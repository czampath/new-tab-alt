// ============================================================
//  All Tool Registrations
// ============================================================

// ===== In-house Code Editor Component =====
function createCodeEditor(wrapper, opts) {
    const { language = 'json', placeholder = '', taId = '', value = '' } = opts || {};

    wrapper.classList.add('ce-wrap');
    wrapper.innerHTML = `
        <div class="ce-gutter" aria-hidden="true"><div class="ce-gutter-inner"></div></div>
        <div class="ce-body">
            <pre class="ce-highlight" aria-hidden="true"><code class="ce-code"></code></pre>
            <textarea class="ce-ta"${taId ? ` id="${taId}"` : ''} spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" placeholder="${placeholder}"></textarea>
        </div>`;

    const gutterInner = wrapper.querySelector('.ce-gutter-inner');
    const ceCode      = wrapper.querySelector('.ce-code');
    const cePre       = wrapper.querySelector('.ce-highlight');
    const ta          = wrapper.querySelector('.ce-ta');

    function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    function hlJson(text) {
        return escHtml(text).replace(
            /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
            m => {
                let cls = 'json-number';
                if (/^"/.test(m)) cls = /:$/.test(m) ? 'json-key' : 'json-string';
                else if (/true|false/.test(m)) cls = 'json-bool';
                else if (/null/.test(m)) cls = 'json-null';
                return `<span class="${cls}">${m}</span>`;
            }
        );
    }

    const SQL_KW_RE = /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|IS|NULL|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|NATURAL|ON|AS|USING|GROUP|ORDER|BY|HAVING|LIMIT|OFFSET|UNION|INTERSECT|EXCEPT|ALL|DISTINCT|TOP|INTO|VALUES|INSERT|UPDATE|SET|DELETE|MERGE|CREATE|ALTER|DROP|TABLE|VIEW|INDEX|DATABASE|SCHEMA|COLUMN|CONSTRAINT|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|DEFAULT|CHECK|AUTO_INCREMENT|IDENTITY|SERIAL|SEQUENCE|TRIGGER|PROCEDURE|FUNCTION|RETURNS|RETURN|DECLARE|BEGIN|END|COMMIT|ROLLBACK|TRANSACTION|IF|ELSE|CASE|WHEN|THEN|ELSEIF|EXISTS|BETWEEN|LIKE|ILIKE|REGEXP|ANY|SOME|OVER|PARTITION|WINDOW|ROWS|RANGE|PRECEDING|FOLLOWING|CURRENT|ROW|UNBOUNDED|RECURSIVE|WITH|TRUNCATE|EXEC|EXECUTE|CALL|GRANT|REVOKE|FETCH|NEXT|FIRST|LAST|NULLS|ASC|DESC|COALESCE|NULLIF|CAST|CONVERT|EXTRACT|LOWER|UPPER|LENGTH|SUBSTRING|REPLACE|CONCAT|COUNT|SUM|AVG|MIN|MAX|ROUND|FLOOR|CEIL|CEILING|ABS|NOW|GETDATE|SYSDATE|TRUE|FALSE)\b/gi;

    function hlSql(text) {
        const toks = [];
        let i = 0;
        while (i < text.length) {
            if (text[i] === "'") {
                let j = i + 1;
                while (j < text.length) {
                    if (text[j] === "'" && text[j+1] === "'") { j += 2; continue; }
                    if (text[j] === "'") { j++; break; }
                    j++;
                }
                toks.push({ t: 'str',   v: text.slice(i, j) }); i = j;
            } else if (text[i] === '"') {
                let j = i + 1;
                while (j < text.length && text[j] !== '"') j++;
                toks.push({ t: 'ident', v: text.slice(i, j + 1) }); i = j + 1;
            } else if (text[i] === '/' && text[i+1] === '*') {
                let j = i + 2;
                while (j < text.length - 1 && !(text[j] === '*' && text[j+1] === '/')) j++;
                toks.push({ t: 'cmt',   v: text.slice(i, j + 2) }); i = j + 2;
            } else if (text[i] === '-' && text[i+1] === '-') {
                let j = i + 2;
                while (j < text.length && text[j] !== '\n') j++;
                toks.push({ t: 'cmt',   v: text.slice(i, j) }); i = j;
            } else {
                let j = i;
                while (j < text.length && text[j] !== "'" && text[j] !== '"' &&
                       !(text[j] === '/' && text[j+1] === '*') &&
                       !(text[j] === '-' && text[j+1] === '-')) j++;
                if (j === i) j++;
                toks.push({ t: 'code',  v: text.slice(i, j) }); i = j;
            }
        }
        return toks.map(tok => {
            const v = escHtml(tok.v);
            if (tok.t === 'str')   return `<span class="sql-str">${v}</span>`;
            if (tok.t === 'cmt')   return `<span class="sql-cmt">${v}</span>`;
            if (tok.t === 'ident') return `<span class="sql-ident">${v}</span>`;
            return v.replace(/\b(\d+(?:\.\d*)?)\b/g, '<span class="sql-num">$1</span>')
                    .replace(SQL_KW_RE, '<span class="sql-kw">$1</span>');
        }).join('');
    }

    function highlight(text) {
        if (language === 'json') return hlJson(text);
        if (language === 'sql')  return hlSql(text);
        return escHtml(text);
    }

    function activeLine() { return ta.value.substring(0, ta.selectionStart).split('\n').length; }

    function updateGutter(text, line) {
        const n = (text.match(/\n/g) || []).length + 1;
        const frags = [];
        for (let i = 1; i <= n; i++)
            frags.push(i === line ? `<span class="ce-line-active">${i}</span>` : `<span>${i}</span>`);
        gutterInner.innerHTML = frags.join('');
    }

    function syncScroll() {
        cePre.scrollTop  = ta.scrollTop;
        cePre.scrollLeft = ta.scrollLeft;
        gutterInner.style.transform = `translateY(-${ta.scrollTop}px)`;
    }

    function update() {
        const text = ta.value;
        ceCode.innerHTML = highlight(text) + '\n';
        updateGutter(text, activeLine());
        syncScroll();
    }

    ta.addEventListener('input',  update);
    ta.addEventListener('scroll', syncScroll);
    ta.addEventListener('click',  () => updateGutter(ta.value, activeLine()));
    ta.addEventListener('keyup',  e => {
        if (e.key.startsWith('Arrow') || ['Home','End','PageUp','PageDown'].includes(e.key))
            updateGutter(ta.value, activeLine());
    });

    ta.addEventListener('keydown', e => {
        const s = ta.selectionStart, end = ta.selectionEnd, v = ta.value;

        // Tab / Shift-Tab
        if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) {
                const ls = v.lastIndexOf('\n', s - 1) + 1;
                if (v.substring(ls, ls + 2) === '  ') {
                    ta.value = v.substring(0, ls) + v.substring(ls + 2);
                    ta.selectionStart = ta.selectionEnd = Math.max(ls, s - 2);
                    update();
                }
            } else {
                ta.value = v.substring(0, s) + '  ' + v.substring(end);
                ta.selectionStart = ta.selectionEnd = s + 2;
                update();
            }
            return;
        }

        // Smart Enter
        if (e.key === 'Enter') {
            e.preventDefault();
            const ls     = v.lastIndexOf('\n', s - 1) + 1;
            const indent = v.substring(ls, s).match(/^(\s*)/)[1];
            const extra  = (v[s - 1] === '{' || v[s - 1] === '[') ? '  ' : '';
            const ins    = '\n' + indent + extra;
            ta.value = v.substring(0, s) + ins + v.substring(end);
            ta.selectionStart = ta.selectionEnd = s + ins.length;
            update();
            return;
        }

        // Auto-close pairs  { [ (
        const OPEN = { '{': '}', '[': ']', '(': ')' };
        if (e.key in OPEN) {
            e.preventDefault();
            const sel = v.substring(s, end);
            if (sel) {
                ta.value = v.substring(0, s) + e.key + sel + OPEN[e.key] + v.substring(end);
                ta.selectionStart = s + 1; ta.selectionEnd = end + 1;
            } else {
                ta.value = v.substring(0, s) + e.key + OPEN[e.key] + v.substring(end);
                ta.selectionStart = ta.selectionEnd = s + 1;
            }
            update(); return;
        }

        // Auto-close "
        if (e.key === '"') {
            e.preventDefault();
            const sel = v.substring(s, end);
            if (sel) {
                ta.value = v.substring(0, s) + '"' + sel + '"' + v.substring(end);
                ta.selectionStart = s + 1; ta.selectionEnd = end + 1;
            } else if (v[s] === '"') {
                ta.selectionStart = ta.selectionEnd = s + 1;
            } else {
                ta.value = v.substring(0, s) + '""' + v.substring(end);
                ta.selectionStart = ta.selectionEnd = s + 1;
            }
            update(); return;
        }

        // Skip over closing bracket if already present
        if ((e.key === '}' || e.key === ']' || e.key === ')') && s === end && v[s] === e.key) {
            e.preventDefault();
            ta.selectionStart = ta.selectionEnd = s + 1;
            update(); return;
        }

        // Backspace: remove auto-closed pair together
        if (e.key === 'Backspace' && s === end && s > 0) {
            const p = v[s - 1], n = v[s];
            if ((p==='{' && n==='}') || (p==='[' && n===']') || (p==='(' && n===')') || (p==='"' && n==='"')) {
                e.preventDefault();
                ta.value = v.substring(0, s - 1) + v.substring(s + 1);
                ta.selectionStart = ta.selectionEnd = s - 1;
                update(); return;
            }
        }
    });

    if (value) ta.value = value;
    update();

    return {
        getValue() { return ta.value; },
        setValue(v) { ta.value = v; update(); },
        focus()     { ta.focus(); },
        getTA()     { return ta; }
    };
}

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
    saveState() { this._state = this._editor ? this._editor.getValue() : (document.getElementById('tsInput')?.value || ''); },
    loadState() {},
    handleFileDrop(content) {
        if (this._editor) this._editor.setValue(content);
    },
    _highlight(sql) {
        const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const KW = /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|IS|NULL|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|ON|AS|GROUP|ORDER|BY|HAVING|LIMIT|OFFSET|UNION|ALL|DISTINCT|TOP|INTO|VALUES|INSERT|UPDATE|SET|DELETE|CREATE|ALTER|DROP|TABLE|VIEW|INDEX|SCHEMA|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|DEFAULT|CONSTRAINT|CASE|WHEN|THEN|ELSE|END|BETWEEN|LIKE|EXISTS|WITH|RECURSIVE|TRUNCATE|BEGIN|COMMIT|ROLLBACK|DECLARE|EXEC|EXECUTE|IF|ASC|DESC|COALESCE|CAST|COUNT|SUM|AVG|MIN|MAX|TRUE|FALSE)\b/gi;
        const toks = [];
        let i = 0;
        while (i < sql.length) {
            if (sql[i] === "'") {
                let j = i + 1;
                while (j < sql.length) {
                    if (sql[j] === "'" && sql[j+1] === "'") { j += 2; continue; }
                    if (sql[j] === "'") { j++; break; }
                    j++;
                }
                toks.push(`<span class="sql-str">${esc(sql.slice(i, j))}</span>`); i = j;
            } else if (sql[i] === '"') {
                let j = i + 1;
                while (j < sql.length && sql[j] !== '"') j++;
                toks.push(`<span class="sql-ident">${esc(sql.slice(i, j + 1))}</span>`); i = j + 1;
            } else if (sql[i] === '/' && sql[i+1] === '*') {
                let j = i + 2;
                while (j < sql.length - 1 && !(sql[j] === '*' && sql[j+1] === '/')) j++;
                toks.push(`<span class="sql-cmt">${esc(sql.slice(i, j + 2))}</span>`); i = j + 2;
            } else if (sql[i] === '-' && sql[i+1] === '-') {
                let j = i + 2;
                while (j < sql.length && sql[j] !== '\n') j++;
                toks.push(`<span class="sql-cmt">${esc(sql.slice(i, j))}</span>`); i = j;
            } else {
                let j = i;
                while (j < sql.length && sql[j] !== "'" && sql[j] !== '"' &&
                       !(sql[j] === '/' && sql[j+1] === '*') &&
                       !(sql[j] === '-' && sql[j+1] === '-')) j++;
                if (j === i) j++;
                const chunk = esc(sql.slice(i, j))
                    .replace(/\b(\d+(?:\.\d*)?)\b/g, '<span class="sql-num">$1</span>')
                    .replace(KW, '<span class="sql-kw">$1</span>');
                toks.push(chunk); i = j;
            }
        }
        return toks.join('');
    },
    _basicFmt(sql) {
        const NEWLINE_BEFORE = /\b(SELECT|FROM|WHERE|JOIN|LEFT\s+(?:OUTER\s+)?JOIN|RIGHT\s+(?:OUTER\s+)?JOIN|INNER\s+JOIN|FULL\s+(?:OUTER\s+)?JOIN|CROSS\s+JOIN|ON|GROUP\s+BY|ORDER\s+BY|HAVING|UNION(?:\s+ALL)?|INSERT\s+INTO|UPDATE|SET|DELETE\s+FROM|VALUES|LIMIT|OFFSET|WITH)\b/gi;
        const INDENT_AFTER = /\b(SELECT|WHERE|SET|VALUES)\b/gi;
        let result = sql
            .replace(/\s+/g, ' ')
            .trim()
            .replace(NEWLINE_BEFORE, '\n$1')
            .replace(INDENT_AFTER, m => m + '\n    ');
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
    handleFileDrop(content) {
        const input = document.getElementById('trInput');
        if (!input) return;
        input.value = content;
        input.dispatchEvent(new Event('input'));
    },
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
                <button class="tool-btn" id="tdClearLeft">Clear Original</button>
                <button class="tool-btn" id="tdClearRight">Clear Modified</button>
            </div>
            <div class="tool-split" style="flex:1;" id="tdInputs">
                <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
                    <input class="tool-label-input" id="tdLeftLabel" value="${s.leftLabel || 'Original'}" placeholder="Label...">
                    <textarea class="tool-textarea" id="tdLeft" placeholder="Original text...">${s.left || ''}</textarea>
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
                    <input class="tool-label-input" id="tdRightLabel" value="${s.rightLabel || 'Modified'}" placeholder="Label...">
                    <textarea class="tool-textarea" id="tdRight" placeholder="Modified text...">${s.right || ''}</textarea>
                </div>
            </div>
            <div class="tool-resize-handle" id="tdResizeHandle" style="display:none;" title="Drag to resize"></div>
            <div class="tool-output" id="tdOutput" style="display:none;flex:1;"></div>
        </div>`;
        // Resize handle logic
        const resizeHandle = document.getElementById('tdResizeHandle');
        const inputsEl = document.getElementById('tdInputs');
        const output = document.getElementById('tdOutput');
        let dragging = false, startY = 0, startInputH = 0, startOutputH = 0;
        resizeHandle.addEventListener('mousedown', (e) => {
            dragging = true;
            startY = e.clientY;
            startInputH = inputsEl.getBoundingClientRect().height;
            startOutputH = output.getBoundingClientRect().height;
            resizeHandle.classList.add('active');
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
        document.addEventListener('mousemove', this._onMouseMove = (e) => {
            if (!dragging) return;
            const delta = e.clientY - startY;
            const newInputH = Math.max(60, startInputH + delta);
            const newOutputH = Math.max(60, startOutputH - delta);
            inputsEl.style.flex = 'none';
            inputsEl.style.height = newInputH + 'px';
            output.style.flex = 'none';
            output.style.height = newOutputH + 'px';
        });
        document.addEventListener('mouseup', this._onMouseUp = () => {
            if (!dragging) return;
            dragging = false;
            resizeHandle.classList.remove('active');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        });
        document.getElementById('tdCompare').onclick = () => {
            const left = document.getElementById('tdLeft').value.split('\n');
            const right = document.getElementById('tdRight').value.split('\n');
            const maxLen = Math.max(left.length, right.length);
            const leftLabel = document.getElementById('tdLeftLabel').value || 'Original';
            const rightLabel = document.getElementById('tdRightLabel').value || 'Modified';
            let html = '';
            for (let i = 0; i < maxLen; i++) {
                const l = left[i], r = right[i];
                if (l === undefined) {
                    html += `<div class="diff-line diff-added"><span class="diff-line-num">${i + 1}</span><span class="diff-marker">+</span><span class="diff-text">${this._esc(r)}</span></div>`;
                } else if (r === undefined) {
                    html += `<div class="diff-line diff-removed"><span class="diff-line-num">${i + 1}</span><span class="diff-marker">&minus;</span><span class="diff-text">${this._esc(l)}</span></div>`;
                } else if (l !== r) {
                    html += `<div class="diff-line diff-removed"><span class="diff-line-num">${i + 1}</span><span class="diff-marker">&minus;</span><span class="diff-text">${this._esc(l)}</span></div>`;
                    html += `<div class="diff-line diff-added"><span class="diff-line-num">${i + 1}</span><span class="diff-marker">+</span><span class="diff-text">${this._esc(r)}</span></div>`;
                } else {
                    html += `<div class="diff-line"><span class="diff-line-num">${i + 1}</span><span class="diff-marker"></span><span class="diff-text">${this._esc(l)}</span></div>`;
                }
            }
            output.innerHTML = html || '<span style="color:rgba(255,255,255,0.4)">No differences found</span>';
            output.style.display = '';
            resizeHandle.style.display = '';
            // Reset to flex-based sizing on fresh compare
            inputsEl.style.height = '';
            inputsEl.style.flex = '0.6';
            output.style.height = '';
            output.style.flex = '1';
        };
        document.getElementById('tdSwap').onclick = () => {
            const l = document.getElementById('tdLeft');
            const r = document.getElementById('tdRight');
            const ll = document.getElementById('tdLeftLabel');
            const rl = document.getElementById('tdRightLabel');
            [l.value, r.value] = [r.value, l.value];
            [ll.value, rl.value] = [rl.value, ll.value];
        };
        document.getElementById('tdClearLeft').onclick = () => {
            document.getElementById('tdLeft').value = '';
        };
        document.getElementById('tdClearRight').onclick = () => {
            document.getElementById('tdRight').value = '';
        };
    },
    destroy() {
        if (this._onMouseMove) document.removeEventListener('mousemove', this._onMouseMove);
        if (this._onMouseUp) document.removeEventListener('mouseup', this._onMouseUp);
    },
    saveState() {
        this._state = {
            left: document.getElementById('tdLeft')?.value || '',
            right: document.getElementById('tdRight')?.value || '',
            leftLabel: document.getElementById('tdLeftLabel')?.value || 'Original',
            rightLabel: document.getElementById('tdRightLabel')?.value || 'Modified'
        };
    },
    loadState() {},
    handleFileDrop(content, filename) {
        const left = document.getElementById('tdLeft');
        const right = document.getElementById('tdRight');
        if (!left || !right) return;
        if (!left.value) {
            left.value = content;
            const ll = document.getElementById('tdLeftLabel');
            if (ll && filename) ll.value = filename;
        } else {
            right.value = content;
            const rl = document.getElementById('tdRightLabel');
            if (rl && filename) rl.value = filename;
        }
    },
    _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
});

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
        container.innerHTML = `<div class="tool-content tool-content-compact">
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
            localStorage.setItem('tool-state-notes', JSON.stringify(this._notes));
            TabManager._updateBadge('notes');
        };
        document.getElementById('tnDel').onclick = () => {
            if (this._notes.length <= 1) { showToast('Cannot delete last note'); return; }
            this._notes = this._notes.filter(n => n.id !== this._activeId);
            this._activeId = this._notes[0].id;
            loadNote();
            renderSidebar();
            localStorage.setItem('tool-state-notes', JSON.stringify(this._notes));
            TabManager._updateBadge('notes');
        };
        loadNote();
        renderSidebar();
    },
    destroy() { clearTimeout(this._saveTimer); },
    saveState() { if (this._saveCurrentNote) this._saveCurrentNote(); },
    loadState() {},
    handleFileDrop(content, filename) {
        const titleEl = document.getElementById('tnTitle');
        const contentEl = document.getElementById('tnContent');
        if (!titleEl || !contentEl) return;
        titleEl.value = filename ? filename.replace(/\.[^.]+$/, '') : 'Dropped Note';
        contentEl.value = content;
        titleEl.dispatchEvent(new Event('input'));
        contentEl.dispatchEvent(new Event('input'));
    },
    _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
});

