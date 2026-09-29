// ===== 7. Date Formatter =====
ToolManager.register('date-formatter', {
    _state: null,
    init(container) {
        container.innerHTML = `<div class="tool-content tool-content-compact">
            <div class="tool-row" style="flex-wrap:wrap;">
                <input class="tool-input" id="tdtInput" placeholder="Enter date (any format)..." value="${this._state || ''}" style="flex:1;min-width:200px">
                <button class="tool-btn primary" id="tdtParse">Parse</button>
                <button class="tool-btn" id="tdtNow">Now</button>
            </div>
            <div class="tool-card" id="tdtResult" style="flex:0 0 auto;"></div>
            <div class="tool-divider"></div>
            <span class="tool-label">Date Difference Calculator</span>
            <div class="tool-row" style="flex-wrap:wrap;">
                <input class="tool-input" id="tdtFrom" type="datetime-local" style="flex:1">
                <span style="color:rgba(255,255,255,0.4)">â†’</span>
                <input class="tool-input" id="tdtTo" type="datetime-local" style="flex:1">
                <button class="tool-btn" id="tdtDiff">Calculate</button>
            </div>
            <div class="tool-stats" id="tdtDiffResult"></div>
        </div>`;
        const input = document.getElementById('tdtInput');
        const result = document.getElementById('tdtResult');
        const parse = (val) => {
            let d;
            if (!val) { result.innerHTML = '<span style="color:rgba(255,255,255,0.3)">Enter a date to parse</span>'; return; }
            // Try parsing as number (epoch)
            if (/^\d{10,13}$/.test(val.trim())) {
                const n = parseInt(val.trim());
                d = new Date(n > 9999999999 ? n : n * 1000);
            } else {
                d = new Date(val);
            }
            if (isNaN(d)) { result.innerHTML = '<span class="tool-error">Could not parse date</span>'; return; }
            const now = new Date();
            const diffMs = now - d;
            const ago = diffMs > 0;
            const absDiff = Math.abs(diffMs);
            let relative;
            if (absDiff < 60000) relative = 'just now';
            else if (absDiff < 3600000) relative = `${Math.floor(absDiff / 60000)} min ${ago ? 'ago' : 'from now'}`;
            else if (absDiff < 86400000) relative = `${Math.floor(absDiff / 3600000)} hours ${ago ? 'ago' : 'from now'}`;
            else relative = `${Math.floor(absDiff / 86400000)} days ${ago ? 'ago' : 'from now'}`;
            result.innerHTML = `
                <div style="display:grid;grid-template-columns:120px 1fr;gap:6px 16px;font-size:13.5px;">
                    <span class="tool-label">ISO 8601</span><span style="user-select:text">${d.toISOString()}</span>
                    <span class="tool-label">UTC</span><span style="user-select:text">${d.toUTCString()}</span>
                    <span class="tool-label">Local</span><span style="user-select:text">${d.toLocaleString()}</span>
                    <span class="tool-label">Unix (s)</span><span style="user-select:text">${Math.floor(d.getTime() / 1000)}</span>
                    <span class="tool-label">Unix (ms)</span><span style="user-select:text">${d.getTime()}</span>
                    <span class="tool-label">Relative</span><span>${relative}</span>
                    <span class="tool-label">Day of Week</span><span>${d.toLocaleDateString('en-US', { weekday: 'long' })}</span>
                    <span class="tool-label">Week Number</span><span>${this._weekNum(d)}</span>
                </div>`;
        };
        document.getElementById('tdtParse').onclick = () => parse(input.value);
        document.getElementById('tdtNow').onclick = () => { input.value = new Date().toISOString(); parse(input.value); };
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') parse(input.value); });
        document.getElementById('tdtDiff').onclick = () => {
            const from = new Date(document.getElementById('tdtFrom').value);
            const to = new Date(document.getElementById('tdtTo').value);
            if (isNaN(from) || isNaN(to)) { document.getElementById('tdtDiffResult').textContent = 'Enter both dates'; return; }
            const ms = Math.abs(to - from);
            const days = Math.floor(ms / 86400000);
            const hours = Math.floor((ms % 86400000) / 3600000);
            const mins = Math.floor((ms % 3600000) / 60000);
            document.getElementById('tdtDiffResult').textContent = `${days} days, ${hours} hours, ${mins} minutes (${ms.toLocaleString()} ms)`;
        };
        if (this._state) parse(this._state);
    },
    destroy() {},
    saveState() { this._state = document.getElementById('tdtInput')?.value || ''; },
    loadState() {},
    _weekNum(d) {
        const start = new Date(d.getFullYear(), 0, 1);
        const diff = (d - start + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60000) / 86400000;
        return Math.ceil((diff + start.getDay() + 1) / 7);
    }
});

