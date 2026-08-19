// ============================================================
//  Formatter And Text Tools
// ============================================================

// ===== 1. JSON Formatter =====
ToolManager.register('json-formatter', {
    _state: null,
    _editor: null,
    init(container) {
        container.innerHTML = `<div class="tool-content">
            <div class="tool-actions">
                <button class="tool-btn primary" id="tjFmt2">Format 2-sp</button>
                <button class="tool-btn" id="tjFmt4">Format 4-sp</button>
                <button class="tool-btn" id="tjMin">Minify</button>
                <button class="tool-btn" id="tjCopy">Copy Output</button>
            </div>
            <div class="tool-split">
                <div id="tjEditorWrap"></div>
                <div class="tool-output" id="tjOutput"></div>
            </div>
        </div>`;
        this._editor = createCodeEditor(document.getElementById('tjEditorWrap'), {
            language: 'json', placeholder: 'Paste JSON here...', taId: 'tjInput', value: this._state || ''
        });
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
    saveState() { this._state = this._editor ? this._editor.getValue() : (document.getElementById('tjInput')?.value || ''); },
    loadState() { this._state = this._state || ''; },
    handleFileDrop(content) {
        if (!this._editor) return;
        this._editor.setValue(content);
        try {
            const output = document.getElementById('tjOutput');
            if (output) output.innerHTML = this._highlight(JSON.stringify(JSON.parse(content), null, 2));
        } catch {}
    },
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
                <textarea class="tool-textarea" id="tmInput" placeholder="Type or paste Markdown...">${this._state || ''}</textarea>
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
        if (!this._markedLoaded) {
            loadScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js')
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
    handleFileDrop(content) {
        const input = document.getElementById('tmInput');
        if (!input) return;
        input.value = content;
        input.dispatchEvent(new Event('input'));
    },
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
    _editor: null,
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
                <div id="tsEditorWrap"></div>
                <div class="tool-output" id="tsOutput"></div>
            </div>
        </div>`;
        this._editor = createCodeEditor(document.getElementById('tsEditorWrap'), {
            language: 'sql', placeholder: 'Paste SQL here...', taId: 'tsInput', value: this._state || ''
        });
        const input = document.getElementById('tsInput');
        const output = document.getElementById('tsOutput');
        document.getElementById('tsFmt').onclick = () => {
            output.innerHTML = this._highlight(this._basicFmt(input.value));
        };
        document.getElementById('tsMin').onclick = () => {
            const sql = input.value;
            const lits = [];
            let c = '';
            let i = 0;
            while (i < sql.length) {
                if (sql[i] === "'" || sql[i] === '`') {
                    const q = sql[i]; let j = i + 1;
                    while (j < sql.length) {
                        if (sql[j] === q && sql[j + 1] === q) { j += 2; continue; }
                        if (sql[j] === q) { j++; break; }
                        j++;
                    }
                    c += `\x01${lits.length}\x01`; lits.push(sql.slice(i, j)); i = j;
                } else if (sql[i] === '"') {
                    let j = i + 1;
                    while (j < sql.length && sql[j] !== '"') j++;
                    c += `\x01${lits.length}\x01`; lits.push(sql.slice(i, j + 1)); i = j + 1;
                } else if (sql[i] === '/' && sql[i + 1] === '*') {
                    let j = i + 2;
                    while (j < sql.length - 1 && !(sql[j] === '*' && sql[j + 1] === '/')) j++;
                    i = j + 2;
                } else if (sql[i] === '-' && sql[i + 1] === '-') {
                    while (i < sql.length && sql[i] !== '\n') i++;
                } else {
                    c += sql[i++];
                }
            }
            const KW = /\b(SELECT|FROM|WHERE|JOIN|ON|AND|OR|NOT|IN|AS|SET|VALUES|INTO|UPDATE|DELETE|INSERT|REPLACE|MERGE|USING|UNION|ALL|DISTINCT|HAVING|LIMIT|OFFSET|CASE|WHEN|THEN|ELSE|END|INNER|LEFT|RIGHT|FULL|OUTER|CROSS|DUPLICATE|KEY)\b/gi;
            c = c.replace(/\s+/g, ' ')
                .replace(/\s*,\s*/g, ',')
                .replace(/\s*\(\s*/g, '(')
                .replace(/\s+\)/g, ')')
                .replace(/\s*(>=|<=|<>|!=|=)\s*/g, '$1')
                .trim()
                .replace(KW, ' $1 ')
                .replace(/\s{2,}/g, ' ')
                .replace(/\s*\(\s*/g, '(')
                .replace(/=\s+/g, '=')
                .trim();
            output.textContent = c.replace(/\x01(\d+)\x01/g, (_, n) => lits[+n]);
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

        function _matchParen(sql, openIdx) {
            let depth = 0;
            let inStr = false;
            for (let i = openIdx; i < sql.length; i++) {
                if (inStr) {
                    if (sql[i] === "'" && sql[i + 1] === "'") i++;
                    else if (sql[i] === "'") inStr = false;
                    continue;
                }
                if (sql[i] === "'") { inStr = true; continue; }
                if (sql[i] === '(') depth++;
                else if (sql[i] === ')') { if (--depth === 0) return i; }
            }
            return -1;
        }

        function _caretSlot(sql, parenStart, caretPos) {
            let depth = 0;
            let commas = 0;
            let inStr = false;
            for (let i = parenStart; i < caretPos && i < sql.length; i++) {
                if (inStr) {
                    if (sql[i] === "'" && sql[i + 1] === "'") i++;
                    else if (sql[i] === "'") inStr = false;
                    continue;
                }
                if (sql[i] === "'") { inStr = true; continue; }
                if (sql[i] === '(') depth++;
                else if (sql[i] === ')') { if (--depth === 0) break; }
                else if (sql[i] === ',' && depth === 1) commas++;
            }
            return commas;
        }

        function _colRange(sql, colParenStart, idx) {
            let depth = 0;
            let colIdx = 0;
            let itemStart = colParenStart + 1;
            for (let i = colParenStart; i < sql.length; i++) {
                const c = sql[i];
                if (c === '(') depth++;
                else if (c === ')') {
                    depth--;
                    if (depth === 0) {
                        if (colIdx === idx) { return _trimRange(sql, itemStart, i); }
                        break;
                    }
                } else if (c === ',' && depth === 1) {
                    if (colIdx === idx) { return _trimRange(sql, itemStart, i); }
                    colIdx++;
                    itemStart = i + 1;
                }
            }
            return null;
        }

        function _trimRange(sql, s, e) {
            while (s < e && /\s/.test(sql[s])) s++;
            while (e > s && /\s/.test(sql[e - 1])) e--;
            return s < e ? { start: s, end: e } : null;
        }

        function _insertDecorations(sql, caret) {
            const insRe = /\b(?:INSERT(?:\s+\w+)*\s+INTO|REPLACE\s+INTO)\s+\S+\s*(?=\()/i;
            const insM = insRe.exec(sql);
            if (!insM) return [];

            const colOpen = insM.index + insM[0].length;
            if (sql[colOpen] !== '(') return [];
            const colClose = _matchParen(sql, colOpen);
            if (colClose === -1) return [];

            let colCount = 1;
            let depth = 0;
            let inStr = false;
            for (let i = colOpen; i <= colClose; i++) {
                if (inStr) { if (sql[i] === "'" && sql[i + 1] !== "'") inStr = false; continue; }
                if (sql[i] === "'") { inStr = true; continue; }
                if (sql[i] === '(') depth++;
                else if (sql[i] === ')') { if (--depth === 0) break; }
                else if (sql[i] === ',' && depth === 1) colCount++;
            }

            const afterCols = sql.slice(colClose + 1);
            const valM = /\bVALUES\s*(?=\()/i.exec(afterCols);
            if (!valM) return [];
            const valOpen = colClose + 1 + valM.index + valM[0].length;
            if (sql[valOpen] !== '(') return [];
            const valClose = _matchParen(sql, valOpen);
            if (valClose === -1) return [];

            if (caret >= valOpen && caret <= valClose) {
                const slotIdx = _caretSlot(sql, valOpen, caret);
                if (slotIdx >= colCount) return [];
                const range = _colRange(sql, colOpen, slotIdx);
                return range ? [{ start: range.start, end: range.end, cls: 'sql-pair-active' }] : [];
            }

            if (caret >= colOpen && caret <= colClose) {
                const slotIdx = _caretSlot(sql, colOpen, caret);
                if (slotIdx >= colCount) return [];
                const range = _colRange(sql, valOpen, slotIdx);
                return range ? [{ start: range.start, end: range.end, cls: 'sql-pair-active' }] : [];
            }

            return [];
        }

        const _trackInsert = () => {
            this._editor.setDecorations(_insertDecorations(input.value, input.selectionStart));
        };
        input.addEventListener('keyup', _trackInsert);
        input.addEventListener('click', _trackInsert);
        input.addEventListener('input', _trackInsert);

        input.addEventListener('dblclick', () => {
            const sql = input.value;
            const caret = input.selectionStart;

            const insRe = /\b(?:INSERT(?:\s+\w+)*\s+INTO|REPLACE\s+INTO)\s+\S+\s*(?=\()/i;
            const insM = insRe.exec(sql);
            if (!insM) return;
            const colOpen = insM.index + insM[0].length;
            if (sql[colOpen] !== '(') return;
            const colClose = _matchParen(sql, colOpen);
            if (colClose === -1) return;

            const afterCols = sql.slice(colClose + 1);
            const valM = /\bVALUES\s*(?=\()/i.exec(afterCols);
            if (!valM) return;
            const valOpen = colClose + 1 + valM.index + valM[0].length;
            if (sql[valOpen] !== '(') return;
            const valClose = _matchParen(sql, valOpen);
            if (valClose === -1) return;

            if (caret < valOpen || caret > valClose) return;

            const slotIdx = _caretSlot(sql, valOpen, caret);
            const range = _colRange(sql, valOpen, slotIdx);
            if (!range) return;

            let { start, end } = range;
            if (sql[start] === "'" && sql[end - 1] === "'") { start++; end--; }
            if (start >= end) return;

            input.selectionStart = start;
            input.selectionEnd = end;
            _trackInsert();
        });
    },
    destroy() {},
    saveState() { this._state = this._editor ? this._editor.getValue() : (document.getElementById('tsInput')?.value || ''); },
    loadState() {},
    handleFileDrop(content) {
        if (this._editor) this._editor.setValue(content);
    },
    _highlight(sql) {
        const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const KW = /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|IS|NULL|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|ON|AS|GROUP|ORDER|BY|HAVING|LIMIT|OFFSET|UNION|ALL|DISTINCT|TOP|INTO|VALUES|INSERT|UPDATE|SET|DELETE|CREATE|ALTER|DROP|TABLE|VIEW|INDEX|SCHEMA|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|DEFAULT|CONSTRAINT|CASE|WHEN|THEN|ELSE|END|BETWEEN|LIKE|EXISTS|WITH|RECURSIVE|TRUNCATE|BEGIN|COMMIT|ROLLBACK|DECLARE|EXEC|EXECUTE|IF|ASC|DESC|COALESCE|CAST|COUNT|SUM|AVG|MIN|MAX|TRUE|FALSE)\b/gi;
        const toks = [];
        let i = 0;
        while (i < sql.length) {
            if (sql[i] === "'") {
                let j = i + 1;
                while (j < sql.length) {
                    if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
                    if (sql[j] === "'") { j++; break; }
                    j++;
                }
                toks.push(`<span class="sql-str">${esc(sql.slice(i, j))}</span>`); i = j;
            } else if (sql[i] === '"') {
                let j = i + 1;
                while (j < sql.length && sql[j] !== '"') j++;
                toks.push(`<span class="sql-ident">${esc(sql.slice(i, j + 1))}</span>`); i = j + 1;
            } else if (sql[i] === '/' && sql[i + 1] === '*') {
                let j = i + 2;
                while (j < sql.length - 1 && !(sql[j] === '*' && sql[j + 1] === '/')) j++;
                toks.push(`<span class="sql-cmt">${esc(sql.slice(i, j + 2))}</span>`); i = j + 2;
            } else if (sql[i] === '-' && sql[i + 1] === '-') {
                let j = i + 2;
                while (j < sql.length && sql[j] !== '\n') j++;
                toks.push(`<span class="sql-cmt">${esc(sql.slice(i, j))}</span>`); i = j;
            } else {
                let j = i;
                while (j < sql.length && sql[j] !== "'" && sql[j] !== '"' &&
                    !(sql[j] === '/' && sql[j + 1] === '*') &&
                    !(sql[j] === '-' && sql[j + 1] === '-')) j++;
                if (j === i) j++;
                const chunk = esc(sql.slice(i, j))
                    .replace(/\b(\d+(?:\.\d*)?)\b/g, '<span class="sql-num">$1</span>')
                    .replace(KW, '<span class="sql-kw">$1</span>');
                toks.push(chunk); i = j;
            }
        }
        return toks.join('');
    },
    _basicFmt(rawSql) {
        function tokenise(src) {
            const toks = [];
            let i = 0;
            while (i < src.length) {
                if (src[i] === "'" || src[i] === '`') {
                    const q = src[i]; let j = i + 1;
                    while (j < src.length) {
                        if (src[j] === q && src[j + 1] === q) { j += 2; continue; }
                        if (src[j] === q) { j++; break; }
                        j++;
                    }
                    toks.push({ t: 'lit', v: src.slice(i, j) }); i = j;
                } else if (src[i] === '"') {
                    let j = i + 1;
                    while (j < src.length && src[j] !== '"') j++;
                    toks.push({ t: 'lit', v: src.slice(i, j + 1) }); i = j + 1;
                } else if (src[i] === '/' && src[i + 1] === '*') {
                    let j = i + 2;
                    while (j < src.length - 1 && !(src[j] === '*' && src[j + 1] === '/')) j++;
                    toks.push({ t: 'cmt', v: src.slice(i, j + 2) }); i = j + 2;
                } else if (src[i] === '-' && src[i + 1] === '-') {
                    let j = i + 2;
                    while (j < src.length && src[j] !== '\n') j++;
                    toks.push({ t: 'cmt', v: src.slice(i, j) }); i = j;
                } else if (src[i] === '(') {
                    const sub = [];
                    let depth = 1;
                    let j = i + 1;
                    while (j < src.length && depth > 0) {
                        if (src[j] === "'" || src[j] === '`') {
                            const q = src[j]; let k = j + 1;
                            while (k < src.length) {
                                if (src[k] === q && src[k + 1] === q) { k += 2; continue; }
                                if (src[k] === q) { k++; break; }
                                k++;
                            }
                            sub.push(src.slice(j, k)); j = k;
                        } else if (src[j] === '"') {
                            let k = j + 1;
                            while (k < src.length && src[k] !== '"') k++;
                            sub.push(src.slice(j, k + 1)); j = k + 1;
                        } else {
                            if (src[j] === '(') depth++;
                            else if (src[j] === ')') { depth--; if (depth === 0) { j++; break; } }
                            sub.push(src[j]); j++;
                        }
                    }
                    toks.push({ t: 'paren', v: sub.join('') }); i = j;
                } else {
                    let j = i;
                    while (j < src.length && src[j] !== "'" && src[j] !== '"' && src[j] !== '`' &&
                        src[j] !== '(' &&
                        !(src[j] === '/' && src[j + 1] === '*') &&
                        !(src[j] === '-' && src[j + 1] === '-')) j++;
                    if (j === i) j++;
                    toks.push({ t: 'code', v: src.slice(i, j) }); i = j;
                }
            }
            return toks;
        }

        function flatten(src) {
            const store = [];
            const toks = tokenise(src);
            let out = '';
            for (const tok of toks) {
                if (tok.t === 'paren') {
                    const ph = `\x00P${store.length}\x00`;
                    store.push(tok.v);
                    out += ph;
                } else {
                    out += tok.v;
                }
            }
            return { flat: out, store };
        }

        function splitComma(s) {
            return s.split(',').map(x => x.trim()).filter(Boolean);
        }

        function fmt(src, depth) {
            const ind = '       '.repeat(depth);
            const colInd = ind + '       ';

            const { flat, store } = flatten(src.trim());

            function spaceOps(s) {
                return s.replace(/\s*(>=|<=|<>|!=|=|>|<)\s*/g, ' $1 ').replace(/\s{2,}/g, ' ');
            }

            function restoreInline(s) {
                return s.replace(/\x00P(\d+)\x00/g, (_, idx) => {
                    const inner = store[+idx];
                    if (/^\s*SELECT\b/i.test(inner)) {
                        const innerFmt = fmt(inner, depth + 1);
                        const subInd = ind + '       ';
                        return '(' + '\n' + innerFmt.split('\n').map(l => subInd + l).join('\n') + ')';
                    }
                    return '(' + spaceOps(inner) + ')';
                });
            }

            const norm = flat.replace(/\s+/g, ' ').trim();
            const clauseRe = /\b(SELECT\s+(?:DISTINCT\s+)?|FROM\s+|(?:(?:LEFT|RIGHT|FULL)\s+(?:OUTER\s+)?)?(?:INNER\s+)?(?:CROSS\s+)?JOIN\s+|ON\s+|WHERE\s+|AND\s+|OR\s+|GROUP\s+BY\s+|ORDER\s+BY\s+|HAVING\s+|LIMIT\s+|OFFSET\s+|UNION(?:\s+ALL)?\s+|INSERT\s+INTO\s+|UPDATE\s+|SET\s+|DELETE\s+(?:FROM\s+)?|VALUES\s+|WITH\s+)/gi;
            const clauses = [];
            let lastIdx = 0;
            let lastKw = '';
            let m;
            const re = new RegExp(clauseRe.source, 'gi');
            re.lastIndex = 0;
            while ((m = re.exec(norm)) !== null) {
                if (lastKw || m.index > 0) {
                    clauses.push({ kw: lastKw, body: norm.slice(lastIdx, m.index).trim() });
                }
                lastKw = m[1].replace(/\s+/g, ' ').toUpperCase().trimEnd();
                lastIdx = m.index + m[1].length;
            }
            clauses.push({ kw: lastKw, body: norm.slice(lastIdx).trim() });

            const lines = [];
            const joinBuffer = [];

            function flushJoins() {
                for (const j of joinBuffer) lines.push(j);
                joinBuffer.length = 0;
            }

            let pendingJoinKw = null;
            let pendingJoinTable = null;

            for (const { kw, body } of clauses) {
                if (!kw && !body) continue;

                const kwU = kw.trimEnd();
                const bodyR = spaceOps(restoreInline(body));

                if (kwU === 'SELECT' || kwU === 'SELECT DISTINCT') {
                    const cols = splitComma(body);
                    const fmtCols = cols.map(c => spaceOps(restoreInline(c)));
                    const parsed = fmtCols.map(col => {
                        const ma = col.match(/^(.*?)\s+AS\s+(\S+)\s*$/i);
                        if (ma) return { expr: ma[1].trim(), alias: ma[2] };
                        return { expr: col.trim(), alias: '' };
                    });
                    const maxE = Math.max(...parsed.map(p => p.expr.length));
                    const colLines = parsed.map((p, idx) => {
                        const comma = idx < parsed.length - 1 ? ', ' : ' ';
                        if (p.alias) {
                            const pad = ' '.repeat(Math.max(1, maxE - p.expr.length + 1));
                            return colInd + p.expr + pad + 'AS ' + p.alias + comma;
                        }
                        return colInd + p.expr + comma;
                    });
                    lines.push(ind + kwU.padEnd(6) + ' ' + colLines[0].trimStart());
                    for (let ci = 1; ci < colLines.length; ci++) lines.push(colLines[ci]);
                } else if (kwU === 'FROM') {
                    flushJoins();
                    lines.push(ind + 'FROM   ' + bodyR);
                } else if (/^(?:(?:LEFT|RIGHT|FULL|INNER|CROSS|NATURAL|LEFT OUTER|RIGHT OUTER|FULL OUTER)\s+)?JOIN$/.test(kwU)) {
                    if (pendingJoinKw) {
                        joinBuffer.push(ind + '       ' + pendingJoinKw + ' ' + pendingJoinTable);
                        pendingJoinKw = null;
                        pendingJoinTable = null;
                    }
                    pendingJoinKw = kwU;
                    pendingJoinTable = bodyR;
                } else if (kwU === 'ON') {
                    if (pendingJoinKw) {
                        joinBuffer.push(ind + '       ' + pendingJoinKw + ' ' + pendingJoinTable);
                        pendingJoinKw = null;
                        pendingJoinTable = null;
                    }
                    const onBody = body.trim();
                    const parenMatch = onBody.match(/^\x00P(\d+)\x00$/);
                    const onInner = parenMatch ? store[+parenMatch[1]] : onBody;
                    const onParts = spaceOps(onInner).split(/\bAND\b/i).map(s => s.trim());
                    const wrapped = parenMatch;
                    if (onParts.length > 1) {
                        joinBuffer.push(ind + '         ON ' + (wrapped ? '( ' : '') + onParts[0]);
                        for (let oi = 1; oi < onParts.length - 1; oi++) {
                            joinBuffer.push(ind + '              AND ' + onParts[oi]);
                        }
                        joinBuffer.push(ind + '              AND ' + onParts[onParts.length - 1] + (wrapped ? ' )' : ''));
                    } else {
                        joinBuffer.push(ind + '         ON ' + (wrapped ? '( ' + spaceOps(onInner) + ' )' : bodyR));
                    }
                } else if (kwU === 'WHERE') {
                    flushJoins();
                    if (pendingJoinKw) {
                        lines.push(ind + '       ' + pendingJoinKw + ' ' + pendingJoinTable);
                        pendingJoinKw = null;
                        pendingJoinTable = null;
                    }
                    const whereBody = body.trim();
                    const wParenMatch = whereBody.match(/^\x00P(\d+)\x00$/);
                    if (wParenMatch) {
                        const wInner = spaceOps(store[+wParenMatch[1]]);
                        const wParts = wInner.split(/\b(AND|OR)\b/i);
                        if (wParts.length > 1) {
                            lines.push(ind + 'WHERE  ( ' + wParts[0].trim());
                            for (let wi = 1; wi < wParts.length; wi += 2) {
                                const nextPart = wParts[wi + 1] ? wParts[wi + 1].trim() : '';
                                const isLast = wi + 2 >= wParts.length;
                                lines.push(ind + '          ' + wParts[wi].toUpperCase() + ' ' + nextPart + (isLast ? ' )' : ''));
                            }
                        } else {
                            lines.push(ind + 'WHERE  ( ' + wInner.trim() + ' )');
                        }
                    } else {
                        lines.push(ind + 'WHERE  ' + bodyR);
                    }
                } else if (kwU === 'AND') {
                    lines.push(ind + '        AND ' + bodyR);
                } else if (kwU === 'OR') {
                    lines.push(ind + '         OR ' + bodyR);
                } else if (kwU === 'GROUP BY') {
                    flushJoins();
                    lines.push(ind + 'GROUP  BY ' + bodyR);
                } else if (kwU === 'ORDER BY') {
                    flushJoins();
                    lines.push(ind + 'ORDER  BY ' + bodyR);
                } else if (kwU === 'HAVING') {
                    lines.push(ind + 'HAVING ' + bodyR);
                } else if (kwU === 'LIMIT') {
                    lines.push(ind + 'LIMIT  ' + bodyR);
                } else if (kwU === 'OFFSET') {
                    lines.push(ind + 'OFFSET ' + bodyR);
                } else if (kwU.startsWith('UNION')) {
                    flushJoins();
                    lines.push('');
                    lines.push(ind + kwU);
                    lines.push('');
                } else {
                    flushJoins();
                    if (kwU) lines.push(ind + kwU + ' ' + bodyR);
                    else if (bodyR) lines.push(ind + bodyR);
                }
            }

            flushJoins();
            if (pendingJoinKw) lines.push(ind + '       ' + pendingJoinKw + ' ' + pendingJoinTable);

            return lines.join('\n');
        }

        return fmt(rawSql, 0).replace(/\n{3,}/g, '\n\n').trimEnd();
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
    loadState() {},
    handleFileDrop(content) {
        const input = document.getElementById('ttInput');
        if (!input) return;
        input.value = content;
        input.dispatchEvent(new Event('input'));
    }
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
                const groups = [];
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
                if (groups.length) info += ` · Groups: ${groups.map(g => `[${g.join(', ')}]`).join(' ')}`;
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
    handleFileDrop(content) {
        const input = document.getElementById('trInput');
        if (!input) return;
        input.value = content;
        input.dispatchEvent(new Event('input'));
    },
    _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
});