/* ============================================================
   Advanced Bookmarks — bookmarks-advanced.js
   All logic is wrapped in an IIFE. Globals from app.js
   (sanitizeUrl, getFaviconUrl, getMainPart, getLetterIconHue,
   showToast, settings) are accessed via window references at
   call-time, so load order (after app.js) is safe.
   ============================================================ */
(function () {
    'use strict';

    // ── Constants ─────────────────────────────────────────────
    const STORAGE_KEY = 'advancedBookmarksConfig';

    const DEFAULT_BORDER = () => ({
        style: 'none',
        width: 1,
        color: 'rgba(255,255,255,0.35)',
        radius: 12
    });

    const DEFAULT_GROUP = () => ({
        id: generateId(),
        name: 'New Group',
        showName: true,
        maxSlots: 4,
        slotSize: 'medium',
        showBookmarkNames: true,
        background: 'rgba(255,255,255,0.08)',
        border: DEFAULT_BORDER(),
        padding: 10,
        bookmarks: []
    });

    const DEFAULT_CONFIG = () => ({
        enabled: false,
        globalMaxSlots: 8,
        groups: []
    });

    // ── State ─────────────────────────────────────────────────
    let config = null;
    let activeModalContext = null; // { groupId, bookmarkId | null }
    let editingGroupId = null;
    let editMode = false;

    // ── ID generation ─────────────────────────────────────────
    function generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return Date.now().toString(36) + Math.random().toString(36).slice(2);
    }

    // ── Storage ───────────────────────────────────────────────
    function loadConfig() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                config = JSON.parse(raw);
                // Back-fill missing fields on existing groups
                if (Array.isArray(config.groups)) {
                    config.groups.forEach(g => {
                        if (!g.id) g.id = generateId();
                        if (!g.border) g.border = DEFAULT_BORDER();
                        if (g.padding === undefined) g.padding = 10;
                        if (g.slotSize === undefined) g.slotSize = 'medium';
                        if (g.showBookmarkNames === undefined) g.showBookmarkNames = true;
                        if (!Array.isArray(g.bookmarks)) g.bookmarks = [];
                        g.bookmarks.forEach(b => {
                            if (!b.id) b.id = generateId();
                        });
                    });
                }
                if (config.globalMaxSlots === undefined) config.globalMaxSlots = 8;
                return;
            }
        } catch (e) {
            console.error('advancedBookmarks: failed to load config', e);
        }
        config = DEFAULT_CONFIG();
    }

    function saveConfig() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }

    // ── Migration ─────────────────────────────────────────────
    function migrateBasicToAdvanced() {
        let basicBookmarks = [];
        try {
            basicBookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
        } catch {}

        const group = DEFAULT_GROUP();
        group.name = 'Quick Access';
        group.maxSlots = config.globalMaxSlots;
        group.bookmarks = basicBookmarks.map(b => ({
            id: generateId(),
            title: b.title || '',
            url: b.url || '',
            iconHue: b.iconHue !== undefined ? b.iconHue : 200,
            iconLetter: b.iconLetter || '?'
        }));
        config.groups = [group];
        saveConfig();
    }

    // ── Group CRUD ────────────────────────────────────────────
    function addGroup(groupData) {
        const group = Object.assign(DEFAULT_GROUP(), groupData, { id: generateId() });
        config.groups.push(group);
        saveConfig();
        renderAdvancedBookmarks();
    }

    function updateGroup(id, patch) {
        const g = config.groups.find(g => g.id === id);
        if (!g) return;
        if (patch.border) {
            g.border = Object.assign({}, g.border, patch.border);
            const p = Object.assign({}, patch);
            delete p.border;
            Object.assign(g, p);
        } else {
            Object.assign(g, patch);
        }
        saveConfig();
        renderAdvancedBookmarks();
    }

    function deleteGroup(id) {
        config.groups = config.groups.filter(g => g.id !== id);
        saveConfig();
        renderAdvancedBookmarks();
    }

    function reorderGroups(newIds) {
        const map = new Map(config.groups.map(g => [g.id, g]));
        config.groups = newIds.map(id => map.get(id)).filter(Boolean);
        saveConfig();
        renderAdvancedBookmarks();
    }

    // ── Bookmark CRUD ─────────────────────────────────────────
    function addBookmarkToGroup(groupId, bookmarkData) {
        const g = config.groups.find(g => g.id === groupId);
        if (!g) return;
        g.bookmarks.push(Object.assign({ id: generateId() }, bookmarkData));
        saveConfig();
        renderAdvancedBookmarks();
    }

    function updateBookmarkInGroup(groupId, bookmarkId, patch) {
        const g = config.groups.find(g => g.id === groupId);
        if (!g) return;
        const b = g.bookmarks.find(b => b.id === bookmarkId);
        if (!b) return;
        Object.assign(b, patch);
        saveConfig();
        renderAdvancedBookmarks();
    }

    function deleteBookmarkFromGroup(groupId, bookmarkId) {
        const g = config.groups.find(g => g.id === groupId);
        if (!g) return;
        g.bookmarks = g.bookmarks.filter(b => b.id !== bookmarkId);
        saveConfig();
        renderAdvancedBookmarks();
    }

    function moveBookmark(fromGroupId, toGroupId, bookmarkId) {
        if (fromGroupId === toGroupId) return;
        const fromG = config.groups.find(g => g.id === fromGroupId);
        const toG = config.groups.find(g => g.id === toGroupId);
        if (!fromG || !toG) return;
        const idx = fromG.bookmarks.findIndex(b => b.id === bookmarkId);
        if (idx < 0) return;
        const [bm] = fromG.bookmarks.splice(idx, 1);
        toG.bookmarks.push(bm);
        saveConfig();
        renderAdvancedBookmarks();
    }

    // ── Safe wrappers for app.js globals ──────────────────────
    function safeUrl(url) {
        return typeof sanitizeUrl === 'function' ? sanitizeUrl(url) : url;
    }

    function safeFaviconUrl(url) {
        return typeof getFaviconUrl === 'function' ? getFaviconUrl(url) : '';
    }

    function computeIconData(sanitized) {
        const mainPart = typeof getMainPart === 'function'
            ? getMainPart(sanitized)
            : (sanitized.replace(/^https?:\/\//, '').split('.')[0] || '?');
        const iconHue = typeof getLetterIconHue === 'function'
            ? getLetterIconHue(mainPart)
            : 200;
        const iconLetter = (mainPart.replace(/[^a-z]/gi, '')[0] || '?').toUpperCase();
        return { iconHue, iconLetter };
    }

    function toast(msg) {
        if (typeof showToast === 'function') showToast(msg);
    }

    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = String(text);
        return d.innerHTML;
    }

    // ── Rendering ─────────────────────────────────────────────
    function renderAdvancedBookmarks() {
        const container = document.getElementById('advancedBookmarksContainer');
        if (!container) return;

        container.innerHTML = '';
        container.style.setProperty('--bm-global-slots', config.globalMaxSlots);

        if (!config.groups.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:rgba(255,255,255,0.45);font-size:13px;padding:20px 0;text-align:center;';
            empty.textContent = 'No groups yet. Click "\u2699 Groups" to create one.';
            container.appendChild(empty);
            return;
        }

        const showFavicons = window.settings && window.settings.showFavicons;

        config.groups.forEach((group, idx) => {
            const slots = Math.min(Math.max(1, group.maxSlots), config.globalMaxSlots);
            const el = createGroupElement(group, slots, showFavicons, idx);
            container.appendChild(el);
        });
    }

    function createGroupElement(group, slots, showFavicons, groupIdx) {
        const el = document.createElement('div');
        el.className = 'bm-group';
        el.dataset.groupId = group.id;
        el.style.cssText = buildGroupStyle(group, slots);
        el.style.animationDelay = (0.05 * groupIdx) + 's';

        if (group.slotSize === 'small') el.classList.add('bm-slot-small');
        if (group.slotSize === 'large') el.classList.add('bm-slot-large');
        if (!group.showBookmarkNames) el.classList.add('bm-hide-names');

        if (group.showName && group.name) {
            const nameEl = document.createElement('div');
            nameEl.className = 'bm-group-name';
            nameEl.textContent = group.name;
            nameEl.title = group.name;
            el.appendChild(nameEl);
        }

        const body = document.createElement('div');
        body.className = 'bm-group-body';
        body.style.setProperty('--bm-group-slots', slots);

        group.bookmarks.forEach((bm, bmIdx) => {
            body.appendChild(createBookmarkSlot(bm, group.id, showFavicons, bmIdx));
        });

        // Add-bookmark slot
        const addSlot = document.createElement('div');
        addSlot.className = 'bm-slot-add';
        addSlot.title = 'Add bookmark';
        addSlot.textContent = '+';
        addSlot.addEventListener('click', () => openAdvancedBookmarkModal(group.id, null));
        body.appendChild(addSlot);

        el.appendChild(body);
        return el;
    }

    function buildGroupStyle(group, slots) {
        const parts = [
            '--bm-group-slots: ' + slots,
            'grid-column: span ' + slots
        ];

        if (group.background && group.background !== 'transparent') {
            parts.push('background: ' + group.background);
        }

        const b = group.border;
        if (b) {
            if (b.style !== 'none') {
                parts.push('border: ' + b.width + 'px ' + b.style + ' ' + b.color);
            }
            const radius = b.radius !== undefined ? b.radius : 12;
            parts.push('border-radius: ' + radius + 'px');
        }

        const padding = group.padding !== undefined ? group.padding : 0;
        if (padding > 0) parts.push('padding: ' + padding + 'px');

        return parts.join('; ');
    }

    function createBookmarkSlot(bm, groupId, showFavicons, bmIdx) {
        const slot = document.createElement('a');
        slot.className = 'bm-slot';
        slot.href = safeUrl(bm.url);
        slot.style.animationDelay = (0.05 + 0.03 * bmIdx) + 's';
        slot.title = bm.title;

        const iconEl = document.createElement('span');
        iconEl.className = 'bm-slot-icon';

        if (showFavicons) {
            const img = document.createElement('img');
            img.src = safeFaviconUrl(bm.url);
            img.alt = bm.title;
            img.onerror = function () {
                this.parentElement.textContent = bm.iconLetter || '?';
                this.parentElement.style.background = 'hsl(' + (bm.iconHue || 200) + ',60%,42%)';
            };
            iconEl.appendChild(img);
        } else {
            iconEl.style.background = 'hsl(' + (bm.iconHue || 200) + ',60%,42%)';
            iconEl.textContent = bm.iconLetter || '?';
        }

        const nameEl = document.createElement('span');
        nameEl.className = 'bm-slot-name';
        nameEl.textContent = bm.title;

        const editBtn = document.createElement('button');
        editBtn.className = 'bm-slot-edit-btn';
        editBtn.textContent = '\u270e';
        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openAdvancedBookmarkModal(groupId, bm.id);
        });

        slot.appendChild(iconEl);
        slot.appendChild(nameEl);
        slot.appendChild(editBtn);
        return slot;
    }

    // ── Advanced Bookmark Modal ────────────────────────────────
    function ensureBookmarkModal() {
        if (document.getElementById('advancedBookmarkModal')) return;

        const overlay = document.createElement('div');
        overlay.className = 'modal';
        overlay.id = 'advancedBookmarkModal';
        overlay.innerHTML =
            '<div class="modal-content">' +
                '<h3 id="advBmModalTitle">Add Bookmark</h3>' +
                '<div class="form-group">' +
                    '<label for="advBmTitle">Title</label>' +
                    '<input type="text" id="advBmTitle" placeholder="My Site">' +
                '</div>' +
                '<div class="form-group">' +
                    '<label for="advBmUrl">URL</label>' +
                    '<input type="text" id="advBmUrl" placeholder="https://example.com">' +
                '</div>' +
                '<div class="form-group" id="bmGroupMoveRow">' +
                    '<label for="advBmMoveGroup">Move to Group</label>' +
                    '<select id="advBmMoveGroup"></select>' +
                '</div>' +
                '<div class="modal-buttons">' +
                    '<button class="modal-btn danger" id="advBmDeleteBtn" style="display:none">Delete</button>' +
                    '<div style="flex:1"></div>' +
                    '<button class="modal-btn secondary" id="advBmCancelBtn">Cancel</button>' +
                    '<button class="modal-btn primary" id="advBmSaveBtn">Save</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        let mdTarget = null;
        overlay.addEventListener('mousedown', (e) => {
            mdTarget = (e.target === overlay) ? overlay : null;
        });
        overlay.addEventListener('mouseup', (e) => {
            if (mdTarget === overlay && e.target === overlay) closeAdvancedBookmarkModal();
            mdTarget = null;
        });

        document.getElementById('advBmCancelBtn').addEventListener('click', closeAdvancedBookmarkModal);
        document.getElementById('advBmSaveBtn').addEventListener('click', saveAdvancedBookmark);
        document.getElementById('advBmDeleteBtn').addEventListener('click', deleteAdvancedBookmark);

        ['advBmTitle', 'advBmUrl'].forEach(id => {
            document.getElementById(id).addEventListener('keypress', (e) => {
                if (e.key === 'Enter') saveAdvancedBookmark();
            });
        });
    }

    function openAdvancedBookmarkModal(groupId, bookmarkId) {
        ensureBookmarkModal();
        activeModalContext = { groupId, bookmarkId };

        const titleEl = document.getElementById('advBmModalTitle');
        const titleInput = document.getElementById('advBmTitle');
        const urlInput = document.getElementById('advBmUrl');
        const deleteBtn = document.getElementById('advBmDeleteBtn');
        const moveRow = document.getElementById('bmGroupMoveRow');
        const moveSelect = document.getElementById('advBmMoveGroup');

        if (bookmarkId) {
            const g = config.groups.find(g => g.id === groupId);
            const bm = g ? g.bookmarks.find(b => b.id === bookmarkId) : null;
            if (!bm) return;

            titleEl.textContent = 'Edit Bookmark';
            titleInput.value = bm.title;
            urlInput.value = bm.url;
            deleteBtn.style.display = '';

            if (config.groups.length > 1) {
                moveRow.classList.add('visible');
                moveSelect.innerHTML = config.groups
                    .map(grp => '<option value="' + grp.id + '"' + (grp.id === groupId ? ' selected' : '') + '>' + escapeHtml(grp.name) + '</option>')
                    .join('');
            } else {
                moveRow.classList.remove('visible');
            }
        } else {
            titleEl.textContent = 'Add Bookmark';
            titleInput.value = '';
            urlInput.value = '';
            deleteBtn.style.display = 'none';
            moveRow.classList.remove('visible');
        }

        const overlay = document.getElementById('advancedBookmarkModal');
        overlay.classList.remove('closing');
        overlay.classList.add('active');
        titleInput.focus();
    }

    function closeAdvancedBookmarkModal() {
        const overlay = document.getElementById('advancedBookmarkModal');
        if (!overlay) return;
        overlay.classList.add('closing');
        overlay.classList.remove('active');
        setTimeout(() => overlay.classList.remove('closing'), 200);
        activeModalContext = null;
    }

    function saveAdvancedBookmark() {
        if (!activeModalContext) return;

        const title = document.getElementById('advBmTitle').value.trim();
        const rawUrl = document.getElementById('advBmUrl').value.trim();
        if (!title || !rawUrl) return;

        let formattedUrl = rawUrl;
        if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://') && !rawUrl.startsWith('file://')) {
            formattedUrl = 'https://' + rawUrl;
        }

        const sanitized = safeUrl(formattedUrl);
        if (sanitized === 'about:blank') {
            toast('Please enter a valid URL (e.g. github.com or https://example.com)');
            return;
        }

        const { iconHue, iconLetter } = computeIconData(sanitized);
        const { groupId, bookmarkId } = activeModalContext;

        if (bookmarkId) {
            const moveRow = document.getElementById('bmGroupMoveRow');
            const moveSelect = document.getElementById('advBmMoveGroup');
            const targetGroupId = (moveRow && moveRow.classList.contains('visible') && moveSelect)
                ? moveSelect.value
                : groupId;

            updateBookmarkInGroup(groupId, bookmarkId, { title, url: sanitized, iconHue, iconLetter });
            if (targetGroupId !== groupId) {
                moveBookmark(groupId, targetGroupId, bookmarkId);
            }
        } else {
            addBookmarkToGroup(groupId, { title, url: sanitized, iconHue, iconLetter });
        }

        closeAdvancedBookmarkModal();
    }

    function deleteAdvancedBookmark() {
        if (!activeModalContext || !activeModalContext.bookmarkId) return;
        deleteBookmarkFromGroup(activeModalContext.groupId, activeModalContext.bookmarkId);
        closeAdvancedBookmarkModal();
    }

    // ── Group Management Panel ────────────────────────────────
    function ensureGroupMgmtPanel() {
        if (document.getElementById('bmMgmtOverlay')) return;

        const overlay = document.createElement('div');
        overlay.className = 'bm-mgmt-overlay';
        overlay.id = 'bmMgmtOverlay';
        overlay.innerHTML =
            '<div class="bm-mgmt-panel" id="bmMgmtPanel">' +
                '<div class="bm-mgmt-header">' +
                    '<span class="bm-mgmt-title">Manage Groups</span>' +
                    '<button class="bm-mgmt-close-btn" id="bmMgmtCloseBtn">\u00d7</button>' +
                '</div>' +
                '<div class="bm-mgmt-global">' +
                    '<label for="bmGlobalSlots">Global columns</label>' +
                    '<input type="number" id="bmGlobalSlots" min="1" max="20" value="8">' +
                    '<span class="bm-mgmt-slots-hint">max bookmark columns per row</span>' +
                '</div>' +
                '<div class="bm-mgmt-list" id="bmMgmtList"></div>' +
                '<div class="bm-mgmt-footer">' +
                    '<button class="bm-mgmt-add-group-btn" id="bmMgmtAddGroupBtn">+ Add Group</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        let mdTarget = null;
        overlay.addEventListener('mousedown', (e) => {
            mdTarget = (e.target === overlay) ? overlay : null;
        });
        overlay.addEventListener('mouseup', (e) => {
            if (mdTarget === overlay && e.target === overlay) closeGroupMgmtPanel();
            mdTarget = null;
        });

        document.getElementById('bmMgmtCloseBtn').addEventListener('click', closeGroupMgmtPanel);
        document.getElementById('bmMgmtAddGroupBtn').addEventListener('click', () => openGroupEditor(null));

        document.getElementById('bmGlobalSlots').addEventListener('change', () => {
            const val = parseInt(document.getElementById('bmGlobalSlots').value, 10);
            if (val >= 1 && val <= 20) {
                config.globalMaxSlots = val;
                saveConfig();
                renderAdvancedBookmarks();
                updateSlotsPreview();
            }
        });
    }

    function openGroupMgmtPanel() {
        ensureGroupMgmtPanel();
        document.getElementById('bmGlobalSlots').value = config.globalMaxSlots;
        refreshGroupMgmtList();
        const overlay = document.getElementById('bmMgmtOverlay');
        overlay.classList.remove('closing');
        overlay.classList.add('active');
    }

    function closeGroupMgmtPanel() {
        const overlay = document.getElementById('bmMgmtOverlay');
        if (!overlay) return;
        overlay.classList.add('closing');
        overlay.classList.remove('active');
        setTimeout(() => overlay.classList.remove('closing'), 220);
    }

    function refreshGroupMgmtList() {
        const list = document.getElementById('bmMgmtList');
        if (!list) return;
        list.innerHTML = '';

        if (!config.groups.length) {
            const empty = document.createElement('div');
            empty.className = 'bm-mgmt-list-empty';
            empty.textContent = 'No groups yet. Add one below.';
            list.appendChild(empty);
            return;
        }

        config.groups.forEach(group => list.appendChild(createGroupMgmtRow(group)));
        initDragReorder(list);
    }

    function createGroupMgmtRow(group) {
        const row = document.createElement('div');
        row.className = 'bm-mgmt-group-row';
        row.dataset.id = group.id;
        row.draggable = true;

        const count = group.bookmarks.length;
        const meta = group.maxSlots + ' col' + (group.maxSlots !== 1 ? 's' : '') +
                     ' \u00b7 ' + count + ' bookmark' + (count !== 1 ? 's' : '');

        row.innerHTML =
            '<span class="bm-mgmt-drag-handle" title="Drag to reorder">\u2807</span>' +
            '<div class="bm-mgmt-group-info">' +
                '<div class="bm-mgmt-group-name-text">' + escapeHtml(group.name) + '</div>' +
                '<div class="bm-mgmt-group-meta">' + escapeHtml(meta) + '</div>' +
            '</div>' +
            '<div class="bm-mgmt-group-actions">' +
                '<button class="bm-mgmt-icon-btn" title="Edit group" data-action="edit">\u270e</button>' +
                '<button class="bm-mgmt-icon-btn danger" title="Delete group" data-action="delete">\ud83d\uddd1</button>' +
            '</div>';

        row.querySelector('[data-action="edit"]').addEventListener('click', () => openGroupEditor(group.id));
        row.querySelector('[data-action="delete"]').addEventListener('click', () => confirmDeleteGroup(group.id, group.name));
        return row;
    }

    function confirmDeleteGroup(id, name) {
        const group = config.groups.find(g => g.id === id);
        if (!group) return;
        const msg = group.bookmarks.length > 0
            ? 'Delete group "' + name + '" and all ' + group.bookmarks.length + ' bookmark(s) inside it?'
            : 'Delete group "' + name + '"?';
        if (!confirm(msg)) return;
        deleteGroup(id);
        refreshGroupMgmtList();
    }

    // ── Drag-to-reorder (HTML5 Drag API) ──────────────────────
    function initDragReorder(listEl) {
        let dragSrcId = null;

        listEl.querySelectorAll('.bm-mgmt-group-row').forEach(row => {
            row.addEventListener('dragstart', (e) => {
                dragSrcId = row.dataset.id;
                row.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            row.addEventListener('dragend', () => {
                row.classList.remove('dragging');
                listEl.querySelectorAll('.bm-mgmt-group-row').forEach(r => r.classList.remove('drag-over'));
            });

            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                listEl.querySelectorAll('.bm-mgmt-group-row').forEach(r => r.classList.remove('drag-over'));
                if (row.dataset.id !== dragSrcId) row.classList.add('drag-over');
            });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                if (!dragSrcId || dragSrcId === row.dataset.id) return;
                const ids = [...listEl.querySelectorAll('.bm-mgmt-group-row')].map(r => r.dataset.id);
                const srcIdx = ids.indexOf(dragSrcId);
                const dstIdx = ids.indexOf(row.dataset.id);
                if (srcIdx < 0 || dstIdx < 0) return;
                ids.splice(srcIdx, 1);
                ids.splice(dstIdx, 0, dragSrcId);
                reorderGroups(ids);
                refreshGroupMgmtList();
            });
        });
    }

    // ── Group Editor Modal ─────────────────────────────────────
    function ensureGroupEditor() {
        if (document.getElementById('bmEditorOverlay')) return;

        const overlay = document.createElement('div');
        overlay.className = 'bm-editor-overlay';
        overlay.id = 'bmEditorOverlay';
        overlay.innerHTML =
            '<div class="bm-editor-panel" id="bmEditorPanel">' +
                '<div class="bm-editor-inner">' +
                    '<div class="bm-editor-title" id="bmEditorTitle">Edit Group</div>' +

                    '<div class="bm-editor-row">' +
                        '<label for="bmEdName">Group Name</label>' +
                        '<input type="text" id="bmEdName" placeholder="e.g. GitHub Repos">' +
                    '</div>' +

                    '<div class="bm-editor-toggle-row">' +
                        '<label>Show Group Name</label>' +
                        '<label class="toggle-switch">' +
                            '<input type="checkbox" id="bmEdShowName" checked>' +
                            '<span class="toggle-slider"></span>' +
                        '</label>' +
                    '</div>' +

                    '<div class="bm-editor-row">' +
                        '<label for="bmEdSlots">Column Width (max slots)</label>' +
                        '<input type="number" id="bmEdSlots" min="1" max="20" value="4">' +
                        '<div class="bm-slots-preview" id="bmEdSlotsPreview"></div>' +
                    '</div>' +

                    '<div class="bm-editor-row">' +
                        '<label>Slot Size</label>' +
                        '<div class="bm-seg-control" id="bmEdSlotSize">' +
                            '<button data-val="small">Small</button>' +
                            '<button data-val="medium" class="active">Medium</button>' +
                            '<button data-val="large">Large</button>' +
                        '</div>' +
                    '</div>' +

                    '<div class="bm-editor-toggle-row">' +
                        '<label>Show Bookmark Names</label>' +
                        '<label class="toggle-switch">' +
                            '<input type="checkbox" id="bmEdShowNames" checked>' +
                            '<span class="toggle-slider"></span>' +
                        '</label>' +
                    '</div>' +

                    '<hr class="bm-editor-divider">' +

                    '<div class="bm-editor-row">' +
                        '<label>Background Color &amp; Opacity</label>' +
                        '<div class="bm-color-row">' +
                            '<input type="color" id="bmEdBgColor" value="#ffffff">' +
                            '<input type="range" id="bmEdBgOpacity" min="0" max="100" value="8">' +
                            '<span class="bm-color-opacity-label" id="bmEdBgOpacityLabel">8%</span>' +
                        '</div>' +
                    '</div>' +

                    '<div class="bm-editor-row">' +
                        '<label for="bmEdBorderStyle">Border Style</label>' +
                        '<select id="bmEdBorderStyle">' +
                            '<option value="none">None</option>' +
                            '<option value="solid">Solid</option>' +
                            '<option value="dashed">Dashed</option>' +
                            '<option value="dotted">Dotted</option>' +
                        '</select>' +
                    '</div>' +

                    '<div id="bmEdBorderDetails">' +
                        '<div class="bm-editor-row">' +
                            '<label>Border Color &amp; Width</label>' +
                            '<div class="bm-color-row">' +
                                '<input type="color" id="bmEdBorderColor" value="#ffffff">' +
                                '<input type="number" id="bmEdBorderWidth" min="1" max="10" value="1">' +
                                '<span style="font-size:12px;color:#aaa;">px</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +

                    '<div class="bm-editor-row">' +
                        '<label>Border Radius: <span id="bmEdRadiusLabel">12px</span></label>' +
                        '<input type="range" id="bmEdRadius" min="0" max="28" value="12" style="width:100%;accent-color:#667eea;">' +
                    '</div>' +

                    '<div class="bm-editor-row">' +
                        '<label>Inner Padding: <span id="bmEdPaddingLabel">10px</span></label>' +
                        '<input type="range" id="bmEdPadding" min="0" max="28" value="10" style="width:100%;accent-color:#667eea;">' +
                    '</div>' +
                '</div>' +
                '<div class="bm-editor-footer">' +
                    '<button class="bm-editor-cancel-btn" id="bmEdCancelBtn">Cancel</button>' +
                    '<button class="bm-editor-save-btn" id="bmEdSaveBtn">Save Group</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        let mdTarget = null;
        overlay.addEventListener('mousedown', (e) => {
            mdTarget = (e.target === overlay) ? overlay : null;
        });
        overlay.addEventListener('mouseup', (e) => {
            if (mdTarget === overlay && e.target === overlay) closeGroupEditor();
            mdTarget = null;
        });

        document.getElementById('bmEdCancelBtn').addEventListener('click', closeGroupEditor);
        document.getElementById('bmEdSaveBtn').addEventListener('click', saveGroupEditorData);

        document.getElementById('bmEdSlots').addEventListener('input', updateSlotsPreview);

        document.getElementById('bmEdSlotSize').addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-val]');
            if (!btn) return;
            document.querySelectorAll('#bmEdSlotSize button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });

        document.getElementById('bmEdBgOpacity').addEventListener('input', () => {
            document.getElementById('bmEdBgOpacityLabel').textContent =
                document.getElementById('bmEdBgOpacity').value + '%';
        });

        document.getElementById('bmEdBorderStyle').addEventListener('change', () => {
            const val = document.getElementById('bmEdBorderStyle').value;
            document.getElementById('bmEdBorderDetails').style.display = (val === 'none') ? 'none' : '';
        });

        document.getElementById('bmEdRadius').addEventListener('input', () => {
            document.getElementById('bmEdRadiusLabel').textContent =
                document.getElementById('bmEdRadius').value + 'px';
        });

        document.getElementById('bmEdPadding').addEventListener('input', () => {
            document.getElementById('bmEdPaddingLabel').textContent =
                document.getElementById('bmEdPadding').value + 'px';
        });
    }

    function openGroupEditor(groupId) {
        ensureGroupEditor();
        editingGroupId = groupId;

        const group = groupId ? config.groups.find(g => g.id === groupId) : null;
        const g = group || DEFAULT_GROUP();

        document.getElementById('bmEditorTitle').textContent = groupId ? 'Edit Group' : 'New Group';
        document.getElementById('bmEdName').value = g.name;
        document.getElementById('bmEdShowName').checked = g.showName !== false;
        document.getElementById('bmEdSlots').max = config.globalMaxSlots;
        document.getElementById('bmEdSlots').value = g.maxSlots;
        document.getElementById('bmEdShowNames').checked = g.showBookmarkNames !== false;

        document.querySelectorAll('#bmEdSlotSize button').forEach(b => {
            b.classList.toggle('active', b.dataset.val === (g.slotSize || 'medium'));
        });

        const bgParsed = parseRgba(g.background);
        document.getElementById('bmEdBgColor').value = rgbToHex(bgParsed.r, bgParsed.g, bgParsed.b);
        const opacityPct = Math.round(bgParsed.a * 100);
        document.getElementById('bmEdBgOpacity').value = opacityPct;
        document.getElementById('bmEdBgOpacityLabel').textContent = opacityPct + '%';

        const border = g.border || DEFAULT_BORDER();
        document.getElementById('bmEdBorderStyle').value = border.style || 'none';
        document.getElementById('bmEdBorderDetails').style.display = (border.style === 'none') ? 'none' : '';

        const bcParsed = parseRgba(border.color);
        document.getElementById('bmEdBorderColor').value = rgbToHex(bcParsed.r, bcParsed.g, bcParsed.b);
        document.getElementById('bmEdBorderWidth').value = border.width || 1;

        const radius = border.radius !== undefined ? border.radius : 12;
        document.getElementById('bmEdRadius').value = radius;
        document.getElementById('bmEdRadiusLabel').textContent = radius + 'px';

        const padding = g.padding !== undefined ? g.padding : 10;
        document.getElementById('bmEdPadding').value = padding;
        document.getElementById('bmEdPaddingLabel').textContent = padding + 'px';

        updateSlotsPreview();

        const overlay = document.getElementById('bmEditorOverlay');
        overlay.classList.remove('closing');
        overlay.classList.add('active');
        document.getElementById('bmEdName').focus();
    }

    function closeGroupEditor() {
        const overlay = document.getElementById('bmEditorOverlay');
        if (!overlay) return;
        overlay.classList.add('closing');
        overlay.classList.remove('active');
        setTimeout(() => overlay.classList.remove('closing'), 200);
    }

    function saveGroupEditorData() {
        const name = document.getElementById('bmEdName').value.trim() || 'Unnamed Group';
        const showName = document.getElementById('bmEdShowName').checked;
        const rawSlots = parseInt(document.getElementById('bmEdSlots').value, 10) || 4;
        const maxSlots = Math.max(1, Math.min(config.globalMaxSlots, rawSlots));

        const activeBtn = document.querySelector('#bmEdSlotSize button.active');
        const slotSize = activeBtn ? activeBtn.dataset.val : 'medium';
        const showBookmarkNames = document.getElementById('bmEdShowNames').checked;

        // Background
        const bgColor = document.getElementById('bmEdBgColor').value;
        const bgOpacity = (parseInt(document.getElementById('bmEdBgOpacity').value, 10) / 100).toFixed(2);
        const bgRgb = hexToRgb(bgColor);
        const background = 'rgba(' + bgRgb.r + ',' + bgRgb.g + ',' + bgRgb.b + ',' + bgOpacity + ')';

        // Border
        const borderStyle = document.getElementById('bmEdBorderStyle').value;
        const bcColor = document.getElementById('bmEdBorderColor').value;
        const bcRgb = hexToRgb(bcColor);
        const borderWidth = parseInt(document.getElementById('bmEdBorderWidth').value, 10) || 1;
        const borderRadius = parseInt(document.getElementById('bmEdRadius').value, 10);
        const padding = parseInt(document.getElementById('bmEdPadding').value, 10);

        const patch = {
            name, showName, maxSlots, slotSize, showBookmarkNames, background,
            border: {
                style: borderStyle,
                width: borderWidth,
                color: 'rgba(' + bcRgb.r + ',' + bcRgb.g + ',' + bcRgb.b + ',1)',
                radius: borderRadius
            },
            padding
        };

        if (editingGroupId) {
            updateGroup(editingGroupId, patch);
        } else {
            addGroup(patch);
        }

        closeGroupEditor();

        const mgmt = document.getElementById('bmMgmtOverlay');
        if (mgmt && mgmt.classList.contains('active')) refreshGroupMgmtList();
    }

    function updateSlotsPreview() {
        const preview = document.getElementById('bmEdSlotsPreview');
        if (!preview) return;
        const total = config.globalMaxSlots;
        const active = parseInt(document.getElementById('bmEdSlots').value, 10) || 4;
        preview.innerHTML = '';
        for (let i = 0; i < total; i++) {
            const cell = document.createElement('div');
            cell.className = 'bm-slots-preview-cell' + (i < active ? ' active' : '');
            preview.appendChild(cell);
        }
    }

    // ── Color utilities ────────────────────────────────────────
    function parseRgba(str) {
        if (!str) return { r: 255, g: 255, b: 255, a: 0.08 };
        const m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
        if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
        const rgb = hexToRgb(str);
        return Object.assign({}, rgb, { a: 1 });
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
            : { r: 255, g: 255, b: 255 };
    }

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b]
            .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
            .join('');
    }

    // ── Mode switching ─────────────────────────────────────────
    function setAdvancedMode(enabled) {
        config.enabled = enabled;
        saveConfig();
        applyMode();
    }

    function setEditMode(enabled) {
        editMode = enabled;
        const container = document.getElementById('advancedBookmarksContainer');
        const manageBtn = document.getElementById('manageGroupsBtn');
        const editToggleBtn = document.getElementById('bmEditToggleBtn');
        if (container) container.classList.toggle('bm-edit-mode', enabled);
        if (manageBtn) manageBtn.classList.toggle('visible', enabled);
        if (editToggleBtn) editToggleBtn.classList.toggle('active', enabled);
    }

    function applyMode() {
        const basicGrid = document.getElementById('bookmarksGrid');
        const advContainer = document.getElementById('advancedBookmarksContainer');
        const addBtn = document.getElementById('addBookmarkBtn');
        const manageBtn = document.getElementById('manageGroupsBtn');
        const editToggleBtn = document.getElementById('bmEditToggleBtn');
        if (!basicGrid || !advContainer) return;

        if (config.enabled) {
            basicGrid.style.display = 'none';
            advContainer.style.display = '';
            if (addBtn) addBtn.style.display = 'none';
            if (editToggleBtn) editToggleBtn.style.display = '';
            // manageBtn and add slots controlled by setEditMode
            setEditMode(editMode);
            renderAdvancedBookmarks();
        } else {
            basicGrid.style.display = '';
            advContainer.style.display = 'none';
            if (addBtn) addBtn.style.display = '';
            if (manageBtn) manageBtn.classList.remove('visible');
            if (editToggleBtn) editToggleBtn.style.display = 'none';
            editMode = false;
        }
    }

    // ── ESC key integration ────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;

        const bmModal = document.getElementById('advancedBookmarkModal');
        if (bmModal && bmModal.classList.contains('active')) {
            closeAdvancedBookmarkModal();
            return;
        }

        const edOverlay = document.getElementById('bmEditorOverlay');
        if (edOverlay && edOverlay.classList.contains('active')) {
            closeGroupEditor();
            return;
        }

        const mgmtOverlay = document.getElementById('bmMgmtOverlay');
        if (mgmtOverlay && mgmtOverlay.classList.contains('active')) {
            closeGroupMgmtPanel();
        }
    });

    // ── Public API ─────────────────────────────────────────────
    window.advancedBookmarks = {
        init() {
            loadConfig();
            const editToggleBtn = document.getElementById('bmEditToggleBtn');
            if (editToggleBtn) {
                editToggleBtn.addEventListener('click', () => setEditMode(!editMode));
            }
            applyMode();
        },
        setMode: setAdvancedMode,
        setEditMode(enabled) { setEditMode(enabled); },
        isEnabled() { return !!(config && config.enabled); },
        hasNoGroups() { return !config || !Array.isArray(config.groups) || config.groups.length === 0; },
        openGroupManager: openGroupMgmtPanel,
        migrate: migrateBasicToAdvanced,
        render: renderAdvancedBookmarks
    };

    // Auto-init when script loads (app.js globals are available since it loaded first)
    window.advancedBookmarks.init();

})();