// ===== 8. Epoch Converter =====
ToolManager.register('epoch-converter', {
    _interval: null,
    init(container) {
        container.innerHTML = `<div class="tool-content tool-content-compact">
            <div class="tool-card">
                <div class="tool-row" style="justify-content:space-between">
                    <span class="tool-label">Current Epoch</span>
                    <span id="teNow" style="font-family:Consolas,monospace;font-size:18px;user-select:text;-webkit-user-select:text;"></span>
                </div>
            </div>
            <div class="tool-divider"></div>
            <span class="tool-label">Epoch â†’ Human</span>
            <div class="tool-row">
                <input class="tool-input" id="teEpoch" placeholder="Unix timestamp (s or ms)" style="flex:1;font-family:Consolas,monospace">
                <button class="tool-btn primary" id="teToHuman">Convert</button>
            </div>
            <div class="tool-card" id="teHumanResult"></div>
            <div class="tool-divider"></div>
            <span class="tool-label">Human â†’ Epoch</span>
            <div class="tool-row">
                <input class="tool-input" id="teHuman" type="datetime-local" style="flex:1">
                <button class="tool-btn primary" id="teToEpoch">Convert</button>
            </div>
            <div class="tool-card" id="teEpochResult"></div>
        </div>`;
        const nowEl = document.getElementById('teNow');
        const tick = () => { nowEl.textContent = Math.floor(Date.now() / 1000); };
        tick();
        this._interval = setInterval(tick, 1000);
        nowEl.style.cursor = 'pointer';
        nowEl.onclick = () => { navigator.clipboard.writeText(nowEl.textContent).then(() => showToast('Copied!')); };
        document.getElementById('teToHuman').onclick = () => {
            const v = document.getElementById('teEpoch').value.trim();
            const n = parseInt(v);
            if (isNaN(n)) return;
            const d = new Date(n > 9999999999 ? n : n * 1000);
            document.getElementById('teHumanResult').innerHTML = `
                <div style="font-size:13.5px;display:grid;grid-template-columns:80px 1fr;gap:4px 12px;">
                    <span class="tool-label">ISO</span><span style="user-select:text">${d.toISOString()}</span>
                    <span class="tool-label">Local</span><span style="user-select:text">${d.toLocaleString()}</span>
                    <span class="tool-label">UTC</span><span style="user-select:text">${d.toUTCString()}</span>
                </div>`;
        };
        document.getElementById('teToEpoch').onclick = () => {
            const d = new Date(document.getElementById('teHuman').value);
            if (isNaN(d)) return;
            document.getElementById('teEpochResult').innerHTML = `
                <div style="font-size:13.5px;display:grid;grid-template-columns:80px 1fr;gap:4px 12px;">
                    <span class="tool-label">Seconds</span><span style="user-select:text;font-family:Consolas,monospace">${Math.floor(d.getTime() / 1000)}</span>
                    <span class="tool-label">Millis</span><span style="user-select:text;font-family:Consolas,monospace">${d.getTime()}</span>
                </div>`;
        };
    },
    destroy() { clearInterval(this._interval); this._interval = null; },
    saveState() {},
    loadState() {}
});

