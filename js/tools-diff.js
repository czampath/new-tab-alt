// ===== 6. Diff Viewer =====
ToolManager.register('diff-viewer', {
    _state: null,
    _onMouseMove: null,
    _onMouseUp: null,
    _lockLR: null,
    _lockRL: null,
    _autoLR: null,
    _autoRL: null,
    _origLeft: null,
    _origRight: null,
    _editorLeft: null,
    _editorRight: null,

    // â”€â”€ Persistence helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    _pref(key, val) {
        const ns = 'diffTool.';
        if (val === undefined) {
            const v = localStorage.getItem(ns + key);
            return v === null ? undefined : JSON.parse(v);
        }
        localStorage.setItem(ns + key, JSON.stringify(val));
    },

    // â”€â”€ LCS-based line-level diff â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    _lcs(a, b) {
        const m = a.length, n = b.length;
        const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
        for (let i = 1; i <= m; i++)
            for (let j = 1; j <= n; j++)
                dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
        const ops = [];
        let i = m, j = n;
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && a[i-1] === b[j-1]) { ops.push({ type:'eq', l:i-1, r:j-1 }); i--; j--; }
            else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) { ops.push({ type:'add', r:j-1 }); j--; }
            else { ops.push({ type:'del', l:i-1 }); i--; }
        }
        return ops.reverse();
    },

    // â”€â”€ Char-level inline diff for changed lines â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    _charDiff(a, b) {
        // Returns [leftHtml, rightHtml] with intra-line highlights
        const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        if (a === b) return [esc(a), esc(b)];
        // simple char LCS (capped at 400 chars to stay fast)
        const MAX = 400;
        const ac = [...a.slice(0, MAX)], bc = [...b.slice(0, MAX)];
        const m = ac.length, n = bc.length;
        const dp = Array.from({ length: m+1 }, () => new Int16Array(n+1));
        for (let i=1;i<=m;i++) for(let j=1;j<=n;j++)
            dp[i][j] = ac[i-1]===bc[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j],dp[i][j-1]);
        const ops = []; let ci=m,cj=n;
        while(ci>0||cj>0){
            if(ci>0&&cj>0&&ac[ci-1]===bc[cj-1]){ops.push({t:'eq',c:ac[ci-1]});ci--;cj--;}
            else if(cj>0&&(ci===0||dp[ci][cj-1]>=dp[ci-1][cj])){ops.push({t:'add',c:bc[cj-1]});cj--;}
            else{ops.push({t:'del',c:ac[ci-1]});ci--;}
        }
        ops.reverse();
        let lh='', rh='';
        // batch consecutive same-type ops
        let li=0;
        while(li<ops.length){
            const t=ops[li].t; let run='';
            while(li<ops.length&&ops[li].t===t){run+=ops[li].c;li++;}
            const e=esc(run);
            if(t==='eq'){lh+=e;rh+=e;}
            else if(t==='del'){lh+=`<span class="diff-char-del">${e}</span>`;}
            else{rh+=`<span class="diff-char-add">${e}</span>`;}
        }
        // append remainder if text was capped
        if(a.length>MAX) lh+=esc(a.slice(MAX));
        if(b.length>MAX) rh+=esc(b.slice(MAX));
        return [lh, rh];
    },

    // â”€â”€ JSON/YAML sort helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    _sortObj(v) {
        if (Array.isArray(v)) return v.map(x => this._sortObj(x));
        if (v && typeof v === 'object') {
            const out = {};
            Object.keys(v).sort().forEach(k => { out[k] = this._sortObj(v[k]); });
            return out;
        }
        return v;
    },
    _tryParseJSON(text) {
        try { return { ok: true, val: JSON.parse(text) }; } catch(e) { return { ok: false, err: e.message }; }
    },
    _tryParseYAML(text) {
        // minimal YAML â†’ JS: handles key:value, nested objects, and lists
        try {
            const lines = text.split('\n');
            const stack = [{ indent: -1, obj: {} }];
            const top = () => stack[stack.length - 1];
            lines.forEach(raw => {
                const line = raw.replace(/\r$/, '');
                if (!line.trim() || line.trimStart().startsWith('#')) return;
                const indent = line.length - line.trimStart().length;
                // pop stack to parent
                while (stack.length > 1 && indent <= top().indent) stack.pop();
                const trimmed = line.trim();
                if (trimmed.startsWith('- ')) {
                    const val = trimmed.slice(2).trim();
                    // Walk up the stack to find the frame that actually has keys.
                    // This is needed when an empty child {} was pushed for "key:" before
                    // we knew its children would be list items, not sub-keys.
                    let fi = stack.length - 1;
                    while (fi > 0 && Object.keys(stack[fi].obj).length === 0) fi--;
                    const parentObj = stack[fi].obj;
                    const keys = Object.keys(parentObj);
                    const lastKey = keys[keys.length - 1];
                    if (lastKey !== undefined) {
                        if (!Array.isArray(parentObj[lastKey])) parentObj[lastKey] = [];
                        // "- key: value" â†’ push as an object, not a raw string
                        const ci = val.indexOf(':');
                        if (ci > 0 && !/^['"]/.test(val)) {
                            const k2 = val.slice(0, ci).trim();
                            const v2 = val.slice(ci + 1).trim();
                            parentObj[lastKey].push({ [k2]: this._yamlVal(v2) });
                        } else {
                            parentObj[lastKey].push(this._yamlVal(val));
                        }
                    }
                } else {
                    const ci = trimmed.indexOf(':');
                    if (ci < 0) return;
                    const key = trimmed.slice(0, ci).trim();
                    const rest = trimmed.slice(ci + 1).trim();
                    const parentObj = top().obj;
                    if (rest === '' || rest === null) {
                        const child = {};
                        parentObj[key] = child;
                        stack.push({ indent, obj: child });
                    } else {
                        parentObj[key] = this._yamlVal(rest);
                    }
                }
            });
            return { ok: true, val: stack[0].obj };
        } catch(e) { return { ok: false, err: e.message }; }
    },
    _yamlVal(s) {
        if (s === 'true') return true;
        if (s === 'false') return false;
        if (s === 'null' || s === '~') return null;
        if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
        if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
            return s.slice(1, -1);
        return s;
    },

    _toYaml(obj, level = 0) {
        const pad = '  '.repeat(level);
        if (obj === null) return 'null';
        if (typeof obj === 'boolean') return String(obj);
        if (typeof obj === 'number') return String(obj);
        if (typeof obj === 'string') {
            // Determine if quoting is needed
            const needsQuote = obj === ''
                || /^(true|false|null|~|yes|no|on|off)$/i.test(obj)
                || /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(obj)
                || /^[\s]|[\s]$/.test(obj)
                || /^[-?:,[\]{}#&*!|>'"%@`]/.test(obj)
                || /: /.test(obj) || obj.endsWith(':')
                || / #/.test(obj)
                || /^- /.test(obj);
            if (!needsQuote) return obj;
            // Prefer single quotes when string contains " but not '
            if (obj.includes('"') && !obj.includes("'")) return `'${obj}'`;
            // Default to double-quote with JSON escaping
            return JSON.stringify(obj);
        }
        if (Array.isArray(obj)) {
            if (obj.length === 0) return '[]';
            return obj.map(v => {
                if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                    const keys = Object.keys(v);
                    if (keys.length === 0) return `${pad}- {}`;
                    // Inline the first key on the same line as '-', rest indented
                    const childPad = pad + '  ';
                    return keys.map((k, i) => {
                        const val = v[k];
                        const ks = /[:{}\[\],#&*!|>'"@`\s]/.test(k) ? JSON.stringify(k) : k;
                        const prefix = i === 0 ? `${pad}- ` : `${childPad}`;
                        if (typeof val === 'object' && val !== null) {
                            if (Array.isArray(val) && val.length === 0) return `${prefix}${ks}: []`;
                            if (!Array.isArray(val) && Object.keys(val).length === 0) return `${prefix}${ks}: {}`;
                            return `${prefix}${ks}:\n${this._toYaml(val, level + 2)}`;
                        }
                        return `${prefix}${ks}: ${this._toYaml(val, 0)}`;
                    }).join('\n');
                }
                return `${pad}- ${this._toYaml(v, level)}`;
            }).join('\n');
        }
        if (typeof obj === 'object') {
            const keys = Object.keys(obj);
            if (keys.length === 0) return '{}';
            return keys.map(k => {
                const v = obj[k];
                const ks = /[:{}\[\],#&*!|>'"@`\s]/.test(k) ? JSON.stringify(k) : k;
                if (typeof v === 'object' && v !== null) {
                    if (Array.isArray(v) && v.length === 0) return `${pad}${ks}: []`;
                    if (!Array.isArray(v) && Object.keys(v).length === 0) return `${pad}${ks}: {}`;
                    return `${pad}${ks}:\n${this._toYaml(v, level + 1)}`;
                }
                return `${pad}${ks}: ${this._toYaml(v, level)}`;
            }).join('\n');
        }
        return String(obj);
    },

    // â”€â”€ Build split diff (left/right panels with padding rows) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    _buildSplitRows(lLines, rLines) {
        const ops = this._lcs(lLines, rLines);
        const rows = [];
        // group consecutive del+add into change pairs
        let i = 0;
        while (i < ops.length) {
            const op = ops[i];
            if (op.type === 'eq') {
                rows.push({ type: 'ctx', l: lLines[op.l], r: rLines[op.r], ln: op.l+1, rn: op.r+1 });
                i++;
            } else {
                // collect a block of del/add
                const dels = [], adds = [];
                while (i < ops.length && (ops[i].type === 'del' || ops[i].type === 'add')) {
                    if (ops[i].type === 'del') dels.push(ops[i]);
                    else adds.push(ops[i]);
                    i++;
                }
                const maxLen = Math.max(dels.length, adds.length);
                for (let j = 0; j < maxLen; j++) {
                    const d = dels[j], a = adds[j];
                    let lHtml = '', rHtml = '';
                    let lNum = d ? d.l+1 : null, rNum = a ? a.r+1 : null;
                    if (d && a) {
                        const [lh, rh] = this._charDiff(lLines[d.l], rLines[a.r]);
                        lHtml = lh; rHtml = rh;
                        rows.push({ type: 'chg', lHtml, rHtml, ln: lNum, rn: rNum });
                    } else if (d) {
                        rows.push({ type: 'del', lHtml: this._esc(lLines[d.l]), rHtml: '', ln: lNum, rn: null });
                    } else {
                        rows.push({ type: 'add', lHtml: '', rHtml: this._esc(rLines[a.r]), ln: null, rn: rNum });
                    }
                }
            }
        }
        return rows;
    },

    _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },

    // â”€â”€ Render helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    _renderUnified(lLines, rLines) {
        const ops = this._lcs(lLines, rLines);
        let html = '';
        let i = 0;
        while (i < ops.length) {
            const op = ops[i];
            if (op.type === 'eq') {
                html += `<div class="diff-line"><span class="diff-line-num">${op.l+1}</span><span class="diff-line-num">${op.r+1}</span><span class="diff-marker"> </span><span class="diff-text">${this._esc(lLines[op.l])}</span></div>`;
                i++;
            } else {
                const dels = [], adds = [];
                while (i < ops.length && (ops[i].type === 'del' || ops[i].type === 'add')) {
                    if (ops[i].type === 'del') dels.push(ops[i]);
                    else adds.push(ops[i]);
                    i++;
                }
                // pair them for char-diff
                const maxLen = Math.max(dels.length, adds.length);
                for (let j = 0; j < maxLen; j++) {
                    const d = dels[j], a = adds[j];
                    if (d && a) {
                        const [lh, rh] = this._charDiff(lLines[d.l], rLines[a.r]);
                        html += `<div class="diff-line diff-removed"><span class="diff-line-num">${d.l+1}</span><span class="diff-line-num"></span><span class="diff-marker">&minus;</span><span class="diff-text">${lh}</span></div>`;
                        html += `<div class="diff-line diff-added"><span class="diff-line-num"></span><span class="diff-line-num">${a.r+1}</span><span class="diff-marker">+</span><span class="diff-text">${rh}</span></div>`;
                    } else if (d) {
                        html += `<div class="diff-line diff-removed"><span class="diff-line-num">${d.l+1}</span><span class="diff-line-num"></span><span class="diff-marker">&minus;</span><span class="diff-text">${this._esc(lLines[d.l])}</span></div>`;
                    } else {
                        html += `<div class="diff-line diff-added"><span class="diff-line-num"></span><span class="diff-line-num">${a.r+1}</span><span class="diff-marker">+</span><span class="diff-text">${this._esc(rLines[a.r])}</span></div>`;
                    }
                }
            }
        }
        return html || '<span style="color:rgba(255,255,255,0.4)">No differences found</span>';
    },

    _renderSplit(lLines, rLines) {
        const rows = this._buildSplitRows(lLines, rLines);
        let lHtml = '', rHtml = '';
        rows.forEach(row => {
            const lNum = row.ln ? `<span class="diff-line-num">${row.ln}</span>` : `<span class="diff-line-num"></span>`;
            const rNum = row.rn ? `<span class="diff-line-num">${row.rn}</span>` : `<span class="diff-line-num"></span>`;
            if (row.type === 'ctx') {
                const t = this._esc(row.l);
                lHtml += `<div class="diff-line">${lNum}<span class="diff-marker"> </span><span class="diff-text">${t}</span></div>`;
                rHtml += `<div class="diff-line">${rNum}<span class="diff-marker"> </span><span class="diff-text">${t}</span></div>`;
            } else if (row.type === 'chg') {
                lHtml += `<div class="diff-line diff-removed">${lNum}<span class="diff-marker">&minus;</span><span class="diff-text">${row.lHtml}</span></div>`;
                rHtml += `<div class="diff-line diff-added">${rNum}<span class="diff-marker">+</span><span class="diff-text">${row.rHtml}</span></div>`;
            } else if (row.type === 'del') {
                lHtml += `<div class="diff-line diff-removed">${lNum}<span class="diff-marker">&minus;</span><span class="diff-text">${row.lHtml}</span></div>`;
                rHtml += `<div class="diff-line diff-empty"></div>`;
            } else {
                lHtml += `<div class="diff-line diff-empty"></div>`;
                rHtml += `<div class="diff-line diff-added">${rNum}<span class="diff-marker">+</span><span class="diff-text">${row.rHtml}</span></div>`;
            }
        });
        return { lHtml, rHtml };
    },

    // â”€â”€ Main compare â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    _doCompare() {
        const mode = this._pref('mode') || 'text';
        const viewMode = this._pref('viewMode') || '3pane';
        const sortKeys = this._pref('sortKeys') !== false;
        const autoScroll = this._pref('autoScroll') !== false;

        // Always read from saved originals if available, so mode switches
        // don't re-process already-transformed textarea content
        let leftRaw  = (this._origLeft  ?? (document.getElementById('tdLeft')?.value  || '')).trimEnd();
        let rightRaw = (this._origRight ?? (document.getElementById('tdRight')?.value || '')).trimEnd();

        // For JSON/YAML modes, parse and optionally sort
        let leftDisplay = leftRaw, rightDisplay = rightRaw;
        let parseError = '';

        if (mode === 'json') {
            const lp = this._tryParseJSON(leftRaw), rp = this._tryParseJSON(rightRaw);
            if (!lp.ok) parseError += `Left JSON error: ${lp.err}\n`;
            if (!rp.ok) parseError += `Right JSON error: ${rp.err}\n`;
            if (lp.ok && rp.ok) {
                const lv = sortKeys ? this._sortObj(lp.val) : lp.val;
                const rv = sortKeys ? this._sortObj(rp.val) : rp.val;
                leftDisplay  = JSON.stringify(lv, null, 2);
                rightDisplay = JSON.stringify(rv, null, 2);
            }
        } else if (mode === 'yaml') {
            const lp = this._tryParseYAML(leftRaw), rp = this._tryParseYAML(rightRaw);
            if (!lp.ok) parseError += `Left YAML error: ${lp.err}\n`;
            if (!rp.ok) parseError += `Right YAML error: ${rp.err}\n`;
            if (lp.ok && rp.ok && sortKeys) {
                const lv = this._sortObj(lp.val), rv = this._sortObj(rp.val);
                leftDisplay  = this._toYaml(lv);
                rightDisplay = this._toYaml(rv);
            }
        }

        const lLines = leftDisplay.split('\n');
        const rLines = rightDisplay.split('\n');

        // Keep textareas in sync with the display (sorted) content so overlays
        // and line numbers align with what the user actually sees
        const lTaEl = document.getElementById('tdLeft');
        const rTaEl = document.getElementById('tdRight');
        if (leftDisplay !== leftRaw || rightDisplay !== rightRaw) {
            // Save originals once so we can restore when sort is turned off
            if (this._origLeft === null)  this._origLeft  = leftRaw;
            if (this._origRight === null) this._origRight = rightRaw;
            if (lTaEl && lTaEl.value !== leftDisplay)  lTaEl.value = leftDisplay;
            if (rTaEl && rTaEl.value !== rightDisplay) rTaEl.value = rightDisplay;
        } else {
            // No transformation applied â€” clear saved originals
            this._origLeft  = null;
            this._origRight = null;
        }
        const outputArea = document.getElementById('tdOutput');
        const inputsEl   = document.getElementById('tdInputs');
        const resizeHandle = document.getElementById('tdResizeHandle');

        if (parseError) {
            this._clearInlineOverlays();
            outputArea.innerHTML = `<pre class="tool-error" style="white-space:pre-wrap">${this._esc(parseError)}</pre>`;
            inputsEl.style.display = '';
            outputArea.style.display = '';
            resizeHandle.style.display = '';
            inputsEl.style.height = '';
            inputsEl.style.flex   = '0.6';
            outputArea.style.height = '';
            outputArea.style.flex = '1';
            return;
        }

        if (viewMode === 'split') {
            // Inline overlay: inputs stay visible and editable, overlays show diff bands
            this._applyInlineOverlays(lLines, rLines);
            inputsEl.style.display = '';
            inputsEl.style.flex = '1';
            inputsEl.style.height = '';
            outputArea.style.display = 'none';
            resizeHandle.style.display = 'none';
        } else {
            this._clearInlineOverlays();
            outputArea.innerHTML = this._renderUnified(lLines, rLines);
            inputsEl.style.display = '';
            inputsEl.style.height = '';
            inputsEl.style.flex   = '0.6';
            outputArea.style.display = '';
            resizeHandle.style.display = '';
            outputArea.style.height = '';
            outputArea.style.flex = '1';
            // Auto-scroll to first diff
            if (autoScroll) {
                setTimeout(() => {
                    const first = outputArea.querySelector('.diff-added, .diff-removed');
                    if (first) first.scrollIntoView({ block: 'nearest' });
                }, 50);
            }
        }
    },

    _setupCodeEditors(mode) {
        const lang = (mode === 'json') ? 'json' : (mode === 'yaml') ? 'yaml' : null;

        ['Left', 'Right'].forEach(side => {
            const edKey = '_editor' + side;
            const taId  = 'td' + side;

            if (lang) {
                // Already set up with the correct language? Skip.
                const existing = document.getElementById(taId);
                if (existing && existing.closest('.ce-wrap') && this[edKey]) {
                    const wrap = existing.closest('.ce-wrap');
                    if (wrap.dataset.lang === lang) return;
                }
                // Get current value from textarea or existing editor
                const curVal = this[edKey]
                    ? this[edKey].getValue()
                    : (document.getElementById(taId)?.value || '');
                // Destroy old editor if language is changing
                this._destroyEditor(side);
                // Find the slot (the textarea itself)
                const ta = document.getElementById(taId);
                if (!ta) return;
                const parent = ta.parentElement;
                // Replace textarea with ce-wrap
                const wrapDiv = document.createElement('div');
                wrapDiv.dataset.lang = lang;
                parent.insertBefore(wrapDiv, ta);
                ta.remove();
                this[edKey] = createCodeEditor(wrapDiv, {
                    language: lang, taId, value: curVal,
                    placeholder: 'Paste ' + mode.toUpperCase() + ' here...'
                });
            } else {
                // Text mode â€” destroy editor and restore plain textarea
                if (!this[edKey]) return;
                const curVal = this[edKey].getValue();
                this._destroyEditor(side); // restores plain textarea with curVal
            }
        });

        // Re-setup inline wrap after any DOM changes
        this._setupInlineWrap();
    },

    _destroyEditor(side) {
        const edKey = '_editor' + side;
        const taId  = 'td' + side;
        if (!this[edKey]) return;
        const curVal = this[edKey].getValue();
        const ceWrap = document.getElementById(taId)?.closest('.ce-wrap');
        if (ceWrap) {
            const parent = ceWrap.parentElement;
            // Restore a plain textarea in place of ce-wrap
            const ta = document.createElement('textarea');
            ta.className = 'tool-textarea';
            ta.id = taId;
            ta.placeholder = 'Paste text, JSON or YAML...';
            ta.spellcheck = false;
            ta.value = curVal;
            parent.insertBefore(ta, ceWrap);
            ceWrap.remove();
        }
        this[edKey] = null;
    },

    _setupInlineWrap() {
        ['Left', 'Right'].forEach(side => {
            const ta = document.getElementById('td' + side);
            if (!ta) return;
            // The element to wrap is either the ce-wrap (editor mode) or the textarea itself
            const toWrap = ta.closest('.ce-wrap') || ta;

            // Build the diff-inline-wrap structure only once
            if (!toWrap.parentElement.classList.contains('diff-inline-wrap')) {
                const wrap = document.createElement('div');
                wrap.className = 'diff-inline-wrap';
                toWrap.parentElement.insertBefore(wrap, toWrap);
                wrap.appendChild(toWrap);
                const overlay = document.createElement('div');
                overlay.className = 'diff-inline-overlay';
                overlay.id = 'td' + side + 'Overlay';
                wrap.insertBefore(overlay, toWrap);
            }

            // (Re)attach scroll sync to this specific ta element.
            // On mode change a new ta/ce-ta is created â€” the data attribute won't be set on it,
            // so the listener is correctly re-attached. The old removed element is ignored by the browser.
            if (!ta.dataset.overlayScrollBound) {
                const overlay = document.getElementById('td' + side + 'Overlay');
                if (overlay) {
                    ta.dataset.overlayScrollBound = '1';
                    ta.addEventListener('scroll', () => {
                        overlay.scrollTop  = ta.scrollTop;
                        overlay.scrollLeft = ta.scrollLeft;
                    });
                }
            }
        });
    },

    _applyInlineOverlays(lLines, rLines) {
        const rows = this._buildSplitRows(lLines, rLines);
        // Map each actual textarea line to its diff state (no padding rows)
        const lState = new Array(lLines.length).fill('ctx');
        const rState = new Array(rLines.length).fill('ctx');
        rows.forEach(row => {
            if (row.type === 'chg') {
                if (row.ln != null) lState[row.ln - 1] = 'chg';
                if (row.rn != null) rState[row.rn - 1] = 'chg';
            } else if (row.type === 'del') {
                if (row.ln != null) lState[row.ln - 1] = 'del';
            } else if (row.type === 'add') {
                if (row.rn != null) rState[row.rn - 1] = 'add';
            }
        });
        // Build char-diff content map for changed line pairs (lHtml/rHtml already on row)
        const lCharMap = {}, rCharMap = {};
        rows.forEach(row => {
            if (row.type === 'chg') {
                if (row.ln != null) lCharMap[row.ln - 1] = row.lHtml;
                if (row.rn != null) rCharMap[row.rn - 1] = row.rHtml;
            }
        });

        ['Left', 'Right'].forEach(side => {
            const ta = document.getElementById('td' + side);
            const overlay = document.getElementById('td' + side + 'Overlay');
            if (!ta || !overlay) return;
            ta.classList.add('diff-ta-active');

            // Measure where the text actually starts inside the overlay container so
            // char-diff highlights align with the textarea text regardless of mode.
            // In text mode: ta is a direct child of diff-inline-wrap, offset = ta.paddingLeft (14px).
            // In editor mode: ta (ce-ta) sits inside ce-body after a ~46px gutter, so offset ~60px.
            const wrapRect = overlay.parentElement.getBoundingClientRect();
            const taRect   = ta.getBoundingClientRect();
            const textLeft = Math.round(taRect.left - wrapRect.left) +
                             parseFloat(getComputedStyle(ta).paddingLeft || 14);
            overlay.style.setProperty('--dil-text-left', textLeft + 'px');

            const states  = side === 'Left' ? lState  : rState;
            const charMap = side === 'Left' ? lCharMap : rCharMap;
            overlay.innerHTML = states.map((st, i) => {
                const cls = st !== 'ctx' ? ' dil-' + st : '';
                const ch  = charMap[i];
                return ch
                    ? `<div class="dil-line${cls}">${ch}</div>`
                    : `<div class="dil-line${cls}"></div>`;
            }).join('');
            overlay.scrollTop  = ta.scrollTop;
            overlay.scrollLeft = ta.scrollLeft;
        });

        // Build line-index map from LCS for smart scroll sync
        const ops = this._lcs(lLines, rLines);
        const lToR = new Array(lLines.length).fill(null);
        const rToL = new Array(rLines.length).fill(null);
        ops.forEach(op => {
            if (op.type === 'eq') { lToR[op.l] = op.r; rToL[op.r] = op.l; }
        });

        // For lines not in the LCS (moved/changed), do a content search in the other side
        // so clicking a moved key actually jumps to where it lives, not just the nearest anchor
        const rContentIdx = {};
        rLines.forEach((line, i) => { const t = line.trim(); if (t && rContentIdx[t] === undefined) rContentIdx[t] = i; });
        const lContentIdx = {};
        lLines.forEach((line, i) => { const t = line.trim(); if (t && lContentIdx[t] === undefined) lContentIdx[t] = i; });
        for (let i = 0; i < lToR.length; i++) {
            if (lToR[i] === null) { const t = lLines[i].trim(); if (t && rContentIdx[t] !== undefined) lToR[i] = rContentIdx[t]; }
        }
        for (let i = 0; i < rToL.length; i++) {
            if (rToL[i] === null) { const t = rLines[i].trim(); if (t && lContentIdx[t] !== undefined) rToL[i] = lContentIdx[t]; }
        }

        // Forward-fill any remaining nulls (blank lines / truly unique lines) with nearest known anchor
        let last = 0;
        for (let i = 0; i < lToR.length; i++) { if (lToR[i] !== null) last = lToR[i]; else lToR[i] = last; }
        last = 0;
        for (let i = 0; i < rToL.length; i++) { if (rToL[i] !== null) last = rToL[i]; else rToL[i] = last; }

        const lTa = document.getElementById('tdLeft');
        const rTa = document.getElementById('tdRight');

        const lineH = ta => { const lh = parseFloat(getComputedStyle(ta).lineHeight); return isFinite(lh) && lh > 0 ? lh : ta.scrollHeight / Math.max((ta.value.match(/\n/g) || []).length + 1, 1); };
        const cursorLine = ta => ta.value.substring(0, ta.selectionStart).split('\n').length - 1;

        // â”€â”€ Scroll Lock: pixel-for-pixel on 'scroll' events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Directional flags prevent the echo scroll on the destination from
        // bouncing back. rAF clears the flag after the echo has fired.
        let _drivingLR = false, _drivingRL = false;
        this._lockLR = () => {
            if (!this._pref('scrollLock') || _drivingRL) return;
            _drivingLR = true;
            rTa.scrollTop = lTa.scrollTop;
            requestAnimationFrame(() => { _drivingLR = false; });
        };
        this._lockRL = () => {
            if (!this._pref('scrollLock') || _drivingLR) return;
            _drivingRL = true;
            lTa.scrollTop = rTa.scrollTop;
            requestAnimationFrame(() => { _drivingRL = false; });
        };

        // â”€â”€ Auto Scroll: line-map jump on 'click' / 'keyup' events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // No feedback-loop risk: setting scrollTop does not fire 'click'/'keyup'.
        const smoothScrollTo = (ta, targetTop) => {
            const start = ta.scrollTop;
            const dist  = targetTop - start;
            if (Math.abs(dist) < 2) return;
            const duration = Math.min(300, Math.max(80, Math.abs(dist) * 0.3));
            const startTime = performance.now();
            const step = (now) => {
                const t = Math.min((now - startTime) / duration, 1);
                const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // ease in-out quad
                ta.scrollTop = start + dist * ease;
                if (t < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        };
        const flashLine = (overlayId, lineIdx) => {
            const overlay = document.getElementById(overlayId);
            if (!overlay) return;
            const lines = overlay.querySelectorAll('.dil-line');
            const el = lines[lineIdx];
            if (!el) return;
            el.classList.remove('dil-flashing');
            void el.offsetWidth; // force reflow to restart animation
            el.classList.add('dil-flashing');
            el.addEventListener('animationend', () => el.classList.remove('dil-flashing'), { once: true });
        };
        this._autoLR = () => {
            if (!this._pref('autoScroll') || this._pref('scrollLock')) return;
            const srcLine = Math.min(cursorLine(lTa), lLines.length - 1);
            const mapped  = lToR[srcLine];
            smoothScrollTo(rTa, Math.max(0, mapped * lineH(rTa) - rTa.clientHeight / 2));
            flashLine('tdRightOverlay', mapped);
        };
        this._autoRL = () => {
            if (!this._pref('autoScroll') || this._pref('scrollLock')) return;
            const srcLine = Math.min(cursorLine(rTa), rLines.length - 1);
            const mapped  = rToL[srcLine];
            smoothScrollTo(lTa, Math.max(0, mapped * lineH(lTa) - lTa.clientHeight / 2));
            flashLine('tdLeftOverlay', mapped);
        };

        lTa?.addEventListener('scroll', this._lockLR);
        rTa?.addEventListener('scroll', this._lockRL);
        lTa?.addEventListener('click',  this._autoLR);
        rTa?.addEventListener('click',  this._autoRL);
        lTa?.addEventListener('keyup',  this._autoLR);
        rTa?.addEventListener('keyup',  this._autoRL);
    },

    _clearInlineOverlays() {
        ['Left', 'Right'].forEach(side => {
            const ta = document.getElementById('td' + side);
            const overlay = document.getElementById('td' + side + 'Overlay');
            if (overlay) overlay.innerHTML = '';
            if (ta) ta.classList.remove('diff-ta-active');
        });
        const lTa = document.getElementById('tdLeft');
        const rTa = document.getElementById('tdRight');
        if (this._lockLR) { lTa?.removeEventListener('scroll', this._lockLR); this._lockLR = null; }
        if (this._lockRL) { rTa?.removeEventListener('scroll', this._lockRL); this._lockRL = null; }
        if (this._autoLR) { lTa?.removeEventListener('click', this._autoLR); lTa?.removeEventListener('keyup', this._autoLR); this._autoLR = null; }
        if (this._autoRL) { rTa?.removeEventListener('click', this._autoRL); rTa?.removeEventListener('keyup', this._autoRL); this._autoRL = null; }
    },

    // â”€â”€ Toolbar UI helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    _isValidJSON(text) {
        if (!text.trim()) return false;
        try { JSON.parse(text); return true; } catch(e) { return false; }
    },
    _isValidYAML(text) {
        if (!text.trim()) return false;
        // JSON is not YAML for our purposes
        if (this._isValidJSON(text)) return false;
        // Must contain at least one 'key: value' pattern and parse to a non-empty object
        if (!/^\s*\S+\s*:/m.test(text)) return false;
        const r = this._tryParseYAML(text);
        return r.ok && typeof r.val === 'object' && r.val !== null && Object.keys(r.val).length > 0;
    },
    _updateToolbarState() {
        const lRaw = (this._origLeft  ?? (document.getElementById('tdLeft')?.value  || ''));
        const rRaw = (this._origRight ?? (document.getElementById('tdRight')?.value || ''));
        const jsonOk = this._isValidJSON(lRaw) && this._isValidJSON(rRaw);
        const yamlOk = this._isValidYAML(lRaw) && this._isValidYAML(rRaw);

        let mode = this._pref('mode') || 'text';
        // Auto-revert mode if inputs no longer valid for it
        if ((mode === 'json' && !jsonOk) || (mode === 'yaml' && !yamlOk)) {
            mode = 'text';
            this._pref('mode', 'text');
            // Tear down any active structured editor
            if (this._editorLeft || this._editorRight) this._setupCodeEditors('text');
        }

        const viewMode  = this._pref('viewMode') || '3pane';
        const sortKeys  = this._pref('sortKeys') !== false;
        const autoScroll= this._pref('autoScroll') !== false;
        const scrollLock= this._pref('scrollLock') !== false;
        const isStructured = mode === 'json' || mode === 'yaml';

        document.querySelectorAll('[data-diff-mode]').forEach(b => {
            b.classList.toggle('active', b.dataset.diffMode === mode);
            if (b.dataset.diffMode === 'json') {
                b.classList.toggle('disabled', !jsonOk);
                b.disabled = !jsonOk;
            }
            if (b.dataset.diffMode === 'yaml') {
                b.classList.toggle('disabled', !yamlOk);
                b.disabled = !yamlOk;
            }
        });
        document.querySelectorAll('[data-diff-view]').forEach(b => {
            b.classList.toggle('active', b.dataset.diffView === viewMode);
        });
        const sortBtn = document.getElementById('tdSortKeys');
        if (sortBtn) {
            sortBtn.classList.toggle('active', sortKeys && isStructured);
            sortBtn.classList.toggle('disabled', !isStructured);
            sortBtn.disabled = !isStructured;
            sortBtn.style.display = '';
        }
        const asBtn = document.getElementById('tdAutoScroll');
        if (asBtn) {
            const asDisabled = scrollLock || !isStructured;
            asBtn.classList.toggle('active', autoScroll && !asDisabled);
            asBtn.classList.toggle('disabled', asDisabled);
            asBtn.disabled = asDisabled;
        }
        const slBtn = document.getElementById('tdScrollLock');
        if (slBtn) slBtn.classList.toggle('active', scrollLock);
    },

    // â”€â”€ init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    init(container) {
        const s = this._state || {};
        // restore prefs (only set defaults if never saved)
        if (this._pref('mode')       === undefined) this._pref('mode', 'text');
        if (this._pref('viewMode')   === undefined) this._pref('viewMode', '3pane');
        if (this._pref('sortKeys')   === undefined) this._pref('sortKeys', true);
        if (this._pref('autoScroll') === undefined) this._pref('autoScroll', false);
        if (this._pref('scrollLock') === undefined) this._pref('scrollLock', false);
        // enforce mutual exclusivity on load (in case of stale saved prefs)
        if (this._pref('scrollLock') !== false) this._pref('autoScroll', false);

        container.innerHTML = `<div class="tool-content">
            <div class="tool-actions" style="flex-wrap:wrap;gap:6px;">
                <button class="tool-btn primary" id="tdCompare">Compare</button>
                <button class="tool-btn" id="tdSwap">Swap</button>
                <button class="tool-btn" id="tdClearLeft">Clear Original</button>
                <button class="tool-btn" id="tdClearRight">Clear Modified</button>
                <span class="diff-toolbar-sep"></span>
                <span class="diff-toolbar-label">Mode:</span>
                <button class="tool-btn" data-diff-mode="text">Text</button>
                <button class="tool-btn" data-diff-mode="json">JSON</button>
                <button class="tool-btn" data-diff-mode="yaml">YAML</button>
                <span class="diff-toolbar-sep"></span>
                <span class="diff-toolbar-label">View:</span>
                <button class="tool-btn" data-diff-view="3pane" title="3-pane: inputs + output">3-pane</button>
                <button class="tool-btn" data-diff-view="split" title="Side-by-side diff">Split</button>
                <span class="diff-toolbar-sep"></span>
                <button class="tool-btn" id="tdSortKeys" title="Sort JSON/YAML keys alphabetically">Sort Keys</button>
                <button class="tool-btn" id="tdAutoScroll" title="Auto-scroll to first diff">Auto Scroll</button>
                <button class="tool-btn" id="tdScrollLock" title="Lock scroll of split panes">ðŸ”’ Scroll</button>
            </div>
            <div class="tool-split" style="flex:1;" id="tdInputs">
                <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
                    <input class="tool-label-input" id="tdLeftLabel" value="${s.leftLabel || 'Original'}" placeholder="Label...">
                    <textarea class="tool-textarea" id="tdLeft" placeholder="Paste text, JSON or YAML...">${s.left || ''}</textarea>
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
                    <input class="tool-label-input" id="tdRightLabel" value="${s.rightLabel || 'Modified'}" placeholder="Label...">
                    <textarea class="tool-textarea" id="tdRight" placeholder="Paste text, JSON or YAML...">${s.right || ''}</textarea>
                </div>
            </div>
            <div class="tool-resize-handle" id="tdResizeHandle" style="display:none;" title="Drag to resize"></div>
            <div class="tool-output" id="tdOutput" style="display:none;flex:1;padding:0;overflow:hidden;"></div>
        </div>`;

        this._updateToolbarState();
        this._setupCodeEditors(this._pref('mode') || 'text');

        // Debounced live recompare when typing in split mode
        let _dbt;
        const debouncedCompare = () => {
            // User is typing â€” their current input is now the new "original"
            this._origLeft  = null;
            this._origRight = null;
            this._updateToolbarState();
            clearTimeout(_dbt);
            _dbt = setTimeout(() => { if (this._pref('viewMode') === 'split') this._doCompare(); }, 350);
        };
        // Use event delegation so the listener survives mode changes that replace the textarea/ce-ta elements.
        container.addEventListener('input', e => {
            if (e.target.id === 'tdLeft' || e.target.id === 'tdRight') debouncedCompare();
        });

        this._updateToolbarState();

        const recompareIfActive = () => {
            const out = document.getElementById('tdOutput');
            const lTa = document.getElementById('tdLeft');
            // _lockLR being set means split diff was previously active; new DOM elements
            // won't have diff-ta-active yet and output is hidden in split view.
            const isActive = out?.style.display !== 'none' || lTa?.classList.contains('diff-ta-active') || !!this._lockLR;
            if (isActive) this._doCompare();
        };

        // Mode buttons
        container.querySelectorAll('[data-diff-mode]').forEach(btn => {
            btn.onclick = () => {
                this._pref('mode', btn.dataset.diffMode);
                this._setupCodeEditors(btn.dataset.diffMode);
                this._updateToolbarState();
                recompareIfActive();
            };
        });

        // View buttons
        container.querySelectorAll('[data-diff-view]').forEach(btn => {
            btn.onclick = () => {
                this._pref('viewMode', btn.dataset.diffView);
                this._updateToolbarState();
                recompareIfActive();
            };
        });

        document.getElementById('tdSortKeys').onclick = () => {
            const turningOff = this._pref('sortKeys') !== false;
            if (turningOff && this._origLeft !== null) {
                // Restore originals before recomparing without sort
                if (this._editorLeft)  this._editorLeft.setValue(this._origLeft);
                else { const ta = document.getElementById('tdLeft');  if (ta) ta.value = this._origLeft; }
                if (this._editorRight) this._editorRight.setValue(this._origRight);
                else { const ta = document.getElementById('tdRight'); if (ta) ta.value = this._origRight; }
                this._origLeft  = null;
                this._origRight = null;
            }
            this._pref('sortKeys', !turningOff);
            this._updateToolbarState();
            recompareIfActive();
        };
        document.getElementById('tdAutoScroll').onclick = () => {
            const next = !(this._pref('autoScroll') !== false);
            this._pref('autoScroll', next);
            if (next) this._pref('scrollLock', false); // mutually exclusive
            this._updateToolbarState();
        };
        document.getElementById('tdScrollLock').onclick = () => {
            const next = !(this._pref('scrollLock') !== false);
            this._pref('scrollLock', next);
            if (next) this._pref('autoScroll', false); // mutually exclusive
            this._updateToolbarState();
        };

        document.getElementById('tdCompare').onclick = () => this._doCompare();

        document.getElementById('tdSwap').onclick = () => {
            const getV = s => this['_editor'+s] ? this['_editor'+s].getValue() : (document.getElementById('td'+s)?.value || '');
            const setV = (s, v) => { if (this['_editor'+s]) this['_editor'+s].setValue(v); else { const ta = document.getElementById('td'+s); if (ta) ta.value = v; } };
            const lv = getV('Left'), rv = getV('Right');
            const ll = document.getElementById('tdLeftLabel');
            const rl = document.getElementById('tdRightLabel');
            setV('Left', rv); setV('Right', lv);
            [ll.value, rl.value] = [rl.value, ll.value];
        };
        document.getElementById('tdClearLeft').onclick  = () => { if (this._editorLeft)  this._editorLeft.setValue('');  else { const ta = document.getElementById('tdLeft');  if (ta) ta.value = ''; } };
        document.getElementById('tdClearRight').onclick = () => { if (this._editorRight) this._editorRight.setValue(''); else { const ta = document.getElementById('tdRight'); if (ta) ta.value = ''; } };

        // Resize handle
        const resizeHandle = document.getElementById('tdResizeHandle');
        const inputsEl     = document.getElementById('tdInputs');
        const outputEl     = document.getElementById('tdOutput');
        let dragging = false, startY = 0, startInputH = 0, startOutputH = 0;
        resizeHandle.addEventListener('mousedown', (e) => {
            dragging = true; startY = e.clientY;
            startInputH  = inputsEl.getBoundingClientRect().height;
            startOutputH = outputEl.getBoundingClientRect().height;
            resizeHandle.classList.add('active');
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
        document.addEventListener('mousemove', this._onMouseMove = (e) => {
            if (!dragging) return;
            const delta = e.clientY - startY;
            inputsEl.style.flex = 'none';
            inputsEl.style.height = Math.max(60, startInputH + delta) + 'px';
            outputEl.style.flex = 'none';
            outputEl.style.height = Math.max(60, startOutputH - delta) + 'px';
        });
        document.addEventListener('mouseup', this._onMouseUp = () => {
            if (!dragging) return;
            dragging = false;
            resizeHandle.classList.remove('active');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        });

        // If we have state & a prior output, re-run compare
        if (s.left || s.right) setTimeout(() => this._doCompare(), 0);
    },

    destroy() {
        if (this._onMouseMove) document.removeEventListener('mousemove', this._onMouseMove);
        if (this._onMouseUp)   document.removeEventListener('mouseup',   this._onMouseUp);
        this._clearInlineOverlays();
        this._destroyEditor('Left');
        this._destroyEditor('Right');
    },

    saveState() {
        const lVal = this._editorLeft  ? this._editorLeft.getValue()  : (document.getElementById('tdLeft')?.value  || '');
        const rVal = this._editorRight ? this._editorRight.getValue() : (document.getElementById('tdRight')?.value || '');
        this._state = {
            left:       this._origLeft  ?? lVal,
            right:      this._origRight ?? rVal,
            leftLabel:  document.getElementById('tdLeftLabel')?.value  || 'Original',
            rightLabel: document.getElementById('tdRightLabel')?.value || 'Modified',
        };
    },
    loadState() {},

    handleFileDrop(content, filename) {
        const setVal = (side, val) => {
            const ed = this['_editor' + side];
            if (ed) { ed.setValue(val); }
            else { const ta = document.getElementById('td' + side); if (ta) ta.value = val; }
        };
        const getVal = (side) => {
            const ed = this['_editor' + side];
            return ed ? ed.getValue() : (document.getElementById('td' + side)?.value || '');
        };
        if (!getVal('Left')) {
            setVal('Left', content);
            const ll = document.getElementById('tdLeftLabel');
            if (ll && filename) ll.value = filename;
        } else {
            setVal('Right', content);
            const rl = document.getElementById('tdRightLabel');
            if (rl && filename) rl.value = filename;
        }
        this._updateToolbarState();
    }
});
