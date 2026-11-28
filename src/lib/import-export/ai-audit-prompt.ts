import { CATALOG_ICON_KEYS } from '@/lib/icons/catalog';
import { type Space, TAB_GROUP_COLORS } from '@/lib/types/stash';

export type AiAuditPromptMode = 'audit' | 'reorganize';

export interface AiAuditLibraryStats {
  linkCount: number;
  collectionCount: number;
  spaces?: readonly Space[];
}

export interface Step2BackupContractOptions {
  multiSpace: boolean;
  spacesSummary: string;
  validColors: string;
  validIcons: string;
}

function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Shared Step 2 `schemaVersion: 1` backup contract used by both external AI
 * workflows so schema compliance, field preservation, and anti-truncation
 * guarantees stay synchronized in one place.
 */
export function buildStep2BackupContract({
  multiSpace,
  spacesSummary,
  validColors,
  validIcons,
}: Step2BackupContractOptions): string {
  const spacesContractLines = multiSpace
    ? [
        `- **Spaces & \`collection.spaceId\`:** Preserve the top-level \`"spaces"\` array and keep every \`collection.spaceId\` mapped to a valid Space ID (${spacesSummary}) unless I approve moving a collection between Spaces.`,
      ]
    : [];

  return [
    '## Step 2 — Final Stash Backup JSON (after I confirm)',
    'Output a single, complete, valid JSON backup ready for **Stash -> Settings -> Backup & Import -> Import JSON Backup -> Replace All**.',
    '',
    '### Strict Stash `schemaVersion: 1` Contract',
    '- **Integrity Check header:** Right before the JSON, print a 1-line **Integrity Check** (`Links: <before> -> <after>, Collections: <before> -> <after>`) confirming the exact changes.',
    multiSpace
      ? '- **Top-level keys:** MUST be `"app": "stash"`, `"schemaVersion": 1`, `"exportedAt"` (ISO-8601 string), `"spaces"`, `"collections"`, `"links"`, `"rules"`, `"settings"`, `"customThemes"`.'
      : '- **Top-level keys:** MUST be `"app": "stash"`, `"schemaVersion": 1`, `"exportedAt"` (ISO-8601 string), `"collections"`, `"links"`, `"rules"`, `"settings"`, `"customThemes"`.',
    '- **Zero truncation & verbatim copy:** NEVER omit entries or use `...`, comments, or `"/* unchanged */"`. Copy `"rules"`, `"settings"`, and `"customThemes"` byte-for-byte verbatim from the backup.',
    ...spacesContractLines,
    '- **Preserve all existing fields:** Keep original `id` values on all retained collections and links, and preserve **all existing properties** on every space, collection, and link (including `starred`, `checked`, `hideChecked`, `collapsed`, `description`, `note`, `product`, `faviconUrl`, `createdAt`, plus any other fields present in the backup) unless explicitly edited.',
    "- **New items:** Any newly created collection or upgraded link MUST receive a fresh unique UUID `id`, match the backup's ISO-8601 `createdAt` timestamp format, and include all required schema fields.",
    '- **URL safety:** Every `link.url` MUST be a valid `https://` or `http://` URL.',
    '- **Valid `collection.color` values (use ONLY these):**',
    `  \`${validColors}\``,
    '- **Valid `collection.icon` keys (use ONLY these):**',
    `  \`${validIcons}\``,
    '- **Ordering & uniqueness:** Assign sequential zero-based `order` indices (`0, 1, 2, ...`) for collections and per-collection links. Guarantee **zero duplicate normalized URLs** within any single collection, and ensure every `link.collectionId` references a valid collection in `collections`.',
    '- **Tags:** Lowercase kebab-case strings without leading `#` (max 3 per link).',
    '- **Output format:** Return the complete JSON as a downloadable `.json` file if your environment supports it; otherwise output it inside a single ```json code block with no comments or trailing commas.',
  ].join('\n');
}

/**
 * Generates a ready-to-paste external LLM prompt (Gemini / Claude / ChatGPT)
 * for auditing or reorganizing an exported Stash `schemaVersion: 1` JSON backup.
 */
export function buildAiAuditPrompt(
  mode: AiAuditPromptMode,
  stats: AiAuditLibraryStats,
): string {
  const validColors = TAB_GROUP_COLORS.join(', ');
  const validIcons = CATALOG_ICON_KEYS.join(', ');
  const spaceCount = stats.spaces?.length ?? 0;
  const multiSpace = spaceCount > 1;
  const spacesSummary = multiSpace
    ? (stats.spaces ?? []).map((s) => `"${s.name}" (id: "${s.id}")`).join(', ')
    : '';

  const linksText = pluralize(stats.linkCount, 'link');
  const collectionsText = pluralize(stats.collectionCount, 'collection');
  const libraryScopeText = multiSpace
    ? `${linksText} across ${collectionsText} and ${pluralize(spaceCount, 'Space')}: ${spacesSummary}`
    : `${linksText} across ${collectionsText}`;

  const header =
    mode === 'audit'
      ? `You are auditing my Stash bookmark library — ${libraryScopeText} — from the attached Stash JSON backup.`
      : `You are reorganizing my Stash bookmark library — ${libraryScopeText} — from the attached Stash JSON backup while keeping 100% of my links.`;

  const stepOne =
    mode === 'audit'
      ? [
          '## Step 1 — Review & Proposal (WAIT for my confirmation before outputting JSON)',
          'Review every collection and present a concise, scannable audit grouped into 3 buckets:',
          '1. **Keep** — valuable, active references worth keeping as-is (or with cleaner titles/tags).',
          '2. **Upgrade / Modern Alternatives** — outdated tools, deprecated docs, or discontinued services with better modern replacements. Never invent unverified deep URLs — link to official root domains if a deeper path cannot be verified.',
          '3. **Cut / Consolidate** — confirmed dead/obsolete links, overlapping duplicates, login/redirect wrapper URLs, watch-once clutter, and collection merges or splits.',
          '',
          '### Accuracy rules for Step 1',
          '- Do NOT claim a site is dead unless you verified it via live browsing or it is a known discontinued service; otherwise flag it as **"Verify if active"**.',
          '- Treat links with `product` metadata (e.g., Shopping Lists) carefully — do NOT flag them as watch-once clutter or break their product URLs.',
          '',
          'End Step 1 by asking me which cuts, upgrades, or collection merges I approve. **Do NOT output the final JSON until I confirm.**',
        ].join('\n')
      : [
          '## Step 1 — Reorganization Proposal (WAIT for my confirmation before outputting JSON)',
          'Keep **100% of my links** (do NOT delete any bookmark unless it is an exact duplicate URL inside the same collection).',
          'Propose a clean, well-balanced library structure covering:',
          '- Balanced, intuitive collections (merging overlapping folders or splitting bloated ones).',
          '- Cleaner, human-readable link titles and stripping tracking query parameters (`utm_*`, `fbclid`, `gclid`, `ref`, etc.) where safe — NEVER strip functional query parameters (such as YouTube `?v=`, document IDs, or product SKUs).',
          '- Preserve existing user `note`s while adding concise 1-line `note` summaries and collection `description`s where helpful, plus consistent lowercase kebab-case tags (1–3 per link, no leading #).',
          '',
          'End Step 1 by asking me to confirm the proposed collections and changes. **Do NOT output the final JSON until I confirm.**',
        ].join('\n');

  const stepTwo = buildStep2BackupContract({
    multiSpace,
    spacesSummary,
    validColors,
    validIcons,
  });

  return [header, '', stepOne, '', stepTwo].join('\n');
}
