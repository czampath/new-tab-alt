// ============================================================
//  All Tool Registrations
// ============================================================

// ===== 1. JSON Formatter =====
ToolManager.register('json-formatter', {
    _state: null,
    init(container) {
        container.innerHTML = `<div class="tool-content">
            <div class="tool-actions">
                <button class="tool-btn primary" id="tjFmt2">Format 2-sp</button>
                <button class="tool-btn" id="tjFmt4">Format 4-sp</button>
                <button class="tool-btn" id="tjMin">Minify</button>
                <button class="tool-btn" id="tjCopy">Copy Output</button>
            </div>
            <div class="tool-split">
                <textarea class="tool-textarea" id="tjInput" placeholder="Paste JSON here...">${this._state || ''}</textarea>
                <div class="tool-output" id="tjOutput"></div>
            </div>
        </div>`;
        const input = document.getElementById('tjInput');
        const output = document.getElementById('tjOutput');
        const fmt = (sp) => {
            try {
                const parsed = JSON.parse(input.value);
                const str = JSON.stringify(parsed, null, sp);
                output.innerHTML = this._highlight(str);
            } catch (e) { output.innerHTML = `<span class="tool-error">${e.message}</span>`; }
        };
        document.getElementById('tjFmt2').onclick = () => fmt(2);
        document.getElementById('tjFmt4').onclick = () => fmt(4);
        document.getElementById('tjMin').onclick = () => {
            try {
                output.innerHTML = this._highlight(JSON.stringify(JSON.parse(input.value)));
            } catch (e) { output.innerHTML = `<span class="tool-error">${e.message}</span>`; }
        };
        document.getElementById('tjCopy').onclick = () => {
            navigator.clipboard.writeText(output.textContent).then(() => showToast('Copied!'));
        };
        if (this._state) fmt(2);
    },
    destroy() {},
    saveState() { this._state = document.getElementById('tjInput')?.value || ''; },
    loadState() { this._state = this._state || ''; },
    _highlight(json) {
        return json.replace(/("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (m) => {
            let cls = 'json-number';
            if (/^"/.test(m)) cls = /:$/.test(m) ? 'json-key' : 'json-string';
            else if (/true|false/.test(m)) cls = 'json-bool';
            else if (/null/.test(m)) cls = 'json-null';
            return `<span class="${cls}">${m}</span>`;
        });
    }
});

// ===== 2. Markdown Viewer =====
ToolManager.register('markdown-viewer', {
    _state: null, _markedLoaded: false, _presentation: false,
    init(container) {
        container.innerHTML = `<div class="tool-content">
            <div class="tool-actions" id="tmActions">
                <button class="tool-btn primary" id="tmPreview">Preview</button>
                <button class="tool-btn" id="tmPresentation">Presentation Mode</button>
                <button class="tool-btn" id="tmCopyHtml">Copy HTML</button>
            </div>
            <div class="tool-split" id="tmSplit">
                <textarea class="tool-textarea" id="tmInput" placeholder="Type or paste Markdown...">${this._state || '# Hello\n\nStart typing **Markdown** here...'}</textarea>
                <div class="md-preview" id="tmOutput"></div>
            </div>
        </div>`;
        const input = document.getElementById('tmInput');
        const output = document.getElementById('tmOutput');
        const render = () => {
            if (window.marked) {
                output.innerHTML = window.marked.parse(input.value);
            } else {
                output.innerHTML = this._basicMd(input.value);
            }
        };
        input.addEventListener('input', render);
        // Load marked.js lazily
        if (!this._markedLoaded) {
            loadScript('lib/marked.min.js')
                .then(() => { this._markedLoaded = true; render(); })
                .catch(() => render());
        }
        render();
        document.getElementById('tmPreview').onclick = () => {
            const editorArea = input.parentElement.querySelector('.tool-textarea');
            if (editorArea.style.display === 'none') {
                editorArea.style.display = '';
                document.getElementById('tmPreview').textContent = 'Preview';
            } else {
                editorArea.style.display = 'none';
                document.getElementById('tmPreview').textContent = 'Show Editor';
            }
        };
        document.getElementById('tmPresentation').onclick = () => {
            const viewport = document.getElementById('toolViewport');
            if (viewport.classList.contains('presentation')) {
                viewport.classList.remove('presentation');
                document.getElementById('tmActions').style.display = '';
                input.style.display = '';
                this._presentation = false;
            } else {
                viewport.classList.add('presentation');
                document.getElementById('tmActions').style.display = 'none';
                input.style.display = 'none';
                this._presentation = true;
                showToast('Press ESC to exit presentation');
            }
        };
        document.getElementById('tmCopyHtml').onclick = () => {
            navigator.clipboard.writeText(output.innerHTML).then(() => showToast('HTML copied!'));
        };
    },
    destroy() {
        document.getElementById('toolViewport')?.classList.remove('presentation');
    },
    saveState() { this._state = document.getElementById('tmInput')?.value || ''; },
    loadState() {},
    _basicMd(md) {
        let html = md
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^---$/gm, '<hr>');
        return `<p>${html}</p>`;
    }
});

