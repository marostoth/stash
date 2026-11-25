# Stash V1 — Product & Technical Specification

> **Product:** **Stash** — A fast, local-first, visual bookmark and tab-session manager built as a Chrome Manifest V3 extension.
> **Strategic Role:** Standalone Toby replacement for everyday browsing and sharing with friends, plus a clean schema-compatible feeder for future **Trace (ADOS)** imports.

---

## 1. Surfaces & Layout

### A. New Tab Page (`entrypoints/newtab/`) — "Links Only" Workbench
Replaces Chrome's New Tab with an instant-loading, uncluttered link workbench:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ [STASH]   🔍 Search links, tags, notes... (Ctrl+K)   [+ Collection] [⚙] │ ← Top Bar (~48px)
├─────────────────────────────────────────────────────┬───────────────────┤
│                                                     │ OPEN TABS (12)    │
│  ▼ 3D Printing              [Wake Up ↗] [•••]       │ [Save Session]    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐             │ [Save & Close]    │
│  │ Printabl │ │ Thangs   │ │ Voron    │             │ ───────────────── │
│  └──────────┘ └──────────┘ └──────────┘             │ ▪ GitHub - WXT    │
│                                                     │ ▪ Tailwind v4     │
│  ▼ Electronics              [Wake Up ↗] [•••]       │ ▪ YouTube - ...   │
│  ┌──────────┐ ┌──────────┐                          │ (Pinned tabs dim  │
│  │ DigiKey  │ │ ESP32    │                          │  & skipped by     │
│  └──────────┘ └──────────┘                          │  default)         │
└─────────────────────────────────────────────────────┴───────────────────┘
               Main Collections Grid                     Collapsible (~280px)
