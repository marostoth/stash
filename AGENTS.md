# Stash — Agent Rules & Engineering Guardrails

These rules are always active for this workspace. Read `SPEC.md` for full product requirements and `PLAN.md` for the current build milestone before writing code.

## 1. Strict Scope Boundary
- Build **Stash** ONLY: a standalone Chrome Manifest V3 bookmark, tab-session, and link-collection manager.
- Do NOT add ADOS / Life OS features (no Quests, no Left Hardware Rail, no Wait Timers, no Widget Dock, no Recipes, no Hardware Inventory, no cloud backend/auth).
- Implement **one milestone at a time** from `PLAN.md`. Stop after completing a milestone and wait for human visual verification in Chrome before starting the next milestone.

## 2. Pinned Tech Stack (2026 Baseline)
- **Runtime:** Node.js `>= 22`, package manager `pnpm`.
- **Extension Framework:** **WXT** (`^0.21.5`, Manifest V3). Manifest config lives in `wxt.config.ts`; pages live in `entrypoints/` (`newtab/`, `sidepanel/`, `background.ts`). Never hand-write a root `manifest.json`.
- **UI:** **React 19** + **TypeScript** (`strict: true`, zero explicit `any`).
- **Styling:** **Tailwind CSS v4** (`@theme inline` mapped to CSS custom properties) + **shadcn/ui** primitives (Radix-based Dialog, Dropdown, Command/Search, Switch, Toast/Sonner).
- **Drag & Drop:** **`@dnd-kit/react`** (`^0.5.3`). Never re-render global storage on pointer move; persist order changes only on drop (`onDragEnd`).
- **Local Persistence:** WXT built-in storage (`chrome.storage.local` with `unlimitedStorage` permission).
- **Transient UI State:** **Zustand** (search query, active modals, open sidebar toggle, drag state). Never duplicate persistent collections/links inside Zustand without keeping WXT storage as the single source of truth.
- **On-Device AI (Tier 2):** Chrome's built-in **`LanguageModel`** Prompt API (`availability()`, `create()`, `prompt(..., { responseConstraint })`).
- **Linting & Formatting:** **Biome** (`@biomejs/biome`, installed with `--save-exact` and configured in `biome.json`, ignoring `.output/` and `.wxt/`). Do NOT install ESLint or Prettier.
- **Testing:** **Vitest** paired with WXT's official **`WxtVitest`** plugin (`wxt/testing/vitest-plugin`) for in-memory extension storage and browser API polyfills.

## 3. Anti-Hallucination API Rules
- **WXT Storage Imports:** ALWAYS use `import { storage } from '#imports';` (or `wxt/utils/storage`). NEVER import from `wxt/storage`, `wxt/sandbox`, or `wxt/client` (removed in WXT `0.20+`).
- **WXT Storage Keys:** Prefix every key with `local:` (e.g., `local:stash_collections`). Define versioned items with `storage.defineItem(..., { version: 1, fallback: ... })`.
- **WXT Types:** Ensure `"postinstall": "wxt prepare"` is in `package.json`. If WXT globals (`defineBackground`, `browser`) show type errors, run `pnpm exec wxt prepare` instead of adding bogus imports.
- **WXT + Vitest Testing:** Configure `vitest.config.ts` with `plugins: [WxtVitest()]` imported from `wxt/testing/vitest-plugin`. Reset `fakeBrowser` state between tests (`fakeBrowser.reset()`). If mocking a WXT helper with `vi.mock(...)`, mock its real module path (e.g., `wxt/utils/storage`), never `#imports`.
- **Chrome `LanguageModel` API:**
  - Feature-detect safely (`typeof LanguageModel !== 'undefined'`).
  - Check `await LanguageModel.availability({ expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] })` before creating a session.
  - Only trigger `LanguageModel.create()` inside a user gesture if the model status is `downloadable`, and show download progress via `monitor(m)`.
  - ALWAYS call `session.destroy()` in a `finally` block after categorization completes.
  - Never crash or block saving a link if `LanguageModel` is unavailable; silently fall back to Tier 1 local rules.
- **No `chrome.storage.sync`:** Never store collections or links in `chrome.storage.sync` (its 100 KB / 8 KB limits will break user libraries).

## 4. Architecture, File Size & Pragmatic Standards
- **Pragmatic Engineering (No Over-Engineering):** Apply high-value engineering practices—strict TypeScript (no `any`), clear separation between pure logic/storage (`src/lib/`) and React UI (`src/components/`), accessible `shadcn/ui` primitives, and clean error handling. Do NOT invent unnecessary abstraction factories, enterprise boilerplate, or premature micro-optimizations.
- **Repository Boundary:** Keep all storage reads/writes behind `src/lib/storage/repo.ts` so future export/sync adapters can plug in without touching UI components.
- **Theme Token Isolation:** Keep all theme tokens centralized in `src/lib/themes/` as typed JSON-serializable theme definitions applied via CSS variables on `document.documentElement`.
- **File Size Discipline:** Aim for a **300-line soft target** and enforce a **500-line hard ceiling** for code files. Once a component or module passes ~300 lines, check whether pure logic, custom hooks, or sub-components should be extracted—without artificially shattering simple code into tiny fragment files. Pure data files (e.g., built-in theme palettes) and test suites are exempt from the line cap.
- **Naming & Security:** Use kebab-case for filenames (`link-card.tsx`), PascalCase for React components (`LinkCard`), and camelCase for functions/variables. Never use `dangerouslySetInnerHTML` or inline `eval` (violates Manifest V3 CSP).

## 5. High-ROI Testing Policy
- **Test Pure Logic & Data Safety:** Focus Vitest unit tests on high-value invariants where silent bugs hurt users:
  - Repository CRUD, `version: 1` defaults/migrations, and the Duplicate URL Guard.
  - Tab session filtering (skipping pinned tabs by default, excluding `chrome://` / `chrome-extension://` URLs, and respecting the `Include pinned tabs` override).
  - Tier 1 auto-categorizer rule matching & priority ordering, plus Tier 2 `LanguageModel` graceful fallback when unavailable or throwing.
  - JSON backup/restore (`schemaVersion: 1`) validation, Merge vs. Replace semantics, Netscape HTML bookmark parsing, and `.stash-theme.json` validation.
- **Skip Low-ROI UI/E2E Tests in V1:** Do NOT write brittle UI snapshot tests, simulated drag-and-drop DOM suites, or Playwright E2E tests in V1. Visual layout, theming, and drag feel are verified directly by the user in Chrome after every milestone.

## 6. Mandatory Verification Gates Before Reporting Done
Add `"check": "biome check ."`, `"check:fix": "biome check --write ."`, and `"test": "vitest run"` to `package.json`. Before finishing any milestone or code change, run **all four gates** and resolve every issue:
1. `pnpm check` — zero Biome lint, formatting, or import-organization errors.
2. `pnpm exec tsc --noEmit` — zero TypeScript errors.
3. `pnpm test` — all Vitest unit tests pass.
4. `pnpm build` (`wxt build`) — produces a clean `.output/chrome-mv3` bundle with zero errors.
5. Summarize clearly in plain, non-jargon language: what was built, which files changed, and exact click-by-click steps for the user to test in Chrome.