// ===== 3. SQL Formatter =====
ToolManager.register('sql-formatter', {
    _state: null,
    init(container) {
        container.innerHTML = `<div class="tool-content">
            <div class="tool-actions">
                <button class="tool-btn primary" id="tsFmt">Format</button>
                <button class="tool-btn" id="tsMin">Minify</button>
                <button class="tool-btn" id="tsConcat">Concat → String</button>
                <button class="tool-btn" id="tsDeconcat">String → SQL</button>
                <button class="tool-btn" id="tsCopy">Copy Output</button>
                <select class="tool-select" id="tsDialect">
                    <option value="sql">Standard SQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="postgresql">PostgreSQL</option>
                    <option value="tsql">T-SQL</option>
                    <option value="plsql">PL/SQL</option>
                </select>
            </div>
            <div class="tool-split">
                <textarea class="tool-textarea" id="tsInput" placeholder="Paste SQL here...">${this._state || ''}</textarea>
                <div class="tool-output" id="tsOutput"></div>
            </div>
        </div>`;
        const input = document.getElementById('tsInput');
        const output = document.getElementById('tsOutput');
        const dialect = document.getElementById('tsDialect');
        const loadFmt = () => loadScript('lib/sql-formatter.min.js');
        document.getElementById('tsFmt').onclick = async () => {
            try {
                await loadFmt();
                output.textContent = window.sqlFormatter.format(input.value, { language: dialect.value });
            } catch { output.textContent = this._basicFmt(input.value); }
        };
        document.getElementById('tsMin').onclick = () => {
            output.textContent = input.value.replace(/\s+/g, ' ').replace(/\s*([,;()=<>])\s*/g, '$1').trim();
        };
        document.getElementById('tsConcat').onclick = () => {
            const lines = input.value.split('\n');
            output.textContent = lines.map((l, i) => {
                const escaped = l.replace(/'/g, "''").replace(/"/g, '\\"');
                return (i === 0 ? '"' : '+ "') + escaped + (i < lines.length - 1 ? ' "' : '"');
            }).join('\n');
        };
        document.getElementById('tsDeconcat').onclick = () => {
            const text = input.value;
            const result = text
                .replace(/^\s*\+?\s*"/gm, '')
                .replace(/"\s*;?\s*$/gm, '')
                .replace(/"$/gm, '')
                .replace(/\\"/g, '"')
                .replace(/''/g, "'");
            output.textContent = result;
        };
        document.getElementById('tsCopy').onclick = () => {
            navigator.clipboard.writeText(output.textContent).then(() => showToast('Copied!'));
        };
    },
    destroy() {},
    saveState() { this._state = document.getElementById('tsInput')?.value || ''; },
    loadState() {},
    _basicFmt(sql) {
        const keywords = ['SELECT','FROM','WHERE','AND','OR','JOIN','LEFT','RIGHT','INNER','OUTER','ON','GROUP BY','ORDER BY','HAVING','INSERT','UPDATE','DELETE','SET','VALUES','INTO','CREATE','ALTER','DROP','TABLE','INDEX','VIEW','UNION','ALL','DISTINCT','AS','IN','NOT','NULL','IS','BETWEEN','LIKE','EXISTS','CASE','WHEN','THEN','ELSE','END','LIMIT','OFFSET','WITH'];
        let result = sql;
        keywords.forEach(kw => {
            result = result.replace(new RegExp(`\\b${kw}\\b`, 'gi'), '\n' + kw);
        });
        return result.trim();
    }
});

// ===== 4. Text Formatter =====
ToolManager.register('text-formatter', {
    _state: null,
    init(container) {
        container.innerHTML = `<div class="tool-content">
            <div class="tool-actions">
                <button class="tool-btn" id="ttUpper">UPPER</button>
                <button class="tool-btn" id="ttLower">lower</button>
                <button class="tool-btn" id="ttTitle">Title</button>
                <button class="tool-btn" id="ttTrim">Trim</button>
                <button class="tool-btn" id="ttSort">Sort Lines</button>
                <button class="tool-btn" id="ttDedup">Dedup Lines</button>
                <button class="tool-btn" id="ttReverse">Reverse</button>
                <button class="tool-btn" id="ttB64Enc">Base64 Enc</button>
                <button class="tool-btn" id="ttB64Dec">Base64 Dec</button>
                <button class="tool-btn" id="ttUrlEnc">URL Enc</button>
                <button class="tool-btn" id="ttUrlDec">URL Dec</button>
                <button class="tool-btn" id="ttCopy">Copy</button>
            </div>
            <textarea class="tool-textarea" id="ttInput" placeholder="Type or paste text...">${this._state || ''}</textarea>
            <div class="tool-stats" id="ttStats"></div>
        </div>`;
        const input = document.getElementById('ttInput');
        const stats = document.getElementById('ttStats');
        const updateStats = () => {
            const v = input.value;
            const chars = v.length;
            const words = v.trim() ? v.trim().split(/\s+/).length : 0;
            const lines = v ? v.split('\n').length : 0;
            stats.textContent = `${chars} chars · ${words} words · ${lines} lines`;
        };
        input.addEventListener('input', updateStats);
        updateStats();
        const apply = (fn) => { input.value = fn(input.value); updateStats(); };
        document.getElementById('ttUpper').onclick = () => apply(v => v.toUpperCase());
        document.getElementById('ttLower').onclick = () => apply(v => v.toLowerCase());
        document.getElementById('ttTitle').onclick = () => apply(v => v.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase()));
        document.getElementById('ttTrim').onclick = () => apply(v => v.split('\n').map(l => l.trim()).join('\n'));
        document.getElementById('ttSort').onclick = () => apply(v => v.split('\n').sort().join('\n'));
        document.getElementById('ttDedup').onclick = () => apply(v => [...new Set(v.split('\n'))].join('\n'));
        document.getElementById('ttReverse').onclick = () => apply(v => v.split('\n').reverse().join('\n'));
        document.getElementById('ttB64Enc').onclick = () => apply(v => { try { return btoa(unescape(encodeURIComponent(v))); } catch { return v; } });
        document.getElementById('ttB64Dec').onclick = () => apply(v => { try { return decodeURIComponent(escape(atob(v))); } catch { return v; } });
        document.getElementById('ttUrlEnc').onclick = () => apply(v => encodeURIComponent(v));
        document.getElementById('ttUrlDec').onclick = () => apply(v => { try { return decodeURIComponent(v); } catch { return v; } });
        document.getElementById('ttCopy').onclick = () => {
            navigator.clipboard.writeText(input.value).then(() => showToast('Copied!'));
        };
    },
    destroy() {},
    saveState() { this._state = document.getElementById('ttInput')?.value || ''; },
    loadState() {}
});

// ===== 5. Regex Tester =====
ToolManager.register('regex-tester', {
    _state: null,
    init(container) {
        const s = this._state || {};
        container.innerHTML = `<div class="tool-content">
            <div class="tool-row" style="gap:8px;flex-wrap:wrap;">
                <span class="tool-label" style="text-transform:none;font-size:16px;color:rgba(255,255,255,0.4)">/</span>
                <input class="tool-input" id="trPat" placeholder="pattern" value="${s.pattern || ''}" style="flex:1;min-width:150px;font-family:Consolas,monospace">
                <span class="tool-label" style="text-transform:none;font-size:16px;color:rgba(255,255,255,0.4)">/</span>
                <input class="tool-input" id="trFlags" value="${s.flags || 'gi'}" style="width:60px;text-align:center;font-family:Consolas,monospace" placeholder="gi">
            </div>
            <div class="tool-split" style="flex:1;">
                <div style="display:flex;flex-direction:column;gap:6px;flex:1;">
                    <span class="tool-label">Test String</span>
                    <textarea class="tool-textarea" id="trInput" placeholder="Enter test string...">${s.text || ''}</textarea>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;flex:1;">
                    <span class="tool-label">Matches</span>
                    <div class="tool-output" id="trOutput" style="flex:1;line-height:1.8"></div>
                    <div class="tool-stats" id="trStats"></div>
                </div>
            </div>
        </div>`;
        const pat = document.getElementById('trPat');
        const flags = document.getElementById('trFlags');
        const input = document.getElementById('trInput');
        const output = document.getElementById('trOutput');
        const stats = document.getElementById('trStats');
        const run = () => {
            if (!pat.value) { output.innerHTML = input.value; stats.textContent = ''; return; }
            try {
                const re = new RegExp(pat.value, flags.value);
                const text = input.value;
                let matchCount = 0;
                let groups = [];
                if (flags.value.includes('g')) {
                    let m;
                    const parts = [];
                    let lastIdx = 0;
                    const re2 = new RegExp(pat.value, flags.value);
                    while ((m = re2.exec(text)) !== null) {
                        matchCount++;
                        if (m.index > lastIdx) parts.push(this._esc(text.slice(lastIdx, m.index)));
                        parts.push(`<span class="regex-match">${this._esc(m[0])}</span>`);
                        if (m.length > 1) groups.push(m.slice(1));
                        lastIdx = re2.lastIndex;
                        if (m[0].length === 0) re2.lastIndex++;
                    }
                    if (lastIdx < text.length) parts.push(this._esc(text.slice(lastIdx)));
                    output.innerHTML = parts.join('');
                } else {
                    const m = re.exec(text);
                    if (m) {
                        matchCount = 1;
                        output.innerHTML = this._esc(text.slice(0, m.index)) +
                            `<span class="regex-match">${this._esc(m[0])}</span>` +
                            this._esc(text.slice(m.index + m[0].length));
                        if (m.length > 1) groups.push(m.slice(1));
                    } else {
                        output.innerHTML = this._esc(text);
                    }
                }
                let info = `${matchCount} match${matchCount !== 1 ? 'es' : ''}`;
                if (groups.length) info += ` · Groups: ${groups.map((g, i) => `[${g.join(', ')}]`).join(' ')}`;
                stats.textContent = info;
            } catch (e) {
                output.innerHTML = `<span class="tool-error">${e.message}</span>`;
                stats.textContent = '';
            }
        };
        pat.addEventListener('input', run);
        flags.addEventListener('input', run);
        input.addEventListener('input', run);
        run();
    },
    destroy() {},
    saveState() {
        this._state = {
            pattern: document.getElementById('trPat')?.value || '',
            flags: document.getElementById('trFlags')?.value || 'gi',
            text: document.getElementById('trInput')?.value || ''
        };
    },
    loadState() {},
    _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
});

// ===== 6. Diff Viewer =====
ToolManager.register('diff-viewer', {
    _state: null,
    init(container) {
        const s = this._state || {};
        container.innerHTML = `<div class="tool-content">
            <div class="tool-actions">
                <button class="tool-btn primary" id="tdCompare">Compare</button>
                <button class="tool-btn" id="tdSwap">Swap</button>
            </div>
            <div class="tool-split" style="flex:1;" id="tdInputs">
                <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
                    <span class="tool-label">Original</span>
                    <textarea class="tool-textarea" id="tdLeft" placeholder="Original text...">${s.left || ''}</textarea>
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
                    <span class="tool-label">Modified</span>
                    <textarea class="tool-textarea" id="tdRight" placeholder="Modified text...">${s.right || ''}</textarea>
                </div>
            </div>
            <div class="tool-output" id="tdOutput" style="display:none;flex:1;"></div>
        </div>`;
        document.getElementById('tdCompare').onclick = () => {
            const left = document.getElementById('tdLeft').value.split('\n');
            const right = document.getElementById('tdRight').value.split('\n');
            const output = document.getElementById('tdOutput');
            const inputsEl = document.getElementById('tdInputs');
            const maxLen = Math.max(left.length, right.length);
            let html = '';
            for (let i = 0; i < maxLen; i++) {
                const l = left[i], r = right[i];
                if (l === undefined) {
                    html += `<div class="diff-line diff-added"><span class="diff-line-num">${i + 1}</span>+ ${this._esc(r)}</div>`;
                } else if (r === undefined) {
                    html += `<div class="diff-line diff-removed"><span class="diff-line-num">${i + 1}</span>- ${this._esc(l)}</div>`;
                } else if (l !== r) {
                    html += `<div class="diff-line diff-removed"><span class="diff-line-num">${i + 1}</span>- ${this._esc(l)}</div>`;
                    html += `<div class="diff-line diff-added"><span class="diff-line-num">${i + 1}</span>+ ${this._esc(r)}</div>`;
                } else {
                    html += `<div class="diff-line"><span class="diff-line-num">${i + 1}</span>  ${this._esc(l)}</div>`;
                }
            }
            output.innerHTML = html || '<span style="color:rgba(255,255,255,0.4)">No differences found</span>';
            output.style.display = '';
            inputsEl.style.flex = '0.6';
        };
        document.getElementById('tdSwap').onclick = () => {
            const l = document.getElementById('tdLeft');
            const r = document.getElementById('tdRight');
            [l.value, r.value] = [r.value, l.value];
        };
    },
    destroy() {},
    saveState() {
        this._state = {
            left: document.getElementById('tdLeft')?.value || '',
            right: document.getElementById('tdRight')?.value || ''
        };
    },
    loadState() {},
    _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
});

// ===== 7. Date Formatter =====
ToolManager.register('date-formatter', {
    _state: null,
    init(container) {
        container.innerHTML = `<div class="tool-content">
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
                <span style="color:rgba(255,255,255,0.4)">→</span>
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
        container.innerHTML = `<div class="tool-content">
            <div class="tool-card">
                <div class="tool-row" style="justify-content:space-between">
                    <span class="tool-label">Current Epoch</span>
                    <span id="teNow" style="font-family:Consolas,monospace;font-size:18px;user-select:text;-webkit-user-select:text;"></span>
                </div>
            </div>
            <div class="tool-divider"></div>
            <span class="tool-label">Epoch → Human</span>
            <div class="tool-row">
                <input class="tool-input" id="teEpoch" placeholder="Unix timestamp (s or ms)" style="flex:1;font-family:Consolas,monospace">
                <button class="tool-btn primary" id="teToHuman">Convert</button>
            </div>
            <div class="tool-card" id="teHumanResult"></div>
            <div class="tool-divider"></div>
            <span class="tool-label">Human → Epoch</span>
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
        container.innerHTML = `<div class="tool-content">
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
        container.innerHTML = `<div class="tool-content">
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
            strengthLabel.textContent = `${label} · ${Math.floor(entropy)} bits of entropy`;
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
        container.innerHTML = `<div class="tool-content">
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
                <textarea class="tool-textarea" id="tuText" placeholder="Enter text to hash..." style="min-height:80px;flex:none"></textarea>
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
    _uuidv4() {
        const a = new Uint8Array(16);
        crypto.getRandomValues(a);
        a[6] = (a[6] & 0x0f) | 0x40;
        a[8] = (a[8] & 0x3f) | 0x80;
        const h = Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
        return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
    }
});

// ===== 12. Notes =====
ToolManager.register('notes', {
    _notes: null, _activeId: null, _saveTimer: null,
    init(container) {
        this._notes = JSON.parse(localStorage.getItem('tool-state-notes') || '[]');
        if (!this._notes.length) this._notes.push({ id: Date.now(), title: 'Untitled', content: '', updated: Date.now() });
        this._activeId = this._notes[0].id;
        container.innerHTML = `<div class="tool-content" style="flex-direction:row;">
            <div class="notes-sidebar" id="tnSidebar"></div>
            <div class="tool-col" style="flex:1;min-width:0;">
                <div class="tool-row">
                    <input class="tool-input" id="tnTitle" placeholder="Note title" style="flex:1;font-weight:500;">
                    <button class="tool-btn" id="tnNew">+ New</button>
                    <button class="tool-btn danger" id="tnDel">Delete</button>
                </div>
                <textarea class="tool-textarea" id="tnContent" placeholder="Start typing..." style="flex:1;"></textarea>
            </div>
        </div>`;
        const titleEl = document.getElementById('tnTitle');
        const contentEl = document.getElementById('tnContent');
        const renderSidebar = () => {
            const sb = document.getElementById('tnSidebar');
            sb.innerHTML = this._notes.map(n => `
                <div class="note-item ${n.id === this._activeId ? 'active' : ''}" data-id="${n.id}">
                    ${this._esc(n.title || 'Untitled')}
                    <div class="note-item-time">${new Date(n.updated).toLocaleDateString()}</div>
                </div>
            `).join('');
            sb.querySelectorAll('.note-item').forEach(el => {
                el.onclick = () => {
                    this._saveCurrentNote();
                    this._activeId = parseInt(el.dataset.id);
                    loadNote();
                    renderSidebar();
                };
            });
        };
        const loadNote = () => {
            const note = this._notes.find(n => n.id === this._activeId);
            if (note) {
                titleEl.value = note.title;
                contentEl.value = note.content;
            }
        };
        this._saveCurrentNote = () => {
            const note = this._notes.find(n => n.id === this._activeId);
            if (note) {
                note.title = titleEl.value;
                note.content = contentEl.value;
                note.updated = Date.now();
            }
            localStorage.setItem('tool-state-notes', JSON.stringify(this._notes));
        };
        const debounceSave = () => {
            clearTimeout(this._saveTimer);
            this._saveTimer = setTimeout(() => this._saveCurrentNote(), 500);
        };
        titleEl.addEventListener('input', () => {
            const note = this._notes.find(n => n.id === this._activeId);
            if (note) note.title = titleEl.value;
            renderSidebar();
            debounceSave();
        });
        contentEl.addEventListener('input', debounceSave);
        document.getElementById('tnNew').onclick = () => {
            this._saveCurrentNote();
            const newNote = { id: Date.now(), title: 'Untitled', content: '', updated: Date.now() };
            this._notes.unshift(newNote);
            this._activeId = newNote.id;
            loadNote();
            renderSidebar();
        };
        document.getElementById('tnDel').onclick = () => {
            if (this._notes.length <= 1) { showToast('Cannot delete last note'); return; }
            this._notes = this._notes.filter(n => n.id !== this._activeId);
            this._activeId = this._notes[0].id;
            loadNote();
            renderSidebar();
            localStorage.setItem('tool-state-notes', JSON.stringify(this._notes));
        };
        loadNote();
        renderSidebar();
    },
    destroy() { clearTimeout(this._saveTimer); },
    saveState() { if (this._saveCurrentNote) this._saveCurrentNote(); },
    loadState() {},
    _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
});

// ===== 13. Reminder =====
ToolManager.register('reminder', {
    _reminders: null,
    init(container) {
        this._reminders = JSON.parse(localStorage.getItem('tool-state-reminder') || '[]');
        container.innerHTML = `<div class="tool-content">
            <div class="tool-row" style="flex-wrap:wrap;">
                <input class="tool-input" id="trmTitle" placeholder="Reminder title..." style="flex:1;min-width:150px">
                <input class="tool-input" id="trmTime" type="datetime-local" style="flex:0 0 auto">
                <button class="tool-btn primary" id="trmAdd">Add</button>
            </div>
            <div id="trmPermission" style="display:none;" class="tool-card">
                <div class="tool-row" style="justify-content:space-between">
                    <span style="font-size:13px;color:rgba(255,255,255,0.6)">Notifications not enabled</span>
                    <button class="tool-btn" id="trmAllow">Enable Notifications</button>
                </div>
            </div>
            <div id="trmList" style="display:flex;flex-direction:column;gap:6px;flex:1;overflow-y:auto;"></div>
        </div>`;
        if ('Notification' in window && Notification.permission !== 'granted') {
            document.getElementById('trmPermission').style.display = '';
            document.getElementById('trmAllow').onclick = () => {
                Notification.requestPermission().then(p => {
                    if (p === 'granted') document.getElementById('trmPermission').style.display = 'none';
                });
            };
        }
        const renderList = () => {
            const list = document.getElementById('trmList');
            const now = Date.now();
            const sorted = [...this._reminders].sort((a, b) => a.time - b.time);
            list.innerHTML = sorted.length ? sorted.map(r => `
                <div class="reminder-item ${r.time < now ? 'past' : ''}">
                    <span class="reminder-title">${this._esc(r.title)}</span>
                    <span class="reminder-time">${new Date(r.time).toLocaleString()}</span>
                    <button class="tool-btn danger" style="padding:4px 10px;font-size:11px" data-rid="${r.id}">×</button>
                </div>
            `).join('') : '<span style="color:rgba(255,255,255,0.3);text-align:center;padding:20px;">No reminders set</span>';
            list.querySelectorAll('[data-rid]').forEach(btn => {
                btn.onclick = () => {
                    this._reminders = this._reminders.filter(r => r.id !== parseInt(btn.dataset.rid));
                    localStorage.setItem('tool-state-reminder', JSON.stringify(this._reminders));
                    renderList();
                };
            });
        };
        document.getElementById('trmAdd').onclick = () => {
            const title = document.getElementById('trmTitle').value.trim();
            const time = new Date(document.getElementById('trmTime').value).getTime();
            if (!title || isNaN(time)) { showToast('Enter title and time'); return; }
            this._reminders.push({ id: Date.now(), title, time, fired: false });
            localStorage.setItem('tool-state-reminder', JSON.stringify(this._reminders));
            document.getElementById('trmTitle').value = '';
            document.getElementById('trmTime').value = '';
            renderList();
            showToast('Reminder set!');
        };
        renderList();
    },
    destroy() {},
    saveState() {},
    loadState() {},
    _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
});

// ===== 14. Keep Screen Awake =====
ToolManager.register('keep-awake', {
    init(container) {
        const active = isWakeLockActive();
        container.innerHTML = `<div class="tool-content" style="align-items:center;justify-content:center;gap:24px;text-align:center;">
            <div style="font-size:64px;">☕</div>
            <div style="font-size:18px;font-weight:500;">Keep Screen Awake</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.5);max-width:360px;line-height:1.6;">
                Prevents your screen from dimming or locking due to inactivity. Uses the Screen Wake Lock API — works even when you switch to the home view.
            </div>
            <button class="tool-btn ${active ? 'danger' : 'success'}" id="tkaToggle" style="padding:12px 32px;font-size:15px;">
                ${active ? '☕ Active — Click to Stop' : '💤 Inactive — Click to Activate'}
            </button>
            <div class="tool-stats" id="tkaStatus">${!('wakeLock' in navigator) ? 'Wake Lock API not supported in this browser' : ''}</div>
        </div>`;
        document.getElementById('tkaToggle').onclick = async () => {
            const btn = document.getElementById('tkaToggle');
            if (isWakeLockActive()) {
                releaseWakeLock();
                localStorage.setItem('tool-state-keep-awake', 'false');
                btn.textContent = '💤 Inactive — Click to Activate';
                btn.className = 'tool-btn success';
            } else {
                const ok = await requestWakeLock();
                if (ok) {
                    localStorage.setItem('tool-state-keep-awake', 'true');
                    btn.textContent = '☕ Active — Click to Stop';
                    btn.className = 'tool-btn danger';
                } else {
                    document.getElementById('tkaStatus').textContent = 'Failed to acquire wake lock';
                }
            }
        };
    },
    destroy() {},
    saveState() {},
    loadState() {}
});

// ===== 15. Screen Saver =====
ToolManager.register('screensaver', {
    _raf: null, _canvas: null, _listeners: {},
    init(container) {
        const saved = JSON.parse(localStorage.getItem('tool-state-screensaver') || '{}');
        container.innerHTML = `<div class="tool-content" style="align-items:center;justify-content:center;gap:20px;text-align:center;">
            <div style="font-size:64px;">🖥</div>
            <div style="font-size:18px;font-weight:500;">Screen Saver</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.5);max-width:400px;line-height:1.6;">
                Launch a fullscreen screen saver animation. Press <strong>ESC</strong> or click to exit.
            </div>
            <div class="tool-row" style="gap:12px;flex-wrap:wrap;justify-content:center;">
                <select class="tool-select" id="tssType" style="font-size:14px;padding:10px 14px;">
                    <option value="matrix" ${saved.type === 'matrix' ? 'selected' : ''}>Matrix Rain</option>
                    <option value="starfield" ${saved.type === 'starfield' ? 'selected' : ''}>Starfield</option>
                    <option value="clock" ${saved.type === 'clock' ? 'selected' : ''}>Clock Only</option>
                </select>
                <button class="tool-btn primary" id="tssStart" style="padding:12px 32px;font-size:15px;">Launch</button>
            </div>
            <div class="tool-divider" style="width:100%;max-width:400px;"></div>
            <div style="font-size:13px;color:rgba(255,255,255,0.35);max-width:400px;line-height:1.6;">
                <strong>Note:</strong> To lock your screen on exit, press <strong>Win+L</strong> after the screensaver closes.
                The browser cannot trigger OS-level screen lock for security reasons.
            </div>
        </div>`;
        document.getElementById('tssType').onchange = (e) => {
            localStorage.setItem('tool-state-screensaver', JSON.stringify({ type: e.target.value }));
        };
        document.getElementById('tssStart').onclick = () => this._launch(document.getElementById('tssType').value);
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
    _matrix(ctx, canvas) {
        const cols = Math.floor(canvas.width / 16);
        const drops = new Array(cols).fill(1);
        const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF';
        const draw = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#0F0';
            ctx.font = '15px monospace';
            for (let i = 0; i < drops.length; i++) {
                const ch = chars[Math.floor(Math.random() * chars.length)];
                ctx.fillStyle = `hsl(120, 100%, ${50 + Math.random() * 30}%)`;
                ctx.fillText(ch, i * 16, drops[i] * 16);
                if (drops[i] * 16 > canvas.height && Math.random() > 0.975) drops[i] = 0;
                drops[i]++;
            }
            this._raf = requestAnimationFrame(draw);
        };
        draw();
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
