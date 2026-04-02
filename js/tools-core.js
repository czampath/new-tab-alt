// ===== Tool Definitions (id, local icon path, label for strip rendering) =====
const TOOL_DEFS = [
    { id: 'json-formatter',     icon: 'img/tool-json.svg',        label: 'JSON' },
    { id: 'markdown-viewer',    icon: 'img/tool-markdown.svg',    label: 'Markdown' },
    { id: 'sql-formatter',      icon: 'img/tool-sql.svg',         label: 'SQL' },
    { id: 'text-formatter',     icon: 'img/tool-text.svg',        label: 'Text' },
    { id: 'regex-tester',       icon: 'img/tool-regex.svg',       label: 'Regex' },
    { id: 'diff-viewer',        icon: 'img/tool-diff.svg',        label: 'Diff' },
    { id: 'date-formatter',     icon: 'img/tool-date.svg',        label: 'Date' },
    { id: 'epoch-converter',    icon: 'img/tool-epoch.svg',       label: 'Epoch' },
    { id: 'color-picker',       icon: 'img/tool-color.svg',       label: 'Color' },
    { id: 'password-generator', icon: 'img/tool-password.svg',    label: 'Password' },
    { id: 'uuid-hash',          icon: 'img/tool-uuid.svg',        label: 'UUID/Hash' },
    { id: 'notes',              icon: 'img/tool-notes.svg',       label: 'Notes' },
    { id: 'reminder',           icon: 'img/tool-reminder.svg',    label: 'Reminder' },
    { id: 'keep-awake',         icon: 'img/tool-awake.svg',       label: 'Awake' },
    { id: 'screensaver',        icon: 'img/tool-screensaver.svg', label: 'Screensaver' },
];

