# Stash — Master Architecture Blueprint (v1.28.0)

**Product Identity:** Local-first Chrome Manifest V3 extension replacing the New Tab page with a tactile, studio-grade bookmark and open-tab workbench, paired with a docked Side Panel companion. Published publicly on the Chrome Web Store (`dplechafagddelmdjcgliojekehbdkdc`) as a free, non-trader project with zero backend, zero cloud accounts, and zero telemetry.

---

## 1. Tech Stack, Surfaces & Manifest

* **Core Stack:** WXT `^0.21.5` (MV3, `srcDir: 'src'`), React 19, TypeScript (`strict: true`, zero explicit `any`), Tailwind CSS v4 (`@tailwindcss/vite`), Radix/shadcn primitives, Motion (`motion/react`), `@dnd-kit/react`, Zustand (transient UI state only), Biome `2.6.8`, Vitest `5.1.1` + `WxtVitest`.
* **Entrypoints (`src/entrypoints/`):**
  * `background.ts` — MV3 service worker (context menus, `s <query>` Omnibox search, keyboard commands, preview capture messaging).
  * `newtab/` — Primary full-board workbench overriding Chrome's New Tab page.
  * `sidepanel/` — Docked pocket workbench triggered via toolbar icon or `Alt+Shift+S`.
* **Keyboard Commands & Omnibox (`wxt.config.ts`):**
  * Omnibox keyword: `s <query>`
  * `open-stash-sidepanel`: `Alt+Shift+S`
  * `quick-stash-active-tab`: `Alt+Shift+D`

| Permission Tier | Keys | Purpose / Disclosure Scope |
| :--- | :--- | :--- |
| **Required** | `storage`, `unlimitedStorage`, `tabs`, `tabGroups`, `sidePanel`, `contextMenus` | Local library persistence, Open Tabs sidebar & session capture, "Wake Up" named Chrome Tab Groups, Side Panel companion, right-click stashing. |
| **Optional** | `bookmarks`, `scripting` | User-initiated Chrome Bookmarks import; Side Panel active-tab product metadata extraction. |
| **Optional Host** | `https://*/*`, `http://*/*` | Requested only for three opt-in features: **Visual Previews**, **Library Health Check**, and **Product Extraction**. |

---

## 2. Module Map (`src/`)

* **`src/components/workbench/`** — Board surface (`workbench.tsx`, `space-bar.tsx`, `space-bar-controls.tsx`, `space-bar-popovers.tsx`, `collection-section.tsx`, `link-card.tsx`, `card-foil-wrapper.tsx`, `details-view.tsx`, `details-collection-section.tsx`, `details-store-section.tsx`, `details-row.tsx`, `open-tabs-sidebar.tsx`, `open-tab-row.tsx`, `open-tabs-bridge.tsx`, `dnd-blur-guard.tsx`, `workbench-skeleton.tsx`, `bulk-action-bar.tsx`, `triage-modal.tsx`, `quick-edit-modal.tsx`, `wallpaper-layer.tsx`).
* **`src/components/settings/`** — 3 navigation groups across 8 tabs: *Preferences* (`General`, `Shortcuts`), *Look & Feel* (`Appearance`, `Effects`, `Sounds`), *Library & Data* (`AI & Rules`, `Library Tools`, `Backup & Import`), plus live Gemini Nano availability status.
* **`src/components/sidepanel/`** — Docked pocket workbench (`side-panel-app.tsx`, `side-panel-header.tsx` *(new)*, `side-panel-space-bar.tsx`, `side-panel-collection-list.tsx`, `side-panel-link-row.tsx` *(new)*, `quick-stash-card.tsx`, `quick-stash-collection-picker.tsx`, `quick-stash-chips.tsx` *(new)*, `quick-stash-product-panel.tsx`).
* **`src/components/reorganize/`, `health/`, `themes/`, `ui/`** — Multi-step Smart Reorganize wizard (`reorganize-undo-toast.ts`), Link Health Check UI, `ThemeStudio.tsx`, `vfx-canvas.tsx`, Radix primitives, `odometer-counter.tsx`, `rolling-currency.tsx`, and `error-boundary.tsx`.
* **`src/hooks/`** — Data & workflow orchestration (`use-stash-data.ts`, `use-workbench-dnd.ts`, `use-workbench-shortcuts.ts`, `use-container-shake.ts`, `use-card-foil-tilt.ts`, `use-open-tabs.ts`, `use-active-tab.ts`, `use-quick-stash-categorizer.ts`, `use-quick-stash-product.ts`, `use-reorganize-workflow.ts`, `use-triage-workflow.ts`, `use-auto-tag-sweep.ts`, `use-health-scan.ts`).
* **`src/store/`** — Ephemeral Zustand stores only (`ui-store.ts`, `selection-store.ts`, `fx-store.ts`, `background-jobs-store.ts`, `open-tabs-store.ts`). Never used as durable storage.
* **`src/lib/`** — Domain logic & engines:
  * `storage/` — Single repository boundary (`repo.ts`, `items.ts`, `storage-lock.ts`, `spaces-ops.ts`, `collections-ops.ts`, `links-ops.ts`, `links-batch-ops.ts`, `rules-ops.ts`, `trash-ops.ts`, `delete-undo-ops.ts`, `reorganize-ops.ts`, `backup-ops.ts`).
  * `vfx/` — 2D `<canvas>` impact & fracture engine (`engine.ts`, `types.ts`, `math.ts`, `sprites.ts`, `primitives.ts`, `packs/iron-ember.ts`, `packs/fissures.ts`).
  * `audio/` — Procedural Web Audio engine (`foley.ts`, `audio-bus.ts`, `audio-math.ts`, `audio-synth.ts`, `combo.ts`, `sound-packs*.ts`, `custom-sfx-store.ts`, `custom-sfx-player.ts`).
  * `dnd/` — DnD types & DOM reconciliation (`types.ts`, `reconcile-dom.ts`).
  * `import-export/` — JSON bundle (`bundle.ts`, `bundle-parsers.ts`), Netscape HTML import/export, Chrome Bookmarks importer, Panic backup, and external AI prompt generator (`ai-audit-prompt.ts`).
  * Feature modules: `categorizer/`, `reorganize/`, `tagging/`, `icons/`, `health/`, `product/`, `previews/`, `tabs/`, `themes/`, `motion/`, `background/`, `shortcuts/`, `types/`, `utils/`.

