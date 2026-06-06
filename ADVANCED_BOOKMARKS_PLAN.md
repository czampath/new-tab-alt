# Advanced Bookmarks — Implementation Plan

## Overview

An advanced bookmark mode layered on top of the existing system. Bookmarks are organised into
**groups**. Groups are placed on a shared horizontal grid; multiple groups can share a visual
row when their combined slot-width fits within the global column limit. A group that is too
wide for the remaining space wraps to the next row — but never bleeds into another group.

---

## 1. Core Mental Model

### 1.1 The Slot Grid

- The outer container is a **CSS Grid** with `N` equally-sized columns (the *global slot limit*,
  default **8**).
- Each **group** declares how many of those columns it occupies (`maxSlots`, 1–N).
- CSS `grid-auto-flow: row` auto-placement handles wrapping: groups are placed left-to-right
  and wrap to the next row when remaining columns in the current row are fewer than
  `group.maxSlots`.
- Inside each group, the bookmarks are laid out on a **second inner grid** using the same
  column count as `group.maxSlots`, so bookmarks wrap within the group without overflowing.

### 1.2 Example Layout (global limit = 8)

```
┌──────────────────────────────────┬──────────────┐
│  GitHub Repos  (maxSlots = 6)    │  Jira (2)    │  ← row 1: 6+2 = 8
├──────────────────┬───────────────┴──────────────┤
│  Jenkins (4)     │  Docs (4)                    │  ← row 2: 4+4 = 8
├──────────────────┴──────────────────────────────┤
│  Misc (8, full row)                             │  ← row 3: 8
└─────────────────────────────────────────────────┘
```

Within the "GitHub Repos" group, if there are 10 bookmarks and maxSlots = 6, they wrap:
```
[1][2][3][4][5][6]
[7][8][9][10][ ][ ]   ← empty slots, stays inside the group box
```

---

## 2. Data Model

### 2.1 localStorage Keys

| Key | Purpose |
|-----|---------|
| `bookmarks` | Existing flat array (basic mode — untouched) |
| `advancedBookmarksConfig` | Full advanced configuration object |

### 2.2 `advancedBookmarksConfig` Schema

```jsonc
{
  "enabled": false,           // false = basic mode (existing behaviour)
  "globalMaxSlots": 8,        // number of grid columns (1–20)
  "groups": [ /* GroupConfig[] */ ]
}
```

### 2.3 `GroupConfig` Schema

```jsonc
{
  "id": "uuid-v4",
  "name": "GitHub Repos",
  "showName": true,           // show/hide group label
  "maxSlots": 6,              // column-span in the parent grid (1–globalMaxSlots)

  // --- Slot appearance ---
  "slotSize": "medium",       // "small" | "medium" | "large"
  "showBookmarkNames": true,  // show/hide text label under icon

  // --- Group container appearance ---
  "background": "rgba(255,255,255,0.08)",
  "border": {
    "style": "none",          // "none" | "solid" | "dashed" | "dotted"
    "width": 1,               // px
    "color": "rgba(255,255,255,0.3)",
    "radius": 12              // px
  },
  "padding": 10,              // inner padding px

  // --- Bookmarks ---
  "bookmarks": [
    {
      "id": "uuid-v4",
      "title": "My Repo",
      "url": "https://github.com/...",
      "iconHue": 210,
      "iconLetter": "M"
    }
  ]
}
```

---

## 3. File Structure

### New files

| File | Role |
|------|------|
| `js/bookmarks-advanced.js` | All data management + rendering logic |
| `css/bookmarks-advanced.css` | Styles for groups, slots, management UI |

### Modified files

| File | Changes |
|------|---------|
| `index.html` | Link new CSS/JS; add advanced container; add settings toggle + "Manage Groups" button |
| `js/app.js` | Show/hide basic vs advanced section based on mode; wire settings toggle |
| `css/style.css` | Minor: ensure `.bookmarks-section` display toggling works for both modes |

---

## 4. HTML Structure (additions to `index.html`)

```html
<!-- Inside .bookmarks-section, alongside existing #bookmarksGrid -->

<!-- Advanced mode container (hidden when mode = basic) -->
<div class="bm-advanced-container" id="advancedBookmarksContainer"></div>

<!-- "Manage Groups" button in section-header (visible only in advanced mode) -->
<button class="manage-groups-btn" id="manageGroupsBtn">⚙ Groups</button>
```

Inside the settings panel, a new toggle:

```html
<div class="setting-item">
  <div class="toggle-label">
    <label>Advanced Bookmark Mode</label>
    <label class="toggle-switch">
      <input type="checkbox" id="toggleAdvancedBookmarks">
      <span class="toggle-slider"></span>
    </label>
  </div>
</div>
```

---