// ===== Tab Manager (multi-tab sessions for supported tools) =====
const TabManager = {
    TABBED: new Set(['json-formatter','markdown-viewer','sql-formatter','text-formatter','regex-tester','diff-viewer']),
    _data: {},

    isTabbed(id) { return this.TABBED.has(id); },

    load(id) {
        if (this._data[id]) return this._data[id];
        try {
            const raw = localStorage.getItem(`tool-tabs-${id}`);
            if (raw) this._data[id] = JSON.parse(raw);
        } catch {}
        if (!this._data[id]) {
            this._data[id] = { active: null, tabs: [] };
        }
        return this._data[id];
    },

    save(id) {
        localStorage.setItem(`tool-tabs-${id}`, JSON.stringify(this._data[id]));
        this._updateBadge(id);
    },

    captureState(id) {
        const h = ToolManager.registry[id];
        if (!h) return null;
        if (h.saveState) h.saveState();
        return h._state;
    },

    restoreState(id, state) {
        const h = ToolManager.registry[id];
        if (!h) return;
        h._state = state != null ? (typeof state === 'object' ? JSON.parse(JSON.stringify(state)) : state) : null;
    },

    saveActiveTab(id) {
        const data = this.load(id);
        const state = this.captureState(id);
        const tab = data.tabs.find(t => t.id === data.active);
        if (tab) tab.state = state;
        this.save(id);
    },

    getTabCount(id) {
        try { const r = localStorage.getItem(`tool-tabs-${id}`); if (r) { const d = JSON.parse(r); return d.tabs?.length || 0; } } catch {}
        return 0;
    },

    createTab(id) {
        if (ToolManager.activeToolId === id) this.saveActiveTab(id);
        const data = this.load(id);
        const tabId = Date.now();
        data.tabs.push({ id: tabId, label: `Tab ${data.tabs.length + 1}`, state: null });
        data.active = tabId;
        this.save(id);
        if (ToolManager.activeToolId === id) this._reinitTool(id);
    },

    closeTab(id, tabId) {
        const data = this.load(id);
        const idx = data.tabs.findIndex(t => t.id === tabId);
        if (idx === -1) return;
        const wasActive = data.active === tabId;
        data.tabs.splice(idx, 1);
        if (data.tabs.length === 0) {
            data.active = null;
            this.save(id);
            if (ToolManager.activeToolId === id) ToolManager.close();
            return;
        }
        if (wasActive) {
            data.active = data.tabs[Math.min(idx, data.tabs.length - 1)].id;
            this.save(id);
            if (ToolManager.activeToolId === id) this._reinitTool(id);
        } else {
            this.save(id);
            if (ToolManager.activeToolId === id) this.renderTabBar(id);
        }
    },

    switchTab(id, tabId) {
        const data = this.load(id);
        if (data.active === tabId) return;
        if (ToolManager.activeToolId === id) this.saveActiveTab(id);
        data.active = tabId;
        this.save(id);
        if (ToolManager.activeToolId === id) this._reinitTool(id);
    },

    moveTab(id, fromIdx, toIdx) {
        const data = this.load(id);
        const [tab] = data.tabs.splice(fromIdx, 1);
        data.tabs.splice(toIdx, 0, tab);
        this.save(id);
        if (ToolManager.activeToolId === id) this.renderTabBar(id);
    },

    _reinitTool(id) {
        const handler = ToolManager.registry[id];
        if (!handler) return;
        if (handler.destroy) handler.destroy();
        const data = this.load(id);
        const activeTab = data.tabs.find(t => t.id === data.active);
        this.restoreState(id, activeTab?.state);
        const body = document.getElementById('toolBody');
        body.innerHTML = '';
        const container = document.createElement('div');
        container.className = 'tool-container';
        body.appendChild(container);
        if (handler.loadState) handler.loadState();
        handler.init(container);
        this.renderTabBar(id);
    },

    renderTabBar(id) {
        const bar = document.getElementById('toolTabBar');
        if (!bar) return;
        const data = this.load(id);
        bar.innerHTML = '';

        data.tabs.forEach((tab, idx) => {
            const el = document.createElement('div');
            el.className = 'tool-tab' + (tab.id === data.active ? ' active' : '');
            el.draggable = true;
            el.dataset.tabId = tab.id;
            el.dataset.idx = idx;

            const label = document.createElement('span');
            label.className = 'tool-tab-label';
            label.textContent = tab.label;
            label.ondblclick = (e) => {
                e.stopPropagation();
                const input = document.createElement('input');
                input.className = 'tool-tab-rename';
                input.value = tab.label;
                input.onblur = () => { tab.label = input.value || tab.label; this.save(id); this.renderTabBar(id); };
                input.onkeydown = (ev) => { if (ev.key === 'Enter') input.blur(); if (ev.key === 'Escape') { input.value = tab.label; input.blur(); } };
                label.replaceWith(input);
                input.focus();
                input.select();
            };
            el.appendChild(label);

            const close = document.createElement('span');
            close.className = 'tool-tab-close';
            close.textContent = '×';
            close.onclick = (e) => { e.stopPropagation(); this.closeTab(id, tab.id); };
            el.appendChild(close);

            el.onclick = () => this.switchTab(id, tab.id);

            el.ondragstart = (e) => { e.dataTransfer.setData('text/plain', String(idx)); el.classList.add('dragging'); };
            el.ondragend = () => el.classList.remove('dragging');
            el.ondragover = (e) => { e.preventDefault(); el.classList.add('drag-over'); };
            el.ondragleave = () => el.classList.remove('drag-over');
            el.ondrop = (e) => {
                e.preventDefault();
                el.classList.remove('drag-over');
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                const toIdx = parseInt(el.dataset.idx);
                if (fromIdx !== toIdx) this.moveTab(id, fromIdx, toIdx);
            };

            bar.appendChild(el);
        });

        const addBtn = document.createElement('button');
        addBtn.className = 'tool-tab-add';
        addBtn.textContent = '+';
        addBtn.title = 'New tab';
        addBtn.onclick = () => this.createTab(id);
        bar.appendChild(addBtn);
    },

    _hasContent(state) {
        if (state == null || state === '') return false;
        if (typeof state === 'string') return state.trim().length > 0;
        if (typeof state === 'object') {
            const skip = new Set(['flags', 'leftLabel', 'rightLabel']);
            return Object.entries(state).some(([k, v]) => !skip.has(k) && typeof v === 'string' && v.trim().length > 0);
        }
        return true;
    },

    _updateBadge(id) {
        const strip = document.getElementById('toolStrip');
        if (!strip) return;
        const defIdx = TOOL_DEFS.findIndex(d => d.id === id);
        if (defIdx === -1) return;
        const item = strip.querySelectorAll('.tool-strip-item')[defIdx];
        if (!item) return;

        let count = 0;
        let dotOnly = false;

        if (this.isTabbed(id)) {
            const data = this.load(id);
            count = data.tabs.length;
            if (count === 1) {
                dotOnly = this._hasContent(data.tabs[0].state);
                count = dotOnly ? 1 : 0;
            }
        } else if (id === 'notes') {
            try { count = JSON.parse(localStorage.getItem('tool-state-notes') || '[]').length; } catch {}
            if (count <= 1) count = 0;
        } else if (id === 'reminder') {
            try { count = JSON.parse(localStorage.getItem('tool-state-reminder') || '[]').filter(r => !r.fired).length; } catch {}
        }

        let badge = item.querySelector('.tool-strip-badge');
        if (count > 0) {
            if (!badge) { badge = document.createElement('span'); item.appendChild(badge); }
            if (dotOnly) {
                badge.textContent = '';
                badge.className = 'tool-strip-badge dot';
            } else {
                badge.textContent = count;
                badge.className = 'tool-strip-badge';
            }
        } else if (badge) {
            badge.remove();
        }
    }
};

