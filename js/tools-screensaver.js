// ===== 15. Screen Saver =====
ToolManager.register('screensaver', {
    _raf: null, _canvas: null, _listeners: {},
    _getSaved() {
        return JSON.parse(localStorage.getItem('tool-state-screensaver') || '{}');
    },
    _saveSetting(key, value) {
        const saved = this._getSaved();
        saved[key] = value;
        localStorage.setItem('tool-state-screensaver', JSON.stringify(saved));
    },
    init(container) {
        const saved = this._getSaved();
        const hasMask = !!saved.maskImage;
        const maskOn = saved.maskEnabled !== false;
        const isMatrix = (!saved.type || saved.type === 'matrix');
        container.innerHTML = `<div class="tool-content tool-content-compact" style="align-items:center;justify-content:center;gap:20px;text-align:center;">
            <div style="font-size:64px;">ðŸ–¥</div>
            <div style="font-size:18px;font-weight:500;">Screen Saver</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.5);max-width:400px;line-height:1.6;">
                Launch a fullscreen screen saver animation. Press <strong>ESC</strong> or click to exit.
            </div>
            <div class="tool-row" style="gap:12px;flex-wrap:wrap;justify-content:center;">
                <select class="tool-select" id="tssType" style="font-size:14px;padding:10px 14px;">
                    <option value="matrix" ${saved.type === 'matrix' || !saved.type ? 'selected' : ''}>Matrix Rain</option>
                    <option value="starfield" ${saved.type === 'starfield' ? 'selected' : ''}>Starfield</option>
                    <option value="clock" ${saved.type === 'clock' ? 'selected' : ''}>Clock Only</option>
                </select>
                <button class="tool-btn primary" id="tssStart" style="padding:12px 32px;font-size:15px;">Launch</button>
            </div>
            <div id="tssMaskSection" style="display:${isMatrix ? 'flex' : 'none'};flex-direction:column;align-items:center;gap:14px;width:100%;max-width:400px;">
                <div class="tool-divider" style="width:100%;"></div>
                <div style="font-size:15px;font-weight:500;">Matrix Mask</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.4);line-height:1.5;">
                    Upload a PNG with a transparent background. Opaque areas will create a ghostly retention pattern in the rain.
                </div>
                <div style="width:100%;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <label style="font-size:13px;">Letter Size</label>
                        <span id="tssSizeVal" style="font-size:12px;color:rgba(255,255,255,0.5);">${saved.letterSize ?? 16}px</span>
                    </div>
                    <input type="range" id="tssLetterSize" min="8" max="16" value="${saved.letterSize ?? 16}" style="width:100%;accent-color:#667eea;">
                </div>
                <div style="width:100%;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <label style="font-size:13px;">Rain Speed</label>
                        <span id="tssSpeedVal" style="font-size:12px;color:rgba(255,255,255,0.5);">${saved.rainSpeed ?? 100}%</span>
                    </div>
                    <input type="range" id="tssRainSpeed" min="20" max="200" value="${saved.rainSpeed ?? 100}" style="width:100%;accent-color:#667eea;">
                </div>
                <div class="toggle-label" style="width:100%;">
                    <label style="font-size:13px;">Enable Mask Effect</label>
                    <label class="toggle-switch"><input type="checkbox" id="tssMaskToggle" ${maskOn ? 'checked' : ''}><span class="toggle-slider"></span></label>
                </div>
                <div style="width:100%;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <label style="font-size:13px;">Intensity</label>
                        <span id="tssMaskIntVal" style="font-size:12px;color:rgba(255,255,255,0.5);">${saved.maskIntensity ?? 50}%</span>
                    </div>
                    <input type="range" id="tssMaskIntensity" min="10" max="100" value="${saved.maskIntensity ?? 50}" style="width:100%;accent-color:#667eea;">
                </div>
                <div id="tssMaskPreview" style="width:100%;min-height:60px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);border-radius:10px;padding:10px;box-sizing:border-box;">
                    ${hasMask ? `<img src="${saved.maskImage}" style="max-height:80px;max-width:100%;object-fit:contain;opacity:0.8;">` : `<span style="font-size:12px;color:rgba(255,255,255,0.25);">No image set</span>`}
                </div>
                <div class="tool-row" style="gap:8px;justify-content:center;">
                    <button class="tool-btn" id="tssMaskChoose" style="padding:8px 16px;font-size:13px;">Choose Image</button>
                    <button class="tool-btn" id="tssMaskClear" style="padding:8px 16px;font-size:13px;${hasMask ? '' : 'opacity:0.3;pointer-events:none;'}">Clear</button>
                </div>
                <input type="file" id="tssMaskFile" accept="image/png,image/webp" style="display:none;">
            </div>
            <div class="tool-divider" style="width:100%;max-width:400px;"></div>
            <div style="font-size:13px;color:rgba(255,255,255,0.35);max-width:400px;line-height:1.6;">
                <strong>Note:</strong> To lock your screen on exit, press <strong>Win+L</strong> after the screensaver closes.
                The browser cannot trigger OS-level screen lock for security reasons.
            </div>
        </div>`;

        // Type dropdown â€” persist + show/hide mask section
        document.getElementById('tssType').onchange = (e) => {
            this._saveSetting('type', e.target.value);
            document.getElementById('tssMaskSection').style.display = e.target.value === 'matrix' ? 'flex' : 'none';
        };
        document.getElementById('tssStart').onclick = () => this._launch(document.getElementById('tssType').value);

        // Letter size slider
        document.getElementById('tssLetterSize').oninput = (e) => {
            const val = parseInt(e.target.value);
            document.getElementById('tssSizeVal').textContent = val + 'px';
            this._saveSetting('letterSize', val);
        };

        // Rain speed slider
        document.getElementById('tssRainSpeed').oninput = (e) => {
            const val = parseInt(e.target.value);
            document.getElementById('tssSpeedVal').textContent = val + '%';
            this._saveSetting('rainSpeed', val);
        };

        // Mask toggle
        document.getElementById('tssMaskToggle').onchange = (e) => {
            this._saveSetting('maskEnabled', e.target.checked);
        };

        // Mask intensity slider
        document.getElementById('tssMaskIntensity').oninput = (e) => {
            const val = parseInt(e.target.value);
            document.getElementById('tssMaskIntVal').textContent = val + '%';
            this._saveSetting('maskIntensity', val);
        };

        // Mask file choose
        document.getElementById('tssMaskChoose').onclick = () => document.getElementById('tssMaskFile').click();
        document.getElementById('tssMaskFile').onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!['image/png', 'image/webp'].includes(file.type)) {
                if (typeof showToast === 'function') showToast('Please select a PNG or WebP image.', 3000);
                return;
            }
            if (file.size > 500 * 1024) {
                if (typeof showToast === 'function') showToast('Image too large (max 500 KB).', 3000);
                return;
            }
            const reader = new FileReader();
            reader.onload = (evt) => {
                const dataUrl = evt.target.result;
                this._saveSetting('maskImage', dataUrl);
                document.getElementById('tssMaskPreview').innerHTML = `<img src="${dataUrl}" style="max-height:80px;max-width:100%;object-fit:contain;opacity:0.8;">`;
                const clearBtn = document.getElementById('tssMaskClear');
                clearBtn.style.opacity = '1';
                clearBtn.style.pointerEvents = 'auto';
                if (typeof showToast === 'function') showToast('Mask image saved.', 2000);
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        };

        // Mask clear
        document.getElementById('tssMaskClear').onclick = () => {
            this._saveSetting('maskImage', '');
            document.getElementById('tssMaskPreview').innerHTML = `<span style="font-size:12px;color:rgba(255,255,255,0.25);">No image set</span>`;
            const clearBtn = document.getElementById('tssMaskClear');
            clearBtn.style.opacity = '0.3';
            clearBtn.style.pointerEvents = 'none';
            if (typeof showToast === 'function') showToast('Mask image cleared.', 2000);
        };
    },
    destroy() { this._stop(); },
    saveState() {},
    loadState() {},
    _launch(type) {
        const overlay = document.createElement('div');
        overlay.className = 'screensaver-overlay';
        const canvas = document.createElement('canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.cssText = 'width:100%;height:100%;';
        overlay.appendChild(canvas);
        document.body.appendChild(overlay);
        this._canvas = canvas;
        const ctx = canvas.getContext('2d');
        const exit = () => { this._stop(); overlay.remove(); };
        this._listeners.click = exit;
        this._listeners.keydown = (e) => { if (e.key === 'Escape') exit(); };
        overlay.addEventListener('click', this._listeners.click);
        document.addEventListener('keydown', this._listeners.keydown);
        if (type === 'matrix') this._matrix(ctx, canvas);
        else if (type === 'starfield') this._starfield(ctx, canvas);
        else this._clock(ctx, canvas);
    },
    _stop() {
        cancelAnimationFrame(this._raf);
        if (this._listeners.keydown) document.removeEventListener('keydown', this._listeners.keydown);
        this._listeners = {};
        const overlay = document.querySelector('.screensaver-overlay');
        if (overlay) overlay.remove();
    },
    _buildMask(canvas, maskImage, cellSize, callback) {
        const cols = Math.floor(canvas.width / cellSize);
        const rows = Math.floor(canvas.height / cellSize);
        const img = new Image();
        img.onload = () => {
            const offscreen = document.createElement('canvas');
            offscreen.width = canvas.width;
            offscreen.height = canvas.height;
            const octx = offscreen.getContext('2d');
            // Scale image to ~80% of canvas width, centered
            const scale = Math.min((canvas.width * 0.8) / img.width, (canvas.height * 0.7) / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = (canvas.width - w) / 2;
            const y = (canvas.height - h) / 2;
            octx.drawImage(img, x, y, w, h);
            const imageData = octx.getImageData(0, 0, offscreen.width, offscreen.height);
            const data = imageData.data;
            const imgW = offscreen.width;
            const mask = [];
            for (let c = 0; c < cols; c++) {
                mask[c] = [];
                for (let r = 0; r < rows; r++) {
                    // Area sampling: count opaque pixels to get density (0.0â€“1.0)
                    // Density-based mask: solid fills get full retention, thin edges get subtle retention
                    const x0 = c * cellSize;
                    const y0 = r * cellSize;
                    const x1 = Math.min(x0 + cellSize, imgW);
                    const y1 = Math.min(y0 + cellSize, offscreen.height);
                    let opaqueCount = 0;
                    let totalCount = 0;
                    for (let py = y0; py < y1; py++) {
                        for (let px = x0; px < x1; px++) {
                            totalCount++;
                            if (data[(py * imgW + px) * 4 + 3] > 50) opaqueCount++;
                        }
                    }
                    mask[c][r] = totalCount > 0 ? opaqueCount / totalCount : 0;
                }
            }
            callback(mask, cols, rows);
        };
        img.onerror = () => callback(null);
        img.src = maskImage;
    },
    _matrix(ctx, canvas) {
        const cellSize = Math.max(8, Math.min(16, this._getSaved().letterSize ?? 16));
        const fontSize = cellSize - 1;
        const cols = Math.floor(canvas.width / cellSize);
        const rows = Math.floor(canvas.height / cellSize);
        const drops = new Array(cols).fill(1);
        const chars = 'ã‚¢ã‚¤ã‚¦ã‚¨ã‚ªã‚«ã‚­ã‚¯ã‚±ã‚³ã‚µã‚·ã‚¹ã‚»ã‚½ã‚¿ãƒãƒ„ãƒ†ãƒˆãƒŠãƒ‹ãƒŒãƒãƒŽãƒãƒ’ãƒ•ãƒ˜ãƒ›ãƒžãƒŸãƒ ãƒ¡ãƒ¢ãƒ¤ãƒ¦ãƒ¨ãƒ©ãƒªãƒ«ãƒ¬ãƒ­ãƒ¯ãƒ²ãƒ³0123456789ABCDEF';

        const saved = this._getSaved();
        const maskEnabled = saved.maskEnabled !== false && !!saved.maskImage;
        // Intensity 10-100 maps to decay 0.92-0.99 and alpha multiplier 0.3-1.0
        const intensity = Math.max(10, Math.min(100, saved.maskIntensity ?? 50));
        const maskDecay = 0.92 + (intensity / 100) * 0.07;       // 0.92 (faint) â†’ 0.99 (very persistent)
        const maskAlphaMul = 0.3 + (intensity / 100) * 0.7;      // 0.3 (subtle) â†’ 1.0 (bold)

        // Rain speed: accumulator-based timing so fade + drops always move in lockstep
        const speedPct = Math.max(20, Math.min(200, saved.rainSpeed ?? 100));
        const msPerTick = 1000 / (60 * speedPct / 100); // ms between simulation ticks
        let lastTick = performance.now();
        let accumulator = 0;

        // Cell data for mask retention: stores { char, brightness } per cell
        const cellData = [];
        for (let c = 0; c < cols; c++) {
            cellData[c] = [];
            for (let r = 0; r < rows; r++) {
                cellData[c][r] = { char: '', brightness: 0 };
            }
        }

        let mask = null;
        const startTime = Date.now();
        const revealDelay = 4000; // 4 seconds of pure rain before mask effect

        // Start the rain immediately; mask loads in parallel
        if (maskEnabled) {
            this._buildMask(canvas, saved.maskImage, cellSize, (m) => { mask = m; });
        }

        const draw = (now) => {
            // Accumulator: run simulation ticks in lockstep (fade + drops together)
            accumulator += now - lastTick;
            lastTick = now;
            // Cap accumulator to avoid spiral-of-death on tab refocus
            if (accumulator > 200) accumulator = 200;

            let ticked = false;
            while (accumulator >= msPerTick) {
                accumulator -= msPerTick;
                ticked = true;

                // === One simulation tick: fade + advance drops ===
                ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.font = fontSize + 'px monospace';

                for (let i = 0; i < drops.length; i++) {
                    const ch = chars[Math.floor(Math.random() * chars.length)];
                    const row = drops[i];
                    ctx.fillStyle = `hsl(120, 100%, ${50 + Math.random() * 30}%)`;
                    ctx.fillText(ch, i * cellSize, row * cellSize);

                    if (row >= 0 && row < rows) {
                        cellData[i][row].char = ch;
                        cellData[i][row].brightness = 1.0;
                    }

                    if (drops[i] * cellSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
                    drops[i]++;
                }

                // Mask retention effect â€” only after reveal delay and if mask loaded
                const elapsed = Date.now() - startTime;
                if (mask && elapsed > revealDelay) {
                    const ramp = Math.min(1, (elapsed - revealDelay) / 2000);
                    for (let c = 0; c < cols; c++) {
                        for (let r = 0; r < rows; r++) {
                            const density = mask[c][r];
                            if (density <= 0) continue;
                            const cell = cellData[c][r];
                            if (cell.brightness <= 0.03 || !cell.char) continue;
                            // Scale decay and alpha by density: thin edges fade faster, solid fills linger
                            const cellDecay = 1 - (1 - maskDecay) / density;
                            cell.brightness *= Math.max(0.90, Math.min(cellDecay, maskDecay));
                            const alpha = cell.brightness * ramp * maskAlphaMul * Math.sqrt(density);
                            const lightness = 45 + alpha * 35;
                            ctx.fillStyle = `hsla(120, 100%, ${lightness}%, ${alpha})`;
                            ctx.fillText(cell.char, c * cellSize, r * cellSize);
                        }
                    }
                } else {
                    for (let c = 0; c < cols; c++) {
                        for (let r = 0; r < rows; r++) {
                            cellData[c][r].brightness *= 0.90;
                        }
                    }
                }
            }

            this._raf = requestAnimationFrame(draw);
        };
        this._raf = requestAnimationFrame(draw);
    },
    _starfield(ctx, canvas) {
        const stars = Array.from({ length: 300 }, () => ({
            x: Math.random() * canvas.width - canvas.width / 2,
            y: Math.random() * canvas.height - canvas.height / 2,
            z: Math.random() * canvas.width
        }));
        const draw = () => {
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const cx = canvas.width / 2, cy = canvas.height / 2;
            for (const star of stars) {
                star.z -= 4;
                if (star.z <= 0) { star.z = canvas.width; star.x = Math.random() * canvas.width - cx; star.y = Math.random() * canvas.height - cy; }
                const sx = (star.x / star.z) * cx + cx;
                const sy = (star.y / star.z) * cy + cy;
                const r = Math.max(0, (1 - star.z / canvas.width) * 3);
                const a = Math.max(0, (1 - star.z / canvas.width));
                ctx.beginPath();
                ctx.arc(sx, sy, r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,255,255,${a})`;
                ctx.fill();
            }
            this._raf = requestAnimationFrame(draw);
        };
        draw();
    },
    _clock(ctx, canvas) {
        const draw = () => {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const now = new Date();
            const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
            ctx.fillStyle = '#fff';
            ctx.font = '600 80px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(time, canvas.width / 2, canvas.height / 2);
            const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            ctx.font = '300 20px Inter, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillText(date, canvas.width / 2, canvas.height / 2 + 60);
            this._raf = requestAnimationFrame(draw);
        };
        draw();
    }
});