---

## 3. Data Schema, Persistence & Safety Invariants

### Schema Contract (`src/lib/types/stash.ts`, `schemaVersion: 1`)
* **Timestamps:** Every timestamp across the entire schema (`exportedAt`, `createdAt`, `updatedAt`, `lastOpenedAt`, `capturedAt`) is an **ISO-8601 `string`** (`new Date().toISOString()`).
* **Backup Envelope:** `app: 'stash'`, `schemaVersion: 1`, `exportedAt`, `spaces`, `collections`, `links`, `rules`, `settings`, `customThemes`.
* **Core Entities:**
  * `Space`: `id`, `name`, `icon?`, `order`, `densityOverride?`, `viewMode?` (`grid|details`), `groupBy?` (`collection|store` — labeled `Collection | Retailer` in the UI), `hideChecked?` (Space-scoped, not per-collection), `createdAt`, `updatedAt`.
  * `Collection`: `id`, `name`, `description?`, `color` (`TabGroupColor`), `tintColor?`, `icon?`, `viewMode?` (`compact|cover`), `sortMode?`, `spaceId?`, `order`, `collapsed`, `isSession?`, `isAutoInbox?`, `createdAt`, `updatedAt`.
  * `LinkItem`: `id`, `collectionId`, `url`, `title`, `note`, `tags[]` (lowercase kebab-case, no leading `#`), `tagsLocked?`, `starred?`, `checked?`, `pinnedToDock?`, `product?`, `faviconUrl?`, `order`, `createdAt`, `updatedAt`, `lastOpenedAt?`.
  * `ProductMeta`: `store?`, `price?`, `previousPrice?`, `currency?`, `priceIsEstimate?`, `spec?`, `orderQty?`, `source` (`extracted|ai|manual`), `capturedAt?`.
  * `CategorizationRule`: `id`, `name`, `enabled`, `priority`, `match` (`domainContains?`, `titleKeywords?`, `urlContains?`), `action` (`targetCollectionId`, `addTags?`).
  * `ThemeDefinition`: `id`, `name`, `isBuiltIn`, `mode` (`dark|light`), `colors`, `radius`, `fonts`, `cardRadius?`, `backdropStyle?`.
  * `TrashEntry`: 7-day auto-purged discriminated union (`kind: 'link' | 'collection'`) carrying full restore payloads.
