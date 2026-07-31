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

// ===== 9. Color Picker =====
ToolManager.register('color-picker', {
    _state: null,
    init(container) {
        const s = this._state || { color: '#667eea', history: [] };
        container.innerHTML = `<div class="tool-content tool-content-compact">
            <div class="tool-row" style="gap:16px;align-items:flex-start;flex-wrap:wrap;">
                <div class="tool-col" style="min-width:200px;">
                    <div class="color-swatch" id="tcSwatch" style="background:${s.color}"></div>
                    <input type="color" id="tcPicker" value="${s.color}" style="width:100%;height:36px;border:none;border-radius:8px;cursor:pointer;background:transparent;">
                </div>
                <div class="tool-col" style="flex:1;min-width:200px;gap:10px;">
                    <div class="tool-row"><span class="tool-label" style="width:40px">HEX</span><input class="tool-input" id="tcHex" value="${s.color}" style="flex:1;font-family:Consolas,monospace"><button class="tool-btn" onclick="navigator.clipboard.writeText(document.getElementById('tcHex').value).then(()=>showToast('Copied!'))">Copy</button></div>
                    <div class="tool-row"><span class="tool-label" style="width:40px">RGB</span><input class="tool-input" id="tcRgb" style="flex:1;font-family:Consolas,monospace" readonly><button class="tool-btn" onclick="navigator.clipboard.writeText(document.getElementById('tcRgb').value).then(()=>showToast('Copied!'))">Copy</button></div>
                    <div class="tool-row"><span class="tool-label" style="width:40px">HSL</span><input class="tool-input" id="tcHsl" style="flex:1;font-family:Consolas,monospace" readonly><button class="tool-btn" onclick="navigator.clipboard.writeText(document.getElementById('tcHsl').value).then(()=>showToast('Copied!'))">Copy</button></div>
                </div>
            </div>
            <div class="tool-divider"></div>
            <span class="tool-label">Recent Colors</span>
            <div class="color-history" id="tcHistory"></div>
        </div>`;
        const picker = document.getElementById('tcPicker');
        const swatch = document.getElementById('tcSwatch');
        const hex = document.getElementById('tcHex');
        const rgb = document.getElementById('tcRgb');
        const hsl = document.getElementById('tcHsl');
        const historyEl = document.getElementById('tcHistory');
        const update = (c) => {
            swatch.style.background = c;
            hex.value = c;
            const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
            rgb.value = `rgb(${r}, ${g}, ${b})`;
            const [h, s2, l] = this._rgbToHsl(r, g, b);
            hsl.value = `hsl(${h}, ${s2}%, ${l}%)`;
        };
        const addHistory = (c) => {
            if (!s.history.includes(c)) {
                s.history.unshift(c);
                if (s.history.length > 20) s.history.pop();
                renderHistory();
            }
        };
        const renderHistory = () => {
            historyEl.innerHTML = s.history.map(c =>
                `<div class="color-history-item" style="background:${c}" title="${c}"></div>`
            ).join('');
            historyEl.querySelectorAll('.color-history-item').forEach((el, i) => {
                el.onclick = () => { picker.value = s.history[i]; update(s.history[i]); };
            });
        };
        picker.addEventListener('input', () => { update(picker.value); });
        picker.addEventListener('change', () => { addHistory(picker.value); });
        hex.addEventListener('change', () => {
            let v = hex.value.trim();
            if (v[0] !== '#') v = '#' + v;
            if (/^#[0-9a-fA-F]{6}$/.test(v)) { picker.value = v; update(v); addHistory(v); }
        });
        update(s.color);
        renderHistory();
    },
    destroy() {},
    saveState() {
        const hex = document.getElementById('tcHex')?.value || '#667eea';
        const histEls = document.querySelectorAll('#tcHistory .color-history-item');
        const history = Array.from(histEls).map(el => {
            const bg = el.style.background;
            return el.title || bg;
        });
        this._state = { color: hex, history };
    },
    loadState() {
        if (!this._state) {
            const saved = localStorage.getItem('tool-state-color-picker');
            if (saved) try { this._state = JSON.parse(saved); } catch {}
        }
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

