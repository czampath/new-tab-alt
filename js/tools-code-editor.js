// ============================================================
//  Shared Tool Editor
// ============================================================

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

    function escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

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
                    if (text[j] === "'" && text[j + 1] === "'") { j += 2; continue; }
                    if (text[j] === "'") { j++; break; }
                    j++;
                }
                toks.push({ t: 'str', v: text.slice(i, j) }); i = j;
            } else if (text[i] === '"') {
                let j = i + 1;
                while (j < text.length && text[j] !== '"') j++;
                toks.push({ t: 'ident', v: text.slice(i, j + 1) }); i = j + 1;
            } else if (text[i] === '/' && text[i + 1] === '*') {
                let j = i + 2;
                while (j < text.length - 1 && !(text[j] === '*' && text[j + 1] === '/')) j++;
                toks.push({ t: 'cmt', v: text.slice(i, j + 2) }); i = j + 2;
            } else if (text[i] === '-' && text[i + 1] === '-') {
                let j = i + 2;
                while (j < text.length && text[j] !== '\n') j++;
                toks.push({ t: 'cmt', v: text.slice(i, j) }); i = j;
            } else {
                let j = i;
                while (j < text.length && text[j] !== "'" && text[j] !== '"' &&
                    !(text[j] === '/' && text[j + 1] === '*') &&
                    !(text[j] === '-' && text[j + 1] === '-')) j++;
                if (j === i) j++;
                toks.push({ t: 'code', v: text.slice(i, j) }); i = j;
            }
        }
        return toks.map(tok => {
            const v = escHtml(tok.v);
            if (tok.t === 'str') return `<span class="sql-str">${v}</span>`;
            if (tok.t === 'cmt') return `<span class="sql-cmt">${v}</span>`;
            if (tok.t === 'ident') return `<span class="sql-ident">${v}</span>`;
            return v.replace(/\b(\d+(?:\.\d*)?)\b/g, '<span class="sql-num">$1</span>')
                .replace(SQL_KW_RE, '<span class="sql-kw">$1</span>');
        }).join('');
    }

    function hlYaml(text) {
        const lines = text.split('\n');
        return lines.map(raw => {
            const line = escHtml(raw);
            if (/^\s*#/.test(raw)) return `<span class="yaml-cmt">${line}</span>`;
            const ci = raw.indexOf(':');
            if (ci > 0) {
                const keyPart = raw.slice(0, ci);
                const rest = raw.slice(ci + 1);
                const listMatch = keyPart.match(/^(\s*-\s+)(\S.*)$/);
                if (listMatch) {
                    const [, bullet, key] = listMatch;
                    return escHtml(bullet) +
                        `<span class="yaml-key">${escHtml(key)}</span>` +
                        `<span class="yaml-colon">:</span>` +
                        hlYamlValue(rest);
                }
                const keyMatch = keyPart.match(/^(\s*)(\S.*)$/);
                if (keyMatch) {
                    const [, indent, key] = keyMatch;
                    return escHtml(indent) +
                        `<span class="yaml-key">${escHtml(key)}</span>` +
                        `<span class="yaml-colon">:</span>` +
                        hlYamlValue(rest);
                }
            }
            const bareList = raw.match(/^(\s*-\s+)(.*)$/);
            if (bareList) {
                return escHtml(bareList[1]) + hlYamlValue(' ' + bareList[2]);
            }
            return line;
        }).join('\n');
    }

    function hlYamlValue(rest) {
        const v = rest.trimStart();
        const indent = rest.slice(0, rest.length - rest.trimStart().length);
        if (v === '') return '';
        if (v === 'true' || v === 'false') return escHtml(indent) + `<span class="yaml-bool">${v}</span>`;
        if (v === 'null' || v === '~') return escHtml(indent) + `<span class="yaml-null">${v}</span>`;
        if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v)) return escHtml(indent) + `<span class="yaml-num">${v}</span>`;
        if (v.startsWith('"') || v.startsWith("'")) return escHtml(indent) + `<span class="yaml-str">${escHtml(v)}</span>`;
        if (v.startsWith('#')) return escHtml(indent) + `<span class="yaml-cmt">${escHtml(v)}</span>`;
        return escHtml(rest);
    }

    function highlight(text) {
        if (language === 'json') return hlJson(text);
        if (language === 'sql') return hlSql(text);
        if (language === 'yaml') return hlYaml(text);
        return escHtml(text);
    }

    function activeLine() { return ta.value.substring(0, ta.selectionStart).split('\n').length; }

    let _decors = [];
    let _baseHl = '';

    function applyDecors(html, decors) {
        if (!decors.length) return html;
        const evs = [];
        for (const d of decors) {
            evs.push({ pos: d.start, open: true, cls: d.cls });
            evs.push({ pos: d.end, open: false });
        }
        evs.sort((a, b) => a.pos - b.pos || (a.open ? -1 : 1));
        let tp = 0;
        let ei = 0;
        let out = '';
        let inTag = false;
        for (let i = 0; i < html.length; i++) {
            if (!inTag) {
                while (ei < evs.length && evs[ei].pos === tp) {
                    out += evs[ei].open ? `<span class="${evs[ei].cls}">` : '</span>';
                    ei++;
                }
            }
            const c = html[i];
            if (c === '<') { inTag = true; out += c; }
            else if (c === '>') { inTag = false; out += c; }
            else if (!inTag) {
                if (c === '&') {
                    const semi = html.indexOf(';', i);
                    if (semi !== -1 && semi - i <= 6) { out += html.slice(i, semi + 1); i = semi; }
                    else out += c;
                } else {
                    out += c;
                }
                tp++;
            } else {
                out += c;
            }
        }
        while (ei < evs.length) {
            if (!evs[ei++].open) out += '</span>';
        }
        return out;
    }

    function updateGutter(text, line) {
        const n = (text.match(/\n/g) || []).length + 1;
        const frags = [];
        for (let i = 1; i <= n; i++) {
            frags.push(i === line ? `<span class="ce-line-active">${i}</span>` : `<span>${i}</span>`);
        }
        gutterInner.innerHTML = frags.join('');
    }

    function syncScroll() {
        cePre.scrollTop = ta.scrollTop;
        cePre.scrollLeft = ta.scrollLeft;
        gutterInner.style.transform = `translateY(-${ta.scrollTop}px)`;
    }

    function update() {
        const text = ta.value;
        _baseHl = highlight(text) + '\n';
        ceCode.innerHTML = _decors.length ? applyDecors(_baseHl, _decors) : _baseHl;
        updateGutter(text, activeLine());
        syncScroll();
    }

    ta.addEventListener('input', update);
    ta.addEventListener('scroll', syncScroll);
    ta.addEventListener('click', () => updateGutter(ta.value, activeLine()));
    ta.addEventListener('keyup', e => {
        if (e.key.startsWith('Arrow') || ['Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
            updateGutter(ta.value, activeLine());
        }
    });

    ta.addEventListener('keydown', e => {
        const s = ta.selectionStart;
        const end = ta.selectionEnd;
        const v = ta.value;

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

        if (e.key === 'Enter') {
            e.preventDefault();
            const ls = v.lastIndexOf('\n', s - 1) + 1;
            const indent = v.substring(ls, s).match(/^(\s*)/)[1];
            const extra = (v[s - 1] === '{' || v[s - 1] === '[') ? '  ' : '';
            const ins = '\n' + indent + extra;
            ta.value = v.substring(0, s) + ins + v.substring(end);
            ta.selectionStart = ta.selectionEnd = s + ins.length;
            update();
            return;
        }

        const OPEN = { '{': '}', '[': ']', '(': ')' };
        if (e.key in OPEN) {
            e.preventDefault();
            const sel = v.substring(s, end);
            if (sel) {
                ta.value = v.substring(0, s) + e.key + sel + OPEN[e.key] + v.substring(end);
                ta.selectionStart = s + 1;
                ta.selectionEnd = end + 1;
            } else {
                ta.value = v.substring(0, s) + e.key + OPEN[e.key] + v.substring(end);
                ta.selectionStart = ta.selectionEnd = s + 1;
            }
            update();
            return;
        }

        if (e.key === '"') {
            e.preventDefault();
            const sel = v.substring(s, end);
            if (sel) {
                ta.value = v.substring(0, s) + '"' + sel + '"' + v.substring(end);
                ta.selectionStart = s + 1;
                ta.selectionEnd = end + 1;
            } else if (v[s] === '"') {
                ta.selectionStart = ta.selectionEnd = s + 1;
            } else {
                ta.value = v.substring(0, s) + '""' + v.substring(end);
                ta.selectionStart = ta.selectionEnd = s + 1;
            }
            update();
            return;
        }

        if ((e.key === '}' || e.key === ']' || e.key === ')') && s === end && v[s] === e.key) {
            e.preventDefault();
            ta.selectionStart = ta.selectionEnd = s + 1;
            update();
            return;
        }

        if (e.key === 'Backspace' && s === end && s > 0) {
            const p = v[s - 1];
            const n = v[s];
            if ((p === '{' && n === '}') || (p === '[' && n === ']') || (p === '(' && n === ')') || (p === '"' && n === '"')) {
                e.preventDefault();
                ta.value = v.substring(0, s - 1) + v.substring(s + 1);
                ta.selectionStart = ta.selectionEnd = s - 1;
                update();
            }
        }
    });

    if (value) ta.value = value;
    update();

    return {
        getValue() { return ta.value; },
        setValue(v) { ta.value = v; update(); },
        focus() { ta.focus(); },
        getTA() { return ta; },
        setDecorations(arr) {
            _decors = arr || [];
            ceCode.innerHTML = _decors.length ? applyDecors(_baseHl, _decors) : _baseHl;
        }
    };
}