// ===== 9. Color Studio =====
ToolManager.register('color-picker', {
    _state: null,
    init(container) {
        const defaults = {
            color: '#6e8cff', alpha: 100, history: [], saved: [], selectedStop: 0,
            gradient: {
                kind: 'linear', angle: 135, shape: 'circle', position: 'center',
                stops: [{ color: '#6e8cff', alpha: 100, position: 0 }, { color: '#f5a524', alpha: 100, position: 100 }]
            }
        };
        const state = this._normalizeState({ ...defaults, ...(this._state || {}) });
        const gradientOptions = [
            ['linear', 'Linear'], ['radial', 'Radial'], ['conic', 'Conic'],
            ['repeating-linear', 'Repeating linear'], ['repeating-radial', 'Repeating radial'], ['repeating-conic', 'Repeating conic']
        ];

        container.innerHTML = `<div class="tool-content color-studio">
            <div class="color-studio-hero">
                <div class="color-studio-preview" id="csPreview"></div>
                <div class="color-studio-hero-copy">
                    <span class="tool-label">Active color</span>
                    <strong id="csColorName"></strong>
                    <span id="csContrast"></span>
                </div>
                <button class="tool-btn" id="csSaveSwatch" type="button">Save swatch</button>
            </div>

            <div class="color-studio-grid">
                <section class="color-studio-panel">
                    <div class="color-studio-panel-head"><span>Color</span><input id="csPicker" type="color" aria-label="Choose color"></div>
                    <div class="color-studio-fields">
                        <label>HEX<span class="color-field-with-copy"><input class="tool-input" id="csHex" spellcheck="false"><button class="color-copy-btn" data-copy-value="hex" type="button" title="Copy HEX" aria-label="Copy HEX"></button></span></label>
                        <label>Alpha<input class="tool-input" id="csAlpha" type="number" min="0" max="100"></label>
                    </div>
                    <label class="color-studio-slider">Hue <input id="csHue" type="range" min="0" max="360"></label>
                    <label class="color-studio-slider">Saturation <input id="csSat" type="range" min="0" max="100"></label>
                    <label class="color-studio-slider">Lightness <input id="csLight" type="range" min="0" max="100"></label>
                    <label class="color-studio-slider">Opacity <input id="csOpacity" type="range" min="0" max="100"></label>
                    <div class="color-studio-values">
                        <label class="color-studio-value"><small>RGB</small><span class="color-field-with-copy"><input id="csRgb" spellcheck="false"><button class="color-copy-btn" data-copy-value="rgb" type="button" title="Copy RGB" aria-label="Copy RGB"></button></span></label>
                        <label class="color-studio-value"><small>HSL</small><span class="color-field-with-copy"><input id="csHsl" spellcheck="false"><button class="color-copy-btn" data-copy-value="hsl" type="button" title="Copy HSL" aria-label="Copy HSL"></button></span></label>
                        <label class="color-studio-value"><small>OKLCH</small><span class="color-field-with-copy"><input id="csOklch" spellcheck="false"><button class="color-copy-btn" data-copy-value="oklch" type="button" title="Copy OKLCH" aria-label="Copy OKLCH"></button></span></label>
                    </div>
                </section>

                <section class="color-studio-panel color-gradient-panel">
                    <div class="color-studio-panel-head"><span>Gradient composer</span><button class="tool-btn" id="csCopyGradient" type="button">Copy CSS</button></div>
                    <div class="color-studio-controls">
                        <select class="tool-select" id="csGradientKind">${gradientOptions.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select>
                        <label class="color-studio-inline">Angle <input class="tool-input" id="csAngle" type="number" min="0" max="360"></label>
                        <label class="color-studio-inline cs-radial-control">Shape <select class="tool-select" id="csShape"><option value="circle">Circle</option><option value="ellipse">Ellipse</option></select></label>
                        <label class="color-studio-inline cs-radial-control">Center <select class="tool-select" id="csPosition"><option value="center">Center</option><option value="top">Top</option><option value="top right">Top right</option><option value="right">Right</option><option value="bottom right">Bottom right</option><option value="bottom">Bottom</option><option value="bottom left">Bottom left</option><option value="left">Left</option><option value="top left">Top left</option></select></label>
                    </div>
                    <div class="color-gradient-preview" id="csGradientPreview"></div>
                    <div class="color-gradient-stop-gutter" id="csStopGutter" aria-label="Gradient stop positions"></div>
                    <div class="color-gradient-actions"><button class="tool-btn primary" id="csAddStop" type="button">Add stop</button><button class="tool-btn danger" id="csRemoveStop" type="button">Remove selected</button></div>
                    <span class="color-gradient-code-wrap"><textarea class="color-gradient-code" id="csGradientCode" spellcheck="false" aria-label="Editable gradient CSS"></textarea><button class="color-copy-btn" data-copy-value="gradient" type="button" title="Copy gradient CSS" aria-label="Copy gradient CSS"></button></span>
                </section>
            </div>

            <section class="color-studio-library">
                <div class="color-studio-library-head"><span class="tool-label">Gradient recipes</span><span class="tool-label">Saved swatches</span></div>
                <div class="color-studio-library-grid">
                    <div class="color-gradient-presets" id="csPresets"></div>
                    <div class="color-swatch-grid" id="csSaved"></div>
                </div>
                <div class="color-studio-library-head"><span class="tool-label">Recent colors</span><button class="tool-btn" id="csClearHistory" type="button">Clear</button></div>
                <div class="color-swatch-grid" id="csHistory"></div>
            </section>
        </div>`;

        const el = (id) => document.getElementById(id);
        const selectedStop = () => state.gradient.stops[Math.min(state.selectedStop, state.gradient.stops.length - 1)];
        const addHistory = (color) => {
            state.history = [color, ...state.history.filter(item => item !== color)].slice(0, 24);
        };
        const setColor = (color, alpha = state.alpha, record = false) => {
            const normalized = this._normalizeHex(color);
            if (!normalized) return false;
            state.color = normalized;
            state.alpha = Math.max(0, Math.min(100, Number(alpha) || 0));
            const stop = selectedStop();
            stop.color = state.color;
            stop.alpha = state.alpha;
            if (record) addHistory(state.color);
            render();
            return true;
        };
        const copy = (value, message) => navigator.clipboard.writeText(value).then(() => showToast(message));
        const gradientCss = () => this._gradientCss(state.gradient);
        const refreshGradientOutput = () => {
            const css = gradientCss();
            el('csGradientPreview').style.background = css;
            el('csGradientCode').value = `background: ${css};`;
        };
        const renderSwatches = (target, values, removable) => {
            target.innerHTML = values.length ? values.map((value, index) => `<button class="color-swatch-button" type="button" data-index="${index}" style="--swatch:${value}" title="${value}"></button>`).join('') : '<span class="color-studio-empty">No swatches yet</span>';
            target.querySelectorAll('.color-swatch-button').forEach(button => {
                button.addEventListener('click', () => setColor(values[Number(button.dataset.index)], 100, false));
                if (removable) button.addEventListener('contextmenu', (event) => {
                    event.preventDefault();
                    values.splice(Number(button.dataset.index), 1);
                    render();
                });
            });
        };
        const renderStops = () => {
            const stops = el('csStopGutter');
            stops.innerHTML = state.gradient.stops.map((stop, index) => `<button class="color-gradient-stop ${index === state.selectedStop ? 'active' : ''}" type="button" data-stop="${index}" style="--stop:${this._colorCss(stop.color, stop.alpha)};left:${stop.position}%" title="${stop.position}%" aria-label="Gradient stop at ${stop.position}%"></button>`).join('');
            stops.querySelectorAll('[data-stop]').forEach(button => {
                button.addEventListener('click', () => {
                    state.selectedStop = Number(button.dataset.stop);
                    const stop = selectedStop();
                    state.color = stop.color;
                    state.alpha = stop.alpha;
                    render();
                });
                button.addEventListener('pointerdown', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const stop = state.gradient.stops[Number(button.dataset.stop)];
                    let shouldRemove = false;
                    const updatePosition = (moveEvent) => {
                        const previewRect = el('csGradientPreview').getBoundingClientRect();
                        shouldRemove = moveEvent.clientY > previewRect.bottom + 44 && state.gradient.stops.length > 2;
                        button.classList.toggle('removing', shouldRemove);
                        if (shouldRemove) return;
                        const rect = el('csStopGutter').getBoundingClientRect();
                        stop.position = Math.round(Math.max(0, Math.min(100, (moveEvent.clientX - rect.left) / rect.width * 100)));
                        state.gradient.stops.sort((left, right) => left.position - right.position);
                        state.selectedStop = state.gradient.stops.indexOf(stop);
                        button.style.left = `${stop.position}%`;
                        button.title = `${stop.position}%`;
                        button.setAttribute('aria-label', `Gradient stop at ${stop.position}%`);
                        refreshGradientOutput();
                    };
                    const finish = () => {
                        document.removeEventListener('pointermove', updatePosition);
                        document.removeEventListener('pointerup', finish);
                        if (shouldRemove) {
                            state.gradient.stops.splice(state.gradient.stops.indexOf(stop), 1);
                            state.selectedStop = Math.max(0, Math.min(state.selectedStop, state.gradient.stops.length - 1));
                        } else {
                            state.gradient.stops.sort((left, right) => left.position - right.position);
                            state.selectedStop = state.gradient.stops.indexOf(stop);
                        }
                        const selected = selectedStop();
                        state.color = selected.color;
                        state.alpha = selected.alpha;
                        render();
                    };
                    document.addEventListener('pointermove', updatePosition);
                    document.addEventListener('pointerup', finish, { once: true });
                });
            });
        };
        const renderPresets = () => {
            const recipes = [
                ['Aurora', 'linear', 135, ['#36d1dc', '#5b86e5', '#b65cff']], ['Sunset', 'linear', 110, ['#f12711', '#f5af19', '#f8e473']],
                ['Berry', 'radial', 0, ['#fb7185', '#a855f7', '#312e81']], ['Orbit', 'conic', 25, ['#22d3ee', '#6366f1', '#f472b6', '#facc15', '#22d3ee']],
                ['Signal', 'repeating-linear', 45, ['#111827', '#111827', '#22d3ee', '#22d3ee']], ['Pulse', 'repeating-radial', 0, ['#fef3c7', '#fef3c7', '#fb7185', '#fb7185']]
            ];
            const host = el('csPresets');
            host.innerHTML = recipes.map((recipe, index) => `<button class="color-gradient-recipe" type="button" data-recipe="${index}" style="background:${this._gradientCss({ kind: recipe[1], angle: recipe[2], shape: 'circle', position: 'center', stops: recipe[3].map((color, stopIndex) => ({ color, alpha: 100, position: Math.round(stopIndex * 100 / (recipe[3].length - 1)) })) })}"><span>${recipe[0]}</span></button>`).join('');
            host.querySelectorAll('[data-recipe]').forEach(button => button.addEventListener('click', () => {
                const recipe = recipes[Number(button.dataset.recipe)];
                state.gradient = { kind: recipe[1], angle: recipe[2], shape: 'circle', position: 'center', stops: recipe[3].map((color, index) => ({ color, alpha: 100, position: Math.round(index * 100 / (recipe[3].length - 1)) })) };
                state.selectedStop = 0;
                state.color = state.gradient.stops[0].color;
                state.alpha = 100;
                render();
            }));
        };
        const render = () => {
            const rgb = this._hexToRgb(state.color);
            const [hue, saturation, lightness] = this._rgbToHsl(rgb.r, rgb.g, rgb.b);
            const currentCss = this._colorCss(state.color, state.alpha);
            const contrast = this._contrastColor(rgb.r, rgb.g, rgb.b);
            const isRadial = state.gradient.kind.includes('radial');
            const css = gradientCss();
            el('csPreview').style.background = currentCss;
            el('csColorName').textContent = state.alpha === 100 ? state.color.toUpperCase() : currentCss;
            el('csContrast').textContent = `Best text: ${contrast === '#ffffff' ? 'white' : 'black'}`;
            el('csPicker').value = state.color;
            el('csHex').value = state.color;
            el('csAlpha').value = state.alpha;
            el('csHue').value = hue;
            el('csSat').value = saturation;
            el('csLight').value = lightness;
            el('csOpacity').value = state.alpha;
            el('csHue').style.background = 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)';
            el('csSat').style.background = `linear-gradient(to right, hsl(${hue}, 0%, ${lightness}%), hsl(${hue}, 100%, ${lightness}%))`;
            el('csLight').style.background = `linear-gradient(to right, #000, hsl(${hue}, ${saturation}%, 50%), #fff)`;
            el('csOpacity').style.background = `linear-gradient(to right, transparent, ${state.color})`;
            el('csRgb').value = state.alpha === 100 ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(state.alpha / 100).toFixed(2)})`;
            el('csHsl').value = state.alpha === 100 ? `hsl(${hue} ${saturation}% ${lightness}%)` : `hsl(${hue} ${saturation}% ${lightness}% / ${state.alpha}%)`;
            el('csOklch').value = this._oklch(rgb.r, rgb.g, rgb.b, state.alpha);
            el('csGradientKind').value = state.gradient.kind;
            el('csAngle').value = state.gradient.angle;
            el('csShape').value = state.gradient.shape;
            el('csPosition').value = state.gradient.position;
            document.querySelectorAll('.cs-radial-control').forEach(control => { control.hidden = !isRadial; });
            el('csGradientPreview').style.background = css;
            el('csGradientCode').value = `background: ${css};`;
            el('csRemoveStop').disabled = state.gradient.stops.length <= 2;
            renderStops();
            renderPresets();
            renderSwatches(el('csSaved'), state.saved, true);
            renderSwatches(el('csHistory'), state.history, false);
        };

        el('csPicker').addEventListener('input', () => setColor(el('csPicker').value, state.alpha));
        el('csPicker').addEventListener('change', () => setColor(el('csPicker').value, state.alpha, true));
        el('csHex').addEventListener('change', () => setColor(el('csHex').value, state.alpha, true));
        el('csAlpha').addEventListener('input', () => setColor(state.color, el('csAlpha').value));
        el('csOpacity').addEventListener('input', () => setColor(state.color, el('csOpacity').value));
        ['csHue', 'csSat', 'csLight'].forEach(id => el(id).addEventListener('input', () => {
            const hex = this._hslToHex(el('csHue').value, el('csSat').value, el('csLight').value);
            setColor(hex, state.alpha);
        }));
        const updateFromFormat = (id, record = false) => {
            const parsed = this._parseColorInput(el(id).value);
            if (!parsed) {
                showToast(`Invalid ${id.slice(2).toUpperCase()} color`);
                render();
                return;
            }
            setColor(parsed.color, parsed.alpha, record);
        };
        ['csRgb', 'csHsl', 'csOklch'].forEach(id => el(id).addEventListener('blur', () => updateFromFormat(id, true)));
        ['csRgb', 'csHsl', 'csOklch'].forEach(id => el(id).addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            const input = el(id);
            const component = this._componentAtCaret(id, input.value, input.selectionStart);
            if (!component) return;
            event.preventDefault();
            const direction = event.key === 'ArrowUp' ? 1 : -1;
            const multiplier = event.shiftKey ? 10 : 1;
            const next = Math.max(component.min, Math.min(component.max, component.value + direction * component.step * multiplier));
            const precision = component.step < 1 ? Math.max(2, String(component.step).split('.')[1]?.length || 0) : 0;
            const replacement = `${Number(next.toFixed(precision))}${component.suffix}`;
            input.value = `${input.value.slice(0, component.start)}${replacement}${input.value.slice(component.end)}`;
            const caretOffset = Math.min(component.caretOffset, replacement.length);
            updateFromFormat(id);
            input.focus();
            input.setSelectionRange(component.start + caretOffset, component.start + caretOffset);
        }));
        document.querySelectorAll('[data-copy-value]').forEach(button => button.addEventListener('click', () => {
            const id = button.dataset.copyValue === 'gradient' ? 'csGradientCode' : `cs${button.dataset.copyValue[0].toUpperCase()}${button.dataset.copyValue.slice(1)}`;
            copy(el(id).value, button.dataset.copyValue === 'gradient' ? 'Gradient CSS copied' : 'Color copied');
        }));
        el('csSaveSwatch').addEventListener('click', () => {
            state.saved = [state.color, ...state.saved.filter(color => color !== state.color)].slice(0, 20);
            addHistory(state.color);
            render();
        });
        el('csGradientKind').addEventListener('change', () => { state.gradient.kind = el('csGradientKind').value; render(); });
        el('csAngle').addEventListener('input', () => { state.gradient.angle = Math.max(0, Math.min(360, Number(el('csAngle').value) || 0)); render(); });
        el('csShape').addEventListener('change', () => { state.gradient.shape = el('csShape').value; render(); });
        el('csPosition').addEventListener('change', () => { state.gradient.position = el('csPosition').value; render(); });
        el('csGradientPreview').addEventListener('pointerdown', (event) => {
            if (event.target !== el('csGradientPreview')) return;
            const rect = el('csGradientPreview').getBoundingClientRect();
            const position = Math.round(Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)));
            const stop = { color: state.color, alpha: state.alpha, position };
            state.gradient.stops.push(stop);
            state.gradient.stops.sort((left, right) => left.position - right.position);
            state.selectedStop = state.gradient.stops.indexOf(stop);
            render();
        });
        el('csAddStop').addEventListener('click', () => {
            const stop = selectedStop();
            state.gradient.stops.push({ color: state.color, alpha: state.alpha, position: Math.min(100, stop.position + 15) });
            state.gradient.stops.sort((left, right) => left.position - right.position);
            state.selectedStop = state.gradient.stops.findIndex(item => item.position === Math.min(100, stop.position + 15) && item.color === state.color);
            render();
        });
        el('csRemoveStop').addEventListener('click', () => {
            state.gradient.stops.splice(state.selectedStop, 1);
            state.selectedStop = Math.max(0, state.selectedStop - 1);
            const stop = selectedStop();
            state.color = stop.color;
            state.alpha = stop.alpha;
            render();
        });
        el('csGradientCode').addEventListener('change', () => {
            const gradient = this._parseGradientCss(el('csGradientCode').value);
            if (!gradient) {
                showToast('Invalid gradient CSS');
                render();
                return;
            }
            state.gradient = gradient;
            state.selectedStop = 0;
            state.color = gradient.stops[0].color;
            state.alpha = gradient.stops[0].alpha;
            render();
        });
        el('csCopyGradient').addEventListener('click', () => copy(el('csGradientCode').value, 'Gradient CSS copied'));
        el('csClearHistory').addEventListener('click', () => { state.history = []; render(); });

        this._state = state;
        render();
    },
    destroy() {},
    saveState() {
        this._state = this._normalizeState(this._state || {});
    },
    loadState() {
        if (this._state) return;
        const tabs = TabManager.load('color-picker');
        const activeTab = tabs.tabs.find(tab => tab.id === tabs.active);
        if (tabs.tabs.length !== 1 || activeTab?.state != null) return;
        try { this._state = JSON.parse(localStorage.getItem('tool-state-color-picker') || 'null'); } catch { this._state = null; }
    },
    _normalizeState(state) {
        const stops = Array.isArray(state.gradient?.stops) ? state.gradient.stops.map(stop => ({ color: this._normalizeHex(stop.color) || '#6e8cff', alpha: Math.max(0, Math.min(100, Number(stop.alpha ?? 100))), position: Math.max(0, Math.min(100, Number(stop.position ?? 0))) })) : [];
        if (stops.length < 2) stops.push({ color: '#6e8cff', alpha: 100, position: 0 }, { color: '#f5a524', alpha: 100, position: 100 });
        state.color = this._normalizeHex(state.color) || stops[0].color;
        state.alpha = Math.max(0, Math.min(100, Number(state.alpha ?? 100)));
        state.history = Array.isArray(state.history) ? state.history.map(color => this._normalizeHex(color)).filter(Boolean).slice(0, 24) : [];
        state.saved = Array.isArray(state.saved) ? state.saved.map(color => this._normalizeHex(color)).filter(Boolean).slice(0, 20) : [];
        state.gradient = { kind: ['linear', 'radial', 'conic', 'repeating-linear', 'repeating-radial', 'repeating-conic'].includes(state.gradient?.kind) ? state.gradient.kind : 'linear', angle: Number(state.gradient?.angle ?? 135), shape: state.gradient?.shape === 'ellipse' ? 'ellipse' : 'circle', position: state.gradient?.position || 'center', stops: stops.sort((left, right) => left.position - right.position) };
        state.selectedStop = Math.max(0, Math.min(state.gradient.stops.length - 1, Number(state.selectedStop) || 0));
        return state;
    },
    _normalizeHex(value) {
        const raw = String(value || '').trim().replace(/^#/, '');
        if (/^[0-9a-f]{3}$/i.test(raw)) return `#${raw.split('').map(character => character + character).join('').toLowerCase()}`;
        return /^[0-9a-f]{6}$/i.test(raw) ? `#${raw.toLowerCase()}` : null;
    },
    _hexToRgb(hex) {
        const normalized = this._normalizeHex(hex) || '#000000';
        return { r: parseInt(normalized.slice(1, 3), 16), g: parseInt(normalized.slice(3, 5), 16), b: parseInt(normalized.slice(5, 7), 16) };
    },
    _hslToHex(hue, saturation, lightness) {
        const h = ((Number(hue) % 360) + 360) % 360 / 360;
        const s = Math.max(0, Math.min(100, Number(saturation))) / 100;
        const l = Math.max(0, Math.min(100, Number(lightness))) / 100;
        const hueToRgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const channels = s === 0 ? [l, l, l] : [hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)];
        return `#${channels.map(channel => Math.round(channel * 255).toString(16).padStart(2, '0')).join('')}`;
    },
    _colorCss(hex, alpha) {
        if (Number(alpha) >= 100) return hex;
        const { r, g, b } = this._hexToRgb(hex);
        return `rgba(${r}, ${g}, ${b}, ${(Number(alpha) / 100).toFixed(2)})`;
    },
    _parseColorInput(value) {
        const source = String(value || '').trim();
        const hex = this._normalizeHex(source);
        if (hex) return { color: hex, alpha: 100 };
        const rgb = source.match(/^rgba?\(\s*([\d.]+)[,\s]+\s*([\d.]+)[,\s]+\s*([\d.]+)(?:\s*(?:,|\/)\s*([\d.]+%?))?\s*\)$/i);
        if (rgb) {
            const channels = rgb.slice(1, 4).map(channel => Math.round(Number(channel)));
            if (channels.some(channel => !Number.isFinite(channel) || channel < 0 || channel > 255)) return null;
            const alpha = rgb[4] ? this._parseAlpha(rgb[4]) : 100;
            return alpha === null ? null : { color: `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`, alpha };
        }
        const hsl = source.match(/^hsla?\(\s*([\d.+-]+)(?:deg)?(?:[,\s]+)\s*([\d.]+)%(?:[,\s]+)\s*([\d.]+)%(?:\s*(?:,|\/)\s*([\d.]+%?))?\s*\)$/i);
        if (hsl) {
            const saturation = Number(hsl[2]), lightness = Number(hsl[3]);
            if (saturation < 0 || saturation > 100 || lightness < 0 || lightness > 100) return null;
            const alpha = hsl[4] ? this._parseAlpha(hsl[4]) : 100;
            return alpha === null ? null : { color: this._hslToHex(hsl[1], saturation, lightness), alpha };
        }
        const oklch = source.match(/^oklch\(\s*([\d.]+)%(?:\s+)\s*([\d.]+)(?:\s+)\s*([\d.+-]+)(?:deg)?(?:\s*\/\s*([\d.]+%?))?\s*\)$/i);
        if (oklch) {
            const alpha = oklch[4] ? this._parseAlpha(oklch[4]) : 100;
            if (alpha === null) return null;
            const color = this._oklchToHex(Number(oklch[1]) / 100, Number(oklch[2]), Number(oklch[3]));
            return color ? { color, alpha } : null;
        }
        return null;
    },
    _parseAlpha(value) {
        const source = String(value).trim();
        const alpha = source.endsWith('%') ? Number(source.slice(0, -1)) : Number(source) * 100;
        return Number.isFinite(alpha) && alpha >= 0 && alpha <= 100 ? Math.round(alpha * 100) / 100 : null;
    },
    _componentAtCaret(format, value, caret) {
        const matches = [...String(value).matchAll(/-?\d*\.?\d+%?/g)];
        const index = matches.findIndex(match => caret >= match.index && caret <= match.index + match[0].length);
        if (index < 0) return null;
        const token = matches[index][0];
        const percent = token.endsWith('%');
        const raw = Number(percent ? token.slice(0, -1) : token);
        if (!Number.isFinite(raw)) return null;
        const specs = format === 'csRgb'
            ? [{ min: 0, max: 255, step: 1 }, { min: 0, max: 255, step: 1 }, { min: 0, max: 255, step: 1 }, { min: 0, max: percent ? 100 : 1, step: percent ? 1 : 0.01 }]
            : format === 'csHsl'
                ? [{ min: 0, max: 360, step: 1 }, { min: 0, max: 100, step: 1 }, { min: 0, max: 100, step: 1 }, { min: 0, max: percent ? 100 : 1, step: percent ? 1 : 0.01 }]
                : [{ min: 0, max: 100, step: 1 }, { min: 0, max: 0.5, step: 0.01 }, { min: 0, max: 360, step: 1 }, { min: 0, max: percent ? 100 : 1, step: percent ? 1 : 0.01 }];
        const spec = specs[index];
        if (!spec) return null;
        return { ...spec, value: raw, suffix: percent ? '%' : '', start: matches[index].index, end: matches[index].index + token.length, caretOffset: caret - matches[index].index };
    },
    _splitGradientParts(value) {
        const parts = [];
        let depth = 0;
        let start = 0;
        for (let index = 0; index < value.length; index++) {
            if (value[index] === '(') depth++;
            if (value[index] === ')') depth--;
            if (value[index] === ',' && depth === 0) {
                parts.push(value.slice(start, index).trim());
                start = index + 1;
            }
        }
        parts.push(value.slice(start).trim());
        return parts.filter(Boolean);
    },
    _parseGradientCss(value) {
        const source = String(value || '').trim().replace(/^background\s*:\s*/i, '').replace(/;\s*$/, '');
        const match = source.match(/^((?:repeating-)?(?:linear|radial|conic)-gradient)\((.*)\)$/is);
        if (!match) return null;
        const kind = match[1].replace('-gradient', '');
        const parts = this._splitGradientParts(match[2]);
        if (parts.length < 2) return null;
        let angle = 135;
        let shape = 'circle';
        let position = 'center';
        let stopStart = 0;
        const header = parts[0];
        if (kind.includes('linear') && /deg$/i.test(header)) {
            angle = Number.parseFloat(header);
            stopStart = 1;
        } else if (kind.includes('conic') && /^from\s+/i.test(header)) {
            const details = header.match(/^from\s+([\d.+-]+)deg(?:\s+at\s+(.+))?$/i);
            if (!details) return null;
            angle = Number(details[1]);
            position = details[2] || 'center';
            stopStart = 1;
        } else if (kind.includes('radial') && /\bat\b/i.test(header)) {
            const details = header.match(/^(circle|ellipse)?\s*(?:at\s+(.+))?$/i);
            if (!details) return null;
            shape = (details[1] || 'circle').toLowerCase();
            position = details[2] || 'center';
            stopStart = 1;
        }
        const stops = parts.slice(stopStart).map((part, index, values) => {
            const stop = part.match(/^(.*?)(?:\s+([\d.]+)%)?$/);
            const parsed = this._parseColorInput(stop?.[1]);
            if (!parsed) return null;
            return { ...parsed, position: stop[2] === undefined ? Math.round(index * 100 / Math.max(1, values.length - 1)) : Number(stop[2]) };
        });
        if (stops.length < 2 || stops.some(stop => !stop)) return null;
        return this._normalizeState({ gradient: { kind, angle, shape, position, stops }, color: stops[0].color, alpha: stops[0].alpha, history: this._state?.history || [], saved: this._state?.saved || [] }).gradient;
    },
    _gradientCss(gradient) {
        const stops = gradient.stops.map(stop => `${this._colorCss(stop.color, stop.alpha)} ${stop.position}%`).join(', ');
        if (gradient.kind.includes('radial')) return `${gradient.kind}-gradient(${gradient.shape} at ${gradient.position}, ${stops})`;
        if (gradient.kind.includes('conic')) return `${gradient.kind}-gradient(from ${gradient.angle}deg at ${gradient.position}, ${stops})`;
        return `${gradient.kind}-gradient(${gradient.angle}deg, ${stops})`;
    },
    _contrastColor(r, g, b) {
        const channel = value => { const normalized = value / 255; return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4; };
        return channel(r) * 0.2126 + channel(g) * 0.7152 + channel(b) * 0.0722 > 0.179 ? '#000000' : '#ffffff';
    },
    _oklch(r, g, b, alpha) {
        const linear = value => { const normalized = value / 255; return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4; };
        const lr = linear(r), lg = linear(g), lb = linear(b);
        const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
        const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
        const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
        const lRoot = Math.cbrt(l), mRoot = Math.cbrt(m), sRoot = Math.cbrt(s);
        const lightness = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
        const a = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
        const b2 = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;
        const chroma = Math.sqrt(a * a + b2 * b2);
        const hue = (Math.atan2(b2, a) * 180 / Math.PI + 360) % 360;
        return `oklch(${(lightness * 100).toFixed(1)}% ${chroma.toFixed(3)} ${hue.toFixed(1)}${alpha < 100 ? ` / ${alpha}%` : ''})`;
    },
    _oklchToHex(lightness, chroma, hue) {
        if (![lightness, chroma, hue].every(Number.isFinite) || lightness < 0 || lightness > 1 || chroma < 0) return null;
        const hueRadians = hue * Math.PI / 180;
        const a = chroma * Math.cos(hueRadians);
        const b = chroma * Math.sin(hueRadians);
        const l = lightness + 0.3963377774 * a + 0.2158037573 * b;
        const m = lightness - 0.1055613458 * a - 0.0638541728 * b;
        const s = lightness - 0.0894841775 * a - 1.291485548 * b;
        const l3 = l * l * l, m3 = m * m * m, s3 = s * s * s;
        const channels = [
            4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
            -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
            -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3
        ];
        const toSrgb = channel => channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
        const srgb = channels.map(toSrgb);
        if (srgb.some(channel => !Number.isFinite(channel))) return null;
        return `#${srgb.map(channel => Math.round(Math.max(0, Math.min(1, channel)) * 255).toString(16).padStart(2, '0')).join('')}`;
    },
    _rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) { h = s = 0; }
        else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
    }
});