* **Deprecated / Back-Compat Fields (`@deprecated` in `stash.ts`):**
  * `StashSettings.dropEffectStyle` — retained only for parsing pre-v1.27.0 backups; active UI uses independent `fxDropDust` and `fxDropFissures` toggles.
  * `StashSettings.customThemes` — retained only for back-compat parsing; authoritative custom themes live in `local:stash_custom_themes` and top-level `bundle.customThemes`.

### Storage Split (Backed Up vs. Device-Only)
All durable extension storage uses `chrome.storage.local` via WXT `storage.defineItem(..., { version: 1 })` or IndexedDB. **`chrome.storage.sync` is strictly forbidden.**

| Store | Storage Keys / Databases | Included in JSON Backup? |
| :--- | :--- | :--- |
| **`chrome.storage.local`** | `local:stash_spaces`, `local:stash_collections`, `local:stash_links`, `local:stash_rules`, `local:stash_settings`, `local:stash_custom_themes` | **Yes** (core library bundle) |
| **`chrome.storage.local`** | `local:stash_active_space_id`, `local:stash_trash`, `local:stash_custom_sfx` | **No** (device-local state & audio blobs) |
| **IndexedDB** | `stash_preview_cache` (`previews`, max 200 LRU); `stash_wallpaper_db` (`wallpapers`, auto-scaled `<= 2560px`) | **No** (device-local media caches) |

### Persistence & Security Invariants
* **Cross-Tab Serialization:** `withStorageLock` (`storage-lock.ts`) serializes all read-modify-write cycles via Web Locks (`navigator.locks`, with an in-process promise queue fallback) and commits multi-key updates atomically via `storage.setItems`.
* **URL & Favicon Sanitization:** `isSafeHttpUrl`, `toSafeHref`, and `sanitizeFaviconUrl` (`src/lib/utils/url.ts`) strictly enforce `http:`/`https:` across both UI rendering and backup imports—blocking `javascript:` and `data:` injection.
* **Destructive Safety:** `isLikelyTruncatedBackup` warns on **Replace All** when an imported JSON drops a major share of links (guarding against LLM truncation); Undo actions are double-click locked (`delete-undo-ops.ts`); Trash operations are busy-locked with two-step arming on **Empty Trash**; Smart Reorganize Undo is strictly Space-scoped.

---

## 4. Core UI, Interaction & Engine Architecture

* **Space Bar (`space-bar.tsx`, `space-bar-controls.tsx`):** Sticky inside `<main>` aligned to the card container (`px-5 sm:px-8`). Left side renders Space switcher pills (`1–9`) and `+ New Space`. Right side renders single-click inline controls (`Grid | Details`, contextual `Collection | Retailer` in Details mode only, contextual `Hide done` when checked items exist, and one-click `Collapse / Expand all`). Board strip toggles (`quickLaunchVisible`, `tagBarVisible`) live exclusively in Settings → General (`view-options-popover.tsx` was permanently removed in v1.27.0).
* **Chrome Side Panel (`src/components/sidepanel/`):** Machined Dark Console / Theme Studio pocket companion built strictly with `--stash-*` tokens (zero hardcoded hex colors) and responsive down to Chrome's `320px` minimum width:
  * **Header & Single-CTA Discipline (`side-panel-header.tsx`):** Unified subtle/ghost controls (`Collection` inline slide-down creator, `Capture` subtly highlighted only while expanded, and `Board`) compact cleanly at `320px`, leaving **`Stash Tab`** as the sole solid high-contrast accent CTA.
  * **Progressive-Disclosure Quick Stash (`quick-stash-card.tsx`, `quick-stash-collection-picker.tsx`, `quick-stash-chips.tsx`, `quick-stash-product-panel.tsx`):** Collapses to a slim single-line status strip on non-stashable (`chrome://` / New Tab) pages so the saved library fills the panel immediately. On webpages, shows a recessed `32×32` favicon Hero row with an "Already stashed" badge and top-right icon-only `Star` toggle, a custom Radix DropdownMenu collection picker (colored icons/dots, Space grouping, inline `+ New collection`), a promoted **`Detect Price`** secondary CTA, and collapsed-by-default summary chips (`Product & Price` with segmented currency & `Qty` stepper, `Tags`, `Note`) plus `Alt+Shift+D` tooltip on `Stash Tab`.
  * **Library List & Shopping Ergonomics (`side-panel-app.tsx`, `side-panel-collection-list.tsx`, `side-panel-link-row.tsx`, `smooth-collapse.tsx`):** Search row pairs live search (`/`, `Ctrl+K`), Starred filter, and a one-click **`Collapse / Expand all`** toggle. Collections render `color-mix()` tinted collapsible headers with live `font-mono tabular-nums` shopping subtotals (accounting for `orderQty`) and hover-revealed `Wake Up`, while `SmoothCollapse` (`grid-cols-[minmax(0,1fr)]` + `min-w-0`) and `min-w-0` / `overflow-hidden` mini-cards keep long titles truncated cleanly and right-aligned tabular price / price-drop pills fully visible at `320px`.
