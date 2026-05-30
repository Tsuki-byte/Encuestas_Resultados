// --- CONFIGURATION ---
const SUPABASE_URL = 'https://bjbhbdcueiyjtifvcxcg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqYmhiZGN1ZWl5anRpZnZjeGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTA4NDAsImV4cCI6MjA5MTE2Njg0MH0.iCi7FWXBzOfkwqjK_0G8ChkNIyY2ixH-h5d-NvcM-DY';

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
let allExpos = [];
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
const exportPdfBtn = document.getElementById('export-pdf');
const refreshBtn = document.getElementById('refresh-data');
const modal = document.getElementById('details-modal');
const modalContent = document.getElementById('modal-details-content');
const closeModal = document.querySelector('.close-modal');

const exposBody = document.getElementById('expos-body');
const expoModal = document.getElementById('expo-modal');
const closeExpoModalBtn = document.getElementById('close-expo-modal');
const btnNewExpo = document.getElementById('btn-new-expo');
const expoForm = document.getElementById('expo-form');

// Filters
const dateFromInput = document.getElementById('date-from');
const dateToInput = document.getElementById('date-to');
const expoFilterInput = document.getElementById('expo-filter');
const clearFiltersBtn = document.getElementById('clear-filters');

// Auth Elements
const loginOverlay = document.getElementById('login-overlay');
const loginBtn = document.getElementById('login-btn');
const emailInput = document.getElementById('admin-email');
const passInput = document.getElementById('admin-pass');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

// --- AUTH LOGIC ---

// --- AUTH LOGIC ---

async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        unlock();
    }
}

async function login() {
    const email = emailInput.value;
    const password = passInput.value;

    if (!email || !password) return;

    loginBtn.innerText = 'Cargando...';
    loginBtn.disabled = true;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });

    loginBtn.innerText = 'Entrar';
    loginBtn.disabled = false;

    if (error) {
        loginError.innerText = error.message.includes('Invalid login') ? 'Credenciales incorrectas' : 'Error: ' + error.message;
        loginError.style.display = 'block';
        passInput.style.borderColor = '#ff4d4d';
        emailInput.style.borderColor = '#ff4d4d';
    } else {
        loginError.style.display = 'none';
        passInput.style.borderColor = '';
        emailInput.style.borderColor = '';
        unlock();
    }
}

