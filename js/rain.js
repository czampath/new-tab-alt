;(function () {
    'use strict';

    // CONFIG
    const DELAY_MS = 30_000;
    const FADEIN_MS = 30_000;
    const BASE_ANGLE_DEG = 12;
    const SWAY_AMP_DEG = 4.0;
    const SWAY_PERIOD = 14_000;
    const MICRO_AMP_DEG = 0.8;
    const MICRO_PERIOD = 2_300;
    const WOBBLE_AMP_DEG = 1.5;
    const FRAME_CAP_MS = 1000 / 35;

    const DR = 174;
    const DG = 194;
    const DB = 224;

    const LIGHT_RAIN_PRESET = {
        intensity: 60,
        speed: 350,
        density: 200,
        length: 30,
        sway: 250,
        wobble: 250,
        micro: 100,
    };

    const NON_LIGHT_RAIN_PRESET = {
        intensity: 70,
        speed: 400,
        density: 360,
        length: 130,
        sway: 250,
        wobble: 250,
        micro: 100,
    };

    const BASE_LAYERS = [
        { speed: 2.5, lineW: 0.4, maxOp: 0.06, count: 50, lenMult: 6.5 },
        { speed: 4.5, lineW: 0.7, maxOp: 0.10, count: 40, lenMult: 7.5 },
        { speed: 7.0, lineW: 1.0, maxOp: 0.15, count: 30, lenMult: 8.5 },
        { speed: 10.5, lineW: 1.4, maxOp: 0.22, count: 15, lenMult: 9.5 },
    ];

    const DEG2RAD = Math.PI / 180;

    // STATE
    let canvas;
    let ctx;
    let W = 0;
    let H = 0;
    let layerDrops = BASE_LAYERS.map(() => []);

    let active = false;
    let weatherRainy = false;
    let lastWeatherData = null;
    let testOn = false;

    let startTs = null;
    let activatedAt = 0;
    let masterAlpha = 0;

    let targetLevel = NON_LIGHT_RAIN_PRESET.intensity / 100;
    let speedMult = NON_LIGHT_RAIN_PRESET.speed / 100;
    let densityMult = NON_LIGHT_RAIN_PRESET.density / 100;
    let lengthMult = NON_LIGHT_RAIN_PRESET.length / 100;
    let swayMult = NON_LIGHT_RAIN_PRESET.sway / 100;
    let wobbleMult = NON_LIGHT_RAIN_PRESET.wobble / 100;
    let microMult = NON_LIGHT_RAIN_PRESET.micro / 100;
    let bypassDelayArmed = false;

    let devPanelEl = null;
    let devPanelVisible = false;

    let rafId = null;
    let lastFrameTs = 0;
    let tabVisible = !document.hidden;

    function init() {
        canvas = document.createElement('canvas');
        canvas.id = 'rainCanvas';
        canvas.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;pointer-events:none;z-index:-1;';
        document.body.insertBefore(canvas, document.body.firstChild);

        ctx = canvas.getContext('2d', { alpha: true });

        doResize();
        window.addEventListener('resize', doResize);
        document.addEventListener('visibilitychange', () => {
            tabVisible = !document.hidden;
            if (!tabVisible || !active) return;
            randomizeDropPlacement();
            lastFrameTs = performance.now();
            if (rafId === null) startLoop();
        });

        document.addEventListener('keydown', (e) => {
            if (!(e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd'))) return;
            devPanelVisible = !devPanelVisible;
            if (devPanelEl) devPanelEl.style.display = devPanelVisible ? 'block' : 'none';
            e.preventDefault();
        });

        createDevPanel();
    }

    function doResize() {
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W;
        canvas.height = H;

        layerDrops.forEach((drops) => {
            drops.forEach((d) => {
                d.x = Math.random() * W;
                d.y = Math.random() * H;
            });
        });
    }

    function makeDrops() {
        layerDrops = BASE_LAYERS.map((layer) => {
            const count = Math.max(0, Math.round(layer.count * densityMult));
            const arr = [];
            for (let i = 0; i < count; i++) {
                arr.push(createDrop(layer.speed, layer.lenMult, true));
            }
            return arr;
        });
    }

    function createDrop(speed, lenMultBase, scatter) {
        const baseLen = speed * lenMultBase * (0.65 + Math.random() * 0.7);
        const drop = {
            x: Math.random() * W,
            y: scatter ? Math.random() * H : -(baseLen + 5),
            baseSpeed: speed,
            baseLen,
            sinW: 0,
            cosW: 1,
        };
        applyWobble(drop);
        return drop;
    }

    function applyWobble(drop) {
        const wobbleAmpRad = WOBBLE_AMP_DEG * wobbleMult * DEG2RAD;
        const wobble = (Math.random() - 0.5) * 2 * wobbleAmpRad;
        drop.sinW = Math.sin(wobble);
        drop.cosW = Math.cos(wobble);
    }

    function reapplyAllWobbles() {
        layerDrops.forEach((drops) => {
            for (let i = 0; i < drops.length; i++) applyWobble(drops[i]);
        });
    }

    function randomizeDropPlacement() {
        layerDrops.forEach((drops) => {
            for (let i = 0; i < drops.length; i++) {
                drops[i].x = Math.random() * W;
                drops[i].y = Math.random() * H;
            }
        });
    }

    function startLoop() {
        if (rafId !== null) return;
        lastFrameTs = performance.now();
        rafId = requestAnimationFrame(frame);
    }

    function stopLoop() {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        masterAlpha = 0;
        if (ctx) ctx.clearRect(0, 0, W, H);
    }

    function activateRain() {
        makeDrops();
        const nowPerf = performance.now();
        startTs = bypassDelayArmed ? nowPerf - DELAY_MS : null;
        activatedAt = Date.now();
        bypassDelayArmed = false;
        startLoop();
    }

    function deactivateRain() {
        stopLoop();
    }

    function syncRunState() {
        const shouldRun = weatherRainy || testOn;
        if (shouldRun === active) return;
        active = shouldRun;
        if (active) activateRain();
        else deactivateRain();
    }

    function frame(ts) {
        rafId = requestAnimationFrame(frame);
        if (!tabVisible) return;

        const dt = ts - lastFrameTs;
        if (dt < FRAME_CAP_MS) return;
        lastFrameTs = ts;

        if (startTs === null) startTs = ts;
        const elapsed = ts - startTs;
        if (elapsed < DELAY_MS) {
            masterAlpha = 0;
        } else {
            const t = Math.min((elapsed - DELAY_MS) / FADEIN_MS, 1.0);
            masterAlpha = easeInOutCubic(t);
        }

        const sway = SWAY_AMP_DEG * swayMult * Math.sin(2 * Math.PI * ts / SWAY_PERIOD);
        const micro = MICRO_AMP_DEG * microMult * Math.sin(2 * Math.PI * ts / MICRO_PERIOD + 1.7);
        const angleRad = (BASE_ANGLE_DEG + sway + micro) * DEG2RAD;
        const sinA = Math.sin(angleRad);
        const cosA = Math.cos(angleRad);

        const scale = dt / 16.667;

        ctx.clearRect(0, 0, W, H);
        if (masterAlpha < 0.002) return;

        ctx.lineCap = 'round';

        BASE_LAYERS.forEach((layer, li) => {
            const alpha = layer.maxOp * masterAlpha * targetLevel;
            if (alpha < 0.004) return;

            const drops = layerDrops[li];
            ctx.beginPath();
            ctx.lineWidth = layer.lineW;
            ctx.strokeStyle = `rgba(${DR},${DG},${DB},${alpha.toFixed(3)})`;

            for (let i = 0; i < drops.length; i++) {
                const d = drops[i];

                const sdx = sinA * d.cosW + cosA * d.sinW;
                const cdx = cosA * d.cosW - sinA * d.sinW;

                const speed = d.baseSpeed * speedMult;
                const len = d.baseLen * lengthMult;

                d.x += sdx * speed * scale;
                d.y += cdx * speed * scale;

                const m = len + 10;
                if (d.y > H + m) {
                    d.y = -m;
                    d.x = Math.random() * (W + H * 0.32) - H * 0.14;
                }
                if (d.x > W + m) d.x -= W + m * 2;
                if (d.x < -m) d.x += W + m * 2;

                ctx.moveTo(d.x, d.y);
                ctx.lineTo(d.x - sdx * len, d.y - cdx * len);
            }

            ctx.stroke();
        });
    }

    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function notify(weatherData) {
        lastWeatherData = weatherData;
        weatherRainy = isRainy(weatherData);
        applyWeatherIntensity(weatherData);
        syncRunState();
    }

    function isRainy(wd) {
        if (!wd) return false;
        const prefix = (wd.icon || '').slice(0, 2);
        if (prefix === '09' || prefix === '10' || prefix === '11') return true;
        return /rain|drizzle|shower/i.test(wd.description || '');
    }

    function isLightRain(wd) {
        const desc = String((wd && wd.description) || '').toLowerCase();
        return /drizzle|light\s+rain|small\s+rain|slight\s+rain/.test(desc);
    }

    function applyPreset(panel, preset) {
        targetLevel = preset.intensity / 100;
        speedMult = preset.speed / 100;
        densityMult = preset.density / 100;
        lengthMult = preset.length / 100;
        swayMult = preset.sway / 100;
        wobbleMult = preset.wobble / 100;
        microMult = preset.micro / 100;

        if (panel) {
            setSliderValue(panel, '#rdpSlider', preset.intensity);
            setSliderValue(panel, '#rdpSpeed', preset.speed);
            setSliderValue(panel, '#rdpDensity', preset.density);
            setSliderValue(panel, '#rdpLength', preset.length);
            setSliderValue(panel, '#rdpSway', preset.sway);
            setSliderValue(panel, '#rdpWobble', preset.wobble);
            setSliderValue(panel, '#rdpMicro', preset.micro);

            setText(panel, '#rdpPct', `${preset.intensity}%`);
            setText(panel, '#rdpSpeedPct', `${preset.speed}%`);
            setText(panel, '#rdpDensityPct', `${preset.density}%`);
            setText(panel, '#rdpLengthPct', `${preset.length}%`);
            setText(panel, '#rdpSwayPct', `${preset.sway}%`);
            setText(panel, '#rdpWobblePct', `${preset.wobble}%`);
            setText(panel, '#rdpMicroPct', `${preset.micro}%`);
        }

        makeDrops();
        reapplyAllWobbles();
    }

    function syncPanelFromState(panel) {
        const preset = {
            intensity: Math.round(targetLevel * 100),
            speed: Math.round(speedMult * 100),
            density: Math.round(densityMult * 100),
            length: Math.round(lengthMult * 100),
            sway: Math.round(swayMult * 100),
            wobble: Math.round(wobbleMult * 100),
            micro: Math.round(microMult * 100),
        };

        setSliderValue(panel, '#rdpSlider', preset.intensity);
        setSliderValue(panel, '#rdpSpeed', preset.speed);
        setSliderValue(panel, '#rdpDensity', preset.density);
        setSliderValue(panel, '#rdpLength', preset.length);
        setSliderValue(panel, '#rdpSway', preset.sway);
        setSliderValue(panel, '#rdpWobble', preset.wobble);
        setSliderValue(panel, '#rdpMicro', preset.micro);

        setText(panel, '#rdpPct', `${preset.intensity}%`);
        setText(panel, '#rdpSpeedPct', `${preset.speed}%`);
        setText(panel, '#rdpDensityPct', `${preset.density}%`);
        setText(panel, '#rdpLengthPct', `${preset.length}%`);
        setText(panel, '#rdpSwayPct', `${preset.sway}%`);
        setText(panel, '#rdpWobblePct', `${preset.wobble}%`);
        setText(panel, '#rdpMicroPct', `${preset.micro}%`);
    }

    function applyWeatherIntensity(wd) {
        if (!weatherRainy) return;
        const preset = isLightRain(wd) ? LIGHT_RAIN_PRESET : NON_LIGHT_RAIN_PRESET;
        applyPreset(devPanelEl, preset);
    }

    function setSliderValue(panel, id, value) {
        const input = panel.querySelector(id);
        if (input) input.value = String(value);
    }

    function setText(panel, id, text) {
        const el = panel.querySelector(id);
        if (el) el.textContent = text;
    }

    function applyControllerPreset(panel) {
        const preset = weatherRainy
            ? (isLightRain(lastWeatherData) ? LIGHT_RAIN_PRESET : NON_LIGHT_RAIN_PRESET)
            : NON_LIGHT_RAIN_PRESET;
        applyPreset(panel, preset);
    }

    function bindSlider(panel, inputId, textId, onUpdate) {
        const input = panel.querySelector(inputId);
        const text = panel.querySelector(textId);
        if (!input || !text) return;

        input.addEventListener('input', (e) => {
            const value = Number(e.target.value);
            text.textContent = `${value}%`;
            onUpdate(value / 100);
        });
    }

    function createDevPanel() {
        const style = document.createElement('style');
        style.textContent = `
            #rainDevPanel {
                position: fixed;
                bottom: 16px;
                right: 16px;
                background: rgba(4,8,24,0.86);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                color: #b8d0ee;
                padding: 10px 14px 13px;
                border-radius: 10px;
                z-index: 99998;
                font: 12px/1.5 monospace;
                min-width: 242px;
                border: 1px solid rgba(90,130,210,0.22);
                user-select: none;
            }
            #rainDevPanel .rdp-h { font-size:11px; font-weight:700; opacity:.6; margin-bottom:6px; }
            #rainDevPanel .rdp-lbl { font-size:11px; display:flex; justify-content:space-between; gap:10px; margin:0 0 2px; }
            #rainDevPanel .rdp-row { margin-bottom:7px; }
            #rainDevPanel input[type="range"] { width:100%; margin:0; cursor:pointer; accent-color:#5a82d2; }
            #rainDevPanel .rdp-btn-row { display:flex; gap:6px; margin-top:8px; }
            #rdpStatus { font-size:10px; opacity:.5; min-height:14px; }
            #rdpSkip, #rdpTest, #rdpReset {
                flex:1;
                padding:4px 0;
                font-size:11px;
                cursor:pointer;
                border:1px solid rgba(90,130,210,0.35);
                border-radius:5px;
                background:rgba(50,80,150,0.4);
                color:#a8c4ee;
                transition:background .15s;
            }
            #rdpSkip:hover, #rdpTest:hover, #rdpReset:hover { background:rgba(70,110,190,0.5); }
        `;
        document.head.appendChild(style);

        const panel = document.createElement('div');
        panel.id = 'rainDevPanel';
        const pct = Math.round(targetLevel * 100);
        panel.innerHTML = `
            <div class="rdp-h">Rain Dev</div>
            <div class="rdp-row">
                <label class="rdp-lbl"><span>Intensity</span><span id="rdpPct">${pct}%</span></label>
                <input type="range" id="rdpSlider" min="0" max="100" value="${pct}">
            </div>
            <div class="rdp-row">
                <label class="rdp-lbl"><span>Speed</span><span id="rdpSpeedPct">100%</span></label>
                <input type="range" id="rdpSpeed" min="20" max="400" value="100">
            </div>
            <div class="rdp-row">
                <label class="rdp-lbl"><span>Density</span><span id="rdpDensityPct">100%</span></label>
                <input type="range" id="rdpDensity" min="20" max="360" value="100">
            </div>
            <div class="rdp-row">
                <label class="rdp-lbl"><span>Length</span><span id="rdpLengthPct">100%</span></label>
                <input type="range" id="rdpLength" min="30" max="220" value="100">
            </div>
            <div class="rdp-row">
                <label class="rdp-lbl"><span>Wind Sway</span><span id="rdpSwayPct">100%</span></label>
                <input type="range" id="rdpSway" min="0" max="250" value="100">
            </div>
            <div class="rdp-row">
                <label class="rdp-lbl"><span>Per-Drop Angle</span><span id="rdpWobblePct">100%</span></label>
                <input type="range" id="rdpWobble" min="0" max="250" value="100">
            </div>
            <div class="rdp-row">
                <label class="rdp-lbl"><span>Turbulence</span><span id="rdpMicroPct">100%</span></label>
                <input type="range" id="rdpMicro" min="0" max="250" value="100">
            </div>
            <div id="rdpStatus">Inactive</div>
            <div class="rdp-btn-row">
                <button id="rdpSkip">Skip Delay</button>
                <button id="rdpTest">Test Rain</button>
                <button id="rdpReset">Reset</button>
            </div>
        `;
        document.body.appendChild(panel);
        panel.style.display = 'none';
        devPanelEl = panel;

        bindSlider(panel, '#rdpSlider', '#rdpPct', (v) => { targetLevel = v; });
        bindSlider(panel, '#rdpSpeed', '#rdpSpeedPct', (v) => { speedMult = v; });
        bindSlider(panel, '#rdpDensity', '#rdpDensityPct', (v) => { densityMult = v; makeDrops(); });
        bindSlider(panel, '#rdpLength', '#rdpLengthPct', (v) => { lengthMult = v; });
        bindSlider(panel, '#rdpSway', '#rdpSwayPct', (v) => { swayMult = v; });
        bindSlider(panel, '#rdpWobble', '#rdpWobblePct', (v) => { wobbleMult = v; reapplyAllWobbles(); });
        bindSlider(panel, '#rdpMicro', '#rdpMicroPct', (v) => { microMult = v; });

        // Initialize panel UI from current runtime state.
        // This avoids overwriting weather presets that may have been applied before DOMContentLoaded.
        syncPanelFromState(panel);

        const skipBtn = panel.querySelector('#rdpSkip');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                if (active && startTs !== null) startTs = performance.now() - DELAY_MS;
                else bypassDelayArmed = true;
            });
        }

        const resetBtn = panel.querySelector('#rdpReset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                applyControllerPreset(panel);
            });
        }

        const testBtn = panel.querySelector('#rdpTest');
        if (testBtn) {
            testBtn.addEventListener('click', () => {
                testOn = !testOn;
                testBtn.textContent = testOn ? 'Stop Test' : 'Test Rain';
                syncRunState();
            });
        }

        setInterval(() => {
            const el = panel.querySelector('#rdpStatus');
            if (!el) return;
            if (!active) {
                el.textContent = 'Inactive';
                return;
            }

            const elapsed = Date.now() - activatedAt;
            if (elapsed < DELAY_MS) {
                const rem = Math.ceil((DELAY_MS - elapsed) / 1000);
                const mode = testOn ? 'test' : 'weather';
                el.textContent = `Delay: ${rem}s (${mode})`;
            } else {
                const mode = testOn ? 'test' : 'weather';
                const drops = layerDrops.reduce((n, arr) => n + arr.length, 0);
                el.textContent = `Active ${mode} · a ${masterAlpha.toFixed(2)} · drops ${drops}`;
            }
        }, 400);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.WeatherRain = { notify };
})();
