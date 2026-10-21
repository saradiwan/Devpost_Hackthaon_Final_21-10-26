
const $ = id => document.getElementById(id);

const state = {
    pressure: 5.2,
    flow: 128,
    salinity: 420,
    attack: false,
    events: [],
    samples: [],
    backend: false,
    last: null,
    liveWater: null,
    liveError: null
};

let toastTimer;

function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function addEvent(title, desc, type = 'amber', tag = 'SYSTEM') {
    state.events.unshift({ title, desc, type, tag, time: new Date() });
    state.events = state.events.slice(0, 9);
    renderEvents();
}

function renderEvents() {
    const el = $('events');

    el.innerHTML = state.events.map(e => `
        <div class="event">
            <span class="eventmark ${
                e.type === 'red' ? 'redmark' :
                e.type === 'green' ? 'greenmark' : 'ambermark'
            }">${
                e.type === 'red' ? '!' :
                e.type === 'green' ? '✓' : '•'
            }</span>
            <div>
                <b>${e.title}</b>
                <p>${e.desc}</p>
                <small>${e.time.toLocaleTimeString()} · ${e.tag}</small>
            </div>
        </div>
    `).join('') || '<p class="muted">No events in this view.</p>';

    const count = state.events.filter(e => e.type !== 'green').length;
    $('navIncidents').textContent = count;
    $('alertCount').textContent = String(count).padStart(2, '0');
}

function reading() {
    const rand = (a, b) => a + Math.random() * (b - a);

    let p = rand(4.85, 5.45);
    let f = rand(119, 136);
    let s = rand(390, 450);

    if (state.attack) {
        p = rand(7.3, 8.6);
        f = rand(80, 95);
        s = rand(600, 720);
    }

    return {
        pressure: +p.toFixed(2),
        flow: +f.toFixed(1),
        salinity: Math.round(s),
        timestamp: new Date().toISOString()
    };
}

async function infer(d) {
    try {
        const response = await fetch('http://127.0.0.1:8000/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(d),
            signal: AbortSignal.timeout(1800)
        });

        if (!response.ok) throw new Error('ML backend unavailable');

        const result = await response.json();

        state.backend = true;
        $('mode').textContent = 'Python · Isolation Forest';
        $('connection').textContent = 'ML backend connected';

        return result;
    } catch (error) {
        state.backend = false;
        $('mode').textContent = 'Browser fallback';
        $('connection').textContent = 'Demo mode · local';

        const anomalous =
            d.pressure < 4.4 ||
            d.pressure > 6.1 ||
            d.flow < 105 ||
            d.flow > 150 ||
            d.salinity > 540;

        return {
            anomaly: anomalous,
            score: anomalous ? 0.88 : 0.12,
            prediction: anomalous ? 'ANOMALY' : 'NORMAL',
            model: 'Statistical fallback'
        };
    }
}

