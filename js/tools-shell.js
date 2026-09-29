const TOOL_DEFS = [
    { id: 'json-formatter', icon: 'img/tool-json.svg', label: 'JSON' },
    { id: 'markdown-viewer', icon: 'img/tool-markdown.svg', label: 'Markdown' },
    { id: 'sql-formatter', icon: 'img/tool-sql.svg', label: 'SQL' },
    { id: 'text-formatter', icon: 'img/tool-text.svg', label: 'Text' },
    { id: 'regex-tester', icon: 'img/tool-regex.svg', label: 'Regex' },
    { id: 'diff-viewer', icon: 'img/tool-diff.svg', label: 'Diff' },
    { id: 'date-formatter', icon: 'img/tool-date.svg', label: 'Date' },
    { id: 'epoch-converter', icon: 'img/tool-epoch.svg', label: 'Epoch' },
    { id: 'color-picker', icon: 'img/tool-color.svg', label: 'Color' },
    { id: 'password-generator', icon: 'img/tool-password.svg', label: 'Password' },
    { id: 'uuid-hash', icon: 'img/tool-uuid.svg', label: 'UUID/Hash' },
    { id: 'notes', icon: 'img/tool-notes.svg', label: 'Notes' },
    { id: 'reminder', icon: 'img/tool-reminder.svg', label: 'Reminder' },
    { id: 'keep-awake', icon: 'img/tool-awake.svg', label: 'Awake' },
    { id: 'screensaver', icon: 'img/tool-screensaver.svg', label: 'Screensaver' }
];

const ToolBadges = {
    tabbed: new Set(['json-formatter', 'markdown-viewer', 'sql-formatter', 'text-formatter', 'regex-tester', 'diff-viewer']),

    hasContent(state) {
        if (state == null || state === '') return false;
        if (typeof state === 'string') return state.trim().length > 0;
        if (typeof state !== 'object') return true;
        const skip = new Set(['flags', 'leftLabel', 'rightLabel']);
        return Object.entries(state).some(([key, value]) => !skip.has(key) && typeof value === 'string' && value.trim().length > 0);
    },

    count(id) {
        try {
            if (this.tabbed.has(id)) {
                const data = JSON.parse(localStorage.getItem(`tool-tabs-${id}`) || '{"tabs":[]}');
                const tabs = data.tabs || [];
                if (tabs.length !== 1) return { count: tabs.length, dot: false };
                return { count: this.hasContent(tabs[0].state) ? 1 : 0, dot: true };
            }
            if (id === 'notes') {
                const count = JSON.parse(localStorage.getItem('tool-state-notes') || '[]').length;
                return { count: count > 1 ? count : 0, dot: false };
            }
            if (id === 'reminder') {
                return { count: JSON.parse(localStorage.getItem('tool-state-reminder') || '[]').filter(reminder => !reminder.fired).length, dot: false };
            }
        } catch {}
        return { count: 0, dot: false };
    },

    refresh() {
        const strip = document.getElementById('toolStrip');
        if (!strip) return;
        TOOL_DEFS.forEach((definition, index) => {
            if (!this.tabbed.has(definition.id) && definition.id !== 'notes' && definition.id !== 'reminder') return;
            const item = strip.querySelectorAll('.tool-strip-item')[index];
            if (!item) return;
            const { count, dot } = this.count(definition.id);
            let badge = item.querySelector('.tool-strip-badge');
            if (!count) {
                badge?.remove();
                return;
            }
            if (!badge) {
                badge = document.createElement('span');
                item.appendChild(badge);
            }
            badge.textContent = dot ? '' : count;
            badge.className = dot ? 'tool-strip-badge dot' : 'tool-strip-badge';
        });
    }
};