// ===== 10. Password Generator =====
ToolManager.register('password-generator', {
    init(container) {
        container.innerHTML = `<div class="tool-content tool-content-compact">
            <div class="tool-card" style="text-align:center;padding:20px;">
                <div id="tpOutput" style="font-family:Consolas,monospace;font-size:20px;word-break:break-all;min-height:30px;user-select:text;-webkit-user-select:text;letter-spacing:1px;"></div>
            </div>
            <div class="tool-row" style="justify-content:center;gap:8px;">
                <button class="tool-btn primary" id="tpGen">Generate</button>
                <button class="tool-btn" id="tpCopy">Copy</button>
            </div>
            <div class="tool-section">
                <div class="tool-row"><span class="tool-label" style="width:60px">Length</span><input type="range" id="tpLen" min="4" max="128" value="20" style="flex:1"><span id="tpLenVal" style="width:30px;text-align:right;font-family:Consolas,monospace">20</span></div>
            </div>
            <div class="tool-row" style="flex-wrap:wrap;gap:10px;">
                <label style="display:flex;gap:6px;align-items:center;font-size:13px;cursor:pointer"><input type="checkbox" id="tpUpper" checked> Uppercase</label>
                <label style="display:flex;gap:6px;align-items:center;font-size:13px;cursor:pointer"><input type="checkbox" id="tpLower" checked> Lowercase</label>
                <label style="display:flex;gap:6px;align-items:center;font-size:13px;cursor:pointer"><input type="checkbox" id="tpDigits" checked> Digits</label>
                <label style="display:flex;gap:6px;align-items:center;font-size:13px;cursor:pointer"><input type="checkbox" id="tpSymbols" checked> Symbols</label>
            </div>
            <div class="strength-bar"><div class="strength-fill" id="tpStrength"></div></div>
            <div class="tool-stats" id="tpStrengthLabel"></div>
        </div>`;
        const output = document.getElementById('tpOutput');
        const lenSlider = document.getElementById('tpLen');
        const lenVal = document.getElementById('tpLenVal');
        const strength = document.getElementById('tpStrength');
        const strengthLabel = document.getElementById('tpStrengthLabel');
        lenSlider.addEventListener('input', () => { lenVal.textContent = lenSlider.value; });
        const generate = () => {
            let chars = '';
            if (document.getElementById('tpUpper').checked) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            if (document.getElementById('tpLower').checked) chars += 'abcdefghijklmnopqrstuvwxyz';
            if (document.getElementById('tpDigits').checked) chars += '0123456789';
            if (document.getElementById('tpSymbols').checked) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
            if (!chars) { output.textContent = 'Select at least one character type'; return; }
            const len = parseInt(lenSlider.value);
            const arr = new Uint32Array(len);
            crypto.getRandomValues(arr);
            let pwd = '';
            for (let i = 0; i < len; i++) pwd += chars[arr[i] % chars.length];
            output.textContent = pwd;
            // Strength calc
            const poolSize = chars.length;
            const entropy = len * Math.log2(poolSize);
            let level, color, label;
            if (entropy < 40) { level = 20; color = '#ef4444'; label = 'Weak'; }
            else if (entropy < 60) { level = 40; color = '#f59e0b'; label = 'Fair'; }
            else if (entropy < 80) { level = 60; color = '#eab308'; label = 'Good'; }
            else if (entropy < 100) { level = 80; color = '#22c55e'; label = 'Strong'; }
            else { level = 100; color = '#10b981'; label = 'Very Strong'; }
            strength.style.width = level + '%';
            strength.style.background = color;
            strengthLabel.textContent = `${label} Â· ${Math.floor(entropy)} bits of entropy`;
        };
        document.getElementById('tpGen').onclick = generate;
        document.getElementById('tpCopy').onclick = () => {
            navigator.clipboard.writeText(output.textContent).then(() => showToast('Copied!'));
        };
        generate();
    },
    destroy() {},
    saveState() {},
    loadState() {}
});

