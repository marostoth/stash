# Stash V1 — Phased Build Plan

Execute **one milestone at a time**. At the end of each milestone, run all four verification gates in `AGENTS.md`, stop, and wait for human confirmation after visual testing in Chrome.

## Milestone 1: WXT Scaffold, Quality Tooling, Theme Engine & Core Collections

**Goal:** A runnable Chrome New Tab extension displaying Stash's Links-Only workbench with working themes, collections, link cards, Quick Edit modal, first-run empty state, and automated lint/test gates wired from day one.

### Deliverables

1. Scaffold WXT (`0.21.5+`) project with React 19, TypeScript (`strict: true`), Tailwind CSS v4, `shadcn/ui`, and Zustand (`pnpm`).
2. Configure **Biome** (`pnpm add -D -E @biomejs/biome`, `biome.json` ignoring `.output/` and `.wxt/`, plus `check` and `check:fix` scripts) and **Vitest + `WxtVitest`** (`vitest.config.ts` using `wxt/testing/vitest-plugin`, plus `test` script).
3. Configure `wxt.config.ts` with Manifest V3 permissions (`storage`, `unlimitedStorage`, `tabs`, `tabGroups`, `sidePanel`) and `newtab` + `sidepanel` entrypoints.
4. Implement the **Token Theme Engine** (`src/lib/themes/`) with all 3 built-in themes (`oscilloscope` default, `clean-dark`, `clean-light`) and a live theme switcher in the Top Bar.
5. Implement `src/lib/storage/repo.ts` using WXT `storage.defineItem` (`local:` prefix, `version: 1`) matching `SPEC.md` Section 4 exactly, including the Duplicate URL Guard.
6. Build the New Tab layout: Top Bar (with working `Ctrl+K` / live search), First-Run Empty State (create collection or seed starter collections), collapsible Collections Grid, visual Link Cards, and the **Quick Edit Modal** (pencil icon + right-click).
7. Write Vitest unit tests (via `WxtVitest`) covering repository CRUD, storage defaults, and the Duplicate URL Guard.

### Automated Verification Gates

* `pnpm check` passes with zero Biome diagnostics.
* `pnpm exec tsc --noEmit` passes cleanly.
* `pnpm test` passes.
* `pnpm build` generates `.output/chrome-mv3`.

### Your Visual Check in Chrome

1. Open a new tab in the dev Chrome window launched by `pnpm dev` — confirm the dark **Oscilloscope** (Cool Graphite + Mint) empty state loads instantaneously.
2. Switch between **Oscilloscope**, **Clean Dark**, and **Clean Light** in the top bar and confirm colors and border radii update immediately.
3. Create 2 collections, manually add a few links with notes/tags, test searching with `Ctrl+K`, right-click a card to edit it in Quick Edit, and confirm adding the same URL twice to one collection is blocked cleanly.

## Milestone 2: Open Tabs Sidebar, Cross-Pane Drag-and-Drop & Tab Sessions

**Goal:** Turn Stash into a real daily-driver Toby replacement with live Open Tabs, smooth `@dnd-kit/react` dragging, Safe Session Saving, and Tab Group Wake-Up.

### Deliverables

1. Build the collapsible **Open Tabs Sidebar** synced live with `chrome.tabs` events (`onCreated`, `onRemoved`, `onUpdated`, `onMoved`), visually separating/dimming pinned tabs and filtering out `chrome://` / `chrome-extension://` URLs.
2. Wire **`@dnd-kit/react`** cross-pane drag-and-drop with a lightweight GPU-accelerated tilted ghost overlay:
   * Drag open tabs from the sidebar onto any Collection or specific card position.
   * Drag Link Cards to reorder within a collection or move between collections.
   * Drag Collections to reorder them vertically.
   * Persist order strictly in `onDragEnd`.
3. Implement **Save Session** (leaves tabs open) and **Save & Close** (saves then closes non-pinned tabs), plus the `Include pinned tabs` toggle (default off).
4. Implement **Wake Up Collection** (`Open All` into a named, color-matched Chrome Tab Group via `chrome.tabs.group` + `chrome.tabGroups.update`, plus `Open in New Window` in the collection menu).
5. Write Vitest unit tests for pure session tab-filtering logic (excluding `chrome://` / `chrome-extension://` tabs, skipping pinned tabs by default, and including pinned tabs when enabled) and order-recalculation helpers.

### Automated Verification Gates

* `pnpm check`, `pnpm exec tsc --noEmit`, `pnpm test`, and `pnpm build` all pass cleanly.