// ===== Tool Manager =====
const ToolManager = {
    registry: {},
    activeToolId: null,
    _closeTimer: null,

    register(id, handler) {
        this.registry[id] = handler;
    },

    open(id) {
        const def = TOOL_DEFS.find(d => d.id === id);
        const handler = this.registry[id];
        if (!def || !handler) return;

        // If another tool is open, close it immediately (no animation)
        if (this.activeToolId) {
            this._closeImmediate();
        }

        // Hide home
        const home = document.getElementById('homeContainer');
        if (home) home.style.display = 'none';

        // Setup viewport
        const viewport = document.getElementById('toolViewport');
        const body = document.getElementById('toolBody');
        const title = document.getElementById('toolTitle');
        const tabBar = document.getElementById('toolTabBar');

        title.textContent = def.label;
        body.innerHTML = '';
        tabBar.innerHTML = '';

        // For tabbed tools, ensure a tab exists and restore its state
        if (TabManager.isTabbed(id)) {
            const data = TabManager.load(id);
            if (!data.tabs.length) {
                const tabId = Date.now();
                data.tabs.push({ id: tabId, label: 'Tab 1', state: null });
                data.active = tabId;
            }
            const activeTab = data.tabs.find(t => t.id === data.active);
            TabManager.restoreState(id, activeTab?.state);
        }

        const container = document.createElement('div');
        container.className = 'tool-container';
        body.appendChild(container);

        // Init tool
        if (handler.loadState) handler.loadState();
        handler.init(container);

        // Render tab bar for tabbed tools
        if (TabManager.isTabbed(id)) {
            TabManager.renderTabBar(id);
        }

        viewport.classList.remove('closing');
        viewport.classList.add('active');
        this.activeToolId = id;

        const backdrop = document.getElementById('toolBackdrop');
        if (backdrop) backdrop.classList.add('active');
    },

    close() {
        if (!this.activeToolId) return;

        const handler = this.registry[this.activeToolId];
        if (handler) {
            if (TabManager.isTabbed(this.activeToolId)) {
                TabManager.saveActiveTab(this.activeToolId);
            } else {
                if (handler.saveState) handler.saveState();
            }
            if (handler.destroy) handler.destroy();
        }

        const viewport = document.getElementById('toolViewport');
        viewport.classList.add('closing');
        viewport.classList.remove('active');
        this.activeToolId = null;

        const backdrop = document.getElementById('toolBackdrop');
        if (backdrop) backdrop.classList.remove('active');

        clearTimeout(this._closeTimer);
        this._closeTimer = setTimeout(() => {
            viewport.classList.remove('closing');
            document.getElementById('toolBody').innerHTML = '';
            document.getElementById('toolTabBar').innerHTML = '';
            const home = document.getElementById('homeContainer');
            if (home) home.style.display = '';
        }, 280);
    },

    _closeImmediate() {
        const handler = this.registry[this.activeToolId];
        if (handler) {
            if (TabManager.isTabbed(this.activeToolId)) {
                TabManager.saveActiveTab(this.activeToolId);
            } else {
                if (handler.saveState) handler.saveState();
            }
            if (handler.destroy) handler.destroy();
        }
        clearTimeout(this._closeTimer);
        const viewport = document.getElementById('toolViewport');
        viewport.classList.remove('active', 'closing');
        document.getElementById('toolBody').innerHTML = '';
        document.getElementById('toolTabBar').innerHTML = '';
        this.activeToolId = null;
        const backdrop = document.getElementById('toolBackdrop');
        if (backdrop) backdrop.classList.remove('active');
    },

    renderStrip() {
        const strip = document.getElementById('toolStrip');
        if (!strip) return;
        strip.innerHTML = '';
        TOOL_DEFS.forEach((def, i) => {
            const item = document.createElement('button');
            item.className = 'tool-strip-item';
            item.style.animationDelay = `${0.42 + i * 0.035}s`;
            item.setAttribute('data-tooltip', def.label);
            const img = document.createElement('img');
            img.className = 'tool-strip-icon';
            img.src = def.icon;
            img.alt = def.label;
            item.appendChild(img);

            item.addEventListener('click', () => this.open(def.id));
            strip.appendChild(item);
        });
        // Initialize badges
        TOOL_DEFS.forEach(def => {
            if (TabManager.isTabbed(def.id) || def.id === 'notes' || def.id === 'reminder') {
                TabManager._updateBadge(def.id);
            }
        });
    }
};

