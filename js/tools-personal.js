// ===== 12. Notes =====
ToolManager.register('notes', {
    _notes: null, _activeId: null, _saveTimer: null, _dropStatusTimer: null,
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
                <div id="tnDropStatus" style="min-height:18px;font-size:12px;color:rgba(255,255,255,0.65);"></div>
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
                const nextTitle = titleEl.value;
                const nextContent = contentEl.value;
                const changed = note.title !== nextTitle || note.content !== nextContent;
                if (!changed) return;
                note.title = nextTitle;
                note.content = nextContent;
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
    destroy() {
        clearTimeout(this._saveTimer);
        clearTimeout(this._dropStatusTimer);
    },
    saveState() { if (this._saveCurrentNote) this._saveCurrentNote(); },
    loadState() {},
    handleFileDrop(content, filename) {
        const newBtn = document.getElementById('tnNew');
        if (newBtn) newBtn.click();
        const titleEl = document.getElementById('tnTitle');
        const contentEl = document.getElementById('tnContent');
        if (!titleEl || !contentEl) return;
        titleEl.value = filename ? filename.replace(/\.[^.]+$/, '') : 'Dropped Note';
        contentEl.value = content;
        titleEl.dispatchEvent(new Event('input'));
        contentEl.dispatchEvent(new Event('input'));
    },
    onFileDropStatus(info) {
        const statusEl = document.getElementById('tnDropStatus');
        if (!statusEl) return;
        clearTimeout(this._dropStatusTimer);
        if (!info || !info.state) {
            statusEl.textContent = '';
            return;
        }
        if (info.state === 'loading') {
            statusEl.style.color = 'rgba(255,255,255,0.75)';
            statusEl.textContent = info.message || 'Loading dropped file...';
            return;
        }
        if (info.state === 'success') {
            statusEl.style.color = '#73d89a';
            statusEl.textContent = info.message || 'File loaded';
            this._dropStatusTimer = setTimeout(() => { statusEl.textContent = ''; }, 2000);
            return;
        }
        if (info.state === 'error') {
            statusEl.style.color = '#ff8f8f';
            statusEl.textContent = info.message || 'Failed to load file';
            this._dropStatusTimer = setTimeout(() => { statusEl.textContent = ''; }, 4000);
        }
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
                    <button class="tool-btn danger" style="padding:4px 10px;font-size:11px" data-rid="${r.id}">Ã—</button>
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
            <div style="font-size:64px;">â˜•</div>
            <div style="font-size:18px;font-weight:500;">Keep Screen Awake</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.5);max-width:360px;line-height:1.6;">
                Prevents your screen from dimming or locking due to inactivity. Uses the Screen Wake Lock API â€” works even when you switch to the home view.
            </div>
            <button class="tool-btn ${active ? 'danger' : 'success'}" id="tkaToggle" style="padding:12px 32px;font-size:15px;">
                ${active ? 'â˜• Active â€” Click to Stop' : 'ðŸ’¤ Inactive â€” Click to Activate'}
            </button>
            <div class="tool-stats" id="tkaStatus">${!('wakeLock' in navigator) ? 'Wake Lock API not supported in this browser' : ''}</div>
        </div>`;
        document.getElementById('tkaToggle').onclick = async () => {
            const btn = document.getElementById('tkaToggle');
            if (isWakeLockActive()) {
                releaseWakeLock();
                localStorage.setItem('tool-state-keep-awake', 'false');
                btn.textContent = 'ðŸ’¤ Inactive â€” Click to Activate';
                btn.className = 'tool-btn success';
            } else {
                const ok = await requestWakeLock();
                if (ok) {
                    localStorage.setItem('tool-state-keep-awake', 'true');
                    btn.textContent = 'â˜• Active â€” Click to Stop';
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

