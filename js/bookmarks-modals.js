/* ============================================================
   Advanced Bookmarks — modal and overlay module
   Keeps the bookmark modal, group manager, and editor UI logic
   isolated from the main controller.
   ============================================================ */
(function (root) {
    'use strict';

    function createController(api) {
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
                            '<label style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">Icon Background<span class="bm-seg-control bm-seg-sm" id="advBmIconBgMode"><button data-val="auto" class="active">Auto</button><button data-val="custom">Custom</button></span></label>' +
                            '<div id="advBmIconBgPicker" style="display:none"><div class="bm-color-row"><input type="color" id="advBmIconBgColor" value="#667eea"></div></div>' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label for="advBmIconLetter">Character <span style="font-weight:400;color:#bbb">(empty = auto from URL)</span></label>' +
                            '<input type="text" id="advBmIconLetter" maxlength="8" placeholder="auto" style="width:80px">' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">Character Color<span class="bm-seg-control bm-seg-sm" id="advBmIconLetterColorMode"><button data-val="auto" class="active">Auto</button><button data-val="custom">Custom</button></span></label>' +
                            '<div id="advBmIconLetterColorPicker" style="display:none"><div class="bm-color-row"><input type="color" id="advBmIconLetterColor" value="#ffffff"></div></div>' +
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

            ['advBmIconBgMode', 'advBmIconLetterColorMode'].forEach(modeId => {
                const pickerId = modeId === 'advBmIconBgMode' ? 'advBmIconBgPicker' : 'advBmIconLetterColorPicker';
                document.getElementById(modeId).addEventListener('click', (e) => {
                    const btn = e.target.closest('button[data-val]');
                    if (!btn) return;
                    document.querySelectorAll('#' + modeId + ' button').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    document.getElementById(pickerId).style.display = btn.dataset.val === 'custom' ? '' : 'none';
                });
            });
        }

        function openAdvancedBookmarkModal(groupId, bookmarkId) {
            ensureBookmarkModal();
            api.setActiveModalContext({ groupId, bookmarkId });

            const titleEl = document.getElementById('advBmModalTitle');
            const titleInput = document.getElementById('advBmTitle');
            const urlInput = document.getElementById('advBmUrl');
            const deleteBtn = document.getElementById('advBmDeleteBtn');
            const moveRow = document.getElementById('bmGroupMoveRow');
            const moveSelect = document.getElementById('advBmMoveGroup');
            const config = api.getConfig();

            if (bookmarkId) {
                const g = config.groups.find(group => group.id === groupId);
                const bm = g ? g.bookmarks.find(item => item.id === bookmarkId) : null;
                if (!bm) return;

                titleEl.textContent = 'Edit Bookmark';
                titleInput.value = bm.title;
                urlInput.value = bm.url;
                deleteBtn.style.display = '';

                if (config.groups.length > 1) {
                    moveRow.classList.add('visible');
                    moveSelect.innerHTML = config.groups
                        .map(group => '<option value="' + group.id + '"' + (group.id === groupId ? ' selected' : '') + '>' + api.escapeHtml(group.name) + '</option>')
                        .join('');
                } else {
                    moveRow.classList.remove('visible');
                }

                const io = bm.iconOverride || { enabled: false, bgColor: '#667eea', letter: '', letterColor: '#ffffff' };
                document.getElementById('advBmIconOverride').checked = io.enabled;
                document.getElementById('advBmIconOverrideDetails').style.display = io.enabled ? '' : 'none';
                const bgAuto = io.bgColor == null;
                document.querySelectorAll('#advBmIconBgMode button').forEach(btn => btn.classList.toggle('active', btn.dataset.val === (bgAuto ? 'auto' : 'custom')));
                document.getElementById('advBmIconBgPicker').style.display = bgAuto ? 'none' : '';
                if (!bgAuto) {
                    const parsed = api.parseRgba(io.bgColor);
                    document.getElementById('advBmIconBgColor').value = api.rgbToHex(parsed.r, parsed.g, parsed.b);
                }
                document.getElementById('advBmIconLetter').value = io.letter || '';
                const lcAuto = io.letterColor == null;
                document.querySelectorAll('#advBmIconLetterColorMode button').forEach(btn => btn.classList.toggle('active', btn.dataset.val === (lcAuto ? 'auto' : 'custom')));
                document.getElementById('advBmIconLetterColorPicker').style.display = lcAuto ? 'none' : '';
                if (!lcAuto) {
                    const parsed = api.parseRgba(io.letterColor);
                    document.getElementById('advBmIconLetterColor').value = api.rgbToHex(parsed.r, parsed.g, parsed.b);
                }
            } else {
                titleEl.textContent = 'Add Bookmark';
                titleInput.value = '';
                urlInput.value = '';
                deleteBtn.style.display = 'none';
                moveRow.classList.remove('visible');

                document.getElementById('advBmIconOverride').checked = false;
                document.getElementById('advBmIconOverrideDetails').style.display = 'none';
                document.querySelectorAll('#advBmIconBgMode button').forEach(btn => btn.classList.toggle('active', btn.dataset.val === 'custom'));
                document.getElementById('advBmIconBgPicker').style.display = '';
                document.getElementById('advBmIconBgColor').value = '#667eea';
                document.getElementById('advBmIconLetter').value = '';
                document.querySelectorAll('#advBmIconLetterColorMode button').forEach(btn => btn.classList.toggle('active', btn.dataset.val === 'auto'));
                document.getElementById('advBmIconLetterColorPicker').style.display = 'none';
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
            api.setActiveModalContext(null);
        }

        function saveAdvancedBookmark() {
            const context = api.getActiveModalContext();
            if (!context) return;

            const title = document.getElementById('advBmTitle').value.trim();
            const rawUrl = document.getElementById('advBmUrl').value.trim();
            if (!title || !rawUrl) return;

            let formattedUrl = rawUrl;
            if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://') && !rawUrl.startsWith('file://')) {
                formattedUrl = 'https://' + rawUrl;
            }

            const sanitized = api.safeUrl(formattedUrl);
            if (sanitized === 'about:blank') {
                api.toast('Please enter a valid URL (e.g. github.com or https://example.com)');
                return;
            }

            const { iconHue, iconLetter } = api.computeIconData(sanitized);
            const { groupId, bookmarkId } = context;

            const iconOverride = {
                enabled: document.getElementById('advBmIconOverride').checked,
                bgColor: document.querySelector('#advBmIconBgMode button.active')?.dataset.val === 'auto' ? null : document.getElementById('advBmIconBgColor').value,
                letter: document.getElementById('advBmIconLetter').value.trim(),
                letterColor: document.querySelector('#advBmIconLetterColorMode button.active')?.dataset.val === 'auto' ? null : document.getElementById('advBmIconLetterColor').value
            };

            if (bookmarkId) {
                const moveRow = document.getElementById('bmGroupMoveRow');
                const moveSelect = document.getElementById('advBmMoveGroup');
                const targetGroupId = (moveRow && moveRow.classList.contains('visible') && moveSelect)
                    ? moveSelect.value
                    : groupId;

                api.updateBookmarkInGroup(groupId, bookmarkId, { title, url: sanitized, iconHue, iconLetter, iconOverride });
                if (targetGroupId !== groupId) {
                    api.moveBookmark(groupId, targetGroupId, bookmarkId);
                }
            } else {
                api.addBookmarkToGroup(groupId, { title, url: sanitized, iconHue, iconLetter, iconOverride });
            }

            closeAdvancedBookmarkModal();
        }

        function deleteAdvancedBookmark() {
            const context = api.getActiveModalContext();
            if (!context || !context.bookmarkId) return;
            api.deleteBookmarkFromGroup(context.groupId, context.bookmarkId);
            closeAdvancedBookmarkModal();
        }

        function ensureGroupMgmtPanel() {
            if (document.getElementById('bmMgmtOverlay')) return;

            const overlay = document.createElement('div');
            overlay.className = 'bm-mgmt-overlay';
            overlay.id = 'bmMgmtOverlay';
            overlay.innerHTML =
                '<div class="bm-mgmt-panel" id="bmMgmtPanel">' +
                    '<div class="bm-mgmt-header">' +
                        '<span class="bm-mgmt-title">Manage Groups</span>' +
                        '<button class="bm-mgmt-close-btn" id="bmMgmtCloseBtn">×</button>' +
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
                    const config = api.getConfig();
                    config.globalMaxSlots = val;
                    api.saveConfig();
                    api.renderAdvancedBookmarks();
                    updateSlotsPreview();
                }
            });
        }

        function openGroupMgmtPanel() {
            ensureGroupMgmtPanel();
            document.getElementById('bmGlobalSlots').value = api.getConfig().globalMaxSlots;
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

            if (!api.getConfig().groups.length) {
                const empty = document.createElement('div');
                empty.className = 'bm-mgmt-list-empty';
                empty.textContent = 'No groups yet. Add one below.';
                list.appendChild(empty);
                return;
            }

            api.getConfig().groups.forEach(group => list.appendChild(createGroupMgmtRow(group)));
            initDragReorder(list);
        }

        function createGroupMgmtRow(group) {
            const row = document.createElement('div');
            row.className = 'bm-mgmt-group-row';
            row.dataset.id = group.id;
            row.draggable = true;

            const count = group.bookmarks.length;
            const meta = group.maxSlots + ' col' + (group.maxSlots !== 1 ? 's' : '') +
                         ' · ' + count + ' bookmark' + (count !== 1 ? 's' : '');

            row.innerHTML =
                '<span class="bm-mgmt-drag-handle" title="Drag to reorder">⤷</span>' +
                '<div class="bm-mgmt-group-info">' +
                    '<div class="bm-mgmt-group-name-text">' + api.escapeHtml(group.name) + '</div>' +
                    '<div class="bm-mgmt-group-meta">' + api.escapeHtml(meta) + '</div>' +
                '</div>' +
                '<div class="bm-mgmt-group-actions">' +
                    '<button class="bm-mgmt-icon-btn" title="Edit group" data-action="edit">✎</button>' +
                    '<button class="bm-mgmt-icon-btn danger" title="Delete group" data-action="delete">🗑</button>' +
                '</div>';

            row.querySelector('[data-action="edit"]').addEventListener('click', () => openGroupEditor(group.id));
            row.querySelector('[data-action="delete"]').addEventListener('click', () => confirmDeleteGroup(group.id, group.name));
            return row;
        }

        function confirmDeleteGroup(id, name) {
            const group = api.getConfig().groups.find(item => item.id === id);
            if (!group) return;
            const msg = group.bookmarks.length > 0
                ? 'Delete group "' + name + '" and all ' + group.bookmarks.length + ' bookmark(s) inside it?'
                : 'Delete group "' + name + '"?';
            if (!confirm(msg)) return;
            api.deleteGroup(id);
            refreshGroupMgmtList();
        }

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
                    listEl.querySelectorAll('.bm-mgmt-group-row').forEach(item => item.classList.remove('drag-over'));
                });

                row.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    listEl.querySelectorAll('.bm-mgmt-group-row').forEach(item => item.classList.remove('drag-over'));
                    if (row.dataset.id !== dragSrcId) row.classList.add('drag-over');
                });

                row.addEventListener('drop', (e) => {
                    e.preventDefault();
                    if (!dragSrcId || dragSrcId === row.dataset.id) return;
                    const ids = [...listEl.querySelectorAll('.bm-mgmt-group-row')].map(item => item.dataset.id);
                    const srcIdx = ids.indexOf(dragSrcId);
                    const dstIdx = ids.indexOf(row.dataset.id);
                    if (srcIdx < 0 || dstIdx < 0) return;
                    ids.splice(srcIdx, 1);
                    ids.splice(dstIdx, 0, dragSrcId);
                    api.reorderGroups(ids);
                    refreshGroupMgmtList();
                });
            });
        }

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
                                '<label style="display:flex;align-items:center;justify-content:space-between">Icon Background<span class="bm-seg-control bm-seg-sm" id="bmEdIconBgMode"><button data-val="auto" class="active">Auto</button><button data-val="custom">Custom</button></span></label>' +
                                '<div id="bmEdIconBgPicker" style="display:none;margin-top:8px"><div class="bm-color-row"><input type="color" id="bmEdIconBgColor" value="#667eea"></div></div>' +
                            '</div>' +
                            '<div class="bm-editor-row">' +
                                '<label for="bmEdIconLetter">Character <span style="font-weight:400;color:#bbb">(empty = auto from URL)</span></label>' +
                                '<input type="text" id="bmEdIconLetter" maxlength="8" placeholder="auto" style="width:80px">' +
                            '</div>' +
                            '<div class="bm-editor-row">' +
                                '<label style="display:flex;align-items:center;justify-content:space-between">Character Color<span class="bm-seg-control bm-seg-sm" id="bmEdIconLetterColorMode"><button data-val="auto" class="active">Auto</button><button data-val="custom">Custom</button></span></label>' +
                                '<div id="bmEdIconLetterColorPicker" style="display:none;margin-top:8px"><div class="bm-color-row"><input type="color" id="bmEdIconLetterColor" value="#ffffff"></div></div>' +
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
                document.querySelectorAll('#bmEdSlotSize button').forEach(item => item.classList.remove('active'));
                btn.classList.add('active');
            });

            document.getElementById('bmEdBgOpacity').addEventListener('input', () => {
                document.getElementById('bmEdBgOpacityLabel').textContent = document.getElementById('bmEdBgOpacity').value + '%';
            });

            document.getElementById('bmEdBorderStyle').addEventListener('change', () => {
                const val = document.getElementById('bmEdBorderStyle').value;
                document.getElementById('bmEdBorderDetails').style.display = (val === 'none') ? 'none' : '';
            });

            document.getElementById('bmEdRadius').addEventListener('input', () => {
                document.getElementById('bmEdRadiusLabel').textContent = document.getElementById('bmEdRadius').value + 'px';
            });

            document.getElementById('bmEdPadding').addEventListener('input', () => {
                document.getElementById('bmEdPaddingLabel').textContent = document.getElementById('bmEdPadding').value + 'px';
            });

            document.getElementById('bmEdIconOverride').addEventListener('change', () => {
                const enabled = document.getElementById('bmEdIconOverride').checked;
                document.getElementById('bmEdIconOverrideDetails').style.display = enabled ? '' : 'none';
            });

            ['bmEdIconBgMode', 'bmEdIconLetterColorMode'].forEach(modeId => {
                const pickerId = modeId === 'bmEdIconBgMode' ? 'bmEdIconBgPicker' : 'bmEdIconLetterColorPicker';
                document.getElementById(modeId).addEventListener('click', (e) => {
                    const btn = e.target.closest('button[data-val]');
                    if (!btn) return;
                    document.querySelectorAll('#' + modeId + ' button').forEach(item => item.classList.remove('active'));
                    btn.classList.add('active');
                    document.getElementById(pickerId).style.display = btn.dataset.val === 'custom' ? '' : 'none';
                });
            });
        }

        function openGroupEditor(groupId) {
            ensureGroupEditor();
            api.setEditingGroupId(groupId);

            const group = groupId ? api.getConfig().groups.find(item => item.id === groupId) : null;
            const g = group || api.createDefaultGroup();

            document.getElementById('bmEditorTitle').textContent = groupId ? 'Edit Group' : 'New Group';
            document.getElementById('bmEdName').value = g.name;
            document.getElementById('bmEdShowName').checked = g.showName !== false;
            document.getElementById('bmEdSlots').max = api.getConfig().globalMaxSlots;
            document.getElementById('bmEdSlots').value = g.maxSlots;
            document.getElementById('bmEdShowNames').checked = g.showBookmarkNames !== false;

            document.querySelectorAll('#bmEdSlotSize button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.val === (g.slotSize || 'medium'));
            });

            const bgParsed = api.parseRgba(g.background);
            document.getElementById('bmEdBgColor').value = api.rgbToHex(bgParsed.r, bgParsed.g, bgParsed.b);
            const opacityPct = Math.round(bgParsed.a * 100);
            document.getElementById('bmEdBgOpacity').value = opacityPct;
            document.getElementById('bmEdBgOpacityLabel').textContent = opacityPct + '%';

            const border = g.border || api.createDefaultBorder();
            document.getElementById('bmEdBorderStyle').value = border.style || 'none';
            document.getElementById('bmEdBorderDetails').style.display = (border.style === 'none') ? 'none' : '';

            const bcParsed = api.parseRgba(border.color);
            document.getElementById('bmEdBorderColor').value = api.rgbToHex(bcParsed.r, bcParsed.g, bcParsed.b);
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
            const bgAuto = io.bgColor == null;
            document.querySelectorAll('#bmEdIconBgMode button').forEach(btn => btn.classList.toggle('active', btn.dataset.val === (bgAuto ? 'auto' : 'custom')));
            document.getElementById('bmEdIconBgPicker').style.display = bgAuto ? 'none' : '';
            if (!bgAuto) {
                const parsed = api.parseRgba(io.bgColor);
                document.getElementById('bmEdIconBgColor').value = api.rgbToHex(parsed.r, parsed.g, parsed.b);
            }
            document.getElementById('bmEdIconLetter').value = io.letter || '';
            const lcAuto = io.letterColor == null;
            document.querySelectorAll('#bmEdIconLetterColorMode button').forEach(btn => btn.classList.toggle('active', btn.dataset.val === (lcAuto ? 'auto' : 'custom')));
            document.getElementById('bmEdIconLetterColorPicker').style.display = lcAuto ? 'none' : '';
            if (!lcAuto) {
                const parsed = api.parseRgba(io.letterColor);
                document.getElementById('bmEdIconLetterColor').value = api.rgbToHex(parsed.r, parsed.g, parsed.b);
            }

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
            const maxSlots = Math.max(1, Math.min(api.getConfig().globalMaxSlots, rawSlots));

            const activeBtn = document.querySelector('#bmEdSlotSize button.active');
            const slotSize = activeBtn ? activeBtn.dataset.val : 'medium';
            const showBookmarkNames = document.getElementById('bmEdShowNames').checked;

            const bgColor = document.getElementById('bmEdBgColor').value;
            const bgOpacity = (parseInt(document.getElementById('bmEdBgOpacity').value, 10) / 100).toFixed(2);
            const bgRgb = api.hexToRgb(bgColor);
            const background = 'rgba(' + bgRgb.r + ',' + bgRgb.g + ',' + bgRgb.b + ',' + bgOpacity + ')';

            const borderStyle = document.getElementById('bmEdBorderStyle').value;
            const bcColor = document.getElementById('bmEdBorderColor').value;
            const bcRgb = api.hexToRgb(bcColor);
            const borderWidth = parseInt(document.getElementById('bmEdBorderWidth').value, 10) || 1;
            const borderRadius = parseInt(document.getElementById('bmEdRadius').value, 10);
            const padding = parseInt(document.getElementById('bmEdPadding').value, 10);

            const iconOverrideEnabled = document.getElementById('bmEdIconOverride').checked;
            const iconBgColor = document.querySelector('#bmEdIconBgMode button.active')?.dataset.val === 'auto' ? null : document.getElementById('bmEdIconBgColor').value;
            const iconLetter = document.getElementById('bmEdIconLetter').value.trim();
            const iconLetterColor = document.querySelector('#bmEdIconLetterColorMode button.active')?.dataset.val === 'auto' ? null : document.getElementById('bmEdIconLetterColor').value;

            const patch = {
                name,
                showName,
                maxSlots,
                slotSize,
                showBookmarkNames,
                background,
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

            const editingGroupId = api.getEditingGroupId();
            if (editingGroupId) {
                api.updateGroup(editingGroupId, patch);
            } else {
                api.addGroup(patch);
            }

            closeGroupEditor();

            const mgmt = document.getElementById('bmMgmtOverlay');
            if (mgmt && mgmt.classList.contains('active')) refreshGroupMgmtList();
        }

        function updateSlotsPreview() {
            const preview = document.getElementById('bmEdSlotsPreview');
            if (!preview) return;
            const total = api.getConfig().globalMaxSlots;
            const active = parseInt(document.getElementById('bmEdSlots').value, 10) || 4;
            preview.innerHTML = '';
            for (let i = 0; i < total; i++) {
                const cell = document.createElement('div');
                cell.className = 'bm-slots-preview-cell' + (i < active ? ' active' : '');
                preview.appendChild(cell);
            }
        }

        return {
            ensureBookmarkModal,
            openAdvancedBookmarkModal,
            closeAdvancedBookmarkModal,
            saveAdvancedBookmark,
            deleteAdvancedBookmark,
            ensureGroupMgmtPanel,
            openGroupMgmtPanel,
            closeGroupMgmtPanel,
            refreshGroupMgmtList,
            createGroupMgmtRow,
            confirmDeleteGroup,
            initDragReorder,
            ensureGroupEditor,
            openGroupEditor,
            closeGroupEditor,
            saveGroupEditorData,
            updateSlotsPreview
        };
    }

    root.bookmarksModals = {
        createController
    };
})(window);