/* REAL PUBLIC DATA: fetched through our FastAPI backend. */
async function fetchLiveWater() {
    try {
        const response = await fetch(
            'http://127.0.0.1:8000/live-water',
            {
                cache: 'no-store',
                signal: AbortSignal.timeout(12000)
            }
        );

        if (!response.ok) {
            throw new Error('USGS feed unavailable');
        }

        const data = await response.json();

        if (data.status !== 'ok' || !Number.isFinite(Number(data.value))) {
            throw new Error('No valid water observation returned');
        }

        state.liveWater = data;
        state.liveError = null;

        $('connection').textContent = state.backend
            ? 'ML connected · USGS feed connected'
            : 'USGS feed connected · ML fallback';

        updateLiveWaterRow();

    } catch (error) {
        state.liveError = error.message;

        $('connection').textContent = state.liveWater
            ? 'USGS last observation · refresh failed'
            : 'USGS feed unavailable · retrying';

        updateLiveWaterRow();
    }
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

/* Adds the real observation to the existing table without changing its design. */
function updateLiveWaterRow() {
    const table = $('sensorRows');
    if (!table) return;

    const previous = table.querySelector('[data-live-water="true"]');
    if (previous) previous.remove();

    const row = document.createElement('tr');
    row.dataset.liveWater = 'true';

    const data = state.liveWater;

    if (data) {
        const observed = data.observed_at
            ? new Date(data.observed_at).toLocaleString()
            : 'Timestamp unavailable';

        row.innerHTML = `
            <td>
                USGS-01646500
                <small>Real river streamflow</small>
            </td>
            <td>
                ${Number(data.value).toLocaleString(undefined, {
                    maximumFractionDigits: 2
                })} ${escapeHTML(data.unit || 'ft³/s')}
                <small>${escapeHTML(observed)}</small>
            </td>
            <td><span class="status ok">Public data</span></td>
        `;
    } else {
        row.innerHTML = `
            <td>USGS public feed<small>Real river streamflow</small></td>
            <td>Unavailable<small>Waiting for next refresh</small></td>
            <td><span class="status bad">Offline</span></td>
        `;
    }

    table.appendChild(row);

    // Keep the existing badge consistent with the extra public-data row.
    const inventory = $('sensors');
    const badge = inventory?.querySelector('.panelhead .pill');

    if (badge) {
        badge.textContent = data ? '6 SYNTH + LIVE' : '6 SYNTHETIC';
    }

    // Show the source observation time in the existing chart footer.
    if (data) {
        $('lastSample').textContent =
            'USGS observed: ' +
            (data.observed_at
                ? new Date(data.observed_at).toLocaleString()
                : 'time unavailable');
    }
}

async function tick() {
    const d = reading();

    state.last = d;
    state.samples.push(d);

    if (state.samples.length > 30) {
        state.samples.shift();
    }

    const pred = await infer(d);
    const anomaly = !!pred.anomaly;
    const score = Math.max(0, Math.min(1, Number(pred.score) || 0));

    $('score').textContent = score.toFixed(3);
    $('scorebar').style.width = (score * 100) + '%';
    $('scorebar').style.background = anomaly
        ? 'var(--red)'
        : 'var(--green)';

    $('mlStatus').textContent = state.backend
        ? 'ML: Isolation Forest'
        : 'ML: fallback rules';

    $('modelTitle').textContent = anomaly
        ? 'Anomaly detected'
        : 'Pattern within expected range';

    $('modelDesc').textContent = anomaly
        ? 'Unusual synthetic telemetry needs operator review.'
        : 'Latest synthetic reading is within the expected envelope.';

    $('prediction').textContent =
        pred.prediction || (anomaly ? 'ANOMALY' : 'NORMAL');

    $('prediction').style.color = anomaly
        ? 'var(--red)'
        : 'var(--green)';

    $('updated').textContent = new Date().toLocaleTimeString();

    $('posture').textContent = anomaly ? 'INVESTIGATE' : 'MONITORING';
    $('posture').style.color = anomaly ? 'var(--red)' : 'var(--green)';

    $('postureSub').textContent = anomaly
        ? 'Unusual synthetic telemetry detected'
        : 'No critical synthetic anomalies';

    $('health').textContent = anomaly ? '76' : '98';
    $('healthbar').style.width = (anomaly ? 76 : 98) + '%';
    $('healthbar').style.background = anomaly
        ? 'var(--amber)'
        : 'var(--green)';

    // These six readings remain synthetic, just like in your original demo.
    $('sensorRows').innerHTML = [
        ['PT-101', 'Synthetic pressure', d.pressure + ' bar'],
        ['FT-202', 'Synthetic flow rate', d.flow + ' m³/h'],
        ['ST-303', 'Synthetic salinity', d.salinity + ' ppm'],
        [
            'PT-104',
            'Synthetic pressure',
            (d.pressure * (anomaly ? 0.96 : 1.02)).toFixed(2) + ' bar'
        ],
        [
            'FT-205',
            'Synthetic flow rate',
            (d.flow * (anomaly ? 0.94 : 1.03)).toFixed(1) + ' m³/h'
        ],
        ['PU-01', 'Synthetic pump state', anomaly ? 'CHECK' : 'RUN']
    ].map((x, i) => `
        <tr>
            <td>${x[0]}<small>${x[1]}</small></td>
            <td>${x[2]}</td>
            <td>
                <span class="status ${anomaly && i < 3 ? 'bad' : 'ok'}">
                    ${anomaly && i < 3 ? 'Review' : 'Nominal'}
                </span>
            </td>
        </tr>
    `).join('');

    // Re-add the live public measurement after rebuilding the six demo rows.
    updateLiveWaterRow();

    if (
        anomaly &&
        (
            !state.events.length ||
            new Date() - state.events[0].time > 12000 ||
            state.events[0].title !== 'ML anomaly flagged'
        )
    ) {
        addEvent(
            'ML anomaly flagged',
            `Score ${score.toFixed(3)}. Review synthetic sensor context; an anomaly is not proof of an attack.`,
            'red',
            state.backend ? 'ISOLATION FOREST' : 'FALLBACK'
        );
    }

    drawChart();
}

function drawChart() {
    const canvas = $('chart');
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    const key = $('sensor').value;
    const values = state.samples.map(sample => sample[key]);

    if (values.length < 2) return;

    let lo, hi;

    if (key === 'pressure') {
        lo = 4;
        hi = 9;
    } else if (key === 'flow') {
        lo = 70;
        hi = 160;
    } else {
        lo = 300;
        hi = 750;
    }

    const x = i => i / (values.length - 1) * w;
    const y = v => h - ((v - lo) / (hi - lo)) * h;

    ctx.strokeStyle = '#1a3945';
    ctx.lineWidth = 1;

    for (let i = 0; i < 5; i++) {
        const yy = i * h / 4;
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.lineTo(w, yy);
        ctx.stroke();
    }

    const min = key === 'pressure' ? 4.7 : key === 'flow' ? 110 : 350;
    const max = key === 'pressure' ? 5.8 : key === 'flow' ? 145 : 520;

    ctx.fillStyle = '#34d6e510';
    ctx.fillRect(0, y(max), w, y(min) - y(max));

    ctx.beginPath();

    values.forEach((value, i) => {
        if (i) {
            ctx.lineTo(x(i), y(value));
        } else {
            ctx.moveTo(x(i), y(value));
        }
    });

    ctx.strokeStyle = '#34d6e5';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = '#34d6e510';
    ctx.fill();

    const last = values[values.length - 1];

    ctx.beginPath();
    ctx.arc(x(values.length - 1), y(last), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#c8ef76';
    ctx.fill();
}

$('sensor').addEventListener('change', drawChart);

$('attack').addEventListener('click', () => {
    if (state.attack) {
        toast('Attack scenario is already active.');
        return;
    }

    state.attack = true;

    addEvent(
        'Attack scenario injected',
        'Synthetic pressure, flow and salinity readings shifted outside the normal envelope.',
        'red',
        'SIMULATION'
    );

    toast('Synthetic anomaly injected. Watch the ML score and event timeline.');
    tick();
});

$('reset').addEventListener('click', () => {
    state.attack = false;
    state.samples = [];
    state.events = [];

    addEvent(
        'Demo reset',
        'Attack scenario disabled; synthetic normal-range telemetry resumed.',
        'green',
        'SYSTEM'
    );

    toast('Demo reset. Synthetic normal telemetry resumed.');
    tick();
});

$('clearEvents').addEventListener('click', () => {
    state.events = [];
    renderEvents();
});

$('report').addEventListener('click', () => {
    const report = {
        project: 'DesalGuard',
        generated_at: new Date().toISOString(),
        environment: 'Synthetic desalination telemetry plus public USGS river data',
        ml_backend: state.backend
            ? 'Python Isolation Forest'
            : 'Browser statistical fallback',
        latest_synthetic_reading: state.last,
        latest_prediction: $('prediction').textContent,
        anomaly_score: $('score').textContent,
        live_public_water_data: state.liveWater,
        live_feed_error: state.liveError,
        events: state.events.map(e => ({
            title: e.title,
            description: e.desc,
            time: e.time.toISOString(),
            type: e.type
        })),
        caveat: 'USGS data is a public US river observation, not desalination-plant telemetry. The model is trained on synthetic data. Anomaly detection is not proof of a cyberattack. Never connect this prototype to operational equipment.'
    };

    const blob = new Blob(
        [JSON.stringify(report, null, 2)],
        { type: 'application/json' }
    );

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'desalguard-report.json';
    a.click();

    URL.revokeObjectURL(a.href);
    toast('Report exported as JSON.');
});

window.addEventListener('resize', drawChart);

addEvent(
    'Demo initialized',
    'Synthetic sensor stream started. Connecting to the ML backend and public USGS water feed.',
    'green',
    'SYSTEM'
);

tick();
fetchLiveWater();

setInterval(tick, 2500);
setInterval(fetchLiveWater, 60000);