async function logout() {
    const { error } = await supabaseClient.auth.signOut();
    if (!error) {
        allResponses = [];
        allAnswers = [];
        filteredResponses = [];
        responsesBody.innerHTML = '';
        loginOverlay.style.display = 'flex';
        document.body.classList.add('locked');
        passInput.value = '';
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

        // Fetch Exposiciones
        const { data: expos, error: eError } = await supabaseClient
            .from('exposiciones')
            .select('*')
            .order('fecha_inicio', { ascending: false });

        if (eError) throw eError;
        allExpos = expos;

        // Populate Expo Filter
        if (expoFilterInput) {
            const currentVal = expoFilterInput.value;
            expoFilterInput.innerHTML = '<option value="">Todas</option>' +
                allExpos.map(e => `<option value="${e.id}">${e.lugar}</option>`).join('');
            expoFilterInput.value = currentVal;
        }

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

    const expoId = expoFilterInput ? expoFilterInput.value : '';

    // Actualizar Panel de Info de la Exposición y Panel de IA
    const infoPanel = document.getElementById('expo-info-panel');
    const aiPanel = document.getElementById('ai-summary-panel');

    if (infoPanel) {
        if (expoId) {
            const expo = allExpos.find(e => e.id === expoId);
            if (expo) {
                document.getElementById('expo-info-title').innerText = expo.lugar;
                document.getElementById('expo-info-dates').innerText = `📅 Desde ${new Date(expo.fecha_inicio).toLocaleDateString()} hasta ${new Date(expo.fecha_fin).toLocaleDateString()}`;

                const expoImage = document.getElementById('expo-info-image');
                const expoImageContainer = document.getElementById('expo-image-container');
                if (expoImage && expoImageContainer) {
                    if (expo.foto_url) {
                        expoImage.src = expo.foto_url;
                        expoImageContainer.style.display = 'block';
                    } else {
                        expoImage.src = '';
                        expoImageContainer.style.display = 'none';
                    }
                }

                let statsHtml = `👥 Visitas totales registradas: <strong>${expo.visitas_totales || 0}</strong>`;
                if (expo.ganador_sorteo) {
                    statsHtml += `<br>🎁 Ganador del Sorteo: <strong style="color: var(--accent);">${expo.ganador_sorteo}</strong>`;
                }
                document.getElementById('expo-info-stats').innerHTML = statsHtml;

                infoPanel.style.display = 'block';
                if (aiPanel) aiPanel.style.display = 'block';

                // Mostrar el contenido del resumen de IA guardado o el texto por defecto
                const aiContent = document.getElementById('ai-summary-content');
                if (aiContent) {
                    if (expo.resumen_ia) {
                        aiContent.innerHTML = marked.parse(expo.resumen_ia);
                    } else {
                        aiContent.innerHTML = '<p style="color: #888; font-style: italic;">Haz clic en el botón para que la Inteligencia Artificial analice las respuestas de esta exposición y genere un resumen automático.</p>';
                    }
                }
            }
        } else {
            infoPanel.style.display = 'none';
            if (aiPanel) aiPanel.style.display = 'none';
        }
    }

    filteredResponses = allResponses.filter(resp => {

        const date = new Date(resp.created_at);
        if (from && date < from) return false;
        if (to && date > to) return false;
        if (expoId && resp.exposicion_id !== expoId) return false;
        return true;
    });

    processAndRender();
}

function resetFilters() {
    dateFromInput.value = '';
    dateToInput.value = '';
    if (expoFilterInput) expoFilterInput.value = '';
    applyFilters();
}

// --- PROCESSING ---

function processAndRender() {
    updateKPIs();
    renderCharts();
    renderTable();
    renderExpos();
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
    renderDistributionChart('satisfactionChart', 'q1', [1, 2, 3, 4, 5], '#d4a75c', 'bar', currentAnswers);

    // 2. Machines Chart (q2)
    const machines = [
        'Bola de Plasma', 'Máquina de Wimshurt', 'Generador de Marx',
        'Transferencia Inalámbrica', 'Bobina de Tesla', 'Coche Eléctrico',
        'Levitador de Haslett', 'Levitador de Ayrton', 'Motor Solar Mendocino', 'Lifter'
    ];
    renderDistributionChart('machinesChart', 'q2', machines, '#4d94ff', 'bar', currentAnswers);

    // 3. Interactivity (q4)
    renderDistributionChart('interactivityChart', 'q4', [1, 2, 3, 4, 5], '#ff4d4d', 'bar', currentAnswers);

    // 4. Educational (q6)
    renderDistributionChart('educationChart', 'q6', [1, 2, 3, 4, 5], '#4dff88', 'bar', currentAnswers);

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
                    ticks: { color: '#a0a0a0', font: { size: 14 } },
                    grid: { color: '#333' }
                },
                x: {
                    ticks: { color: '#a0a0a0', font: { size: 14 } },
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
                    ticks: { color: '#a0a0a0', stepSize: 1, font: { size: 14 } },
                    grid: { color: '#333' }
                },
                x: {
                    ticks: { color: '#a0a0a0', font: { size: 14 } },
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

        const expo = allExpos.find(e => e.id === resp.exposicion_id);
        const expoName = expo ? expo.lugar : 'Sin asignar';

        return `
            <tr>
                <td>${date}</td>
                <td>${resp.email}</td>
                <td><small style="color: #a0a0a0;">${expoName}</small></td>
                <td>${q1}</td>
                <td>${q2}</td>
                <td>${q3}</td>
                <td><button class="btn-details" onclick="showDetails('${resp.id}')">Ver todo</button></td>
            </tr>
        `;
    }).join('');
}

