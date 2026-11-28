# Privacy Policy — Stash

**Last updated:** November 28, 2026

Stash is a local-first visual bookmark, tab-session, and link-collection workbench for Chrome.

## 1. Data Collection & Transmission

Stash does **not** collect, transmit, sell, or share personal data, browsing history, or analytics. There are no developer servers, no user accounts, no advertising, and no third-party tracking scripts.

The only direct network requests Stash makes are straight from your browser to websites you have saved:

- Loading saved site favicon URLs directly from the originating website.
- **Opt-in Visual Previews & Library Health Check:** When you explicitly enable Visual Previews or run a Health Check, Stash sends direct requests (with `credentials: 'omit'`, without sending your cookies) to the saved URLs to fetch preview metadata or check if a link is broken. No proxy or developer server is involved.

## 2. What Stays Locally on Your Device

All data you create or import is stored strictly on your device using `chrome.storage.local` and browser IndexedDB:

- **Collections, Spaces & Links:** Titles, URLs, notes, tags, sort preferences, starred/done/pinned status, and optional product metadata (store name, price, previous price history, spec, quantity).
- **Preferences, Rules & Safety Bin:** Themes, layout/effect settings, categorization rules, custom local wallpapers, optional locally uploaded custom audio clips (`local:stash_custom_sfx`), and a 7-day local Recently Deleted safety bin (`local:stash_trash`) that auto-purges expired entries.
- **Optional Visual Previews:** Cached page thumbnails captured locally in IndexedDB only when you explicitly enable Visual Previews.

## 3. On-Device AI (Gemini Nano)

When you enable On-Device AI, Stash uses Chrome's built-in local `LanguageModel` API to suggest collections, tags, or cleaned product titles. All inference runs locally on your machine; your links are never sent to external AI APIs by Stash.

## 4. Permissions Usage

- **`storage` / `unlimitedStorage`:** Saves your Spaces, collections, links, rules, and preferences locally.
- **`tabs` & `tabGroups`:** Powers the Open Tabs sidebar, Save Session / Save & Close, drag-to-stash, and opening collections or store items into Chrome Tab Groups.
- **`sidePanel`:** Provides the docked Side Panel for one-click stashing from any webpage.
- **`contextMenus`, `omnibox`, `commands`:** Enables right-click "Stash this link", address-bar search (`s <query>`), and global keyboard shortcuts.
- **Optional `scripting` & Optional Host Permissions (`https://*/*`, `http://*/*`):** Requested strictly on user interaction when you choose to extract product price/spec metadata from an active tab, enable Visual Previews, or run a Library Health Check.
- **Optional `bookmarks`:** Requested only if you choose to import existing Chrome bookmarks.

## 5. Data Control & Deletion

You can export your entire library as a portable JSON backup or standard Netscape HTML bookmarks file at any time, empty Recently Deleted immediately, or permanently delete all local data by removing the extension from Chrome.

## 6. Contact

For privacy questions or support, contact the developer at **maros.toth.developer@gmail.com**.
