import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.2.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { exposicion_id } = await req.json()
    if (!exposicion_id) throw new Error('Missing exposicion_id parameter')

    // Create a Supabase client with the Auth context of the logged in user.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Verify user is logged in
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    // Fetch responses for this exhibition
    const { data: responses, error: rError } = await supabaseClient
      .from('responses')
      .select('id')
      .eq('exposicion_id', exposicion_id)

    if (rError) throw rError

    if (!responses || responses.length === 0) {
      return new Response(JSON.stringify({ summary: 'No hay respuestas registradas para esta exposición todavía. La IA no tiene datos que analizar.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const responseIds = responses.map(r => r.id)

    // Fetch answers for these responses
    const { data: answers, error: aError } = await supabaseClient
      .from('answers')
      .select('question_id, value')
      .in('response_id', responseIds)

    if (aError) throw aError

    // Prepare data for OpenAI
    // We will summarize the data into a prompt
    const q1Stats = answers.filter(a => a.question_id === 'q1').map(a => parseInt(a.value))
    const avgEstetica = q1Stats.length > 0 ? (q1Stats.reduce((a, b) => a + b, 0) / q1Stats.length).toFixed(1) : 0
    
    const q4Stats = answers.filter(a => a.question_id === 'q4').map(a => parseInt(a.value))
    const avgInteract = q4Stats.length > 0 ? (q4Stats.reduce((a, b) => a + b, 0) / q4Stats.length).toFixed(1) : 0

    const q6Stats = answers.filter(a => a.question_id === 'q6').map(a => parseInt(a.value))
    const avgEducacion = q6Stats.length > 0 ? (q6Stats.reduce((a, b) => a + b, 0) / q6Stats.length).toFixed(1) : 0

    const recommendations = answers.filter(a => a.question_id === 'q9' && a.value === 'Sí').length
    const recommendRate = responses.length > 0 ? Math.round((recommendations / responses.length) * 100) : 0

    const favoriteMachines = answers.filter(a => a.question_id === 'q2').map(a => a.value)
    
    // Group machines to find the most popular
    const machineCounts = favoriteMachines.reduce((acc, curr) => {
      acc[curr] = (acc[curr] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    const topMachine = Object.keys(machineCounts).sort((a, b) => machineCounts[b] - machineCounts[a])[0] || 'Ninguna'

    const openComments = answers.filter(a => a.question_id === 'q3' && a.value.trim().length > 0).map(a => a.value)

    const prompt = `Eres un asistente experto analizando datos de encuestas de museos y exposiciones científicas/tecnológicas.
    Analiza los siguientes resultados de una exposición:
    - Total de respuestas: ${responses.length}
    - Puntuación media en Estética: ${avgEstetica} sobre 5
    - Puntuación media en Interactividad: ${avgInteract} sobre 5
    - Puntuación media en Valor Educativo: ${avgEducacion} sobre 5
    - Tasa de Recomendación: ${recommendRate}%
    - La máquina o invento favorito ha sido: ${topMachine}
    - Aquí hay algunos comentarios abiertos de los visitantes: ${openComments.slice(0, 10).join(' | ')}
    
    Por favor, escribe un resumen ejecutivo de unas 10 líneas, amigable pero profesional, destacando los puntos fuertes de la exposición y mencionando áreas de mejora si las hay según los comentarios y puntuaciones. Usa formato de texto claro (puedes usar listas cortas).`

    // Call OpenAI
    const configuration = new Configuration({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    })
    const openai = new OpenAIApi(configuration)

    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo', // or gpt-4
      messages: [{ role: 'system', content: 'Eres un analista de datos de museos.' }, { role: 'user', content: prompt }],
      max_tokens: 400,
    })

    const summary = completion.data.choices[0].message?.content || 'No se pudo generar el resumen.'

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