function renderExpos() {
    if (!exposBody) return;
    exposBody.innerHTML = allExpos.map(expo => `
        <tr>
            <td><strong>${expo.lugar}</strong></td>
            <td>${new Date(expo.fecha_inicio).toLocaleDateString()} al ${new Date(expo.fecha_fin).toLocaleDateString()}</td>
            <td>${expo.visitas_totales || '-'}</td>
            <td>
                ${expo.activa ?
            '<span style="color: #4dff88; font-weight: bold; margin-right: 10px;">★ ACTIVA</span>' :
            `<button class="btn-details" style="margin-right: 10px;" onclick="setActivaExpo('${expo.id}')">Activar</button>`
        }
                <button class="btn-details" onclick="editExpo('${expo.id}')">Editar</button>
                <button class="btn-details" style="background: rgba(255, 77, 77, 0.2); color: #ff4d4d;" onclick="deleteExpo('${expo.id}')">Borrar</button>
            </td>
        </tr>
    `).join('');
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

window.editExpo = (id) => {
    const expo = allExpos.find(e => e.id === id);
    if (!expo) return;
    document.getElementById('expo-modal-title').innerText = 'Editar Exposición';
    document.getElementById('expo-id').value = expo.id;
    document.getElementById('expo-lugar').value = expo.lugar;
    document.getElementById('expo-inicio').value = expo.fecha_inicio;
    document.getElementById('expo-fin').value = expo.fecha_fin;
    document.getElementById('expo-visitas').value = expo.visitas_totales || '';
    document.getElementById('expo-publico').value = expo.publico_mayoritario || '';
    document.getElementById('expo-desc').value = expo.descripcion || '';
    document.getElementById('expo-obs').value = expo.observaciones || '';
    document.getElementById('expo-foto').value = expo.foto_url || '';
    document.getElementById('expo-foto-file').value = '';
    document.getElementById('expo-galeria').value = expo.galeria_url || '';

    expoModal.style.display = 'block';
};

window.setActivaExpo = async (id) => {
    // Confirmación opcional
    if (!confirm('¿Marcar esta exposición como la activa? Las nuevas encuestas se vincularán a ella.')) return;

    // Primero, desactivamos todas
    const activas = allExpos.filter(e => e.activa);
    for (let expo of activas) {
        await supabaseClient.from('exposiciones').update({ activa: false }).eq('id', expo.id);
    }

    // Luego, activamos la seleccionada
    const { error } = await supabaseClient.from('exposiciones').update({ activa: true }).eq('id', id);

    if (error) {
        alert('Error al activar exposición: ' + error.message);
    } else {
        fetchData();
    }
};

window.deleteExpo = async (id) => {
    const expo = allExpos.find(e => e.id === id);
    if (!expo) return;

    const confirmacion = prompt(`CUIDADO: Vas a borrar la exposición "${expo.lugar}".\n\nPara confirmar, escribe la palabra BORRAR en mayúsculas:`);

    if (confirmacion !== 'BORRAR') {
        alert('Borrado cancelado.');
        return;
    }

    const { error } = await supabaseClient.from('exposiciones').delete().eq('id', id);
    if (error) {
        alert('Error al borrar: ' + error.message);
    } else {
        fetchData();
    }
};

function exportToCSV() {
    if (filteredResponses.length === 0) return;

    // Header
    let csv = 'Fecha,Email,Exposición,' + questions.map(q => `"${q.text}"`).join(',') + '\n';

    // Rows
    filteredResponses.forEach(resp => {
        const expo = allExpos.find(e => e.id === resp.exposicion_id);
        const expoName = expo ? expo.lugar : 'Sin asignar';

        let row = [
            new Date(resp.created_at).toLocaleString(),
            resp.email,
            `"${expoName}"`
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
emailInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') login(); });
if (logoutBtn) logoutBtn.addEventListener('click', logout);

dateFromInput.addEventListener('change', applyFilters);
dateToInput.addEventListener('change', applyFilters);
if (expoFilterInput) expoFilterInput.addEventListener('change', applyFilters);
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
if (closeExpoModalBtn) closeExpoModalBtn.onclick = () => expoModal.style.display = 'none';

window.onclick = (e) => {
    if (e.target == modal) modal.style.display = 'none';
    if (e.target == expoModal) expoModal.style.display = 'none';
};

if (btnNewExpo) {
    btnNewExpo.addEventListener('click', () => {
        document.getElementById('expo-modal-title').innerText = 'Nueva Exposición';
        expoForm.reset();
        document.getElementById('expo-id').value = '';
        document.getElementById('expo-foto-file').value = '';
        expoModal.style.display = 'block';
    });
}

if (expoForm) {
    expoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('expo-id').value;
        const submitBtn = expoForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerText;
        submitBtn.innerText = 'Guardando...';
        submitBtn.disabled = true;

        let fotoUrl = document.getElementById('expo-foto').value;
        const fotoFile = document.getElementById('expo-foto-file').files[0];

        if (fotoFile) {
            submitBtn.innerText = 'Subiendo imagen...';
            const fileExt = fotoFile.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `portadas/${fileName}`;

            const { error: uploadError } = await supabaseClient.storage
                .from('exposiciones')
                .upload(filePath, fotoFile);

            if (uploadError) {
                alert('Error al subir la imagen: ' + uploadError.message + '\\n(Asegúrate de haber creado el bucket "exposiciones" público en Supabase)');
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                return;
            }

            const { data: publicUrlData } = supabaseClient.storage
                .from('exposiciones')
                .getPublicUrl(filePath);
                
            fotoUrl = publicUrlData.publicUrl;
        }

        const expoData = {
            lugar: document.getElementById('expo-lugar').value,
            fecha_inicio: document.getElementById('expo-inicio').value,
            fecha_fin: document.getElementById('expo-fin').value,
            visitas_totales: parseInt(document.getElementById('expo-visitas').value) || null,
            publico_mayoritario: document.getElementById('expo-publico').value,
            descripcion: document.getElementById('expo-desc').value,
            observaciones: document.getElementById('expo-obs').value,
            foto_url: fotoUrl,
            galeria_url: document.getElementById('expo-galeria').value
        };

        let error;
        if (id) {
            const res = await supabaseClient.from('exposiciones').update(expoData).eq('id', id);
            error = res.error;
        } else {
            const res = await supabaseClient.from('exposiciones').insert([expoData]);
            error = res.error;
        }

        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;

        if (error) {
            alert('Error al guardar: ' + error.message);
        } else {
            expoModal.style.display = 'none';
            fetchData();
        }
    });
}

refreshBtn.addEventListener('click', fetchData);
exportBtn.addEventListener('click', exportToCSV);

if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', exportToPDF);
}

function exportToPDF() {
    // Save current active state
    const statsSection = document.getElementById('stats');
    const responsesSection = document.getElementById('responses');
    const prevStatsActive = statsSection.classList.contains('active');
    const prevRespActive = responsesSection.classList.contains('active');
    
    // Force both sections to be active so Chart.js canvases have physical dimensions
    statsSection.classList.add('active');
    responsesSection.classList.add('active');
    
    // Allow the browser to reflow and Chart.js to resize
    setTimeout(() => {
        window.print();
        
        // Restore original state
        if (!prevStatsActive) statsSection.classList.remove('active');
        if (!prevRespActive) responsesSection.classList.remove('active');
    }, 500);
}

// AI Summary Logic
const btnGenerateAi = document.getElementById('btn-generate-ai');
if (btnGenerateAi) {
    btnGenerateAi.addEventListener('click', async () => {
        const expoId = expoFilterInput ? expoFilterInput.value : '';
        if (!expoId) return alert('Por favor, selecciona una exposición del desplegable primero.');

        const aiContent = document.getElementById('ai-summary-content');
        btnGenerateAi.disabled = true;
        btnGenerateAi.innerHTML = '⏳ Generando resumen (puede tardar un minuto)...';
        aiContent.innerHTML = `<p style="color: #cda8ff; font-style: italic;">Analizando ${filteredResponses.length} respuestas con Inteligencia Artificial...</p>`;

        try {
            // Llamar a la Edge Function de Supabase
            const { data, error } = await supabaseClient.functions.invoke('generate-summary', {
                body: { exposicion_id: expoId }
            });

            if (error) throw error;

            if (data && data.summary) {
                // Guardar el resumen en la base de datos
                await supabaseClient.from('exposiciones').update({ resumen_ia: data.summary }).eq('id', expoId);
                
                // Actualizar la memoria local para no tener que recargar la página
                const expoToUpdate = allExpos.find(e => e.id === expoId);
                if (expoToUpdate) expoToUpdate.resumen_ia = data.summary;

                // marked.parse renders the Markdown to HTML
                aiContent.innerHTML = marked.parse(data.summary);
            } else {
                throw new Error('La IA no devolvió un resumen válido.');
            }
        } catch (err) {
            console.error('Error generando resumen IA:', err);
            aiContent.innerHTML = `<p style="color: #ff4d4d;">❌ Error al conectar con la IA: ${err.message}</p><p style="color: #888; font-size: 0.9rem; margin-top: 10px;">Asegúrate de haber desplegado la función en Supabase y de haber configurado tu GEMINI_API_KEY en los Secrets.</p>`;
        } finally {
            btnGenerateAi.disabled = false;
            btnGenerateAi.innerHTML = '🤖 Generar Resumen';
        }
    });
}

// Raffle Logic
const btnRaffle = document.getElementById('btn-raffle');
const raffleModal = document.getElementById('raffle-modal');
const closeRaffleModal = document.getElementById('close-raffle-modal');
const raffleWinner = document.getElementById('raffle-winner');
const rafflePoolSize = document.getElementById('raffle-pool-size');

if (btnRaffle) {
    btnRaffle.addEventListener('click', () => {
        // Find responses with a valid email and marketing consent in the current filter
        const eligibleResponses = filteredResponses.filter(r =>
            r.email &&
            r.email.trim() !== '' &&
            r.marketing_consent === true
        );

        if (eligibleResponses.length === 0) {
            alert('No hay correos electrónicos válidos registrados para esta exposición.');
            return;
        }

        const expoId = expoFilterInput ? expoFilterInput.value : '';
        const currentExpo = allExpos.find(e => e.id === expoId);

        if (currentExpo && currentExpo.ganador_sorteo) {
            const confirmOverwrite = confirm(`⚠️ ¡ATENCIÓN!\n\nYa se realizó un sorteo para esta exposición y el ganador fue: ${currentExpo.ganador_sorteo}\n\n¿Estás seguro de que quieres realizar un NUEVO sorteo y sobrescribir al ganador anterior?`);
            if (!confirmOverwrite) return;
        }

        // Show modal and start "calculating" animation
        raffleModal.style.display = 'block';
        raffleWinner.innerHTML = 'Mezclando correos... 🎲';
        raffleWinner.style.color = 'var(--text-muted)';
        rafflePoolSize.innerText = `Participantes válidos: ${eligibleResponses.length}`;

        // Add a fun little delay for suspense
        let ticks = 0;
        const interval = setInterval(() => {
            ticks++;
            const randomEmail = eligibleResponses[Math.floor(Math.random() * eligibleResponses.length)].email;
            raffleWinner.innerHTML = randomEmail;

            if (ticks > 15) {
                clearInterval(interval);
                // Pick final winner
                const finalWinner = eligibleResponses[Math.floor(Math.random() * eligibleResponses.length)].email;
                raffleWinner.innerHTML = `🏆 ${finalWinner} 🏆`;
                raffleWinner.style.color = 'var(--accent)';

                // Save winner to Supabase (assuming the column was added)
                const expoId = expoFilterInput ? expoFilterInput.value : '';
                if (expoId) {
                    supabaseClient
                        .from('exposiciones')
                        .update({ ganador_sorteo: finalWinner })
                        .eq('id', expoId)
                        .then(({ error }) => {
                            if (error) {
                                console.warn('No se pudo guardar el ganador (puede que falte la columna ganador_sorteo):', error);
                            } else {
                                console.log('Ganador guardado en la base de datos.');
                                // Refresh data to update UI if needed
                                fetchData();
                            }
                        });
                }
            }
        }, 100);
    });
}

if (closeRaffleModal) {
    closeRaffleModal.addEventListener('click', () => {
        raffleModal.style.display = 'none';
    });
}

// Initial Load
checkAuth();