## 5. CSS Architecture (`css/bookmarks-advanced.css`)

### 5.1 Outer Container

```css
.bm-advanced-container {
  display: grid;
  grid-template-columns: repeat(var(--bm-global-slots, 8), 1fr);
  grid-auto-flow: row;
  gap: 10px;
  align-items: start;
  width: 100%;
}
```

### 5.2 Group

```css
.bm-group {
  grid-column: span var(--bm-group-slots);   /* set via inline style */
  background: var(--bm-group-bg);
  border: var(--bm-group-border);
  border-radius: var(--bm-group-radius);
  padding: var(--bm-group-padding);
  box-sizing: border-box;
  min-width: 0;
}

.bm-group-name {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.6;
  margin-bottom: 6px;
  padding-left: 2px;
}

.bm-group-body {
  display: grid;
  grid-template-columns: repeat(var(--bm-group-slots), 1fr);
  gap: 8px;
}
```

### 5.3 Slot Sizes

```css
/* Medium (default) */
.bm-slot { padding: 14px 10px; }
.bm-slot .bm-slot-icon { font-size: 28px; width: 36px; height: 36px; }

/* Small */
.bm-group.slot-small .bm-slot { padding: 8px 6px; }
.bm-group.slot-small .bm-slot-icon { font-size: 18px; width: 26px; height: 26px; }

/* Large */
.bm-group.slot-large .bm-slot { padding: 20px 14px; }
.bm-group.slot-large .bm-slot-icon { font-size: 38px; width: 48px; height: 48px; }
```

### 5.4 Slot

```css
.bm-slot {
  background: rgba(255,255,255,0.12);
  border-radius: 12px;
  text-align: center;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  position: relative;
  transition: background 0.2s, transform 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.bm-slot:hover { background: rgba(255,255,255,0.22); transform: translateY(-2px); }

.bm-slot-icon { display: block; border-radius: 8px; margin-bottom: 6px; }
.bm-slot-name { font-size: 11.5px; font-weight: 500; word-break: break-word; line-height: 1.25; }

/* Hidden name variant */
.bm-group.hide-names .bm-slot-name { display: none; }

/* Edit overlay button */
.bm-slot .bm-slot-edit { /* same pattern as existing .edit-btn */ }
```

---

## 6. JavaScript Architecture (`js/bookmarks-advanced.js`)

### 6.1 Storage helpers

```js
function loadAdvancedConfig() { ... }   // parse localStorage or return defaults
function saveAdvancedConfig() { ... }   // stringify + store
function generateId() { ... }           // crypto.randomUUID() or fallback
```

### 6.2 Data defaults

```js
const DEFAULT_GROUP = {
  name: 'New Group', showName: true, maxSlots: 4,
  slotSize: 'medium', showBookmarkNames: true,
  background: 'rgba(255,255,255,0.08)',
  border: { style: 'none', width: 1, color: 'rgba(255,255,255,0.3)', radius: 12 },
  padding: 10, bookmarks: []
};
```

### 6.3 Rendering

```js
function renderAdvancedBookmarks() {
  // 1. Set CSS variable --bm-global-slots on container
  // 2. For each group:
  //    a. Create .bm-group element, set style="--bm-group-slots: N; ..."
  //    b. Apply slot-size class, hide-names class
  //    c. Render group name header if showName
  //    d. Render .bm-group-body with bookmark slots
  //    e. Append "+ add bookmark" slot at the end of the group
  // 3. Each slot: icon (letter-icon or favicon), name, edit overlay
}
```

### 6.4 Group CRUD

```js
function addGroup(groupConfig) { ... }
function updateGroup(id, patch) { ... }
function deleteGroup(id) { ... }
function reorderGroups(newOrder) { ... }   // drag-and-drop reorder
```

### 6.5 Bookmark CRUD within group

```js
function addBookmarkToGroup(groupId, bookmarkData) { ... }
function updateBookmarkInGroup(groupId, bookmarkId, patch) { ... }
function deleteBookmarkFromGroup(groupId, bookmarkId) { ... }
function moveBookmark(fromGroupId, toGroupId, bookmarkId) { ... }
```

### 6.6 Migration

```js
function migrateBasicToAdvanced() {
  // Takes the flat `bookmarks` array from basic mode
  // Creates a single group "Quick Access" with maxSlots = 8
  // Populates it with those bookmarks
  // Saves to advancedBookmarksConfig
}
```

### 6.7 Mode switching (wired in `app.js`)

```js
function setAdvancedMode(enabled) {
  // Toggle display of #bookmarksGrid vs #advancedBookmarksContainer
  // Toggle visibility of #addBookmarkBtn vs #manageGroupsBtn
  // Save settings
}
```

---

## 7. Group Management UI

### 7.1 "Manage Groups" Panel

