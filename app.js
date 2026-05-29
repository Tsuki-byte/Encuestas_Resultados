// --- CONFIGURATION ---
const SUPABASE_URL = 'https://bjbhbdcueiyjtifvcxcg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqYmhiZGN1ZWl5anRpZnZjeGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTA4NDAsImV4cCI6MjA5MTE2Njg0MH0.iCi7FWXBzOfkwqjK_0G8ChkNIyY2ixH-h5d-NvcM-DY';
const RETURN_URL = 'https://granteatroelectrico.unizar.es';

console.log('Script app.js cargado correctamente');

// Initialize Supabase
let supabaseClient = null;
try {
    if (SUPABASE_URL && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Cliente de Supabase inicializado');
    } else {
        console.warn('Supabase no configurado. Ejecutando en modo demo.');
    }
} catch (e) {
    console.error('Fallo al inicializar Supabase:', e);
}

// --- DATA ---
const questions = [
    {
        id: 'q1',
        type: 'rating',
        text: '¿Qué te ha parecido la estética "steampunk" de la exposición?',
        min: 1,
        max: 5
    },
    {
        id: 'q2',
        type: 'choice',
        text: '¿Cuál de estas máquinas o experimentos te ha sorprendido más?',
        options: [
            'Bola de Plasma',
            'Máquina de Wimshurt',
            'Generador de Marx',
            'Transferencia Inalámbrica',
            'Bobina de Tesla',
            'Coche Eléctrico',
            'Levitador de Haslett',
            'Levitador de Ayrton',
            'Motor Solar Mendocino',
            'Lifter'
        ]
    },
    {
        id: 'q3',
        type: 'boolean',
        text: '¿La explicación sobre el electromagnetismo te ha resultado clara y comprensible?',
        options: ['Sí', 'No']
    },
    {
        id: 'q4',
        type: 'rating',
        text: '¿Cómo calificarías el nivel de interactividad de los experimentos?',
        min: 1,
        max: 5
    },
    {
        id: 'q5',
        type: 'boolean',
        text: '¿Has utilizado las audioguías disponibles mediante los códigos QR?',
        options: ['Sí', 'No']
    },
    {
        id: 'q6',
        type: 'rating',
        text: '¿Crees que este formato de "espectáculo" facilita el aprendizaje de la ciencia?',
        min: 1,
        max: 5
    },
    {
        id: 'q7',
        type: 'text',
        text: '¿Cuál ha sido tu experimento o momento favorito de la visita?',
        placeholder: 'Escribe aquí tu respuesta...'
    },
    {
        id: 'q8',
        type: 'boolean',
        text: '¿Habías asistido anteriormente a algún evento del Grupo EDEMUZ?',
        options: ['Sí', 'No']
    },
    {
        id: 'q9',
        type: 'boolean',
        text: '¿Recomendarías "Gran Espectáculo Eléctrico" a tus amigos o familiares?',
        options: ['Sí', 'No']
    },
    {
        id: 'q10',
        type: 'textarea',
        text: '¿Tienes alguna otra sugerencia para futuros espectáculos eléctricos?',
        placeholder: 'Tu opinión nos ayuda a mejorar...'
    }
];

// --- STATE ---
let currentStep = 0;
let userEmail = '';
let marketingConsent = false;
let userAnswers = {};

// --- ELEMENTS ---
const screens = {
    welcome: document.getElementById('welcome-screen'),
    survey: document.getElementById('survey-screen'),
    success: document.getElementById('success-screen')
};

const emailInput = document.getElementById('user-email');
const marketingConsentInput = document.getElementById('marketing-consent');
const emailError = document.getElementById('email-error');
const startBtn = document.getElementById('start-btn');
const questionContainer = document.getElementById('question-container');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const progressBar = document.getElementById('progress');
const returnBtn = document.getElementById('return-btn');

// --- FUNCTIONS ---

function showScreen(screenId) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenId].classList.add('active');
}

async function checkEmailExists(email) {
    // Ya no hacemos esta consulta al servidor porque RLS la bloquea por seguridad.
    // La verificacion ocurrrira al final: Si el email está duplicado, Supabase nos 
    // devolverá un error (código 23505) en la inserción final que capturaremos allí.
    return false;
}

async function startSurvey() {
    try {
        console.log('Iniciando encuesta para:', emailInput.value);
        userEmail = emailInput.value.trim();
        if (!userEmail) {
            alert('Por favor, introduce un correo electrónico válido.');
            return;
        }

        marketingConsent = marketingConsentInput.checked;

        startBtn.disabled = true;
        startBtn.innerText = 'Cargando...';

        console.log('Comprobando si el email existe en la base de datos...');
        const exists = await checkEmailExists(userEmail);
        console.log('¿El email ya existe?:', exists);

        if (exists) {
            emailError.style.display = 'block';
            alert('Este correo electrónico ya ha completado la encuesta. Solo se permite una respuesta por persona.');
            startBtn.disabled = false;
            startBtn.innerText = 'Comenzar Encuesta';
            return;
        }

        emailError.style.display = 'none';
        showScreen('survey');
        renderQuestion();
    } catch (error) {
        console.error('Error fatal al iniciar la encuesta:', error);
        alert('Error al conectar con Supabase. Revisa la consola del navegador (F12) para más detalles.');
        startBtn.disabled = false;
        startBtn.innerText = 'Comenzar Encuesta';
    }
}

