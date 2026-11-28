# Stash — Chrome Web Store Submission Kit

Ready-to-paste copy, permission justifications, and privacy answers for publishing **Stash** on the Chrome Web Store.

---

## 1. Store Listing Basics

- **Extension Name:** `Stash — Visual Bookmarks & Tab Sessions`
- **Short Summary (126 / 132 chars):**
  > Local-first visual bookmark workbench, Spaces, shopping lists, and tab-session manager for Chrome. Zero accounts, zero tracking.
- **Category:** `Productivity`
- **Language:** `English`
- **Homepage URL:** `https://github.com/marostoth/stash`
- **Privacy Policy URL:** `https://github.com/marostoth/stash/blob/master/PRIVACY.md`
- **Support Email:** `maros.toth.developer@gmail.com`

---

## 2. Detailed Description (Ready to Paste)

```text
Stash turns your Chrome New Tab and Side Panel into a fast, local-first visual bookmark workbench and tab-session manager.

Organize links into color-coded collections across Spaces, save entire browsing sessions with one click, track shopping specs and prices, and wake collections straight back into native Chrome Tab Groups—all stored 100% locally on your device with zero accounts, zero cloud servers, and zero tracking.

KEY FEATURES

• Spaces & Visual Collections
  Separate Work, Personal, Research, or Shopping into dedicated Spaces (switch instantly with keys 1–9). Flip between responsive card grids and a structured Details table (grouped by Collection or Retailer) right from the Space bar, sort any collection (Manual, A–Z, Newest, Recently Opened, or Price), and slice Spaces with clickable #tag filters.

• Tab Session Manager & Pocket Side Panel
  Keep open browser tabs in a dockable right-hand rail. Drag any tab straight into a collection, click Save Session or Save & Close to declutter your window, and click Wake Up to reopen a collection into a named Chrome Tab Group. Open the Side Panel (Alt+Shift+S) from any website to search your library, switch Spaces, or quick-stash the active tab.

• Shopping Lists & Price Tracking
  Check off bought/done items, toggle "Hide done", edit specs, quantities, and unit prices inline, watch live Remaining vs. Total subtotals, see automatic price-drop/increase badges, and copy clean Markdown lists in one click.

• Instant Search & Power Organization
  Find anything instantly with live search (/ or Ctrl+K), address-bar omnibox search ("s <query>"), Smart Views (Recently Added, Recently Opened, Untagged), multi-select bulk actions (Alt+Click / Shift+Click), Duplicate URL Finder, Library Health Check, and a 7-day Recently Deleted safety bin.

• Smart Rules & Optional On-Device AI
  Create fast local domain/keyword auto-categorization rules, or enable optional on-device AI powered by Chrome's built-in LanguageModel API (Gemini Nano) to suggest collections and tags—inference runs strictly locally on your machine.

• 12 Curated Themes, Custom Motion & Sound Packs
  Choose from 12 built-in light and dark themes with live hover preview, remix skins in Theme Studio, add local wallpapers, tune motion physics (Off, Reduced, Tactile, Arcade with layered Impact Shockwave & Ground Fracture effects), and pick from 5 Web Audio sound packs or upload your own audio clips.

• Zero Lock-In & Local-First Privacy
  Everything stays in chrome.storage.local (and local IndexedDB for optional visual previews). Export or restore your library anytime via schema-versioned JSON backups or standard Netscape HTML bookmark files, and import directly from Chrome bookmarks or HTML exports.
```

---

## 3. Single Purpose Description (Privacy Practices Tab)

```text
Stash provides a local-first Chrome New Tab and Side Panel workbench for organizing bookmarks into Spaces and collections, managing browser tab sessions, and importing/exporting bookmark libraries locally on the user's device.
```

---

## 4. Permission Justifications (Privacy Practices Tab)

- **`storage` & `unlimitedStorage`:**
  > Stores the user's Spaces, collections, links, categorization rules, theme preferences, 7-day Recently Deleted safety bin, and optional user-uploaded local wallpapers and custom audio clips strictly locally on the device without hitting small quota limits.
- **`tabs`:**
  > Powers the Open Tabs rail, Save Session / Save & Close workflow, drag-to-stash from open tabs, Quick Stash active-tab detection in the Side Panel, and opening saved links.
- **`tabGroups`:**
  > Powers the one-click "Wake Up" feature that reopens a saved collection or selected links into a color-coded native Chrome Tab Group.
- **`sidePanel`:**
  > Provides the docked Chrome Side Panel allowing users to search their Stash library and save the current webpage without leaving their active tab.
- **`contextMenus`:**
  > Adds a right-click "Stash this link" / "Stash this page" context menu action so users can save links from any webpage.
- **Optional `scripting` (`optional_permissions`):**
  > Requested strictly on explicit user click inside the Side Panel ("Extract Product Info") to read visible title, price, and store metadata from the active webpage. Never granted at install time and never runs automatically in the background.
- **Optional `bookmarks` (`optional_permissions`):**
  > Requested only if the user clicks "Import Chrome Bookmarks" in Settings → Backup & Import to read existing Chrome bookmark folders into Stash collections.
- **Optional Host Permissions (`http://*/*`, `https://*/*` in `optional_host_permissions`):**
  > Requested only when the user explicitly opts in to Visual Page Previews, runs a manual Library Health Check, or clicks "Extract Product Info" in the Side Panel. All fetches use `credentials: 'omit'` directly from the browser to the user's saved URLs with no external proxy or developer server.
- **Remote Code:**
  > **No, I am not using Remote code.** All JavaScript, CSS, Web Audio synthesis, and UI assets are bundled inside the extension package.

---

## 5. Data Usage Disclosures (Privacy Tab Checkboxes)

- **Does your extension collect or transmit user data?** → **No** (do not check any data-collection boxes; Stash has no backend servers, accounts, or analytics).
- **Certify all three compliance statements:**
  - I do not sell or transfer user data to third parties.
  - I do not use or transfer user data for purposes unrelated to the item's single purpose.
  - I do not use or transfer user data to determine creditworthiness or for lending purposes.

---

## 6. Visual Assets Checklist (Capture at 1280×800)

1. **Screenshot 1 (Hero Workbench):** Clean populated New Tab in *Oscilloscope* or *Catppuccin Mocha* showing Spaces, Quick Links, `#tag` bar, color-coded collections, and the Open Tabs rail.
2. **Screenshot 2 (Shopping & Details Table):** A Shopping Space in *Details* view showing checked items, inline prices, green/red price-change badges, and live Remaining vs. Total subtotals.
3. **Screenshot 3 (Side Panel Pocket Workbench):** Chrome tab with the Stash Side Panel docked on the right showing Space pills, Quick Stash capture, and searchable collections.
4. **Screenshot 4 (12 Themes & Theme Studio):** Spacious **Settings → Appearance** showing the curated theme grid + Theme Studio / Backdrop controls.
5. **Screenshot 5 (Effects & Custom Sounds):** **Settings → Effects** or **Settings → Sounds** showcasing tactile motion controls, 5 Sound Packs, and Custom Audio Clips.
6. **Small Promo Tile (`440×280`):** Dark *Oscilloscope* background, crisp Stash mark, `"Stash"` wordmark, and subtitle `"Visual Bookmarks & Tab Sessions"`.
