// --- CONFIGURATION ---
const SUPABASE_URL = 'https://bjbhbdcueiyjtifvcxcg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqYmhiZGN1ZWl5anRpZnZjeGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTA4NDAsImV4cCI6MjA5MTE2Njg0MH0.iCi7FWXBzOfkwqjK_0G8ChkNIyY2ixH-h5d-NvcM-DY';
const ADMIN_PASSWORD = 'GEE_ADMIN_2024'; // TODO: Change this as needed

const questions = [
    { id: 'q1', type: 'rating', text: '¿Qué te ha parecido la estética "steampunk" de la exposición?' },
    { id: 'q2', type: 'choice', text: '¿Cuál de estas máquinas o experimentos te ha sorprendido más?' },
    { id: 'q3', type: 'boolean', text: '¿La explicación sobre el electromagnetismo te ha resultado clara y comprensible?' },
    { id: 'q4', type: 'rating', text: '¿Cómo calificarías el nivel de interactividad de los experimentos?' },
    { id: 'q5', type: 'boolean', text: '¿Has utilizado las audioguías disponibles mediante los códigos QR?' },
    { id: 'q6', type: 'rating', text: '¿Crees que este formato de "espectáculo" facilita el aprendizaje de la ciencia?' },
    { id: 'q7', type: 'text', text: '¿Cuál ha sido tu experimento o momento favorito de la visita?' },
    { id: 'q8', type: 'boolean', text: '¿Habías asistido anteriormente a algún evento del Grupo EDEMUZ?' },
    { id: 'q9', type: 'boolean', text: '¿Recomendarías "Gran Espectáculo Eléctrico" a tus amigos o familiares?' },
    { id: 'q10', type: 'textarea', text: '¿Tienes alguna otra sugerencia para futuros espectáculos eléctricos?' }
];

// Initialize Supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State
let allResponses = [];
let allAnswers = [];
let filteredResponses = [];
let charts = {};

// Elements
const totalResponsesEl = document.getElementById('total-responses');
const avgSatisfactionEl = document.getElementById('avg-satisfaction');
const recommendRateEl = document.getElementById('recommend-rate');
const audioguideRateEl = document.getElementById('audioguide-rate');
const recurringRateEl = document.getElementById('recurring-rate');
const responsesBody = document.getElementById('responses-body');
const exportBtn = document.getElementById('export-csv');
const refreshBtn = document.getElementById('refresh-data');
const modal = document.getElementById('details-modal');
const modalContent = document.getElementById('modal-details-content');
const closeModal = document.querySelector('.close-modal');

// Filters
const dateFromInput = document.getElementById('date-from');
const dateToInput = document.getElementById('date-to');
const clearFiltersBtn = document.getElementById('clear-filters');

// Auth Elements
const loginOverlay = document.getElementById('login-overlay');
const loginBtn = document.getElementById('login-btn');
const passInput = document.getElementById('admin-pass');
const loginError = document.getElementById('login-error');

// --- AUTH LOGIC ---

function checkAuth() {
    if (localStorage.getItem('gee_admin_auth') === 'true') {
        unlock();
    }
}

function login() {
    if (passInput.value === ADMIN_PASSWORD) {
        localStorage.setItem('gee_admin_auth', 'true');
        unlock();
    } else {
        loginError.style.display = 'block';
        passInput.style.borderColor = '#ff4d4d';
    }
}

function unlock() {
    loginOverlay.style.display = 'none';
    document.body.classList.remove('locked');
    fetchData();
}

// --- DATA FETCHING ---

async function fetchData() {
    try {
        console.log('Fetching data from Supabase...');
        
        // Fetch responses
        const { data: responses, error: rError } = await supabaseClient
            .from('responses')
            .select('*')
            .order('created_at', { ascending: false });

        if (rError) throw rError;
        allResponses = responses;

        // Fetch answers
        const { data: answers, error: aError } = await supabaseClient
            .from('answers')
            .select('*');

        if (aError) throw aError;
        allAnswers = answers;

        applyFilters();
    } catch (err) {
        console.error('Error loading data:', err);
        alert('Error al cargar datos de Supabase. Revisa la consola.');
    }
}

// --- FILTERING ---