* **Theming (`theme-engine.ts`, `globals.css`):** 12 built-in themes + custom Theme Studio with WCAG contrast checks. Sets `data-theme`, `data-theme-mode`, `data-backdrop`, `color-scheme`, and `--stash-*` CSS variables on `document.documentElement`—including mode-aware `--stash-warning` (`#B45309` light / `#FBBF24` dark). Skips cold-boot cross-fades and suppresses transitions when `motionMode === 'off'`.
* **Motion Tiers (`src/lib/motion/presets.ts`, `animations.css`):**

| Tier | Behavior |
| :--- | :--- |
| `off` | Hard CSS lock (`html[data-motion="off"] * { animation: none; transition-duration: 0ms }`), `<MotionConfig transition={{ duration: 0 }}>`, instant scrolling, `<VfxCanvas>` unmounted. |
| `reduced` | Honors OS `prefers-reduced-motion`, disables decorative animations and wake waves, uses instant scrolling. |
| `tactile` | Crisp springs, 1px inset rim-light drop flashes, card foil tilt (cached `DOMRect` in `card-foil-wrapper.tsx`), `<VfxCanvas>` unmounted. |
| `arcade` | Mounts fixed `<VfxCanvas>`, vertical container punch (`use-container-shake.ts`), lockstep audio + impact VFX on first painted frame, combo pitch scaling, vacuum-implosion delete. |

* **`VfxCanvas` Engine (`src/lib/vfx/`):** Fixed DPR-scaled HTML5 2D canvas running a single `requestAnimationFrame` loop across two depth passes—`'floor'` (ground cracks/fissures, dust clouds, perimeter shockwaves) and `'air'` (sparks, vapor puffs). Ground fractures collect `excludeRects` from `[data-vfx-occluder="true"]` elements (`LinkCard`, `DetailsRow`, Settings preview cards) using rounded `evenodd` clipping so cracks travel across gutters and duck cleanly underneath sibling cards while sparks fly over top. Independent toggles: `fxDropDust` (Impact Shockwave) and `fxDropFissures` (Ground Fracture).
* **Procedural Web Audio (`src/lib/audio/`):** 5 synthesized foley packs (`arpg-heavy`, `studio-desk`, `mechanical-thock`, `retro-synth`, `glass-ceramic`) plus optional custom audio clips (`custom-sfx-player.ts`). Runs through a squared perceptual volume curve (`audio-math.ts`), 35Hz highpass + soft-limiter master bus (`audio-bus.ts`), voice choking with `gate.disconnect()` + `onended` cleanup, suspended `AudioContext` gating (preventing fresh-tab hover audio blasts), and deduplicated cold decodes.
* **Drag & Drop Invariant (`@dnd-kit/react`, `use-workbench-dnd.ts`, `reconcile-dom.ts`):**
  * **Critical DOM rule:** `<LinkCard>` must render directly as a CSS grid child with its sortable ref attached to an outer plain `<div>`—**never** wrapped in an intermediate keyed `<div>`, which breaks `@dnd-kit/dom`'s `OptimisticSortingPlugin` and causes stuck inline heights / row stretching.
  * Synchronous optimistic reconciliation on `onDragEnd`, Space-scoped collection ordering, `hideChecked` visible-to-full index mapping, silent outside-zone drops, and `dnd-blur-guard.tsx` cancelling active drags on `window` blur, `visibilitychange`, or capture-phase `Escape`.
* **Keyboard & Layer Guards (`use-workbench-shortcuts.ts`):** Capture-phase `Escape` unwinds popovers and active drags first; global shortcuts (`/`, `Ctrl+K`, `1–9`, arrow navigation) yield to open modals/dialogs, editable inputs, and `event.defaultPrevented`.

---

## 5. AI Architecture

