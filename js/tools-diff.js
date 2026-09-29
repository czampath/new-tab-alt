// ============================================================
//  Diff Viewer
// ============================================================

ToolManager.register('diff-viewer', {
    _state: null,
    _container: null,
    _result: null,
    _resultStale: false,
    _currentChange: 0,
    _preferences: null,
    _editorLeft: null,
    _editorRight: null,
    _refreshTimer: null,

    init(container) {
        this._container = container;
        this._preferences = this._readPreferences();
        const state = this._state || {};
        const mode = state.mode || 'text';
        container.innerHTML = `
            <div class="diff-tool" id="diffTool">
                <div class="diff-toolbar" aria-label="Comparison controls">
                    <div class="diff-toolbar-context">
                        <div class="diff-mode-group" role="group" aria-label="Comparison mode">
                            <button class="tool-btn diff-mode-btn" data-diff-mode="text" type="button">Text</button>
                            <button class="tool-btn diff-mode-btn" data-diff-mode="json" type="button">JSON</button>
                            <button class="tool-btn diff-mode-btn" data-diff-mode="yaml" type="button">YAML</button>
                        </div>
                        <label class="diff-toggle"><input id="tdKeyOrder" type="checkbox"> Ignore key order</label>
                    </div>
                    <div class="diff-toolbar-actions">
                        <button class="tool-btn" id="tdSwap" type="button" title="Swap Original and Modified">Swap sides</button>
                        <button class="tool-btn primary" id="tdCompare" type="button">Compare</button>
                    </div>
                </div>
                <section class="diff-source" id="tdSource" aria-label="Source inputs">
                    <div class="diff-input-panel">
                        <div class="diff-input-header">
                            <input class="tool-label-input" id="tdLeftLabel" value="${this._escapeAttr(state.leftLabel || 'Original')}" aria-label="Original label">
                            <button class="diff-clear-btn" id="tdClearLeft" type="button">Clear</button>
                        </div>
                        <div class="diff-editor-host">
                            <div class="diff-editor-surface" id="tdLeftHost"></div>
                            <button class="diff-copy-btn diff-copy-btn-editor" data-copy-source="left" type="button" title="Copy Original" aria-label="Copy Original"><span class="diff-copy-icon" aria-hidden="true"></span></button>
                        </div>
                        <p class="diff-input-error" id="tdLeftError" role="alert"></p>
                    </div>
                    <div class="diff-input-panel">
                        <div class="diff-input-header">
                            <input class="tool-label-input" id="tdRightLabel" value="${this._escapeAttr(state.rightLabel || 'Modified')}" aria-label="Modified label">
                            <button class="diff-clear-btn" id="tdClearRight" type="button">Clear</button>
                        </div>
                        <div class="diff-editor-host">
                            <div class="diff-editor-surface" id="tdRightHost"></div>
                            <button class="diff-copy-btn diff-copy-btn-editor" data-copy-source="right" type="button" title="Copy Modified" aria-label="Copy Modified"><span class="diff-copy-icon" aria-hidden="true"></span></button>
                        </div>
                        <p class="diff-input-error" id="tdRightError" role="alert"></p>
                    </div>
                </section>
                <section class="diff-results" id="tdResults" aria-live="polite" hidden></section>
            </div>`;

        this._setupEditors(mode, state.left || '', state.right || '');
        this._container.querySelector('#tdKeyOrder').checked = this._preferences.ignoreObjectKeyOrder;
        this._bindEvents();
        this._updateToolbar(mode);
    },

    destroy() {
        clearTimeout(this._refreshTimer);
        this._refreshTimer = null;
        this._editorLeft = null;
        this._editorRight = null;
        this._container = null;
    },

    saveState() {
        this._state = {
            left: this._getValue('left'),
            right: this._getValue('right'),
            leftLabel: this._container?.querySelector('#tdLeftLabel')?.value || 'Original',
            rightLabel: this._container?.querySelector('#tdRightLabel')?.value || 'Modified',
            mode: this._getMode()
        };
    },

    loadState() {
        this._state = this._state || {};
    },

    handleFileDrop(content, filename) {
        const left = this._getValue('left');
        const right = this._getValue('right');
        if (!left) {
            this._setValue('left', content);
            this._container.querySelector('#tdLeftLabel').value = filename || 'Original';
        } else if (!right) {
            this._setValue('right', content);
            this._container.querySelector('#tdRightLabel').value = filename || 'Modified';
        } else {
            showToast('Both inputs are occupied. Clear a side before dropping another file.');
            return;
        }
        this._refreshComparison();
    },

    _bindEvents() {
        this._container.querySelector('#tdCompare').addEventListener('click', () => this._compare());
        this._container.querySelector('#tdSwap').addEventListener('click', () => this._swap());
        this._container.querySelector('#tdClearLeft').addEventListener('click', () => this._clearSide('left'));
        this._container.querySelector('#tdClearRight').addEventListener('click', () => this._clearSide('right'));
        this._container.querySelector('#tdKeyOrder').addEventListener('change', (event) => {
            this._preferences.ignoreObjectKeyOrder = event.target.checked;
            this._writePreferences();
            this._refreshComparison();
        });
        this._container.querySelectorAll('[data-diff-mode]').forEach((button) => {
            button.addEventListener('click', () => this._changeMode(button.dataset.diffMode));
        });
        this._container.querySelectorAll('[data-copy-source]').forEach((button) => {
            button.addEventListener('click', () => this._copyText(this._getValue(button.dataset.copySource)));
        });
        this._container.addEventListener('input', (event) => {
            if (event.target.matches('.ce-ta, .diff-plain-input, .tool-label-input')) {
                this._updateToolbar(this._getMode());
                this._scheduleRefresh();
            }
        });
    },

    _setupEditors(mode, left, right) {
        const leftHost = this._container.querySelector('#tdLeftHost');
        const rightHost = this._container.querySelector('#tdRightHost');
        if (mode === 'json' || mode === 'yaml') {
            const language = mode;
            const format = mode.toUpperCase();
            this._editorLeft = createCodeEditor(leftHost, { language, taId: 'tdLeft', placeholder: `Paste original ${format}...`, value: left });
            this._editorRight = createCodeEditor(rightHost, { language, taId: 'tdRight', placeholder: `Paste modified ${format}...`, value: right });
        } else {
            this._editorLeft = null;
            this._editorRight = null;
            leftHost.innerHTML = `<textarea class="tool-textarea diff-plain-input" id="tdLeft" spellcheck="false" placeholder="Paste original text..."></textarea>`;
            rightHost.innerHTML = `<textarea class="tool-textarea diff-plain-input" id="tdRight" spellcheck="false" placeholder="Paste modified text..."></textarea>`;
            leftHost.querySelector('#tdLeft').value = left;
            rightHost.querySelector('#tdRight').value = right;
        }
    },

    _changeMode(mode) {
        const left = this._getValue('left');
        const right = this._getValue('right');
        this._setupEditors(mode, left, right);
        this._updateToolbar(mode);
        this._refreshComparison();
    },

    _updateToolbar(mode) {
        this._container.querySelectorAll('[data-diff-mode]').forEach((button) => {
            const active = button.dataset.diffMode === mode;
            const structured = button.dataset.diffMode;
            const valid = structured === 'text' || this._isValidStructuredMode(structured);
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
            button.disabled = !valid;
        });
        const keyOrder = this._container.querySelector('#tdKeyOrder');
        keyOrder.closest('.diff-toggle').hidden = mode === 'text';
    },

    _isValidStructuredMode(mode) {
        const left = this._getValue('left');
        const right = this._getValue('right');
        if (!left.trim() || !right.trim()) return false;
        if (mode === 'json') return this._isJson(left) && this._isJson(right);
        if (mode === 'yaml') return !this._isJson(left) && !this._isJson(right) && this._isYaml(left) && this._isYaml(right);
        return false;
    },

    _isJson(value) {
        try { JSON.parse(value); return true; } catch { return false; }
    },

    _isYaml(value) {
        try { window.YamlParser?.loadAll(value); return true; } catch { return false; }
    },

    _compare(showResults = true) {
        const mode = this._getMode();
        const left = this._getValue('left');
        const right = this._getValue('right');
        this._clearErrors();
        let compareLeft = left;
        let compareRight = right;
        let normalized = false;

        if (mode === 'json') {
            const parsed = this._parseJson(left, right);
            if (!parsed) return;
            compareLeft = JSON.stringify(this._normalizeJson(parsed.left), null, 2);
            compareRight = JSON.stringify(this._normalizeJson(parsed.right), null, 2);
            normalized = true;
        } else if (mode === 'yaml') {
            const parsed = this._parseYaml(left, right);
            if (!parsed) return;
            compareLeft = window.YamlParser.dump(this._normalizeJson(parsed.left));
            compareRight = window.YamlParser.dump(this._normalizeJson(parsed.right));
            normalized = true;
        }

        const rows = this._buildRows(compareLeft, compareRight);
        this._result = {
            mode,
            normalized,
            leftLabel: this._container.querySelector('#tdLeftLabel').value || 'Original',
            rightLabel: this._container.querySelector('#tdRightLabel').value || 'Modified',
            leftText: compareLeft,
            rightText: compareRight,
            rows,
            changeCount: rows.filter((row) => row.type !== 'equal').length,
            viewMode: this._preferences.viewMode
        };
        this._resultStale = false;
        this._currentChange = 0;
        if (showResults) this._showResults();
    },

    _parseJson(left, right) {
        let parsedLeft;
        let parsedRight;
        let valid = true;
        try { parsedLeft = JSON.parse(left); } catch (error) { this._setError('left', error.message); valid = false; }
        try { parsedRight = JSON.parse(right); } catch (error) { this._setError('right', error.message); valid = false; }
        return valid ? { left: parsedLeft, right: parsedRight } : null;
    },

    _parseYaml(left, right) {
        if (!window.YamlParser) {
            this._setError('left', 'YAML parser failed to load.');
            this._setError('right', 'YAML parser failed to load.');
            return null;
        }
        let parsedLeft;
        let parsedRight;
        let valid = true;
        try { parsedLeft = window.YamlParser.loadAll(left); } catch (error) { this._setError('left', error.message); valid = false; }
        try { parsedRight = window.YamlParser.loadAll(right); } catch (error) { this._setError('right', error.message); valid = false; }
        return valid ? {
            left: parsedLeft.length === 1 ? parsedLeft[0] : parsedLeft,
            right: parsedRight.length === 1 ? parsedRight[0] : parsedRight
        } : null;
    },

    _normalizeJson(value) {
        if (Array.isArray(value)) return value.map((item) => this._normalizeJson(item));
        if (!value || typeof value !== 'object') return value;
        const keys = Object.keys(value);
        if (this._preferences.ignoreObjectKeyOrder) keys.sort();
        const normalized = {};
        keys.forEach((key) => { normalized[key] = this._normalizeJson(value[key]); });
        return normalized;
    },

    _buildRows(leftText, rightText) {
        const left = leftText.split('\n');
        const right = rightText.split('\n');
        const matrix = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1));
        for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex--) {
            for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex--) {
                matrix[leftIndex][rightIndex] = left[leftIndex] === right[rightIndex]
                    ? matrix[leftIndex + 1][rightIndex + 1] + 1
                    : Math.max(matrix[leftIndex + 1][rightIndex], matrix[leftIndex][rightIndex + 1]);
            }
        }
        const operations = [];
        let leftIndex = 0;
        let rightIndex = 0;
        while (leftIndex < left.length && rightIndex < right.length) {
            if (left[leftIndex] === right[rightIndex]) {
                operations.push({ type: 'equal', left: left[leftIndex++], right: right[rightIndex++] });
            } else if (matrix[leftIndex + 1][rightIndex] >= matrix[leftIndex][rightIndex + 1]) {
                operations.push({ type: 'remove', left: left[leftIndex++], right: '' });
            } else {
                operations.push({ type: 'add', left: '', right: right[rightIndex++] });
            }
        }
        while (leftIndex < left.length) operations.push({ type: 'remove', left: left[leftIndex++], right: '' });
        while (rightIndex < right.length) operations.push({ type: 'add', left: '', right: right[rightIndex++] });

        const rows = [];
        let leftLine = 1;
        let rightLine = 1;
        for (let index = 0; index < operations.length; index++) {
            const operation = operations[index];
            if (operation.type === 'remove' && operations[index + 1]?.type === 'add') {
                const addition = operations[++index];
                const highlights = this._inlineDiff(operation.left, addition.right);
                rows.push({ type: 'change', left: highlights.left, right: highlights.right, leftLine: leftLine++, rightLine: rightLine++ });
            } else if (operation.type === 'equal') {
                rows.push({ type: 'equal', left: this._escapeHtml(operation.left), right: this._escapeHtml(operation.right), leftLine: leftLine++, rightLine: rightLine++ });
            } else if (operation.type === 'remove') {
                rows.push({ type: 'remove', left: this._escapeHtml(operation.left), right: '', leftLine: leftLine++, rightLine: null });
            } else {
                rows.push({ type: 'add', left: '', right: this._escapeHtml(operation.right), leftLine: null, rightLine: rightLine++ });
            }
        }
        return rows;
    },

    _inlineDiff(left, right) {
        const maxLength = 300;
        if (left.length + right.length > maxLength) {
            return { left: this._escapeHtml(left), right: this._escapeHtml(right) };
        }
        let start = 0;
        while (start < left.length && start < right.length && left[start] === right[start]) start++;
        let end = 0;
        while (end < left.length - start && end < right.length - start && left[left.length - 1 - end] === right[right.length - 1 - end]) end++;
        const leftMiddle = left.slice(start, left.length - end || left.length);
        const rightMiddle = right.slice(start, right.length - end || right.length);
        const suffix = end ? this._escapeHtml(left.slice(left.length - end)) : '';
        return {
            left: this._escapeHtml(left.slice(0, start)) + (leftMiddle ? `<mark class="diff-mark-remove">${this._escapeHtml(leftMiddle)}</mark>` : '') + suffix,
            right: this._escapeHtml(right.slice(0, start)) + (rightMiddle ? `<mark class="diff-mark-add">${this._escapeHtml(rightMiddle)}</mark>` : '') + suffix
        };
    },

    _showResults() {
        const result = this._result;
        if (!result) return;
        this._container.querySelector('#tdSource').hidden = true;
        const area = this._container.querySelector('#tdResults');
        const identical = result.changeCount === 0;
        area.hidden = false;
        area.innerHTML = `
            <div class="diff-result-toolbar">
                <div class="diff-result-summary" id="tdSummary">${identical ? 'No differences' : `${result.changeCount} changed row${result.changeCount === 1 ? '' : 's'}`}${result.normalized ? ` - normalized ${result.mode.toUpperCase()}` : ''}${this._resultStale ? ' - previous valid comparison' : ''}</div>
                <div class="diff-result-actions">
                    <button class="tool-btn" id="tdBackToSource" type="button">Edit source</button>
                    <div class="diff-nav-group" role="group" aria-label="Change navigation">
                        <button class="diff-nav-btn" id="tdPrevious" type="button">Previous</button>
                        <span class="diff-change-counter" id="tdCounter"></span>
                        <button class="diff-nav-btn" id="tdNext" type="button">Next</button>
                    </div>
                    <div class="diff-view-group" role="group" aria-label="Result layout">
                        <button class="tool-btn diff-view-btn" data-diff-view="side-by-side" type="button">Side by side</button>
                        <button class="tool-btn diff-view-btn" data-diff-view="unified" type="button">Unified</button>
                    </div>
                </div>
            </div>
            <div class="diff-render" id="tdRender"></div>`;
        area.querySelector('#tdBackToSource').addEventListener('click', () => {
            area.hidden = true;
            this._container.querySelector('#tdSource').hidden = false;
            this._getInput('left').focus();
        });
        area.querySelector('#tdPrevious').addEventListener('click', () => this._navigateChange(-1));
        area.querySelector('#tdNext').addEventListener('click', () => this._navigateChange(1));
        area.querySelectorAll('[data-diff-view]').forEach((button) => button.addEventListener('click', () => {
            this._preferences.viewMode = button.dataset.diffView;
            this._writePreferences();
            result.viewMode = this._preferences.viewMode;
            this._renderRows();
        }));
        this._renderRows();
    },

    _renderRows() {
        const render = this._container.querySelector('#tdRender');
        const result = this._result;
        const viewMode = result.viewMode;
        this._container.querySelectorAll('[data-diff-view]').forEach((button) => button.classList.toggle('active', button.dataset.diffView === viewMode));
        if (result.changeCount === 0) {
            render.className = 'diff-render diff-render-empty';
            render.innerHTML = `${this._renderCopyButton('unified')}<p class="diff-empty-message">No differences</p>`;
            this._bindResultCopyButtons();
            this._updateChangeCounter();
            return;
        }
        if (viewMode === 'unified') {
            render.className = 'diff-render diff-render-unified';
            render.innerHTML = this._renderCopyButton('unified') + result.rows.map((row, index) => this._renderUnifiedRow(row, index)).join('');
        } else {
            render.className = 'diff-render diff-render-split';
            render.innerHTML = `<div class="diff-column-heading"><span>${this._escapeHtml(result.leftLabel)}</span>${this._renderCopyButton('left', result.leftLabel)}</div><div class="diff-column-heading"><span>${this._escapeHtml(result.rightLabel)}</span>${this._renderCopyButton('right', result.rightLabel)}</div>${result.rows.map((row, index) => this._renderSplitRow(row, index)).join('')}`;
        }
        this._bindResultCopyButtons();
        this._updateChangeCounter();
    },

    _renderCopyButton(target, name) {
        const label = name ? `Copy ${name}` : 'Copy comparison';
        const placement = target === 'unified' ? 'diff-copy-btn-render' : 'diff-copy-btn-header';
        return `<button class="diff-copy-btn ${placement}" data-copy-result="${target}" type="button" title="${label}" aria-label="${label}"><span class="diff-copy-icon" aria-hidden="true"></span></button>`;
    },

    _bindResultCopyButtons() {
        this._container.querySelectorAll('[data-copy-result]').forEach((button) => {
            button.addEventListener('click', () => {
                const target = button.dataset.copyResult;
                const text = target === 'left' ? this._result.leftText
                    : target === 'right' ? this._result.rightText
                    : this._container.querySelector('#tdRender').innerText;
                this._copyText(text);
            });
        });
    },

    _renderSplitRow(row, index) {
        const left = `<div class="diff-cell diff-cell-${row.type}"><span class="diff-line-number">${row.leftLine || ''}</span><span class="diff-line-marker">${row.type === 'remove' || row.type === 'change' ? '-' : ''}</span><code>${row.left}</code></div>`;
        const right = `<div class="diff-cell diff-cell-${row.type}"><span class="diff-line-number">${row.rightLine || ''}</span><span class="diff-line-marker">${row.type === 'add' || row.type === 'change' ? '+' : ''}</span><code>${row.right}</code></div>`;
        return `<div class="diff-row${row.type === 'equal' ? '' : ' diff-change'}" data-change-index="${index}">${left}${right}</div>`;
    },

    _renderUnifiedRow(row, index) {
        const marker = row.type === 'remove' ? '-' : row.type === 'add' ? '+' : row.type === 'change' ? '~' : ' ';
        const content = row.type === 'remove' ? row.left : row.type === 'add' ? row.right : row.type === 'change' ? `${row.left}\n${row.right}` : row.left;
        return `<div class="diff-unified-row diff-cell-${row.type}${row.type === 'equal' ? '' : ' diff-change'}" data-change-index="${index}"><span class="diff-line-number">${row.leftLine || ''}</span><span class="diff-line-number">${row.rightLine || ''}</span><span class="diff-line-marker">${marker}</span><code>${content}</code></div>`;
    },

    _navigateChange(direction) {
        const changes = [...this._container.querySelectorAll('.diff-change')];
        if (!changes.length) return;
        this._currentChange = (this._currentChange + direction + changes.length) % changes.length;
        const activeChange = changes[this._currentChange];
        const scrollTarget = activeChange.querySelector('.diff-cell') || activeChange;
        scrollTarget.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        changes.forEach((change, index) => change.classList.toggle('diff-change-active', index === this._currentChange));
        this._updateChangeCounter();
    },

    _updateChangeCounter() {
        const changes = this._container.querySelectorAll('.diff-change');
        const counter = this._container.querySelector('#tdCounter');
        if (counter) counter.textContent = changes.length ? `${this._currentChange + 1} / ${changes.length}` : '0 / 0';
    },

    _swap() {
        const left = this._getValue('left');
        const right = this._getValue('right');
        const leftLabel = this._container.querySelector('#tdLeftLabel');
        const rightLabel = this._container.querySelector('#tdRightLabel');
        this._setValue('left', right);
        this._setValue('right', left);
        [leftLabel.value, rightLabel.value] = [rightLabel.value, leftLabel.value];
        this._refreshComparison();
    },

    _clearSide(side) {
        this._setValue(side, '');
        this._refreshComparison();
        this._getInput(side).focus();
    },

    _refreshComparison() {
        this._updateToolbar(this._getMode());
        clearTimeout(this._refreshTimer);
        this._refreshTimer = null;
        if (!this._result) return;
        const sourceVisible = !this._container.querySelector('#tdSource').hidden;
        this._compare(!sourceVisible);
    },

    _scheduleRefresh() {
        clearTimeout(this._refreshTimer);
        this._refreshTimer = setTimeout(() => this._refreshComparison(), 150);
    },

    _getMode() {
        return this._container.querySelector('[data-diff-mode].active')?.dataset.diffMode || 'text';
    },

    _getInput(side) {
        return this._container.querySelector(side === 'left' ? '#tdLeft' : '#tdRight');
    },

    _getValue(side) {
        const editor = side === 'left' ? this._editorLeft : this._editorRight;
        return editor ? editor.getValue() : (this._getInput(side)?.value || '');
    },

    _setValue(side, value) {
        const editor = side === 'left' ? this._editorLeft : this._editorRight;
        if (editor) editor.setValue(value);
        else {
            const input = this._getInput(side);
            if (input) input.value = value;
        }
    },

    _clearErrors() {
        this._setError('left', '');
        this._setError('right', '');
    },

    _setError(side, message) {
        const element = this._container.querySelector(side === 'left' ? '#tdLeftError' : '#tdRightError');
        element.textContent = message;
        element.hidden = !message;
    },

    async _copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            showToast('Copied');
            return;
        } catch {}

        const fallback = document.createElement('textarea');
        fallback.value = text;
        fallback.setAttribute('readonly', '');
        fallback.style.position = 'fixed';
        fallback.style.opacity = '0';
        document.body.appendChild(fallback);
        fallback.select();
        const copied = document.execCommand('copy');
        fallback.remove();
        showToast(copied ? 'Copied' : 'Clipboard unavailable');
    },

    _readPreferences() {
        const defaults = { viewMode: 'side-by-side', ignoreObjectKeyOrder: true };
        try {
            const stored = JSON.parse(localStorage.getItem('diffTool.preferences'));
            return { ...defaults, ...(stored && typeof stored === 'object' ? stored : {}) };
        } catch {
            return defaults;
        }
    },

    _writePreferences() {
        localStorage.setItem('diffTool.preferences', JSON.stringify(this._preferences));
    },

    _escapeHtml(value) {
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    _escapeAttr(value) {
        return this._escapeHtml(value);
    }
});