```

* **Top Bar (~48px):** Brand mark, instant live search input (`Ctrl+K` or `/` focuses search across titles, URLs, tags, and *"Why I saved this"* notes), quick **`+ New Collection`** button, **Theme quick-switcher**, **Open Tabs toggle**, and **Settings** button.
* **Main Collections Grid:** Collapsible collection sections displaying responsive grids of visual link cards. Collections can be collapsed/expanded and reordered via drag-and-drop.
* **Collapsible Open Tabs Sidebar (~280px, right edge):** Live list of tabs in the current browser window (`chrome.tabs`).
  * Drag any open tab directly onto any Collection (or into a specific slot inside a collection) to stash it.
  * Clicking a tab switches to it; hovering shows a quick-close `×` and 1-click stash button.
  * Pinned tabs appear subtly dimmed at the top with a pin icon and are **excluded** from batch saves by default (user-toggleable via a small checkbox: `Include pinned tabs`).
* **First-Run Empty State (Friend Onboarding):** When `collections.length === 0`, display a clean, welcoming empty state with two primary actions:
  1. **Import Chrome Bookmarks** (reads existing browser bookmarks via `chrome.bookmarks` API or HTML file upload).
  2. **Create First Collection** (plus an optional button to seed 3 starter collections like *Reading*, *Tools*, *Inspiration*).

### B. Chrome Native Side Panel (`entrypoints/sidepanel/`)
Opened via clicking the extension toolbar icon (`chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`). Stays docked beside any normal webpage:
* **Active Tab Quick-Stash Card (Pinned Top):** Automatically detects the current active tab's favicon, title, and URL.
  * Runs the **Auto-Categorizer** immediately and pre-highlights the suggested collection pill (Suggest & Confirm UX).
  * Optional 1-line *"Why I saved this"* note input and tag chips.
  * Press `Enter` or click **Stash Tab** to save in 1 click (with an optional small checkbox: `Close tab after saving`, default **unchecked**).
* **Compact Search & Collections List:** Search and open saved links or expand collections directly from the panel without opening a New Tab.

---

## 2. Core Workflows & Locked UX Edge Cases

### 1. Card Interaction & Quick Edit Modal
* **Click Card:** Opens the URL in a new tab (or current tab via Settings preference; default: new tab).
* **Drag Anywhere on Card:** Smooth `@dnd-kit/react` pointer drag with a lightweight GPU-accelerated tilted ghost overlay (`transform: translate3d(...)`, subtle 2–3° tilt). Supports reordering within a collection, moving between collections, and dropping open browser tabs from the sidebar.
* **Edit / Inspect (No Accidental Misclicks):** Clicking the subtle hover **Edit (pencil)** icon or **right-clicking** the card opens a compact **Quick Edit Modal** to edit Title, URL, *"Why I saved this"* note, Tags, and Collection assignment, or delete the link.
* **Link Card Visual Anatomy:** Site favicon (graceful monogram fallback if missing), crisp title (max 2 lines), subtle truncated domain in monospace, optional 1-line *"Why I saved this"* note preview, and muted tag pills.

### 2. Tab Sessions: Save vs. Save & Close, Pinned Tabs, Duplicates & Wake Up
* **Save Session (Default Primary Action):** Captures all non-pinned open tabs in the current window into a new dated collection (e.g., `Session — Nov 25, 14:30`) and **leaves all tabs open** so new users are never startled by vanishing tabs.
* **Save & Close (Secondary Explicit Action):** Clearly labeled button next to Save Session that saves the tabs and then closes them (keeping the Stash New Tab open).
* **Pinned Tab Protection:** Both session actions automatically skip `tab.pinned === true` tabs unless the user explicitly enables `Include pinned tabs`. Also skip internal `chrome://` and `chrome-extension://` tabs.
* **Duplicate URL Guard:** Normalize URLs lightly (strip trailing slash differences) when checking duplicates **within the same collection**. If a link already exists in the target collection, do NOT create a duplicate—highlight/pulse the existing card and show a brief toast (`Already in this collection`). Allow the same URL to exist in *different* collections.
* **Wake Up Collection (`Open All`):**
  * Default click: Opens all links in the collection inside a **new Chrome Tab Group** in the current window (`chrome.tabs.group` + `chrome.tabGroups.update` with the collection's title and matching tab-group color).
  * Secondary dropdown action: `Open in New Window`.

### 3. Auto-Categorization Engine (Tier 1 Rules + Tier 2 Chrome Gemini Nano)
Never silently hide a link in an unexpected folder. Always use **Suggest & Confirm**:
* **Tier 1 — Instant Local Rules (0ms, Always Available):** User-editable rules in Settings matching `domainContains` (e.g., `github.com`, `printables.com`) or `titleKeywords` (e.g., `ESP32`, `recipe`, `tutorial`) to a `targetCollectionId` and optional `defaultTags`. Evaluated first in priority order.
* **Tier 2 — Chrome On-Device AI (`LanguageModel` / Gemini Nano):** Runs only when no Tier 1 rule matches AND `LanguageModel.availability()` is `available` (or after the user clicks an opt-in **"Enable On-Device AI"** button in Settings if `downloadable`).
  * Passes only compact metadata: `{ url, title, existingCollections: [{ id, name }] }`.
  * Enforces strict JSON output via `responseConstraint`:
    ```json
    {
      "type": "object",
      "properties": {
        "collectionId": { "type": "string" },
        "suggestedNewCollection": { "type": "string" },
        "tags": { "type": "array", "items": { "type": "string" }, "maxItems": 3 },
        "summaryNote": { "type": "string", "maxLength": 100 }
      },
      "required": ["tags", "summaryNote"]
    }
    ```
  * Always destroys the session immediately after use.
* **Single-Tab vs. Batch UX:**
  * *Single Tab (Side Panel):* Pre-selects the suggested collection pill + fills tags/note; user presses `Enter` to confirm.
  * *Batch Session (`Auto-Triage` button on any Session collection):* Never pops up N separate modals. Opens a single **Triage Review Drawer/Modal** listing every tab with its suggested destination dropdown and a one-click **`Accept All`** button.

---

## 3. Winamp-Style Token Theme Engine

Themes are pure, JSON-serializable design-token objects applied via CSS custom properties (`data-theme` + Tailwind v4 `@theme inline`). Ship **3 built-in themes** in V1, architected so importing/exporting custom `.json` skins works cleanly in Settings:

| Theme ID | Name | Visual Feel | Key Tokens |
|---|---|---|---|
| `oscilloscope` *(Default)* | **Oscilloscope** | Matte hardware console (Cool Graphite + Oscilloscope Mint) | Canvas `#0E1013`, Panel `#15181D`, Card `#1D2128`, Border `rgba(255,255,255,0.08)`, Accent `#00D68F`, Text `#ECEFF4`, Muted `#8B949E`, Radius `6px` (crisp), Mono metadata font |
| `clean-dark` | **Clean Dark** | Neutral modern dark workspace | Canvas `#121316`, Panel `#181A1F`, Card `#22252C`, Border `rgba(255,255,255,0.09)`, Accent `#5E9EFF`, Text `#F2F4F8`, Muted `#9BA3B0`, Radius `10px` |
| `clean-light` | **Clean Light** | Crisp daylight workspace for friends who prefer light mode | Canvas `#F6F7F9`, Panel `#ECEFF3`, Card `#FFFFFF`, Border `rgba(15,23,42,0.10)`, Accent `#0F766E`, Text `#111827`, Muted `#64748B`, Radius `10px` |

* **Token Contract:** Every theme object defines: `id`, `name`, `isBuiltIn`, `mode` (`"dark" | "light"`), `colors` (`canvas`, `panel`, `card`, `cardHover`, `border`, `accent`, `accentFg`, `text`, `textMuted`, `danger`), `radius` (`card`, `control`, `pill`), and `fonts` (`sans`, `mono`).
* **Custom Theme Import/Export (Settings):** Users can export any theme as `.stash-theme.json` or import a valid theme JSON file to add a custom skin immediately.

---

## 4. Versioned JSON Data Schema (`schemaVersion: 1`)

Designed as the permanent **ADOS feeder contract**. Every entity uses a stable UUID (`crypto.randomUUID()`) and ISO-8601 timestamps so a Stash JSON backup imports directly into future ADOS without migration scripts.

### Storage Keys (WXT `storage.defineItem` in `local:`)
* `local:stash_collections` (`version: 1`) — `Collection[]`
* `local:stash_links` (`version: 1`) — `LinkItem[]`
* `local:stash_rules` (`version: 1`) — `CategorizationRule[]`
* `local:stash_settings` (`version: 1`) — `StashSettings`
* `local:stash_custom_themes` (`version: 1`) — `ThemeDefinition[]`

### TypeScript Interfaces (Canonical Contract)

```ts
export type TabGroupColor =
  | 'grey' | 'blue' | 'red' | 'yellow' | 'green'
  | 'pink' | 'purple' | 'cyan' | 'orange';

export interface Collection {
  id: string;                 // UUID
  name: string;
  description?: string;
  color: TabGroupColor;       // Maps directly to chrome.tabGroups color enum
  icon?: string;              // Optional Lucide icon key or emoji
  order: number;              // Display sort index
  collapsed: boolean;
  isSession?: boolean;        // True for quick-saved browser sessions
  createdAt: string;          // ISO-8601
  updatedAt: string;          // ISO-8601
}

export interface LinkItem {
  id: string;                 // UUID
  collectionId: string;       // Foreign key -> Collection.id
  url: string;
  title: string;
  note: string;               // "Why I saved this"
  tags: string[];             // Normalized lowercase tags
  faviconUrl?: string;
  order: number;              // Sort index inside its collection
  createdAt: string;          // ISO-8601
  updatedAt: string;          // ISO-8601
  lastOpenedAt?: string;      // ISO-8601
}

export interface CategorizationRule {
  id: string;                 // UUID
  name: string;
  enabled: boolean;
  priority: number;           // Lower number runs first
  match: {
    domainContains?: string[];  // e.g. ["printables.com", "thingiverse.com"]
    titleKeywords?: string[];   // e.g. ["esp32", "servo"]
    urlContains?: string[];
  };
  action: {
    targetCollectionId: string;
    addTags?: string[];
  };
}

export interface StashSettings {
  activeThemeId: string;               // Default: "oscilloscope"
  openLinkInNewTab: boolean;           // Default: true
  includePinnedInSessions: boolean;    // Default: false
  closeTabOnQuickStash: boolean;       // Default: false
  openTabsSidebarVisible: boolean;     // Default: true
  enableOnDeviceAi: boolean;           // Default: true (gracefully degrades if unavailable)
  density: 'compact' | 'comfortable';  // Default: "comfortable"
}

export interface StashExportBundle {
  app: 'stash';
  schemaVersion: 1;
  exportedAt: string;                  // ISO-8601
  collections: Collection[];
  links: LinkItem[];
  rules: CategorizationRule[];
  settings: StashSettings;
  customThemes: ThemeDefinition[];
}
```

### Backup, Restore & Bookmark Migration
* **Export JSON:** Downloads `stash-backup-YYYY-MM-DD.json` conforming strictly to `StashExportBundle`.
* **Import JSON:** Validates `schemaVersion === 1` and structure before offering **Merge (skip duplicate IDs/URLs)** or **Replace All**.
* **Import Bookmarks:**
  1. **Direct Chrome Bookmarks Import** (`chrome.bookmarks.getTree()`): Converts top-level bookmark folders into Stash Collections and preserves nested links.
  2. **Netscape HTML Bookmarks File Upload:** Parses standard exported `.html` bookmark files (Chrome, Edge, Firefox, Toby HTML exports).

---

## 5. Manifest Permissions (`wxt.config.ts`)
Keep permissions minimal and Chrome Web Store–friendly (no scary broad `<all_urls>` host permissions):
* `storage`
* `unlimitedStorage`
* `tabs`
* `tabGroups`
* `sidePanel`
* `bookmarks` *(optional permission requested on click via `chrome.permissions.request` when the user triggers Direct Chrome Bookmark Import, keeping install warnings minimal)*