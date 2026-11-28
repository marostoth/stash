# Stash

A local-first Chrome Manifest V3 visual bookmark, tab-session, Spaces, and link-collection workbench.

Everything stays on your device in `chrome.storage.local` (and optional local IndexedDB for opt-in visual page previews)—no accounts, no cloud servers, and no tracking.

## Highlights

- **Visual Workbench & Spaces:** Organize links into color-coded collections across Spaces (e.g., *Main*, *Work*, *Shopping*), with instant switching (`1–9`), one-click inline Grid/Details, Collection/Retailer grouping, and Collapse/Expand All controls on the Space bar, per-collection sorting (*Manual*, *A–Z*, *Newest*, *Opened*, *Price*), a toggleable Quick Links strip, and clickable `#tag` filter bar.
- **Tab Session Manager & Pocket Side Panel:** Dockable Open Tabs rail with drag-to-stash, **Save Session**, **Save & Close**, and one-click **Wake Up** into native Chrome Tab Groups—plus an upgraded Chrome Side Panel (`Alt+Shift+S`) with Space switching, live search, quick actions, and collapsible one-click capture.
- **Shopping Lists & Price Tracking:** Mark items done/bought, toggle *Hide done*, edit specs/prices/quantities inline, see rolling Remaining vs. Total subtotals, automatic price-change badges, and 1-click Markdown list export.
- **Power Organization & Safety:** Live search (`/` or `Ctrl+K`) with match highlighting, Smart Filter Views (*Recently Added*, *Recently Opened*, *Untagged*), multi-select Bulk Action Bar (`Alt+Click` / `Shift+Click`), cross-Space Duplicate URL Finder, Library Health Check, and a **7-day Recently Deleted Trash** with Undo countdowns.
- **Auto-Categorizer & Optional On-Device AI:** Fast local domain/keyword rules with optional Chrome built-in `LanguageModel` (Gemini Nano) suggestions that run strictly on-device.
- **12 Curated Themes, Effects & Custom Sound Packs:** 12 contrast-tested built-in themes with live hover preview & smooth cross-fade + Theme Studio + local wallpapers, a 2D Canvas Arcade VFX engine with independently toggleable Impact Shockwave, Ground Fracture (with neighbor card occlusion), and vacuum-implosion delete, 5 built-in Web Audio Sound Packs, and per-event custom audio clip uploads (`.mp3`, `.wav`, `.ogg`, `.webm`, `.m4a`).
- **Portable Backups & Importers:** Schema-versioned JSON Backup & Restore (Merge or Replace) with built-in external AI Audit & Reorganize prompt templates and truncation checks, standard Netscape HTML bookmark export & import, and optional Chrome Bookmarks importer.

## Privacy

Stash makes zero developer-server requests and collects zero telemetry. See [PRIVACY.md](./PRIVACY.md) for the full breakdown of permissions and local storage.

## Development

Requires **Node.js >= 22** and **pnpm**.

```bash
pnpm install
pnpm dev          # Start WXT dev server for Chrome MV3
pnpm check        # Biome lint & formatting check
pnpm exec tsc --noEmit
pnpm test         # Run Vitest unit test suite
pnpm build        # Build production bundle into .output/chrome-mv3
pnpm zip          # Package Chrome Web Store zip into .output/
```

Load `.output/chrome-mv3` as an unpacked extension at `chrome://extensions` (with **Developer mode** enabled).
