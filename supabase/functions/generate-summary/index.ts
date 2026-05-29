import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { exposicion_id } = await req.json()
    if (!exposicion_id) throw new Error('Falta el ID de la exposición')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Falta la cabecera Authorization en la petición')
    const token = authHeader.replace('Bearer ', '')

    // Conectar a Supabase usando el token del administrador actual
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseAnonKey) throw new Error('Faltan las variables SUPABASE_URL o SUPABASE_ANON_KEY')

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: authHeader } } }
    )

    // Validar que el que pide el resumen sea un administrador logueado pasándole el token manualmente
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError) throw new Error('Error al validar sesión: ' + userError.message)
    if (!user) throw new Error('Token inválido o expirado. No autorizado.')

    // Conseguir los IDs de todas las respuestas de esta exposición
    const { data: responses, error: rError } = await supabaseClient
      .from('responses').select('id').eq('exposicion_id', exposicion_id)

    if (rError) throw rError
    if (!responses || responses.length === 0) {
      return new Response(JSON.stringify({ summary: 'No hay respuestas para esta exposición todavía. La IA no tiene datos que analizar.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }})
    }

    const responseIds = responses.map(r => r.id)

    // Conseguir todas las respuestas reales a las preguntas
    const { data: answers, error: aError } = await supabaseClient
      .from('answers').select('question_id, value').in('response_id', responseIds)

    if (aError) throw aError

    // Pre-procesar estadísticas básicas para facilitarle la vida a la IA
    const q1Stats = answers.filter(a => a.question_id === 'q1').map(a => parseInt(a.value))
    const avgEstetica = q1Stats.length > 0 ? (q1Stats.reduce((a, b) => a + b, 0) / q1Stats.length).toFixed(1) : 0
    const recommendations = answers.filter(a => a.question_id === 'q9' && a.value === 'Sí').length
    const recommendRate = responses.length > 0 ? Math.round((recommendations / responses.length) * 100) : 0
    const openComments = answers.filter(a => a.question_id === 'q3' && a.value.trim().length > 0).map(a => a.value)

    const favoriteMachines = answers.filter(a => a.question_id === 'q2').map(a => a.value)
    const machineCounts = favoriteMachines.reduce((acc, curr) => {
      acc[curr] = (acc[curr] || 0) + 1; return acc;
    }, {} as Record<string, number>)
    const topMachine = Object.keys(machineCounts).sort((a, b) => machineCounts[b] - machineCounts[a])[0] || 'Ninguna'

    // Crear el Prompt para Gemini
    const prompt = `Eres un experto analista de datos de encuestas de satisfacción en exposiciones de ciencia y tecnología.
    Se ha realizado una encuesta a los visitantes y estos son los resultados recopilados:
    
    - Total de visitantes encuestados: ${responses.length}
    - Puntuación media en Estética: ${avgEstetica} sobre 5
    - Tasa de Recomendación: ${recommendRate}%
    - Máquina/invento más votado como favorito: ${topMachine}
    
    A continuación se listan TODOS los comentarios y opiniones abiertas dejados por los visitantes en el buzón de sugerencias:
    ${openComments.map(c => `- "${c}"`).join('\n    ')}
    
    Tu tarea es escribir un informe analítico muy completo y detallado para los organizadores de la exposición. 
    Tu análisis debe tener la longitud que consideres necesaria y estar estructurado con títulos claros:
    
    1. **🌟 Recepción General**: Un resumen del éxito y sentimiento general de la exposición.
    2. **🏆 Lo más elogiado**: Las cosas que más han gustado o sorprendido a la gente.
    3. **🗣️ Opiniones Curiosas**: Destaca alguna opinión particular, original o textual que te llame la atención.
    4. **⚠️ Puntos Negativos y Mejoras**: Analiza las críticas más repetidas, lo que menos ha gustado o las sugerencias de mejora que han dejado. No te dejes nada negativo en el tintero, es vital para mejorar.
    5. **🎯 Conclusión**: Un cierre breve con el veredicto final.
    
    Usa formato Markdown (negritas, listas) para que el reporte sea fácil de leer y muy profesional. No escatimes en palabras, haz un análisis profundo.`

    // Llamar a la API de Gemini (Google)
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) throw new Error('Falta la variable de entorno GEMINI_API_KEY')

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.7
        }
      })
    })

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text()
      throw new Error(`Error de Gemini: ${errText}`)
    }

    const geminiJson = await geminiResponse.json()
    const summary = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar el resumen con Gemini.'

    return new Response(JSON.stringify({ summary }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Error interno de la Edge Function:', error.message, error.stack)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
