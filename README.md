# Stash

A local-first Chrome Manifest V3 visual bookmark, tab-session, Spaces, and link-collection workbench.

Everything stays on your device in `chrome.storage.local` (and optional local IndexedDB for opt-in visual page previews)—no accounts, no cloud servers, and no tracking.

## Highlights

- **Visual Workbench & Spaces:** Organize links into color-coded collections across Spaces (e.g., *General*, *Work*, *Shopping*), with instant switching (`1–9`), Grid or Details table view, and a Pinned Quick Launch strip.
- **Tab Session Manager:** Dockable Open Tabs rail with drag-to-stash, **Save Session**, **Save & Close**, and one-click **Wake Up** into native Chrome Tab Groups.
- **Shopping Lists & Price Tracking:** Mark items done/bought, toggle *Hide done*, edit specs/prices/quantities inline, see rolling Remaining vs. Total subtotals, automatic price-change badges, and 1-click Markdown list export.
- **Power Organization:** Live search (`/` or `Ctrl+K`) with match highlighting, Smart Filter Views (*Recently Added*, *Recently Opened*, *Untagged*), multi-select Bulk Action Bar (`Alt+Click` / `Shift+Click`), cross-Space Duplicate URL Finder, and Library Health Check.
- **Auto-Categorizer & Optional On-Device AI:** Fast local domain/keyword rules with optional Chrome built-in `LanguageModel` (Gemini Nano) suggestions that run strictly on-device.
- **Themes, Effects & Custom Sound Packs:** Built-in light/dark themes + Theme Studio + local wallpapers, customizable tactile motion/effects, 5 built-in Web Audio Sound Packs, and per-event custom audio clip uploads (`.mp3`, `.wav`, `.ogg`, `.webm`, `.m4a`).
- **Portable Backups & Importers:** Schema-versioned JSON Backup & Restore (Merge or Replace), optional Chrome Bookmarks importer, and standard Netscape HTML bookmark import.

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