### Your Visual Check in Chrome

1. Open 5–6 normal websites plus 1 pinned tab, then open a Stash New Tab.
2. Drag an open tab from the right sidebar onto a collection — verify smooth card motion and instant save.
3. Drag cards between collections and reorder them; reload the tab and confirm the new order persists.
4. Click **Save Session** — verify a dated session collection appears while your tabs remain open and your pinned tab was skipped.
5. Close a few tabs and click **Wake Up** on a collection — verify Chrome opens them neatly inside a colored Tab Group.

## Milestone 3: Chrome Native Side Panel & 2-Tier Auto-Categorizer

**Goal:** Enable 1-click stashing from any website via Chrome's Side Panel, backed by instant Tier 1 local rules and optional on-device Gemini Nano (`LanguageModel`).

### Deliverables

1. Build the **Chrome Side Panel** (`entrypoints/sidepanel/`) configured to open on toolbar icon click:
   * Active Tab Quick-Stash card with pre-selected suggested collection pill, *"Why I saved this"* note, tags, `Enter` to save, and `Close tab after saving` toggle (default off).
   * Compact live search and browsable collections list synced automatically with the New Tab page via WXT storage `watch()`.
2. Implement **Tier 1 Local Rules Engine** (`src/lib/categorizer/rules-engine.ts`) with full CRUD UI in Settings (match domain/title/URL keywords → target collection + tags).
3. Implement **Tier 2 Chrome Prompt API Adapter** (`src/lib/categorizer/nano-engine.ts`) using `LanguageModel.availability()`, user-gesture-safe `create()` with download progress feedback, strict `responseConstraint` JSON Schema, and `finally { session.destroy() }`. Must degrade silently to Tier 1 if unavailable.
4. Add **Auto-Triage** button on Session collections opening a single batch review modal with per-tab collection dropdowns and one-click **`Accept All`**.
5. Write Vitest unit tests covering Tier 1 rule matching, priority order, disabled rules, and mocked Tier 2 `LanguageModel` unavailable/error graceful fallback.

### Automated Verification Gates

* `pnpm check`, `pnpm exec tsc --noEmit`, `pnpm test`, and `pnpm build` all pass cleanly.

### Your Visual Check in Chrome

1. Browse to any normal site (e.g., GitHub or YouTube), click the Stash toolbar icon, and verify the Chrome Side Panel slides open beside the page.
2. Add a Tier 1 rule in Settings (e.g., `github.com` → `Dev`), visit a GitHub page, open the Side Panel, and verify `Dev` is pre-highlighted so pressing `Enter` saves it immediately.
3. Open a New Tab and verify the link saved from the Side Panel appears instantly without refreshing.
4. Run **Auto-Triage** on a saved session and confirm the single batch review modal lets you accept all suggestions cleanly.

## Milestone 4: Backup/Restore, Bookmark Importers, Custom Themes & Store Packaging

**Goal:** Make Stash safe for daily use, easy to onboard your friend, and ready for an Unlisted Chrome Web Store upload.

### Deliverables

1. Implement **JSON Backup & Restore** (`StashExportBundle` `schemaVersion: 1`) in Settings with schema validation and **Merge vs. Replace** import modes.
2. Implement **Bookmark Importers** (accessible both in Settings and the First-Run Empty State):
   * Direct Chrome Bookmarks importer (requesting optional `bookmarks` permission on click).
   * Standard Netscape HTML bookmarks file importer (`.html` upload).
3. Implement **Custom Theme Import / Export** (`.stash-theme.json`) in Settings with validation so custom Winamp-style token skins can be shared and loaded safely.
4. Polish keyboard shortcuts (`Ctrl+K`, `/`, `Esc`), visual density toggle (`comfortable` / `compact`), performance check with 200+ seeded mock links (smooth 60fps drag), and clean extension icons (16/32/48/128px).
5. Write Vitest unit tests covering `StashExportBundle` validation, Merge vs. Replace restore logic, Netscape HTML bookmark parsing, and `.stash-theme.json` schema validation.
6. Verify production Chrome Web Store zip packaging via `pnpm exec wxt zip`.

### Automated Verification Gates

