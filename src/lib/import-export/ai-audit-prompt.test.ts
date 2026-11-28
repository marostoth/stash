import { describe, expect, it } from 'vitest';
import { CATALOG_ICON_KEYS } from '@/lib/icons/catalog';
import { buildAiAuditPrompt } from '@/lib/import-export/ai-audit-prompt';
import {
  BACKUP_STALE_DAYS,
  getBackupStaleness,
  isLikelyTruncatedBackup,
} from '@/lib/import-export/backup-status';
import { TAB_GROUP_COLORS } from '@/lib/types/stash';

describe('buildAiAuditPrompt', () => {
  const sampleSpaces = [
    {
      id: 'space-main',
      name: 'Main',
      icon: 'layers',
      order: 0,
      createdAt: '2026-11-25T10:00:00.000Z',
      updatedAt: '2026-11-25T10:00:00.000Z',
    },
    {
      id: 'space-reorders',
      name: 'Reorders',
      icon: 'shopping-bag',
      order: 1,
      createdAt: '2026-11-25T10:00:00.000Z',
      updatedAt: '2026-11-25T10:00:00.000Z',
    },
  ];

  it('builds Full Audit & Modernize prompt with clean em-dash framing, Step 1 accuracy guards, and hardened Step 2 contract', () => {
    const prompt = buildAiAuditPrompt('audit', {
      linkCount: 142,
      collectionCount: 9,
    });

    expect(prompt).toContain(
      'You are auditing my Stash bookmark library — 142 links across 9 collections — from the attached Stash JSON backup.',
    );
    expect(prompt).not.toContain('#tags');
    expect(prompt).toContain('Upgrade / Modern Alternatives');
    expect(prompt).toContain('Never invent unverified deep URLs');
    expect(prompt).toContain('Accuracy rules for Step 1');
    expect(prompt).toContain('"Verify if active"');
    expect(prompt).toContain('`product` metadata');
    expect(prompt).toContain('Do NOT output the final JSON until I confirm');

    // Shared Step 2 contract invariants
    expect(prompt).toContain('Integrity Check');
    expect(prompt).toContain('Links: <before> -> <after>');
    expect(prompt).toContain('NEVER omit entries');
    expect(prompt).toContain('byte-for-byte verbatim');
    expect(prompt).toContain('preserve **all existing properties**');
    expect(prompt).toContain('`hideChecked`');
    expect(prompt).toContain('fresh unique UUID `id`');
    expect(prompt).toContain('`https://` or `http://`');
    expect(prompt).toContain('downloadable `.json` file');
    expect(prompt).toContain(TAB_GROUP_COLORS.join(', '));
    expect(prompt).toContain(CATALOG_ICON_KEYS.join(', '));
  });

  it('builds Reorganize Only prompt with 100% retention, no #tags contradiction, functional query-param guard, and shared Step 2 contract', () => {
    const prompt = buildAiAuditPrompt('reorganize', {
      linkCount: 58,
      collectionCount: 1,
    });

    // Verifies singular/plural formatting and em-dash syntax
    expect(prompt).toContain(
      'You are reorganizing my Stash bookmark library — 58 links across 1 collection — from the attached Stash JSON backup while keeping 100% of my links.',
    );
    expect(prompt).not.toContain('#tags');
    expect(prompt).toContain(
      'consistent lowercase kebab-case tags (1–3 per link, no leading #)',
    );
    expect(prompt).toContain('do NOT delete any bookmark');
    expect(prompt).toContain('NEVER strip functional query parameters');
    expect(prompt).toContain('`?v=`');
    expect(prompt).toContain('Preserve existing user `note`s');
    expect(prompt).toContain('Do NOT output the final JSON until I confirm');

    // Shared Step 2 contract invariants
    expect(prompt).toContain('Integrity Check');
    expect(prompt).toContain('NEVER omit entries');
    expect(prompt).toContain('byte-for-byte verbatim');
    expect(prompt).toContain('fresh unique UUID `id`');
    expect(prompt).toContain('`https://` or `http://`');
    expect(prompt).toContain(TAB_GROUP_COLORS.join(', '));
    expect(prompt).toContain(CATALOG_ICON_KEYS.join(', '));
  });

  it('interpolates multiple Spaces cleanly with em-dash framing and zero nested parentheses in both modes', () => {
    for (const mode of ['audit', 'reorganize'] as const) {
      const prompt = buildAiAuditPrompt(mode, {
        linkCount: 1,
        collectionCount: 2,
        spaces: sampleSpaces,
      });

      const firstLine = prompt.split('\n')[0] ?? '';
      expect(firstLine).toContain(
        '— 1 link across 2 collections and 2 Spaces: "Main" (id: "space-main"), "Reorders" (id: "space-reorders") —',
      );
      // Confirm no nested parentheses anywhere on the opening line
      let depth = 0;
      let maxDepth = 0;
      for (const ch of firstLine) {
        if (ch === '(') depth += 1;
        if (ch === ')') depth -= 1;
        if (depth > maxDepth) maxDepth = depth;
      }
      expect(maxDepth).toBe(1);
      expect(prompt).toContain('"spaces"');
      expect(prompt).toContain('collection.spaceId');
    }
  });
});