// ===== 13. Reminder =====
ToolManager.register('reminder', {
    _reminders: null,
    init(container) {
        this._reminders = JSON.parse(localStorage.getItem('tool-state-reminder') || '[]');
        container.innerHTML = `<div class="tool-content tool-content-compact">
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
                    TabManager._updateBadge('reminder');
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
            TabManager._updateBadge('reminder');
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
        container.innerHTML = `<div class="tool-content tool-content-compact" style="align-items:center;justify-content:center;gap:24px;text-align:center;">
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
            <div style="font-size:64px;">🖥</div>
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

        // Type dropdown — persist + show/hide mask section
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
                    // Area sampling: count opaque pixels to get density (0.0–1.0)
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
        const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF';

        const saved = this._getSaved();
        const maskEnabled = saved.maskEnabled !== false && !!saved.maskImage;
        // Intensity 10-100 maps to decay 0.92-0.99 and alpha multiplier 0.3-1.0
        const intensity = Math.max(10, Math.min(100, saved.maskIntensity ?? 50));
        const maskDecay = 0.92 + (intensity / 100) * 0.07;       // 0.92 (faint) → 0.99 (very persistent)
        const maskAlphaMul = 0.3 + (intensity / 100) * 0.7;      // 0.3 (subtle) → 1.0 (bold)

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

                // Mask retention effect — only after reveal delay and if mask loaded
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
