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
    const quakeSound = window.bookmarksQuakeSound;
    const quakeConfig = (quakeSound && quakeSound.constants) || {};
    const hoverAnimation = window.bookmarksHoverAnimation;

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

    function createDefaultBorder() {
        return DEFAULT_BORDER();
    }

    function createDefaultGroup() {
        return DEFAULT_GROUP();
    }

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
    const quakeStates = new Map(); // key: .bm-slot-icon element
    let quakeRafId = 0;
    let corrosionFilterReady = false;

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

    function setActiveModalContext(context) {
        activeModalContext = context;
    }

    function getActiveModalContext() {
        return activeModalContext;
    }

    function setEditingGroupId(groupId) {
        editingGroupId = groupId;
    }

    function getEditingGroupId() {
        return editingGroupId;
    }

    const modalsApi = {
        getConfig: () => config,
        saveConfig,
        renderAdvancedBookmarks,
        setActiveModalContext,
        getActiveModalContext,
        setEditingGroupId,
        getEditingGroupId,
        addBookmarkToGroup,
        updateBookmarkInGroup,
        deleteBookmarkFromGroup,
        moveBookmark,
        addGroup,
        updateGroup,
        deleteGroup,
        reorderGroups,
        createDefaultGroup,
        createDefaultBorder,
        safeUrl,
        computeIconData,
        toast,
        escapeHtml,
        parseRgba,
        rgbToHex,
        hexToRgb,
        getConfig: () => config
    };

    const modalsController = window.bookmarksModals && window.bookmarksModals.createController
        ? window.bookmarksModals.createController(modalsApi)
        : null;

    function ensureBookmarkModal() {
        if (modalsController && typeof modalsController.ensureBookmarkModal === 'function') {
            modalsController.ensureBookmarkModal();
        }
    }

    function openAdvancedBookmarkModal(groupId, bookmarkId) {
        if (modalsController && typeof modalsController.openAdvancedBookmarkModal === 'function') {
            modalsController.openAdvancedBookmarkModal(groupId, bookmarkId);
        }
    }

    function closeAdvancedBookmarkModal() {
        if (modalsController && typeof modalsController.closeAdvancedBookmarkModal === 'function') {
            modalsController.closeAdvancedBookmarkModal();
        }
    }

    function saveAdvancedBookmark() {
        if (modalsController && typeof modalsController.saveAdvancedBookmark === 'function') {
            modalsController.saveAdvancedBookmark();
        }
    }

    function deleteAdvancedBookmark() {
        if (modalsController && typeof modalsController.deleteAdvancedBookmark === 'function') {
            modalsController.deleteAdvancedBookmark();
        }
    }

    function ensureGroupMgmtPanel() {
        if (modalsController && typeof modalsController.ensureGroupMgmtPanel === 'function') {
            modalsController.ensureGroupMgmtPanel();
        }
    }

    function openGroupMgmtPanel() {
        if (modalsController && typeof modalsController.openGroupMgmtPanel === 'function') {
            modalsController.openGroupMgmtPanel();
        }
    }

    function closeGroupMgmtPanel() {
        if (modalsController && typeof modalsController.closeGroupMgmtPanel === 'function') {
            modalsController.closeGroupMgmtPanel();
        }
    }

    function refreshGroupMgmtList() {
        if (modalsController && typeof modalsController.refreshGroupMgmtList === 'function') {
            modalsController.refreshGroupMgmtList();
        }
    }

    function createGroupMgmtRow(group) {
        if (modalsController && typeof modalsController.createGroupMgmtRow === 'function') {
            return modalsController.createGroupMgmtRow(group);
        }
        return null;
    }

    function confirmDeleteGroup(id, name) {
        if (modalsController && typeof modalsController.confirmDeleteGroup === 'function') {
            modalsController.confirmDeleteGroup(id, name);
        }
    }

    function initDragReorder(listEl) {
        if (modalsController && typeof modalsController.initDragReorder === 'function') {
            modalsController.initDragReorder(listEl);
        }
    }

    function ensureGroupEditor() {
        if (modalsController && typeof modalsController.ensureGroupEditor === 'function') {
            modalsController.ensureGroupEditor();
        }
    }

    function openGroupEditor(groupId) {
        if (modalsController && typeof modalsController.openGroupEditor === 'function') {
            modalsController.openGroupEditor(groupId);
        }
    }

    function closeGroupEditor() {
        if (modalsController && typeof modalsController.closeGroupEditor === 'function') {
            modalsController.closeGroupEditor();
        }
    }

    function saveGroupEditorData() {
        if (modalsController && typeof modalsController.saveGroupEditorData === 'function') {
            modalsController.saveGroupEditorData();
        }
    }

    function updateSlotsPreview() {
        if (modalsController && typeof modalsController.updateSlotsPreview === 'function') {
            modalsController.updateSlotsPreview();
        }
    }

    // ── Rendering ─────────────────────────────────────────────
    function renderAdvancedBookmarks() {
        const container = document.getElementById('advancedBookmarksContainer');
        if (!container) return;

        clearAllSlotQuakes();
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
                    this.parentElement.style.background = resolved.bgColor != null ? resolved.bgColor : 'hsl(' + (bm.iconHue || 200) + ',60%,42%)';
                    if (resolved.letterColor != null) this.parentElement.style.color = resolved.letterColor;
                } else {
                    this.parentElement.textContent = bm.iconLetter || '?';
                    this.parentElement.style.background = 'hsl(' + (bm.iconHue || 200) + ',60%,42%)';
                }
            };
            iconEl.appendChild(img);
        } else if (resolved) {
            iconEl.style.background = resolved.bgColor != null ? resolved.bgColor : 'hsl(' + (bm.iconHue || 200) + ',60%,42%)';
            iconEl.textContent = resolved.letter || bm.iconLetter || '?';
            if (resolved.letterColor != null) iconEl.style.color = resolved.letterColor;
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
        container.addEventListener('mouseover', onSlotHoverStart);
        container.addEventListener('mouseout', onSlotHoverEnd);
        // Prevent the browser's native HTML5 link-drag from hijacking pointer events
        // on <a> slot elements while in edit mode.
        container.addEventListener('dragstart', (e) => {
            if (editMode) e.preventDefault();
        });
    }

    function onSlotHoverStart(e) {
        const slot = e.target.closest('.bm-slot');
        if (!slot) return;
        if (e.relatedTarget && slot.contains(e.relatedTarget)) return;
        startSlotQuake(slot);
    }

    function onSlotHoverEnd(e) {
        const slot = e.target.closest('.bm-slot');
        if (!slot) return;
        if (e.relatedTarget && slot.contains(e.relatedTarget)) return;

        const icon = slot.querySelector('.bm-slot-icon');
        const state = icon ? (hoverAnimation && typeof hoverAnimation.getQuakeState === 'function' ? hoverAnimation.getQuakeState(icon) : null) : null;
        const explodedGone = !!icon && (icon.classList.contains('bm-quake-gone') || (state && state.gone));
        if (hoverAnimation && typeof hoverAnimation.stopSlotQuake === 'function') {
            hoverAnimation.stopSlotQuake(slot);
        }
        if (explodedGone) {
            const section = slot.closest('.bookmarks-section');
            if (hoverAnimation && typeof hoverAnimation.spawnBookmarksSectionGlitch === 'function') {
                hoverAnimation.spawnBookmarksSectionGlitch(icon, state ? state.seed : Math.random() * 10000);
                hoverAnimation.spawnBookmarksSectionGlitch(section, state ? state.seed : Math.random() * 10000);
            }
        }
    }

    function startSlotQuake(slot) {
        if (hoverAnimation && typeof hoverAnimation.startSlotQuake === 'function') {
            hoverAnimation.startSlotQuake(slot);
        }
    }

    function stopSlotQuake(slot) {
        if (hoverAnimation && typeof hoverAnimation.stopSlotQuake === 'function') {
            hoverAnimation.stopSlotQuake(slot);
        }
    }

    function clearAllSlotQuakes() {
        if (hoverAnimation && typeof hoverAnimation.clearAllSlotQuakes === 'function') {
            hoverAnimation.clearAllSlotQuakes();
        }
    }

    function resetIconQuakeStyle(icon) {
        if (hoverAnimation && typeof hoverAnimation.resetIconQuakeStyle === 'function') {
            hoverAnimation.resetIconQuakeStyle(icon);
        }
    }

    function ensureCorrosionFilter() {
        if (hoverAnimation && typeof hoverAnimation.ensureCorrosionFilter === 'function') {
            hoverAnimation.ensureCorrosionFilter();
        }
    }

    function initAudioUnlockHooks() {
        if (quakeSound && typeof quakeSound.initAudioUnlockHooks === 'function') {
            quakeSound.initAudioUnlockHooks();
        }
    }

    function ensureQuakeAudioContext() {
        if (quakeSound && typeof quakeSound.ensureQuakeAudioContext === 'function') {
            return quakeSound.ensureQuakeAudioContext();
        }
        return null;
    }

    function createQuakeSynth(seed) {
        if (quakeSound && typeof quakeSound.createQuakeSynth === 'function') {
            return quakeSound.createQuakeSynth(seed);
        }
        return null;
    }

    function setSynthBuildFrame(synth, buildProgress) {
        if (quakeSound && typeof quakeSound.setSynthBuildFrame === 'function') {
            quakeSound.setSynthBuildFrame(synth, buildProgress);
        }
    }

    function releaseQuakeSynth(synth, explode) {
        if (quakeSound && typeof quakeSound.releaseQuakeSynth === 'function') {
            quakeSound.releaseQuakeSynth(synth, { explode: explode !== false });
        }
    }

    function ensureQuakeLoop() {
        if (quakeRafId) return;
        quakeRafId = requestAnimationFrame(runQuakeFrame);
    }

    function smoothStep(value) {
        const clampValue = (quakeSound && typeof quakeSound.clamp01 === 'function')
            ? quakeSound.clamp01(value)
            : Math.max(0, Math.min(1, value));
        return clampValue * clampValue * (3 - 2 * clampValue);
    }

    function lerp(from, to, amount) {
        return from + ((to - from) * amount);
    }

    function runQuakeFrame(now) {
        if (!quakeStates.size) {
            quakeRafId = 0;
            return;
        }

        quakeStates.forEach((state, icon) => {
            if (!icon.isConnected || !state.slot.matches(':hover')) {
                if (state.synth) {
                    releaseQuakeSynth(state.synth, false);
                    state.synth = null;
                }
                quakeStates.delete(icon);
                resetIconQuakeStyle(icon);
                return;
            }

            const elapsed = now - state.startMs;

            if (elapsed < (quakeConfig.holdMs || 5000)) {
                icon.style.transform = '';
                icon.style.filter = '';
                icon.style.opacity = '';
                icon.style.boxShadow = '';
                return;
            }

            const tremorElapsed = elapsed - (quakeConfig.holdMs || 5000);
            if (tremorElapsed < (quakeConfig.buildMs || 40000)) {
                if (!state.synth) {
                    state.synth = createQuakeSynth(state.seed);
                }
                if (state.synth) {
                    setSynthBuildFrame(state.synth, tremorElapsed / (quakeConfig.buildMs || 40000));
                }
                applyQuakeBuild(icon, tremorElapsed, state.seed);
                return;
            }

            const explodeElapsed = tremorElapsed - (quakeConfig.buildMs || 40000);
            if (explodeElapsed < (quakeConfig.explodeMs || 400)) {
                if (!state.rippleTriggered) {
                    state.rippleTriggered = true;
                    spawnExplosionRipple(icon, state.seed);
                    if (state.synth) {
                        releaseQuakeSynth(state.synth, true);
                        state.synth = null;
                    }
                }
                applyQuakeExplosion(icon, explodeElapsed, state.seed);
                return;
            }

            if (!state.gone) {
                state.gone = true;
                icon.classList.add('bm-quake-gone');
                icon.style.transform = 'translate3d(0,0,0) rotate(0deg) scale(0.01)';
                icon.style.filter = 'saturate(2.1) contrast(1.5) brightness(1.35) blur(4px)';
                icon.style.opacity = '0';
                icon.style.boxShadow = 'none';
            }
        });

        if (!quakeStates.size) {
            quakeRafId = 0;
            return;
        }

        quakeRafId = requestAnimationFrame(runQuakeFrame);
    }

    function spawnExplosionRipple(icon, seed) {
        if (hoverAnimation && typeof hoverAnimation.spawnExplosionRipple === 'function') {
            hoverAnimation.spawnExplosionRipple(icon, seed);
            return;
        }

        const rect = icon.getBoundingClientRect();
        const cx = rect.left + (rect.width / 2);
        const cy = rect.top + (rect.height / 2);

        const ripple = document.createElement('div');
        ripple.className = 'bm-explosion-ripple';
        ripple.style.left = cx.toFixed(2) + 'px';
        ripple.style.top = cy.toFixed(2) + 'px';
        ripple.style.setProperty('--bm-ripple-hue', String(Math.floor((seed % 80) + 180)));
        ripple.style.setProperty('--bm-ripple-size', Math.max(180, Math.min(window.innerWidth, window.innerHeight) * 0.55).toFixed(2) + 'px');

        document.body.appendChild(ripple);

        const remove = () => {
            if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
        };

        ripple.addEventListener('animationend', remove, { once: true });
        setTimeout(remove, 2800);
    }

    function spawnBookmarksSectionGlitch(sectionEl, seed) {
        if (hoverAnimation && typeof hoverAnimation.spawnBookmarksSectionGlitch === 'function') {
            hoverAnimation.spawnBookmarksSectionGlitch(sectionEl, seed);
            return;
        }

        if (!sectionEl || !sectionEl.isConnected) return;
        const sectionRect = sectionEl.getBoundingClientRect();
        if (sectionRect.width < 2 || sectionRect.height < 2) return;

        const layer = document.createElement('div');
        layer.className = 'bm-explosion-glitch-layer';

        const clones = [];
        const colorClasses = ['bm-explosion-glitch-red', 'bm-explosion-glitch-cyan', 'bm-explosion-glitch-raw'];

        for (let i = 0; i < 3; i++) {
            const clone = document.createElement('div');
            clone.className = 'bm-explosion-glitch-clone ' + colorClasses[i];
            const sectionClone = sectionEl.cloneNode(true);
            sectionClone.removeAttribute('id');
            sectionClone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));

            clone.style.left = sectionRect.left.toFixed(2) + 'px';
            clone.style.top = sectionRect.top.toFixed(2) + 'px';
            clone.style.width = sectionRect.width.toFixed(2) + 'px';
            clone.style.height = sectionRect.height.toFixed(2) + 'px';
            clone.style.transform = 'translate(0,0)';

            sectionClone.style.margin = '0';
            sectionClone.style.width = sectionRect.width.toFixed(2) + 'px';
            sectionClone.style.maxWidth = 'none';
            sectionClone.style.minWidth = '0';

            clone.appendChild(sectionClone);
            layer.appendChild(clone);
            clones.push(clone);
        }

        document.body.appendChild(layer);

        const maxShift = Math.max(16, Math.min(52, Math.min(window.innerWidth, window.innerHeight) * 0.045));
        const interval = setInterval(() => {
            const now = performance.now() * 0.001;
            clones.forEach((clone, i) => {
                const clipTop = Math.random() * 88;
                const clipBottom = Math.max(0, 100 - (clipTop + (Math.random() * 26)));
                const dx = (Math.random() - 0.5) * maxShift;
                const dy = (Math.random() > 0.75) ? (Math.random() - 0.5) * 11 : 0;
                const skew = Math.sin((now * 35) + seed + i) * 4.8;

                clone.style.clipPath = 'inset(' + clipTop.toFixed(2) + '% 0 ' + clipBottom.toFixed(2) + '% 0)';
                clone.style.transform =
                    'translate(' + dx.toFixed(2) + 'px, ' + dy.toFixed(2) + 'px) skewX(' + skew.toFixed(2) + 'deg)';
            });
        }, 36);

        const cleanup = () => {
            clearInterval(interval);
            if (layer.parentNode) layer.parentNode.removeChild(layer);
        };

        setTimeout(cleanup, quakeConfig.sectionGlitchDurationMs || 360);
    }

    function applyQuakeBuild(icon, tremorElapsed, seed) {
        if (hoverAnimation && typeof hoverAnimation.applyQuakeBuild === 'function') {
            hoverAnimation.applyQuakeBuild(icon, tremorElapsed, seed);
            return;
        }

        const t = Math.min(1, tremorElapsed / (quakeConfig.buildMs || 40000));
        const ts = tremorElapsed / 1000;
        const entry = smoothStep(tremorElapsed / (quakeConfig.entryRampMs || 1600));
        const ramp = Math.pow(t, 2.2);
        const ampPx = 0.08 + (0.45 * t) + (10.5 * ramp);
        const rotAmp = 0.03 + (0.2 * t) + (6.4 * ramp);
        const scale = 1.06 + (0.03 * t) + (0.2 * Math.pow(t, 2.7));

        const f1 = 17 + 48 * t;
        const f2 = 29 + 56 * t;
        const f3 = 43 + 70 * t;
        const drift = Math.sin((ts * 0.85) + seed * 0.0043) * (0.3 + 1.9 * t);

        const x = ampPx * (
            0.7 * Math.sin((ts * f1) + seed * 0.73) +
            0.45 * Math.sin((ts * f2 * 1.07) + seed * 1.31 + drift) +
            0.22 * Math.sin((ts * f3 * 0.93) + seed * 2.17)
        );

        const y = ampPx * (
            0.66 * Math.sin((ts * f1 * 1.11) + seed * 2.29 - drift * 0.6) +
            0.41 * Math.sin((ts * f2 * 0.89) + seed * 0.58) +
            0.24 * Math.sin((ts * f3 * 1.21) + seed * 1.67)
        );

        const rot = rotAmp * (
            0.65 * Math.sin((ts * f1 * 0.91) + seed * 1.1) +
            0.35 * Math.sin((ts * f2 * 1.13) + seed * 2.7)
        );

        const pulse = Math.pow(Math.max(0, Math.sin((ts * (2.1 + t * 4.6)) + seed * 0.013)), 6);
        const pulseBoost = 1 + pulse * (0.15 + t * 0.55);

        const hintDist = Math.abs(tremorElapsed - (quakeConfig.corrosionHintAtMs || 20000));
        const hintRaw = Math.max(0, 1 - (hintDist / (quakeConfig.corrosionHintSpanMs || 140)));
        const corrosionHint = Math.pow(hintRaw, 2.4);

        const corrosionStart = (quakeConfig.buildMs || 40000) - (quakeConfig.corrosionRampMs || 10000);
        const corrosionRamp = Math.max(0, Math.min(1, (tremorElapsed - corrosionStart) / (quakeConfig.corrosionRampMs || 10000)));
        const corrosionLevel = Math.max(corrosionHint, corrosionRamp);

        const buildX = x * pulseBoost;
        const buildY = y * pulseBoost;
        const buildRot = rot * pulseBoost;
        const buildScale = scale + pulse * 0.06 + corrosionLevel * 0.025;
        icon.style.transform =
            'translate3d(' + lerp(0, buildX, entry).toFixed(3) + 'px,' + lerp(0, buildY, entry).toFixed(3) + 'px,0) ' +
            'rotate(' + lerp(0, buildRot, entry).toFixed(3) + 'deg) ' +
            'scale(' + lerp(1.06, buildScale, entry).toFixed(4) + ')';

        icon.style.filter =
            'saturate(' + lerp(1, 1 + 0.18 * t + 0.28 * corrosionLevel, entry).toFixed(3) + ') ' +
            'contrast(' + lerp(1, 1 + 0.16 * t + 0.2 * corrosionLevel, entry).toFixed(3) + ') ' +
            'brightness(' + lerp(1, 1 + 0.1 * t - 0.06 * corrosionLevel, entry).toFixed(3) + ')';

        icon.style.opacity = lerp(1, 1 - (0.015 * Math.pow(t, 3)) - (0.025 * corrosionLevel), entry).toFixed(3);

        icon.style.setProperty('--bm-corrosion-opacity', lerp(0, Math.min(1, 0.03 + corrosionLevel * 1.12), entry).toFixed(3));
        icon.style.setProperty('--bm-corrosion-shift-x', lerp(0, Math.sin((ts * (7 + corrosionLevel * 22)) + seed * 0.021) * (0.5 + corrosionLevel * 7), entry).toFixed(3) + 'px');
        icon.style.setProperty('--bm-corrosion-shift-y', lerp(0, Math.cos((ts * (9 + corrosionLevel * 26)) + seed * 0.037) * (0.4 + corrosionLevel * 6), entry).toFixed(3) + 'px');
        icon.style.setProperty('--bm-corrosion-rot', lerp(0, Math.sin((ts * (8 + corrosionLevel * 21)) + seed * 0.013) * (0.4 + corrosionLevel * 5), entry).toFixed(3) + 'deg');
        icon.style.setProperty('--bm-corrosion-scale', lerp(0, corrosionLevel * 0.3 + pulse * 0.06, entry).toFixed(4));

        const edgeNoise = Math.sin((ts * (11 + corrosionLevel * 37)) + seed * 0.071) * 0.8 +
                  Math.sin((ts * (17 + corrosionLevel * 41)) + seed * 0.137) * 0.5 +
                  Math.sin((ts * (23 + corrosionLevel * 53)) + seed * 0.193) * 0.32;
        const biteA = Math.max(0, 1.2 + corrosionLevel * 44 + Math.abs(edgeNoise) * 6.8);
        const biteB = Math.max(0, 1.5 + corrosionLevel * 38 + Math.abs(Math.cos(edgeNoise * 1.2)) * 5.9);
        const biteC = Math.max(0, 0.9 + corrosionLevel * 41 + Math.abs(Math.sin(edgeNoise * 1.7)) * 6.4);
        const biteD = Math.max(0, 1.1 + corrosionLevel * 46 + Math.abs(Math.cos(edgeNoise * 1.3)) * 6.1);
        const biteE = Math.max(0, 2.2 + corrosionLevel * 27 + Math.abs(edgeNoise) * 4.8);
        const biteF = Math.max(20, 48 + Math.sin(ts * 13 + seed * 0.05) * (1.4 + corrosionLevel * 18));
        icon.style.setProperty('--bm-corrosion-bite-a', biteA.toFixed(2));
        icon.style.setProperty('--bm-corrosion-bite-b', biteB.toFixed(2));
        icon.style.setProperty('--bm-corrosion-bite-c', biteC.toFixed(2));
        icon.style.setProperty('--bm-corrosion-bite-d', biteD.toFixed(2));
        icon.style.setProperty('--bm-corrosion-bite-e', biteE.toFixed(2));
        icon.style.setProperty('--bm-corrosion-bite-f', biteF.toFixed(2));

        const glowA = lerp(0.21, 0.21 + 0.26 * t + 0.12 * corrosionLevel, entry).toFixed(3);
        const glowB = lerp(0.27, 0.27 + 0.25 * t + 0.2 * corrosionLevel, entry).toFixed(3);
        const spread = lerp(1, 1 + 3.2 * t + 2.4 * corrosionLevel, entry).toFixed(2);
        const blur = lerp(5, 5 + 13 * t + 10 * corrosionLevel, entry).toFixed(2);
        const baseShadow =
            '0 0 1px ' + spread + 'px rgba(255,255,255,' + glowA + '), ' +
            '0 0 ' + blur + 'px ' + lerp(2, 2 + 5.5 * t, entry).toFixed(2) + 'px rgba(0,0,0,' + glowB + ')';

        const extraBlend = smoothStep(entry * corrosionLevel);
        if (extraBlend > 0.001) {
            const rustBlur = lerp(0, 12 + corrosionLevel * 28, extraBlend).toFixed(2);
            const rustSpread = lerp(0, 4 + corrosionLevel * 10, extraBlend).toFixed(2);
            const rustAlpha = lerp(0, 0.1 + corrosionLevel * 0.7, extraBlend).toFixed(3);

            const darkBlur = lerp(0, 16 + corrosionLevel * 26, extraBlend).toFixed(2);
            const darkSpread = lerp(0, 7 + corrosionLevel * 12, extraBlend).toFixed(2);
            const darkAlpha = lerp(0, 0.16 + corrosionLevel * 0.62, extraBlend).toFixed(3);

            icon.style.boxShadow =
                baseShadow + ', ' +
                '0 0 ' + rustBlur + 'px ' + rustSpread + 'px rgba(92,48,22,' + rustAlpha + '), ' +
                '0 0 ' + darkBlur + 'px ' + darkSpread + 'px rgba(31,19,12,' + darkAlpha + ')';
        } else {
            icon.style.boxShadow = baseShadow;
        }
    }

    function applyQuakeExplosion(icon, explodeElapsed, seed) {
        if (hoverAnimation && typeof hoverAnimation.applyQuakeExplosion === 'function') {
            hoverAnimation.applyQuakeExplosion(icon, explodeElapsed, seed);
            return;
        }

        const t = Math.min(1, explodeElapsed / (quakeConfig.explodeMs || 400));
        const ts = explodeElapsed / 1000;
        const inv = 1 - t;

        const blastAmp = (14 + 26 * t) * inv;
        const x = blastAmp * Math.sin((ts * 85) + seed * 1.37);
        const y = blastAmp * Math.sin((ts * 97) + seed * 2.11 + Math.PI / 3);
        const rot = (13 + 30 * t) * inv * Math.sin((ts * 73) + seed * 0.91);
        const scale = 1.26 + 1.35 * t - 2.45 * t * t;

        icon.style.transform =
            'translate3d(' + x.toFixed(3) + 'px,' + y.toFixed(3) + 'px,0) ' +
            'rotate(' + rot.toFixed(3) + 'deg) ' +
            'scale(' + Math.max(0.01, scale).toFixed(4) + ')';

        icon.style.filter =
            'saturate(' + (1.35 + 0.95 * t).toFixed(3) + ') ' +
            'contrast(' + (1.2 + 0.42 * t).toFixed(3) + ') ' +
            'brightness(' + (1.1 + 0.34 * t).toFixed(3) + ') ' +
            'sepia(' + (0.35 + 0.45 * t).toFixed(3) + ') ' +
            'blur(' + (0.4 + 4.2 * t).toFixed(3) + 'px)';

        icon.style.opacity = Math.max(0, 1 - Math.pow(t, 1.35)).toFixed(3);
        icon.style.boxShadow =
            '0 0 ' + (8 + 24 * t).toFixed(2) + 'px ' + (4 + 11 * t).toFixed(2) + 'px rgba(255,255,255,' + (0.5 - 0.48 * t).toFixed(3) + '), ' +
            '0 0 ' + (20 + 35 * t).toFixed(2) + 'px ' + (9 + 14 * t).toFixed(2) + 'px rgba(0,0,0,' + (0.52 - 0.5 * t).toFixed(3) + ')';
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
            initAudioUnlockHooks();
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