Triggered by the **⚙ Groups** button. Opens a slide-in panel (or full-width modal) containing:

- **Global settings row**: `Global slots per row` (number input, 1–20), slot unit size visual guide
- **Group list**: scrollable list of all groups, each row showing:
  - Drag handle (for reordering)
  - Group name + slot count badge
  - Edit icon → opens Group Editor
  - Delete icon (with confirm)
- **+ Add Group** button at the bottom

### 7.2 Group Editor Modal

A form with:

| Field | Control |
|-------|---------|
| Group name | Text input |
| Show group name | Toggle |
| Max slots (width) | Number spinner (1–globalMaxSlots) + visual slot-count preview |
| Slot size | Segmented button: Small / Medium / Large |
| Show bookmark names | Toggle |
| Background color | Color picker + opacity slider |
| Border style | Dropdown: None / Solid / Dashed / Dotted |
| Border width | Number input (px) |
| Border color | Color picker |
| Border radius | Slider (0–24px) |
| Inner padding | Slider (0–24px) |

### 7.3 Bookmark Editor within Group

Clicking the edit overlay on a slot opens the existing bookmark modal, augmented with:

- **Move to group** dropdown (if more than one group exists)

The "Add bookmark" slot (➕) at the end of each group body opens the existing bookmark modal,
pre-scoped to that group.

---

## 8. Implementation Phases

### Phase 1 — Data layer + basic rendering (no editing UI)
1. Create `js/bookmarks-advanced.js` with storage helpers, default schema, `renderAdvancedBookmarks()`
2. Create `css/bookmarks-advanced.css` with container, group, and slot styles
3. Add advanced container to `index.html`; link CSS + JS
4. Hard-code a sample `advancedBookmarksConfig` in localStorage to verify layout

**Acceptance**: Groups render correctly side-by-side / wrapping based on `maxSlots`. Slot sizes and name visibility work.

### Phase 2 — Mode toggle + migration
1. Add settings toggle `toggleAdvancedBookmarks` to `index.html`
2. Wire in `app.js`: `setAdvancedMode()` hides/shows basic vs advanced section
3. On first toggle-on, prompt user: *"Migrate your existing bookmarks into a default group?"*
4. Implement `migrateBasicToAdvanced()`

**Acceptance**: Toggling mode correctly switches views; migration works without data loss.

### Phase 3 — Bookmark editing within groups
1. Add "+ add slot" element at end of each group body
2. Reuse existing bookmark modal, scope save/delete to the group
3. Implement edit overlay per slot (reuse `.edit-btn` pattern)
4. Implement `addBookmarkToGroup`, `updateBookmarkInGroup`, `deleteBookmarkFromGroup`

**Acceptance**: Full add/edit/delete lifecycle for bookmarks within a group.

### Phase 4 — Group management UI
1. Add "⚙ Groups" button to section header
2. Build the Manage Groups panel (list + add/delete + drag reorder)
3. Build the Group Editor modal with all fields
4. Implement `addGroup`, `updateGroup`, `deleteGroup`, `reorderGroups`
5. Wire "Move to group" dropdown in bookmark editor

**Acceptance**: Full CRUD for groups with live re-render on save.

### Phase 5 — Polish
1. Animations: group and slot entrance animations (extend existing `popIn` keyframe)
2. Light-theme overrides for all new classes
3. Empty-state: when a group has 0 bookmarks, show a subtle placeholder
4. Settings panel: surface `globalMaxSlots` as a number input
5. Responsive: on narrow screens, collapse to single-column regardless of `maxSlots`
6. Accessibility: `aria-label` on groups, keyboard navigation between slots
7. Favicon support in advanced mode (respect existing `showFavicons` setting)

---

## 9. Edge Cases & Constraints

| Scenario | Handling |
|----------|----------|
| `maxSlots` > `globalMaxSlots` | Clamp to `globalMaxSlots`; warn on save |
| Group with 0 bookmarks | Render empty group with placeholder; still occupies its column span |
| Single group wider than `globalMaxSlots` | Treated as full-width row |
| Switching back to basic mode | Basic `bookmarks` array is untouched; advanced data persists in its own key |
| Very long group name | Truncate with ellipsis; tooltip on hover |
| `maxSlots = 1` | Single-column group; bookmarks stack vertically |
| Reorder groups via drag | Update `groups` array index order; re-render |
| Delete group with bookmarks | Confirm dialog; optionally move bookmarks to another group |

---

## 10. Non-Goals (out of scope for this implementation)

- Cloud sync / export-import of group config
- Nested groups
- Drag-and-drop reordering of individual bookmarks *between* groups (move-to-group via dropdown is sufficient)
- Custom per-slot sizes (size is group-level, not slot-level)
- Animated group resize / slot count change
