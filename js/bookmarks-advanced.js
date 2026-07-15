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
    const DRAG_THRESHOLD = 6; // px movement before drag is committed

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
        iconOverride: { enabled: false, bgColor: '#667eea', letter: '', letterColor: '#ffffff' },
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
    let dragState = null;  // active drag context; null when idle

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
                        if (!g.iconOverride) g.iconOverride = { enabled: false, bgColor: '#667eea', letter: '', letterColor: '#ffffff' };
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

        // Attach drag listeners once after all groups are rendered
        initDrag(container);
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
            body.appendChild(createBookmarkSlot(bm, group.id, showFavicons, bmIdx, group.iconOverride));
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

    // Priority: individual bookmark override > group override > null (auto)
    function resolveIconStyle(bm, groupIconOverride) {
        if (bm.iconOverride && bm.iconOverride.enabled) return bm.iconOverride;
        if (groupIconOverride && groupIconOverride.enabled) return groupIconOverride;
        return null;
    }

    function createBookmarkSlot(bm, groupId, showFavicons, bmIdx, iconOverride) {
        const slot = document.createElement('a');
        slot.className = 'bm-slot';
        slot.href = safeUrl(bm.url);
        slot.style.animationDelay = (0.05 + 0.03 * bmIdx) + 's';
        slot.title = bm.title;

        const iconEl = document.createElement('span');
        iconEl.className = 'bm-slot-icon';

        const resolved = resolveIconStyle(bm, iconOverride);
        if (showFavicons) {
            const img = document.createElement('img');
            img.src = safeFaviconUrl(bm.url);
            img.alt = bm.title;
            img.onerror = function () {
                if (resolved) {
                    this.parentElement.textContent = resolved.letter || bm.iconLetter || '?';
                    this.parentElement.style.background = resolved.bgColor;
                    if (resolved.letterColor) this.parentElement.style.color = resolved.letterColor;
                } else {
                    this.parentElement.textContent = bm.iconLetter || '?';
                    this.parentElement.style.background = 'hsl(' + (bm.iconHue || 200) + ',60%,42%)';
                }
            };
            iconEl.appendChild(img);
        } else if (resolved) {
            iconEl.style.background = resolved.bgColor;
            iconEl.textContent = resolved.letter || bm.iconLetter || '?';
            iconEl.style.color = resolved.letterColor || '';
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

        slot.dataset.bookmarkId = bm.id;
        slot.dataset.groupId = groupId;

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
                '<hr style="border:none;border-top:1px solid #f0f0f0;margin:4px 0 14px">' +
                '<div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#aaa;margin-bottom:12px">Icon Override</div>' +
                '<div class="form-group" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
                    '<label for="advBmIconOverride" style="margin-bottom:0">Custom Icon</label>' +
                    '<label class="toggle-switch">' +
                        '<input type="checkbox" id="advBmIconOverride">' +
                        '<span class="toggle-slider"></span>' +
                    '</label>' +
                '</div>' +
                '<div id="advBmIconOverrideDetails" style="display:none">' +
                    '<div class="form-group">' +
                        '<label>Icon Background</label>' +
                        '<div class="bm-color-row">' +
                            '<input type="color" id="advBmIconBgColor" value="#667eea">' +
                        '</div>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label for="advBmIconLetter">Character <span style="font-weight:400;color:#bbb">(empty = auto from URL)</span></label>' +
                        '<input type="text" id="advBmIconLetter" maxlength="8" placeholder="auto" style="width:80px">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>Character Color</label>' +
                        '<div class="bm-color-row">' +
                            '<input type="color" id="advBmIconLetterColor" value="#ffffff">' +
                        '</div>' +
                    '</div>' +
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

        document.getElementById('advBmIconOverride').addEventListener('change', () => {
            const enabled = document.getElementById('advBmIconOverride').checked;
            document.getElementById('advBmIconOverrideDetails').style.display = enabled ? '' : 'none';
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

            const io = bm.iconOverride || { enabled: false, bgColor: '#667eea', letter: '', letterColor: '#ffffff' };
            document.getElementById('advBmIconOverride').checked = io.enabled;
            document.getElementById('advBmIconOverrideDetails').style.display = io.enabled ? '' : 'none';
            const ioBgParsed = parseRgba(io.bgColor || '#667eea');
            document.getElementById('advBmIconBgColor').value = rgbToHex(ioBgParsed.r, ioBgParsed.g, ioBgParsed.b);
            document.getElementById('advBmIconLetter').value = io.letter || '';
            const ioLetterParsed = parseRgba(io.letterColor || '#ffffff');
            document.getElementById('advBmIconLetterColor').value = rgbToHex(ioLetterParsed.r, ioLetterParsed.g, ioLetterParsed.b);
        } else {
            titleEl.textContent = 'Add Bookmark';
            titleInput.value = '';
            urlInput.value = '';
            deleteBtn.style.display = 'none';
            moveRow.classList.remove('visible');

            document.getElementById('advBmIconOverride').checked = false;
            document.getElementById('advBmIconOverrideDetails').style.display = 'none';
            document.getElementById('advBmIconBgColor').value = '#667eea';
            document.getElementById('advBmIconLetter').value = '';
            document.getElementById('advBmIconLetterColor').value = '#ffffff';
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

        const iconOverride = {
            enabled: document.getElementById('advBmIconOverride').checked,
            bgColor: document.getElementById('advBmIconBgColor').value,
            letter: document.getElementById('advBmIconLetter').value.trim(),
            letterColor: document.getElementById('advBmIconLetterColor').value
        };

        if (bookmarkId) {
            const moveRow = document.getElementById('bmGroupMoveRow');
            const moveSelect = document.getElementById('advBmMoveGroup');
            const targetGroupId = (moveRow && moveRow.classList.contains('visible') && moveSelect)
                ? moveSelect.value
                : groupId;

            updateBookmarkInGroup(groupId, bookmarkId, { title, url: sanitized, iconHue, iconLetter, iconOverride });
            if (targetGroupId !== groupId) {
                moveBookmark(groupId, targetGroupId, bookmarkId);
            }
        } else {
            addBookmarkToGroup(groupId, { title, url: sanitized, iconHue, iconLetter, iconOverride });
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

                    '<hr class="bm-editor-divider">' +
                    '<div class="bm-editor-section-label">Icon Style Override</div>' +
                    '<div class="bm-editor-toggle-row">' +
                        '<label>Override Icon Style</label>' +
                        '<label class="toggle-switch">' +
                            '<input type="checkbox" id="bmEdIconOverride">' +
                            '<span class="toggle-slider"></span>' +
                        '</label>' +
                    '</div>' +
                    '<div id="bmEdIconOverrideDetails" style="display:none">' +
                        '<div class="bm-editor-row">' +
                            '<label>Icon Background</label>' +
                            '<div class="bm-color-row">' +
                                '<input type="color" id="bmEdIconBgColor" value="#667eea">' +
                            '</div>' +
                        '</div>' +
                        '<div class="bm-editor-row">' +
                            '<label for="bmEdIconLetter">Character <span style="font-weight:400;color:#bbb">(empty = auto from URL)</span></label>' +
                            '<input type="text" id="bmEdIconLetter" maxlength="8" placeholder="auto" style="width:80px">' +
                        '</div>' +
                        '<div class="bm-editor-row">' +
                            '<label>Character Color</label>' +
                            '<div class="bm-color-row">' +
                                '<input type="color" id="bmEdIconLetterColor" value="#ffffff">' +
                            '</div>' +
                        '</div>' +
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

        document.getElementById('bmEdIconOverride').addEventListener('change', () => {
            const enabled = document.getElementById('bmEdIconOverride').checked;
            document.getElementById('bmEdIconOverrideDetails').style.display = enabled ? '' : 'none';
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

        const io = g.iconOverride || { enabled: false, bgColor: '#667eea', letter: '', letterColor: '#ffffff' };
        document.getElementById('bmEdIconOverride').checked = io.enabled;
        document.getElementById('bmEdIconOverrideDetails').style.display = io.enabled ? '' : 'none';
        const ioBgParsed = parseRgba(io.bgColor || '#667eea');
        document.getElementById('bmEdIconBgColor').value = rgbToHex(ioBgParsed.r, ioBgParsed.g, ioBgParsed.b);
        document.getElementById('bmEdIconLetter').value = io.letter || '';
        const ioLetterParsed = parseRgba(io.letterColor || '#ffffff');
        document.getElementById('bmEdIconLetterColor').value = rgbToHex(ioLetterParsed.r, ioLetterParsed.g, ioLetterParsed.b);

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

        const iconOverrideEnabled = document.getElementById('bmEdIconOverride').checked;
        const iconBgColor = document.getElementById('bmEdIconBgColor').value;
        const iconLetter = document.getElementById('bmEdIconLetter').value.trim();
        const iconLetterColor = document.getElementById('bmEdIconLetterColor').value;

        const patch = {
            name, showName, maxSlots, slotSize, showBookmarkNames, background,
            border: {
                style: borderStyle,
                width: borderWidth,
                color: 'rgba(' + bcRgb.r + ',' + bcRgb.g + ',' + bcRgb.b + ',1)',
                radius: borderRadius
            },
            padding,
            iconOverride: {
                enabled: iconOverrideEnabled,
                bgColor: iconBgColor,
                letter: iconLetter,
                letterColor: iconLetterColor
            }
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

    // ── Bookmark Drag & Drop ──────────────────────────────────────
    // iPhone-style: picked-up slot becomes a floating ghost;
    // remaining slots shift live to reveal the insert point.

    function initDrag(container) {
        // Guard: only attach once per container instance (innerHTML wipe creates a fresh node)
        if (container.dataset.dragReady === '1') return;
        container.dataset.dragReady = '1';
        container.addEventListener('pointerdown', onSlotPointerDown);
        // Prevent the browser's native HTML5 link-drag from hijacking pointer events
        // on <a> slot elements while in edit mode.
        container.addEventListener('dragstart', (e) => {
            if (editMode) e.preventDefault();
        });
    }

    function onSlotPointerDown(e) {
        if (!editMode) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        const slot = e.target.closest('.bm-slot');
        if (!slot) return;
        // Don't hijack clicks on the edit pencil button
        if (e.target.closest('.bm-slot-edit-btn')) return;

        const bookmarkId = slot.dataset.bookmarkId;
        if (!bookmarkId) return;

        const groupId = slot.dataset.groupId;
        if (!groupId) return;

        dragState = {
            bookmarkId,
            fromGroupId: groupId,
            sourceEl: slot,
            ghostEl: null,
            placeholderEl: null,
            startX: e.clientX,
            startY: e.clientY,
            offsetX: 0,
            offsetY: 0,
            lastGroupId: null,
            lastInsertIndex: -1,
            started: false,
            pointerId: e.pointerId
        };

        // Use set/releasePointerCapture so pointermove fires everywhere
        try { slot.setPointerCapture(e.pointerId); } catch {}

        document.addEventListener('pointermove', onDragMove, { passive: false });
        document.addEventListener('pointerup',   onDragEnd);
        document.addEventListener('pointercancel', onDragCancel);
    }

    function onDragMove(e) {
        if (!dragState) return;

        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;

        if (!dragState.started) {
            if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
            startActualDrag(e);
        }

        // Move ghost
        dragState.ghostEl.style.left = (e.clientX - dragState.offsetX) + 'px';
        dragState.ghostEl.style.top  = (e.clientY - dragState.offsetY) + 'px';

        e.preventDefault(); // suppress scroll while dragging

        // Update drop preview
        const target = getDropTarget(e.clientX, e.clientY);
        if (target &&
            (target.groupId !== dragState.lastGroupId ||
             target.insertIndex !== dragState.lastInsertIndex)) {
            movePlaceholderAnimated(target.groupId, target.insertIndex);
            dragState.lastGroupId    = target.groupId;
            dragState.lastInsertIndex = target.insertIndex;
        }
    }

    function startActualDrag(e) {
        dragState.started = true;
        const slot = dragState.sourceEl;
        const rect = slot.getBoundingClientRect();

        dragState.offsetX = e.clientX - rect.left;
        dragState.offsetY = e.clientY - rect.top;

        // ── Ghost (floating clone) ─────────────────────────────
        const ghost = slot.cloneNode(true);
        ghost.className = 'bm-slot bm-drag-ghost';
        // Carry slot-size styles from the group
        const groupEl = slot.closest('.bm-group');
        if (groupEl) {
            if (groupEl.classList.contains('bm-slot-small')) ghost.classList.add('bm-drag-ghost-small');
            if (groupEl.classList.contains('bm-slot-large')) ghost.classList.add('bm-drag-ghost-large');
        }
        ghost.style.cssText = [
            'position:fixed',
            'width:'  + rect.width  + 'px',
            'height:' + rect.height + 'px',
            'left:'   + rect.left   + 'px',
            'top:'    + rect.top    + 'px',
            'z-index:9000',
            'pointer-events:none',
            'opacity:0.92',
            'transform:scale(1.07) translateZ(0)',
            'box-shadow:0 12px 32px rgba(0,0,0,0.45)',
            'transition:box-shadow 0.1s ease',
            'will-change:left,top'
        ].join(';');
        document.body.appendChild(ghost);
        dragState.ghostEl = ghost;

        // ── Placeholder (invisible gap in grid) ────────────────
        const placeholder = document.createElement('div');
        placeholder.className = 'bm-drag-placeholder';
        dragState.placeholderEl = placeholder;

        // Replace source slot with placeholder (maintains its original position)
        slot.parentNode.insertBefore(placeholder, slot);
        slot.remove();

        // Record initial state so duplicate-move check works
        dragState.lastGroupId = dragState.fromGroupId;
        const body = placeholder.parentNode;
        const realSlots = getRealSlots(body);
        dragState.lastInsertIndex = realSlots.indexOf(placeholder); // placeholder is in this list
    }

    // Returns all non-add, non-placeholder slots in a group body
    function getRealSlots(body) {
        return Array.from(body.children).filter(c =>
            c.classList.contains('bm-slot') ||
            c.classList.contains('bm-drag-placeholder')
        );
    }

    function getDropTarget(x, y) {
        const container = document.getElementById('advancedBookmarksContainer');
        if (!container) return null;

        const groupEls = Array.from(container.querySelectorAll('.bm-group'));

        // Find group that contains the cursor, else the nearest one
        let targetGroupEl = null;
        let minDist = Infinity;
        for (const g of groupEls) {
            const r = g.getBoundingClientRect();
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
                targetGroupEl = g;
                minDist = 0;
                break;
            }
            const cx = Math.max(r.left, Math.min(x, r.right));
            const cy = Math.max(r.top,  Math.min(y, r.bottom));
            const d  = (x - cx) ** 2 + (y - cy) ** 2;
            if (d < minDist) { minDist = d; targetGroupEl = g; }
        }
        if (!targetGroupEl) return null;

        const groupId = targetGroupEl.dataset.groupId;
        const body = targetGroupEl.querySelector('.bm-group-body');

        // Real bookmark slots only (not the add-btn or the placeholder itself)
        const bookmarkSlots = Array.from(body.children).filter(c =>
            c.classList.contains('bm-slot')
        );

        if (!bookmarkSlots.length) return { groupId, insertIndex: 0 };

        // Find nearest slot by Euclidean distance to centre
        let nearestIdx = 0;
        let nearestRect = null;
        let nearestDist = Infinity;
        for (let i = 0; i < bookmarkSlots.length; i++) {
            const r  = bookmarkSlots[i].getBoundingClientRect();
            const cx = r.left + r.width  / 2;
            const cy = r.top  + r.height / 2;
            const d  = (x - cx) ** 2 + (y - cy) ** 2;
            if (d < nearestDist) { nearestDist = d; nearestIdx = i; nearestRect = r; }
        }

        // Left half → insert before; right half → insert after
        const midX = nearestRect.left + nearestRect.width / 2;
        const insertIndex = (x <= midX) ? nearestIdx : nearestIdx + 1;

        return { groupId, insertIndex };
    }

    function movePlaceholderAnimated(targetGroupId, insertIndex) {
        // FLIP technique – animate slots smoothly when the placeholder moves.
        const container = document.getElementById('advancedBookmarksContainer');
        if (!container) { movePlaceholder(targetGroupId, insertIndex); return; }

        // First: snapshot every slot's current screen position
        const slotEls = Array.from(container.querySelectorAll('.bm-slot'));
        const firstRects = new Map();
        slotEls.forEach(s => firstRects.set(s, s.getBoundingClientRect()));

        // Last: actually move the placeholder (triggers grid reflow)
        movePlaceholder(targetGroupId, insertIndex);

        // Invert + Play
        slotEls.forEach(s => {
            const f = firstRects.get(s);
            if (!f) return;
            const l = s.getBoundingClientRect();
            const dx = f.left - l.left;
            const dy = f.top  - l.top;
            if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return; // didn't move

            // Snap to old position with no transition
            s.style.transition = 'none';
            s.style.transform  = 'translate(' + dx + 'px,' + dy + 'px)';

            // Force sync reflow so the browser sees the snapped state before animating
            // eslint-disable-next-line no-unused-expressions
            s.getBoundingClientRect();

            // Animate back to natural grid position
            s.style.transition = 'transform 140ms ease-out';
            s.style.transform  = '';
        });
    }

    function movePlaceholder(targetGroupId, insertIndex) {
        const placeholder = dragState.placeholderEl;
        if (!placeholder) return;

        const targetGroupEl = document.querySelector(
            '.bm-group[data-group-id="' + targetGroupId + '"]'
        );
        if (!targetGroupEl) return;
        const targetBody = targetGroupEl.querySelector('.bm-group-body');

        // Remove from current position, get fresh slot list for that body
        placeholder.remove();
        const bookmarkSlots = Array.from(targetBody.children).filter(c =>
            c.classList.contains('bm-slot')
        );

        const addSlot = targetBody.querySelector('.bm-slot-add');
        const clamped = Math.max(0, Math.min(insertIndex, bookmarkSlots.length));

        if (clamped >= bookmarkSlots.length) {
            targetBody.insertBefore(placeholder, addSlot || null);
        } else {
            targetBody.insertBefore(placeholder, bookmarkSlots[clamped]);
        }
    }

    function onDragEnd(e) {
        document.removeEventListener('pointermove',   onDragMove);
        document.removeEventListener('pointerup',     onDragEnd);
        document.removeEventListener('pointercancel', onDragCancel);

        if (!dragState) return;

        if (!dragState.started) {
            // Threshold not crossed — treat as plain click, restore state
            dragState = null;
            return;
        }

        const { bookmarkId, fromGroupId, lastGroupId, lastInsertIndex } = dragState;

        dragState.ghostEl.remove();
        dragState.placeholderEl.remove();
        dragState = null;

        if (lastGroupId !== null && lastInsertIndex >= 0) {
            commitDragMove(bookmarkId, fromGroupId, lastGroupId, lastInsertIndex);
        } else {
            renderAdvancedBookmarks();
        }
    }

    function onDragCancel() {
        document.removeEventListener('pointermove',   onDragMove);
        document.removeEventListener('pointerup',     onDragEnd);
        document.removeEventListener('pointercancel', onDragCancel);

        if (dragState) {
            if (dragState.ghostEl)       dragState.ghostEl.remove();
            if (dragState.placeholderEl) dragState.placeholderEl.remove();
            dragState = null;
        }
        renderAdvancedBookmarks();
    }

    function commitDragMove(bookmarkId, fromGroupId, toGroupId, insertIndex) {
        const fromGroup = config.groups.find(g => g.id === fromGroupId);
        if (!fromGroup) { renderAdvancedBookmarks(); return; }

        const bmIdx = fromGroup.bookmarks.findIndex(b => b.id === bookmarkId);
        if (bmIdx < 0) { renderAdvancedBookmarks(); return; }

        const [bm] = fromGroup.bookmarks.splice(bmIdx, 1);

        if (fromGroupId === toGroupId) {
            // insertIndex is relative to the (n-1) remaining items after splice
            const clamped = Math.max(0, Math.min(insertIndex, fromGroup.bookmarks.length));
            fromGroup.bookmarks.splice(clamped, 0, bm);
        } else {
            const toGroup = config.groups.find(g => g.id === toGroupId);
            if (!toGroup) {
                fromGroup.bookmarks.splice(bmIdx, 0, bm); // restore
                renderAdvancedBookmarks();
                return;
            }
            const clamped = Math.max(0, Math.min(insertIndex, toGroup.bookmarks.length));
            toGroup.bookmarks.splice(clamped, 0, bm);
        }

        saveConfig();
        renderAdvancedBookmarks();
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