function applyFilters() {
    const from = dateFromInput.value ? new Date(dateFromInput.value) : null;
    const to = dateToInput.value ? new Date(dateToInput.value) : null;
    
    // Set 'to' to end of day
    if (to) to.setHours(23, 59, 59, 999);

    filteredResponses = allResponses.filter(resp => {
        const date = new Date(resp.created_at);
        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
    });

    processAndRender();
}

function resetFilters() {
    dateFromInput.value = '';
    dateToInput.value = '';
    applyFilters();
}

// --- PROCESSING ---

function processAndRender() {
    updateKPIs();
    renderCharts();
    renderTable();
}

function updateKPIs() {
    totalResponsesEl.innerText = filteredResponses.length;
    
    // Get answers for filtered responses
    const filteredRespIds = new Set(filteredResponses.map(r => r.id));
    const filteredAnswers = allAnswers.filter(a => filteredRespIds.has(a.response_id));
    const totalCount = filteredResponses.length;

    // 1. Average satisfaction (q1)
    const q1Answers = filteredAnswers.filter(a => a.question_id === 'q1').map(a => parseInt(a.value));
    const avg = q1Answers.length > 0 
        ? (q1Answers.reduce((a, b) => a + b, 0) / q1Answers.length).toFixed(1)
        : '0.0';
    avgSatisfactionEl.innerText = avg;

    // 2. Recommend Rate (q9)
    const q9Yes = filteredAnswers.filter(a => a.question_id === 'q9' && a.value === 'Sí').length;
    recommendRateEl.innerText = totalCount > 0 ? Math.round((q9Yes / totalCount) * 100) + '%' : '0%';

    // 3. Audioguide Rate (q5)
    const q5Yes = filteredAnswers.filter(a => a.question_id === 'q5' && a.value === 'Sí').length;
    audioguideRateEl.innerText = totalCount > 0 ? Math.round((q5Yes / totalCount) * 100) + '%' : '0%';

    // 4. Recurring Audience (q8)
    const q8Yes = filteredAnswers.filter(a => a.question_id === 'q8' && a.value === 'Sí').length;
    recurringRateEl.innerText = totalCount > 0 ? Math.round((q8Yes / totalCount) * 100) + '%' : '0%';
}

function renderCharts() {
    // Destroy existing charts if any
    Object.values(charts).forEach(chart => chart.destroy());

    const filteredRespIds = new Set(filteredResponses.map(r => r.id));
    const currentAnswers = allAnswers.filter(a => filteredRespIds.has(a.response_id));

    // 1. Satisfaction Chart (q1)
    renderDistributionChart('satisfactionChart', 'q1', [1,2,3,4,5], '#d4a75c', 'bar', currentAnswers);
    
    // 2. Machines Chart (q2)
    const machines = [
        'Bola de Plasma', 'Máquina de Wimshurt', 'Generador de Marx', 
        'Transferencia Inalámbrica', 'Bobina de Tesla', 'Coche Eléctrico', 
        'Levitador de Haslett', 'Levitador de Ayrton', 'Motor Solar Mendocino', 'Lifter'
    ];
    renderDistributionChart('machinesChart', 'q2', machines, '#4d94ff', 'bar', currentAnswers);

    // 3. Interactivity (q4)
    renderDistributionChart('interactivityChart', 'q4', [1,2,3,4,5], '#ff4d4d', 'bar', currentAnswers);

    // 4. Educational (q6)
    renderDistributionChart('educationChart', 'q6', [1,2,3,4,5], '#4dff88', 'bar', currentAnswers);

    // 5. Averages Comparison Chart
    renderAveragesComparisonChart(currentAnswers);
}

function renderAveragesComparisonChart(dataPool) {
    const questionsToCompare = [
        { id: 'q1', label: 'Estética' },
        { id: 'q4', label: 'Interactividad' },
        { id: 'q6', label: 'Educación' }
    ];

    const averages = questionsToCompare.map(q => {
        const vals = dataPool.filter(a => a.question_id === q.id).map(a => parseInt(a.value));
        return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 0;
    });

    const ctx = document.getElementById('averagesChart').getContext('2d');
    charts['averagesChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: questionsToCompare.map(q => q.label),
            datasets: [{
                label: 'Promedio (1-5)',
                data: averages,
                backgroundColor: ['#d4a75c88', '#ff4d4d88', '#4dff8888'],
                borderColor: ['#d4a75c', '#ff4d4d', '#4dff88'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 5,
                    ticks: { color: '#a0a0a0' },
                    grid: { color: '#333' }
                },
                x: {
                    ticks: { color: '#a0a0a0' },
                    grid: { display: false }
                }
            }
        }
    });
}