describe('getBackupStaleness & isLikelyTruncatedBackup', () => {
  const NOW = new Date('2026-11-25T18:00:00.000Z');

  it('reports never backed up as stale only when library has links', () => {
    expect(getBackupStaleness(undefined, 0, NOW)).toEqual({
      label: 'Never backed up',
      isStale: false,
      daysSinceBackup: null,
    });
    expect(getBackupStaleness(undefined, 12, NOW)).toEqual({
      label: 'Never backed up',
      isStale: true,
      daysSinceBackup: null,
    });
  });

  it('computes age in days and flags backups >= 14 days old as stale', () => {
    const today = getBackupStaleness('2026-11-25T10:00:00.000Z', 10, NOW);
    expect(today).toEqual({
      label: 'Last backup: Today',
      isStale: false,
      daysSinceBackup: 0,
    });

    const thirteenDaysAgo = new Date(
      NOW.getTime() - (BACKUP_STALE_DAYS - 1) * 86_400_000,
    ).toISOString();
    expect(getBackupStaleness(thirteenDaysAgo, 10, NOW)).toEqual({
      label: 'Last backup: 13d ago',
      isStale: false,
      daysSinceBackup: 13,
    });

    const fourteenDaysAgo = new Date(
      NOW.getTime() - BACKUP_STALE_DAYS * 86_400_000,
    ).toISOString();
    expect(getBackupStaleness(fourteenDaysAgo, 10, NOW)).toEqual({
      label: 'Last backup: 14d ago',
      isStale: true,
      daysSinceBackup: 14,
    });

    // Empty libraries are never flagged stale even if old
    expect(getBackupStaleness(fourteenDaysAgo, 0, NOW).isStale).toBe(false);
  });

  it('flags likely truncated backups when current library >= 10 links and backup drops > 30%', () => {
    // Libraries with < 10 links never trigger truncation warning
    expect(isLikelyTruncatedBackup(9, 2)).toBe(false);
    expect(isLikelyTruncatedBackup(0, 0)).toBe(false);

    // Exactly 30% drop is allowed; > 30% triggers warning
    expect(isLikelyTruncatedBackup(100, 70)).toBe(false);
    expect(isLikelyTruncatedBackup(100, 69)).toBe(true);
    expect(isLikelyTruncatedBackup(10, 6)).toBe(true);
    expect(isLikelyTruncatedBackup(10, 7)).toBe(false);
    // Larger backup never triggers
    expect(isLikelyTruncatedBackup(50, 80)).toBe(false);
  });
});
