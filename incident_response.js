
/* DesalGuard Incident Response Module
   Louder audible alarm + existing anomaly detection.
   Defensive demonstration only; not a real plant alarm system. */

(() => {
    'use strict';

    const $ = id => document.getElementById(id);

    let audioContext = null;
    let soundEnabled = true;
    let activeIncident = false;
    let lastAlarmTime = 0;

    const styles = document.createElement('style');
    styles.textContent = `
      #dg-response {
        position: fixed;
        right: 22px;
        bottom: 22px;
        z-index: 9999;
        width: min(340px, calc(100vw - 28px));
        color: #e8f4f7;
        background: #081d28;
        border: 1px solid #28505d;
        border-radius: 14px;
        box-shadow: 0 14px 40px #0008;
        font: 13px/1.5 system-ui, sans-serif;
        overflow: hidden;
      }
      #dg-response * { box-sizing: border-box; }
      #dg-response .dg-head {
        display:flex; align-items:center; gap:10px;
        padding:13px 14px; background:#0d2935;
        border-bottom:1px solid #244653;
      }
      #dg-response .dg-illustration {
        width:43px; height:43px; flex-shrink:0;
      }
      #dg-response .dg-title {
        font-weight:750; font-size:14px; letter-spacing:.2px;
      }
      #dg-response .dg-sub { color:#91aeb8; font-size:11px; }
      #dg-response .dg-dot {
        width:8px; height:8px; border-radius:50%;
        display:inline-block; background:#65d9a0; margin-right:5px;
      }
      #dg-response.dg-alert .dg-dot {
        background:#ff626c; box-shadow:0 0 10px #ff626c;
      }
      #dg-response .dg-body { padding:13px 14px 14px; }
      #dg-response .dg-state {
        color:#72e0ad; font-size:12px; font-weight:800;
        letter-spacing:.7px; margin-bottom:6px;
      }
      #dg-response.dg-alert .dg-state { color:#ff747c; }
      #dg-response .dg-message { color:#d5e4e9; margin-bottom:10px; }
      #dg-response .dg-steps {
        margin:0; padding-left:18px; color:#adc4cc;
      }
      #dg-response .dg-steps li { padding:2px 0; }
      #dg-response .dg-actions {
        display:flex; align-items:center; justify-content:space-between;
        flex-wrap:wrap; gap:8px; margin-top:12px;
      }
      #dg-response button {
        border:1px solid #315562; border-radius:8px;
        color:#eaf8fb; background:#12313e;
        padding:8px 10px; font-size:12px; cursor:pointer;
      }
      #dg-response button:hover { background:#194353; }
      #dg-response #dg-test {
        background:#173c49;
        border-color:#34c9df;
      }
      #dg-response .dg-note {
        color:#7899a5; font-size:10px; margin-top:9px;
      }
      @media (max-width:520px) {
        #dg-response { right:14px; bottom:14px; }
      }
    `;
    document.head.appendChild(styles);

    const panel = document.createElement('section');
    panel.id = 'dg-response';
    panel.setAttribute('aria-live', 'polite');

    panel.innerHTML = `
      <div class="dg-head">
        <svg class="dg-illustration" viewBox="0 0 64 64"
             role="img" aria-label="Industrial water security illustration">
          <defs>
            <linearGradient id="dgWater" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#28c8e3"/>
              <stop offset="1" stop-color="#167a9b"/>
            </linearGradient>
          </defs>
          <path d="M8 52V27L20 20V52M20 52V31L33 24V52M33 52V17H46V52"
                fill="#123b49" stroke="#37c8dc" stroke-width="2"/>
          <path d="M4 52H58" stroke="#638895" stroke-width="3"
                stroke-linecap="round"/>
          <path d="M40 7L51 11V22C51 30 45 34 40 37
                   C35 34 29 30 29 22V11Z"
                fill="#0b2d3a" stroke="#b9ec73" stroke-width="2"/>
          <path d="M35 21L39 25L46 17" fill="none"
                stroke="#b9ec73" stroke-width="2.5"
                stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 43Q14 39 20 43T33 43" fill="none"
                stroke="url(#dgWater)" stroke-width="2"/>
        </svg>
        <div>
          <div class="dg-title">DESALGUARD · RESPONSE</div>
          <div class="dg-sub">
            <span class="dg-dot"></span>
            <span id="dg-connection">Monitoring dashboard</span>
          </div>
        </div>
      </div>

      <div class="dg-body">
        <div class="dg-state" id="dg-state">SYSTEM MONITORING</div>

        <div class="dg-message" id="dg-message">
          Waiting for the dashboard's next ML prediction.
        </div>

        <ol class="dg-steps" id="dg-steps">
          <li>Monitor the incoming sensor readings.</li>
          <li>Compare unusual values with other evidence.</li>
        </ol>

        <div class="dg-actions">
          <button id="dg-test" type="button">🔔 Test Alarm</button>
          <button id="dg-sound" type="button">🔊 Sound: ON</button>
          <button id="dg-ack" type="button">Acknowledge</button>
        </div>

        <div class="dg-note">
          Demo response guidance · No equipment is controlled by this module.
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    function enableAudio() {
        if (!soundEnabled) return false;

        try {
            const AudioCtx =
                window.AudioContext || window.webkitAudioContext;

            if (!AudioCtx) {
                $('dg-connection').textContent =
                    'Audio is not supported in this browser';
                return false;
            }

            if (!audioContext) {
                audioContext = new AudioCtx();
            }

            if (audioContext.state === 'suspended') {
                audioContext.resume().catch(() => {});
            }

            return true;
        } catch (error) {
            console.error('DesalGuard audio error:', error);
            return false;
        }
    }

    // Browser audio must be unlocked by a user interaction.
    document.addEventListener('pointerdown', enableAudio, {
        once: true,
        capture: true
    });

    function beep(frequency, startDelay, duration, volume = 0.75) {
        if (!soundEnabled || !audioContext ||
            audioContext.state !== 'running') {
            return;
        }

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const start = audioContext.currentTime + startDelay;

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(frequency, start);

        // Loud, but keep the oscillator output below maximum gain
        // to reduce harsh clipping.
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(
            volume, start + 0.02
        );
        gain.gain.setValueAtTime(
            volume, start + duration - 0.035
        );
        gain.gain.exponentialRampToValueAtTime(
            0.0001, start + duration
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start(start);
        oscillator.stop(start + duration);
    }

    function playAlarmPattern() {
        if (!soundEnabled) return;

        enableAudio();

        // Wait for audio to resume before playing the pattern.
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                playBeepSequence();
            }).catch(() => {});
            return;
        }

        playBeepSequence();
    }

    function playBeepSequence() {
        if (!soundEnabled || !audioContext ||
            audioContext.state !== 'running') {
            return;
        }

        // High-low-high industrial-style warning pattern.
        beep(1000, 0.00, 0.24, 0.65);
        beep(720, 0.34, 0.24, 0.65);
        beep(1000, 0.68, 0.34, 0.65);
    }

    function alarm() {
        const now = Date.now();

        // Avoid repeating the alarm on every rapid prediction update.
        if (now - lastAlarmTime < 15000) return;

        lastAlarmTime = now;
        playAlarmPattern();
    }

    function setNormal() {
        panel.classList.remove('dg-alert');

        $('dg-state').textContent = 'SYSTEM MONITORING';

        $('dg-message').textContent =
            'Latest prediction is normal. Continue monitoring and validate any unusual readings.';

        $('dg-steps').innerHTML = `
          <li>Continue monitoring the sensor stream.</li>
          <li>Keep the incident history for review.</li>
        `;

        $('dg-connection').textContent = 'No active ML alert';
        $('dg-ack').textContent = 'Acknowledge';
    }

    function setAlert() {
        panel.classList.add('dg-alert');

        $('dg-state').textContent = '⚠ ANOMALY DETECTED';

        $('dg-message').textContent =
            'Unusual demo telemetry detected. This is a possible incident signal, not proof of a cyberattack.';

        $('dg-steps').innerHTML = `
          <li>Verify the affected reading against another sensor.</li>
          <li>Review controller, network and operator logs.</li>
          <li>Notify the authorized OT security team if corroborated.</li>
          <li>Follow the site's approved incident-response procedure.</li>
        `;

        $('dg-connection').textContent = 'Review required';

        if (!activeIncident) {
            alarm();
        }

        activeIncident = true;
    }

    function inspectPrediction() {
        const prediction = $('prediction');
        const title = $('modelTitle');

        if (!prediction || !title) return;

        const predictionText =
            prediction.textContent.trim().toUpperCase();

        const titleText =
            title.textContent.trim().toUpperCase();

        const anomalous =
            predictionText.includes('ANOMALY') ||
            titleText.includes('ANOMALY DETECTED');

        if (anomalous) {
            setAlert();
        } else {
            activeIncident = false;
            setNormal();
        }
    }

    $('dg-test').addEventListener('click', () => {
        if (!soundEnabled) {
            soundEnabled = true;
            $('dg-sound').textContent = '🔊 Sound: ON';
        }

        enableAudio();

        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                playBeepSequence();
            }).catch(() => {
                $('dg-connection').textContent =
                    'Click Test Alarm again to enable audio';
            });
        } else {
            playAlarmPattern();
        }
    });

    $('dg-sound').addEventListener('click', () => {
        soundEnabled = !soundEnabled;

        $('dg-sound').textContent =
            soundEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';

        if (soundEnabled) {
            enableAudio();

            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    beep(850, 0, 0.20, 0.6);
                }).catch(() => {});
            } else {
                beep(850, 0, 0.20, 0.6);
            }
        }
    });

    $('dg-ack').addEventListener('click', () => {
        $('dg-connection').textContent = activeIncident
            ? 'Alert acknowledged · investigation pending'
            : 'Monitoring active';

        $('dg-ack').textContent = activeIncident
            ? 'Acknowledged ✓'
            : 'Monitoring ✓';

        // Acknowledgement does not erase or suppress the alert.
    });

    const targets = [
        $('prediction'),
        $('modelTitle')
    ].filter(Boolean);

    const observer = new MutationObserver(inspectPrediction);

    targets.forEach(target => {
        observer.observe(target, {
            childList: true,
            characterData: true,
            subtree: true
        });
    });

    inspectPrediction();
})();