const ToolManager = {
    activeToolId: null,
    _closeTimer: null,

    open(id) {
        const definition = TOOL_DEFS.find(tool => tool.id === id);
        if (!definition) return;
        if (this.activeToolId) this._closeImmediate();

        const home = document.getElementById('homeContainer');
        const viewport = document.getElementById('toolViewport');
        const body = document.getElementById('toolBody');
        const title = document.getElementById('toolTitle');
        const frame = document.createElement('iframe');

        frame.className = 'tool-runtime-frame';
        frame.title = `${definition.label} tool`;
        frame.src = `tool-runtime.html?tool=${encodeURIComponent(id)}`;
        body.replaceChildren(frame);
        title.textContent = definition.label;
        home.style.display = 'none';
        viewport.classList.remove('closing');
        viewport.classList.add('active');
        document.getElementById('toolBackdrop').classList.add('active');
        this.activeToolId = id;
    },

    close() {
        if (!this.activeToolId) return;
        this._disposeFrame();
        this.activeToolId = null;

        const viewport = document.getElementById('toolViewport');
        viewport.classList.add('closing');
        viewport.classList.remove('active');
        document.getElementById('toolBackdrop').classList.remove('active');

        clearTimeout(this._closeTimer);
        this._closeTimer = setTimeout(() => {
            viewport.classList.remove('closing');
            document.getElementById('toolBody').replaceChildren();
            document.getElementById('homeContainer').style.display = '';
            ToolBadges.refresh();
        }, 280);
    },

    _closeImmediate() {
        this._disposeFrame();
        clearTimeout(this._closeTimer);
        document.getElementById('toolViewport').classList.remove('active', 'closing');
        document.getElementById('toolBackdrop').classList.remove('active');
        document.getElementById('toolBody').replaceChildren();
        this.activeToolId = null;
        ToolBadges.refresh();
    },

    _disposeFrame() {
        const frame = document.querySelector('.tool-runtime-frame');
        try {
            frame?.contentWindow?.disposeToolRuntime?.();
        } catch {}
    },

    renderStrip() {
        const strip = document.getElementById('toolStrip');
        if (!strip) return;
        strip.replaceChildren();
        TOOL_DEFS.forEach((definition, index) => {
            const item = document.createElement('button');
            const icon = document.createElement('img');
            item.className = 'tool-strip-item';
            item.style.animationDelay = `${0.42 + index * 0.035}s`;
            item.dataset.tooltip = definition.label;
            icon.className = 'tool-strip-icon';
            icon.src = definition.icon;
            icon.alt = definition.label;
            item.appendChild(icon);
            item.addEventListener('click', () => this.open(definition.id));
            strip.appendChild(item);
        });
        ToolBadges.refresh();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ToolManager.renderStrip();
    document.getElementById('toolBack')?.addEventListener('click', () => ToolManager.close());
    document.getElementById('toolClose')?.addEventListener('click', () => ToolManager.close());
    document.getElementById('toolBackdrop')?.addEventListener('click', () => ToolManager.close());
    document.getElementById('toolExpand')?.addEventListener('click', (event) => {
        const viewport = document.getElementById('toolViewport');
        viewport.classList.toggle('fullwidth');
        event.currentTarget.textContent = viewport.classList.contains('fullwidth') ? '⊟' : '⛶';
    });
});

window.addEventListener('message', (event) => {
    if (event.source !== document.querySelector('.tool-runtime-frame')?.contentWindow) return;
    if (event.data?.type === 'tool-runtime-close') ToolManager.close();
});

setInterval(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reminders = JSON.parse(localStorage.getItem('tool-state-reminder') || '[]');
    const now = Date.now();
    let changed = false;
    reminders.forEach(reminder => {
        if (!reminder.fired && reminder.time <= now) {
            reminder.fired = true;
            changed = true;
            new Notification('Reminder', { body: reminder.title, icon: '⏰' });
        }
    });
    if (changed) {
        localStorage.setItem('tool-state-reminder', JSON.stringify(reminders));
        ToolBadges.refresh();
    }
}, 30000);