// ===== 11. UUID / Hash Generator =====
ToolManager.register('uuid-hash', {
    init(container) {
        container.innerHTML = `<div class="tool-content tool-content-compact">
            <div class="tool-section">
                <span class="tool-label">UUID v4</span>
                <div class="tool-row">
                    <div class="tool-card" id="tuUuid" style="flex:1;font-family:Consolas,monospace;font-size:15px;user-select:text;-webkit-user-select:text;cursor:pointer" title="Click to copy"></div>
                    <button class="tool-btn primary" id="tuGenUuid">Generate</button>
                </div>
            </div>
            <div class="tool-divider"></div>
            <div class="tool-section">
                <span class="tool-label">Hash Generator</span>
                <textarea class="tool-textarea" id="tuText" placeholder="Enter text to hash..." style="min-height:120px"></textarea>
                <div class="tool-actions">
                    <button class="tool-btn primary" id="tuSha256">SHA-256</button>
                    <button class="tool-btn" id="tuSha512">SHA-512</button>
                    <button class="tool-btn" id="tuSha1">SHA-1</button>
                </div>
                <div class="tool-card" id="tuHashResult" style="font-family:Consolas,monospace;font-size:12.5px;word-break:break-all;user-select:text;-webkit-user-select:text;min-height:20px;cursor:pointer" title="Click to copy"></div>
            </div>
        </div>`;
        const uuidEl = document.getElementById('tuUuid');
        const genUuid = () => {
            uuidEl.textContent = crypto.randomUUID ? crypto.randomUUID() : this._uuidv4();
        };
        document.getElementById('tuGenUuid').onclick = genUuid;
        uuidEl.onclick = () => navigator.clipboard.writeText(uuidEl.textContent).then(() => showToast('Copied!'));
        genUuid();
        const hashResult = document.getElementById('tuHashResult');
        const hash = async (algo) => {
            const text = document.getElementById('tuText').value;
            if (!text) { hashResult.textContent = ''; return; }
            const enc = new TextEncoder().encode(text);
            const buf = await crypto.subtle.digest(algo, enc);
            const arr = Array.from(new Uint8Array(buf));
            hashResult.textContent = arr.map(b => b.toString(16).padStart(2, '0')).join('');
        };
        hashResult.onclick = () => navigator.clipboard.writeText(hashResult.textContent).then(() => showToast('Copied!'));
        document.getElementById('tuSha256').onclick = () => hash('SHA-256');
        document.getElementById('tuSha512').onclick = () => hash('SHA-512');
        document.getElementById('tuSha1').onclick = () => hash('SHA-1');
    },
    destroy() {},
    saveState() {},
    loadState() {},
    handleFileDrop(content) {
        const input = document.getElementById('tuText');
        if (input) input.value = content;
    },
    _uuidv4() {
        const a = new Uint8Array(16);
        crypto.getRandomValues(a);
        a[6] = (a[6] & 0x0f) | 0x40;
        a[8] = (a[8] & 0x3f) | 0x80;
        const h = Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
        return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
    }
});