function renderQuestion() {
    const question = questions[currentStep];
    let html = `
        <div class="question-item">
            <p class="question-text">${currentStep + 1}. ${question.text}</p>
            <div class="options-container">
    `;

    if (question.type === 'rating') {
        html += `<div class="rating-group">`;
        for (let i = question.min; i <= question.max; i++) {
            const selectedClass = userAnswers[question.id] == i ? 'selected' : '';
            html += `<button class="rating-btn ${selectedClass}" onclick="selectAnswer('${question.id}', '${i}')">${i}</button>`;
        }
        html += `</div>`;
    } else if (question.type === 'boolean' || question.type === 'choice') {
        html += `<div class="options-grid">`;
        question.options.forEach(opt => {
            const selectedClass = userAnswers[question.id] === opt ? 'selected' : '';
            html += `
                <button class="option-btn ${selectedClass}" onclick="selectAnswer('${question.id}', '${opt}')">
                    <span class="option-circle"></span>
                    ${opt}
                </button>
            `;
        });
        html += `</div>`;
    } else if (question.type === 'text') {
        html += `<input type="text" placeholder="${question.placeholder}" value="${userAnswers[question.id] || ''}" oninput="selectAnswer('${question.id}', this.value)">`;
    } else if (question.type === 'textarea') {
        html += `<textarea rows="4" placeholder="${question.placeholder}" oninput="selectAnswer('${question.id}', this.value)">${userAnswers[question.id] || ''}</textarea>`;
    }

    html += `</div></div>`;
    questionContainer.innerHTML = html;

    updateProgress();
    updateNavButtons();
}

function selectAnswer(questionId, value) {
    userAnswers[questionId] = value;

    // Smooth auto-next for choice/rating
    const question = questions[currentStep];
    if (question.type === 'rating' || question.type === 'boolean' || question.type === 'choice') {
        // Re-render to show selection
        renderQuestion();

        // Delay slightly for visual feedback
        setTimeout(() => {
            if (currentStep < questions.length - 1) {
                // currentStep++;
                // renderQuestion();
            }
        }, 300);
    }
}

function updateProgress() {
    const percent = ((currentStep + 1) / questions.length) * 100;
    progressBar.style.width = `${percent}%`;
}

function updateNavButtons() {
    prevBtn.disabled = currentStep === 0;

    if (currentStep === questions.length - 1) {
        nextBtn.innerText = 'Enviar Encuesta';
    } else {
        nextBtn.innerText = 'Siguiente';
    }
}

function handleNext() {
    // Basic validation
    const question = questions[currentStep];
    if (!userAnswers[question.id]) {
        alert('Por favor, responde la pregunta antes de continuar.');
        return;
    }

    if (currentStep < questions.length - 1) {
        currentStep++;
        renderQuestion();
    } else {
        submitSurvey();
    }
}

function handlePrev() {
    if (currentStep > 0) {
        currentStep--;
        renderQuestion();
    }
}

async function submitSurvey() {
    nextBtn.disabled = true;
    nextBtn.innerText = 'Enviando...';

    if (!supabaseClient) {
        console.log('Demo Mode: Survey data:', { userEmail, marketingConsent, userAnswers });
        setTimeout(() => showScreen('success'), 1000);
        return;
    }

    try {
        // 0. Pre-generar el ID de la respuesta para no tener que pedírselo a la base de datos
        const responseId = window.crypto.randomUUID();

        // 1. Create response record (sin select al final porque RLS nos lo bloquea)
        const { error: responseError } = await supabaseClient
            .from('responses')
            .insert({ 
                id: responseId,
                email: userEmail,
                marketing_consent: marketingConsent
            });

        if (responseError) {
            // Manejamos el caso en que el email ya estaba registrado
            if (responseError.code === '23505') {
                alert('Este correo electrónico ya ha completado la encuesta. Solo se permite una respuesta por persona.');
                nextBtn.disabled = false;
                nextBtn.innerText = 'Enviar Encuesta';
                return;
            }
            throw responseError;
        }

        // 2. Insert answers
        const answersToInsert = Object.entries(userAnswers).map(([qId, val]) => ({
            response_id: responseId,
            question_id: qId,
            value: val.toString()
        }));

        const { error: answersError } = await supabaseClient
            .from('answers')
            .insert(answersToInsert);

        if (answersError) throw answersError;

        // 3. Send confirmation email (Edge Function)
        try {
            console.log('Enviando email de confirmación...');
            await supabaseClient.functions.invoke('send-confirmation', {
                body: { email: userEmail },
            });
            console.log('Email enviado correctamente.');
        } catch (emailErr) {
            console.warn('Error al enviar el email, pero los datos se guardaron:', emailErr);
        }

        showScreen('success');

    } catch (err) {
        console.error('Error submitting survey:', err);
        // Mostramos el mensaje de error específico para diagnóstico
        const detail = err.message || JSON.stringify(err);
        alert('Hubo un error al enviar tu encuesta: ' + detail);
        nextBtn.disabled = false;
        nextBtn.innerText = 'Enviar Encuesta';
    }
}

// --- EVENTS ---

startBtn.addEventListener('click', startSurvey);
prevBtn.addEventListener('click', handlePrev);
nextBtn.addEventListener('click', handleNext);
returnBtn.addEventListener('click', () => {
    window.location.href = RETURN_URL;
});

// Allow Enter key to start
emailInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startSurvey();
});

// Clear error on type
emailInput.addEventListener('input', () => {
    emailError.style.display = 'none';
});

// Cancel and Exit Logic
document.querySelectorAll('.btn-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres salir? Se perderán tus respuestas.')) {
            window.location.href = RETURN_URL;
        }
    });
});