* `pnpm check`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`, and `pnpm exec wxt zip` all succeed with zero errors or manifest warnings.

### Your Visual Check in Chrome

1. Export a JSON backup, clear storage or load a fresh profile, and re-import the backup — confirm all collections, links, rules, and theme settings restore identically.
2. Test importing your existing Chrome bookmarks (or a small `.html` bookmark export) from the Empty State.
3. Export a theme JSON, tweak the accent hex color, re-import it as a custom theme, and verify it applies live.
4. Confirm `.output/stash-*-chrome.zip` is generated and ready for Unlisted upload to the Chrome Web Store.

---

## Active Feature Roadmap (v1.17.0 – v1.20.0)

### v1.17.0 — Effects Studio, Perimeter Shockwaves & Tactile Animations (Shipped)
- Dedicated **Settings → Effects** page with Live Impact Preview Stage, Volume Slider (`0%–100%`), Foley Soundboard, and 4 Fine-Tune Physics toggles (`fxDeskJolt`, `fxDragTilt`, `fxHoverSheen`, `fxAmbientWaves`).
- Underneath perimeter dust shockwave (`Neutral Dust + Accent Ring` and `Full Accent Glow`), heavy tile slam, louder layered Web Audio foley with compressor bus, radial neighbor desk jolt, hover tilt sheen, star pop shimmer burst, delete vaporize, magnetic drop-zone breathing, Wake Up ignition wave, Save Session deck sweep, Space pill `+1` swallow, directional Space slide, Quick Stash vault stamp, and rolling odometer totals.

### Milestone A (v1.18.0) — Effects Studio 2.0: Sound Packs & Tactile Polish (Shipped)
- [x] **5 Synthesized Web Audio Sound Packs** (`arpg-heavy` *Heavy Stone & Iron*, `studio-desk`, `mechanical-thock`, `retro-synth`, `glass-ceramic`) powered by a Cinematic DSP bus (soft-clipping `WaveShaperNode`, stereo dark-hall `ConvolverNode`, stereo panning, brown noise, and 2-op FM synthesis).
- [x] **Gliding Keyboard Spotlight:** Smooth `layoutId` focus frame sliding directly between cards during keyboard navigation.
- [x] **Arcade Drag Trail:** Subtle glowing trailing echoes following the dragged card/tab ghost in Arcade mode.
- [x] **Accordion Deal & Search Match Highlight:** Smooth diagonal card-deal fan on manual collection expand + highlighted matching text snippets with subtle pop when searching.

### Milestone B (v1.19.0) — Shopping Lists Pro & Checkboxes (Shipped)
- [x] **Checked / Bought ✓ Mode** on links (works in Details view + Grid cards for both Shopping Lists and Study/Watch lists, with animated checkmark + per-Space *Hide checked* toggle).
- [x] **Live Remaining Total Odometer:** Checking off items smoothly rolls down the remaining subtotal & Space total (showing Remaining vs Total when items are checked).
- [x] **Automatic Price Change Badges:** Save `previousPrice` whenever a price is updated or re-captured from the Side Panel and display green `↓ £X.XX` / red `↑ £X.XX` badges.
- [x] **1-Click Copy Shopping List:** Clean formatted text/Markdown copy button on collections and Space Details footer (items, store, qty, price, subtotals, grand total).

### Milestone C (v1.20.0) — Power Workbench (Shipped)
- [x] **Multi-Select Bulk Bar:** `Alt+Click` / `Shift+Click` cards/rows to select multiple links, springing up a floating bottom bar for Bulk Move, Tag, Star, Done, Open Tabs, and Delete with Undo.
- [x] **Pinned Quick Launch Strip:** Compact favicon dock right below the Space bar for 1-click launch of pinned or starred daily sites, with inline `+ Pin` search popover and Settings toggle.
- [x] **Smart Filter Views & Cross-Space Duplicate Finder:** Top Bar **Views** dropdown (*Recently Added 7d*, *Recently Opened*, *Untagged*) + 1-click cross-Space duplicate URL scanner inside *Settings → Library Tools*.

### Milestone D (v1.21.0) — Custom Audio Pack Uploader & Dedicated Sounds Settings (Shipped)
- [x] **Custom Audio Pack (`.mp3` / `.wav` / `.ogg` per-event clips):** Upload your own sound files for any of the 7 events (`Drop Slam`, `Pickup`, `Star / Tag`, `Session Lock`, `Hover Riffle`, `Delete`, `Blocked`) stored locally via WXT storage, decoded into an instant 0ms `AudioBuffer` cache, routed through the shared master Volume + soft limiter with subtle ±3.5% pitch jitter, and automatic fallback to your active Sound Pack for unfilled slots.
- [x] **Dedicated Settings → Sounds Page:** Split **Sounds** (Sound Packs, Volume, Audition Soundboard, and Custom Audio Clips) into its own Settings tab separate from visual **Effects**.
