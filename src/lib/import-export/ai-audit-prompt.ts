import { CATALOG_ICON_KEYS } from '@/lib/icons/catalog';
import { type Space, TAB_GROUP_COLORS } from '@/lib/types/stash';

export type AiAuditPromptMode = 'audit' | 'reorganize';

export interface AiAuditLibraryStats {
  linkCount: number;
  collectionCount: number;
  spaces?: readonly Space[];
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
  const multiSpace = (stats.spaces?.length ?? 0) > 1;
  const spacesSummary = multiSpace
    ? (stats.spaces ?? []).map((s) => `"${s.name}" (id: "${s.id}")`).join(', ')
    : '';

  const libraryScopeText = multiSpace
    ? `${stats.linkCount} links across ${stats.collectionCount} collections and ${stats.spaces?.length ?? 0} Spaces (${spacesSummary})`
    : `${stats.linkCount} links across ${stats.collectionCount} collections`;

  const header =
    mode === 'audit'
      ? `You are auditing my Stash bookmark library (${libraryScopeText}) from the attached Stash JSON backup.`
      : `You are reorganizing my Stash bookmark library (${libraryScopeText}) from the attached Stash JSON backup — keeping 100% of my links.`;

  const stepOne =
    mode === 'audit'
      ? [
          '## Step 1 — Review & Proposal (WAIT for my confirmation before outputting JSON)',
          'Review every collection and present a concise, scannable audit grouped into 3 buckets:',
          '1. **Keep** — valuable, active references worth keeping as-is (or with cleaner titles/tags).',
          '2. **Upgrade / Modern Alternatives** — outdated tools, deprecated docs, or dead/legacy services with better modern replacements.',
          '3. **Cut / Consolidate** — dead/obsolete links, overlapping duplicates, login/redirect wrapper URLs, watch-once clutter, and collection merges or splits.',
          '',
          'End Step 1 by asking me which cuts, upgrades, or collection merges I approve. **Do NOT output the final JSON until I confirm.**',
        ].join('\n')
      : [
          '## Step 1 — Reorganization Proposal (WAIT for my confirmation before outputting JSON)',
          'Keep **100% of my links** (do NOT delete any bookmark unless it is an exact duplicate URL inside the same collection).',
          'Propose a clean, well-balanced library structure covering:',
          '- Balanced, intuitive collections (merging overlapping folders or splitting bloated ones).',
          '- Cleaner, human-readable link titles and stripped redirect/tracking URLs where safe.',
          '- Concise 1-line `note` summaries where helpful and consistent lowercase kebab-case `#tags` (1–3 per link).',
          '',
          'End Step 1 by asking me to confirm the proposed collections and changes. **Do NOT output the final JSON until I confirm.**',
        ].join('\n');

  const spacesContractLines = multiSpace
    ? [
        `- **Spaces & \`collection.spaceId\`:** Preserve the top-level \`"spaces"\` array (\`id\`, \`name\`, \`icon\`, \`order\`, optional \`densityOverride\`, \`viewMode\`, \`groupBy\`) and keep every \`collection.spaceId\` mapped to a valid Space ID (${spacesSummary}) unless I approve moving a collection between Spaces.`,
      ]
    : [];

  const stepTwo = [
    '## Step 2 — Final Stash Backup JSON (after I confirm)',
    'Output a single, clean, valid JSON file ready for **Stash -> Settings -> Backup & Import -> Import JSON Backup -> Replace All**.',
    '',
    '### Strict Stash `schemaVersion: 1` Contract',
    multiSpace
      ? '- Top-level keys MUST be: `"app": "stash"`, `"schemaVersion": 1`, `"exportedAt"` (ISO-8601 string), `"spaces"`, `"collections"`, `"links"`, `"rules"`, `"settings"`, `"customThemes"`.'
      : '- Top-level keys MUST be: `"app": "stash"`, `"schemaVersion": 1`, `"exportedAt"` (ISO-8601 string), `"collections"`, `"links"`, `"rules"`, `"settings"`, `"customThemes"`.',
    ...spacesContractLines,
    '- **Preserve existing data:** Keep original `id` values on all retained collections and links, and strictly preserve `starred`, `product` (`store`, `price`, `currency`, `priceIsEstimate`, `spec`, `orderQty`, `source`, `capturedAt`), `faviconUrl`, `createdAt`, `rules`, `settings` (including `defaultCurrency`), and `customThemes` untouched.',
    '- **Valid `collection.color` values (use ONLY these):**',
    `  \`${validColors}\``,
    '- **Valid `collection.icon` keys (use ONLY these):**',
    `  \`${validIcons}\``,
    '- **Ordering & Uniqueness:** Assign sequential zero-based `order` indices (`0, 1, 2, ...`) for collections and per-collection links. Guarantee **zero duplicate normalized URLs** within any single collection, and ensure every `link.collectionId` references a valid collection in `collections`.',
    '- **Tags:** Lowercase kebab-case strings without leading `#` (max 3 per link).',
    '- Return the final JSON inside a single ```json code block with no comments or trailing commas.',
  ].join('\n');

  return [header, '', stepOne, '', stepTwo].join('\n');
}