// ===== Viewport event wiring =====
document.addEventListener('DOMContentLoaded', () => {
    ToolManager.renderStrip();

    const backBtn = document.getElementById('toolBack');
    const closeBtn = document.getElementById('toolClose');
    const expandBtn = document.getElementById('toolExpand');
    const backdropEl = document.getElementById('toolBackdrop');
    if (backBtn) backBtn.addEventListener('click', () => ToolManager.close());
    if (closeBtn) closeBtn.addEventListener('click', () => ToolManager.close());
    if (backdropEl) backdropEl.addEventListener('click', () => ToolManager.close());
    if (expandBtn) expandBtn.addEventListener('click', () => {
        const vp = document.getElementById('toolViewport');
        vp.classList.toggle('fullwidth');
        expandBtn.textContent = vp.classList.contains('fullwidth') ? '⊟' : '⛶';
    });

    // ESC to close tool viewport
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && ToolManager.activeToolId) {
            // Don't close if screensaver is running (it handles its own ESC)
            const ssOverlay = document.querySelector('.screensaver-overlay');
            if (ssOverlay) return;
            // If in presentation mode, exit that first
            const viewport = document.getElementById('toolViewport');
            if (viewport && viewport.classList.contains('presentation')) {
                viewport.classList.remove('presentation');
                const actions = document.getElementById('tmActions');
                if (actions) actions.style.display = '';
                const handler = ToolManager.registry[ToolManager.activeToolId];
                if (handler) handler._presentation = false;
                e.stopPropagation();
                return;
            }
            ToolManager.close();
            e.stopPropagation();
        }
    });
});

// ===== Lazy script loader =====
function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
    });
}

// ===== Reminder background check (runs even when tool is closed) =====
setInterval(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reminders = JSON.parse(localStorage.getItem('tool-state-reminder') || '[]');
    const now = Date.now();
    let changed = false;
    reminders.forEach(r => {
        if (!r.fired && r.time <= now) {
            r.fired = true;
            changed = true;
            new Notification('Reminder', { body: r.title, icon: '⏰' });
        }
    });
    if (changed) {
        localStorage.setItem('tool-state-reminder', JSON.stringify(reminders));
        TabManager._updateBadge('reminder');
    }
}, 30000);

// ===== Keep-awake background management =====
let _wakeLock = null;
async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return false;
    try {
        _wakeLock = await navigator.wakeLock.request('screen');
        _wakeLock.addEventListener('release', () => {
            _wakeLock = null;
            _updateAwakeIndicator(false);
        });
        _updateAwakeIndicator(true);
        return true;
    } catch { return false; }
}
function releaseWakeLock() {
    if (_wakeLock) { _wakeLock.release(); _wakeLock = null; }
    _updateAwakeIndicator(false);
}
function isWakeLockActive() { return !!_wakeLock; }
function _updateAwakeIndicator(active) {
    let el = document.getElementById('awakeIndicator');
    if (active) {
        if (!el) {
            el = document.createElement('div');
            el.id = 'awakeIndicator';
            el.className = 'awake-indicator';
            el.textContent = '☕ Screen awake';
            document.body.appendChild(el);
        }
    } else if (el) {
        el.remove();
    }
}
// Restore wake lock on page load if it was active
if (localStorage.getItem('tool-state-keep-awake') === 'true') {
    requestWakeLock();
}
// Reacquire on visibility change (wake locks release when tab is hidden)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && localStorage.getItem('tool-state-keep-awake') === 'true' && !_wakeLock) {
        requestWakeLock();
    }
});