function renderDistributionChart(canvasId, qId, labels, color, type, dataPool) {
    const counts = labels.map(label => {
        return dataPool.filter(a => a.question_id === qId && a.value == label).length;
    });

    const ctx = document.getElementById(canvasId).getContext('2d');
    charts[canvasId] = new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: 'Respuestas',
                data: counts,
                backgroundColor: color + '44',
                borderColor: color,
                borderWidth: 2,
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: type === 'bar' && labels.length > 5 ? 'y' : 'x',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#a0a0a0', stepSize: 1 },
                    grid: { color: '#333' }
                },
                x: {
                    ticks: { color: '#a0a0a0' },
                    grid: { display: false }
                }
            }
        }
    });
}

function renderTable() {
    responsesBody.innerHTML = filteredResponses.map(resp => {
        const date = new Date(resp.created_at).toLocaleDateString();
        const rAnswers = allAnswers.filter(a => a.response_id === resp.id);
        const q1 = rAnswers.find(a => a.question_id === 'q1')?.value || '-';
        const q2 = rAnswers.find(a => a.question_id === 'q2')?.value || '-';
        const q3 = rAnswers.find(a => a.question_id === 'q3')?.value || '-';
        
        return `
            <tr>
                <td>${date}</td>
                <td>${resp.email}</td>
                <td>${q1}</td>
                <td>${q2}</td>
                <td>${q3}</td>
                <td><button class="btn-details" onclick="showDetails('${resp.id}')">Ver todo</button></td>
            </tr>
        `;
    }).join('');
}

// --- ACTIONS ---

window.showDetails = (responseId) => {
    const resp = allResponses.find(r => r.id === responseId);
    const rAnswers = allAnswers.filter(a => a.response_id === responseId);
    
    let html = `<div style="margin-bottom: 20px;"><strong>Email:</strong> ${resp.email}<br><strong>Fecha:</strong> ${new Date(resp.created_at).toLocaleString()}</div>`;
    
    questions.forEach(q => {
        const ans = rAnswers.find(a => a.question_id === q.id);
        html += `
            <div class="detail-item">
                <span class="detail-q">${q.text}</span>
                <span class="detail-a">${ans ? ans.value : '<em>Sin respuesta</em>'}</span>
            </div>
        `;
    });

    modalContent.innerHTML = html;
    modal.style.display = 'block';
};

function exportToCSV() {
    if (filteredResponses.length === 0) return;

    // Header
    let csv = 'Fecha,Email,' + questions.map(q => `"${q.text}"`).join(',') + '\n';

    // Rows
    filteredResponses.forEach(resp => {
        let row = [
            new Date(resp.created_at).toLocaleString(),
            resp.email
        ];
        
        questions.forEach(q => {
            const ans = allAnswers.find(a => a.response_id === resp.id && a.question_id === q.id);
            let val = ans ? ans.value : '';
            val = val.replace(/"/g, '""');
            row.push(`"${val}"`);
        });
        
        csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `encuestas_gee_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- EVENTS ---

loginBtn.addEventListener('click', login);
passInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') login(); });

dateFromInput.addEventListener('change', applyFilters);
dateToInput.addEventListener('change', applyFilters);
clearFiltersBtn.addEventListener('click', resetFilters);

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
        
        item.classList.add('active');
        const target = item.getAttribute('href').substring(1);
        document.getElementById(target).classList.add('active');
    });
});

closeModal.onclick = () => modal.style.display = 'none';
window.onclick = (e) => { if (e.target == modal) modal.style.display = 'none'; };

refreshBtn.addEventListener('click', fetchData);
exportBtn.addEventListener('click', exportToCSV);

// Initial Load
checkAuth();