* **On-Device Gemini Nano (`src/lib/categorizer/nano-engine.ts`):** Strictly feature-detected (`typeof LanguageModel !== 'undefined'`), checked via `LanguageModel.availability(...)`, pre-warmed only via explicit user gesture (`nano-prewarm.ts`), always calls `session.destroy()` in `finally`, and falls back silently to Tier 1 local rules. Powers six features: Tier 2 Auto-Categorizer, Auto-Tagging (on-save & background sweep), Smart Reorganize Wizard (Space-scoped with Undo), AI Collection Icon Picker, Health Check Tie-Breaker, and Product Title Cleanup.
* **External AI Backup Prompt Generator (`src/lib/import-export/ai-audit-prompt.ts`):** Generates live-interpolated **Audit & Upgrade** and **Reorganize — Keep 100%** prompts in Settings → Backup & Import using runtime library counts, Space IDs, and valid `color`/`icon` catalogs. Both share `buildStep2BackupContract(...)`, enforcing `schemaVersion: 1`, ISO-8601 timestamps, Integrity Check headers, anti-truncation rules, blanket field preservation, `http(s)://` URLs, functional query-parameter protection, and `product` metadata guards.

---

## 6. Future Integration Seam (ADOS & External Handoffs)

Stash v1.28.0 remains strictly local-only and standalone for Chrome Web Store simplicity, while preserving clean structural seams so an opt-in **ADOS** (or generic webhook/external-app) bridge can be added later without refactoring the core:

* **Preserved Data Primitives:** Keep stable UUID `id`s on Spaces, Collections, and Links, ISO-8601 timestamps, structured `tags`/`note`/`product` fields, and `src/lib/storage/repo.ts` as the single mutation boundary.
* **Planned Additive Architecture (Future Release):**
  * Add `src/lib/integrations/` defining a versioned outbound link payload (`id`, `url`, `title`, `note`, `tags`, `collectionName`, `spaceName`, `product`, `createdAt`, `source: 'stash'`).
  * Execute outbound `fetch` calls from `background.ts` (to an HTTPS ADOS endpoint or local `http://localhost:PORT` server) so handoffs survive closing the New Tab or Side Panel.
  * Keep custom-scheme launchers (`ados://`) isolated in the outbound integration module—never weaken `isSafeHttpUrl` for bookmark rendering.
  * Expose the connector as an **opt-in Settings → Connections** feature (off by default, framed as a generic Webhook / External Handoff connector with an ADOS preset) with optional `LinkItem.externalRefs?: { adosId?: string; syncedAt?: string }` tracking.
* **Policy Gate:** Any release enabling outbound network handoffs must simultaneously update `AGENTS.md` (allowing opt-in export connectors), `PRIVACY.md`, and Chrome Web Store Privacy Practices to disclose user-initiated transmission over HTTPS/local endpoints.

---

## 7. Guardrails, Health & Tech Debt Watchlist

* **Repo Rules (`AGENTS.md`):** WXT imports via `#imports` or `wxt/utils/storage`; all storage keys prefixed `local:`; all persistence behind `repo.ts`; zero `chrome.storage.sync`, `dangerouslySetInnerHTML`, or `eval`; **300-line soft target / 500-line hard cap** per non-test, non-preset file; four mandatory verification gates before shipping (`pnpm check`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`).
* **v1.28.0 Health Snapshot:** **43 Vitest suites / 204 tests passing**, 266 Biome files clean (0 errors/warnings), 0 TypeScript errors, 0 `TODO`/`FIXME`/`HACK` comments, **1.51 MB** unpacked build / **454.58 kB** Chrome Web Store `.zip` (`stash-1.28.0-chrome.zip`). All modified Side Panel files remain within the 500-line hard ceiling (`quick-stash-card.tsx` 487, `side-panel-app.tsx` 389, `quick-stash-collection-picker.tsx` 367, `quick-stash-chips.tsx` 328, `side-panel-collection-list.tsx` 304, `quick-stash-product-panel.tsx` 243, `side-panel-link-row.tsx` 213, `side-panel-header.tsx` 208, `side-panel-space-bar.tsx` 113).
* **v1.29+ Tech Debt Watchlist:**
  * **File-size cliff:** `src/hooks/use-reorganize-workflow.ts` (**496 lines**), `src/components/workbench/workbench.tsx` (**491 lines**), and `src/components/sidepanel/quick-stash-card.tsx` (**487 lines**) sit immediately beneath the 500-line hard cap. Extract a focused sub-hook / sub-component from any of them *before* adding new features.
  * **Modular VFX packs:** New opt-in Arcade packs (e.g., playful drop animations or Easter-egg packs) should plug exclusively into `src/lib/vfx/packs/` via `VfxCanvas` without introducing layout delays or touching `@dnd-kit` drop timing.