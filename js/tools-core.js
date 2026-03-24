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

        title.textContent = def.label;
        body.innerHTML = '';

        const container = document.createElement('div');
        container.className = 'tool-container';
        body.appendChild(container);

        // Init tool
        if (handler.loadState) handler.loadState();
        handler.init(container);

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
            if (handler.saveState) handler.saveState();
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
            const home = document.getElementById('homeContainer');
            if (home) home.style.display = '';
        }, 280);
    },

    _closeImmediate() {
        const handler = this.registry[this.activeToolId];
        if (handler) {
            if (handler.saveState) handler.saveState();
            if (handler.destroy) handler.destroy();
        }
        clearTimeout(this._closeTimer);
        const viewport = document.getElementById('toolViewport');
        viewport.classList.remove('active', 'closing');
        document.getElementById('toolBody').innerHTML = '';
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
    if (changed) localStorage.setItem('tool-state-reminder', JSON.stringify(reminders));
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
