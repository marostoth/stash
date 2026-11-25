import { describe, expect, it } from 'vitest';
import { CATALOG_ICON_KEYS } from '@/lib/icons/catalog';
import { buildAiAuditPrompt } from '@/lib/import-export/ai-audit-prompt';
import {
  BACKUP_STALE_DAYS,
  getBackupStaleness,
} from '@/lib/import-export/backup-status';
import { TAB_GROUP_COLORS } from '@/lib/types/stash';

describe('buildAiAuditPrompt', () => {
  it('builds Full Audit & Modernize prompt with schema v1, live counts, whitelists, and 2-step confirmation', () => {
    const prompt = buildAiAuditPrompt('audit', {
      linkCount: 142,
      collectionCount: 9,
    });

    expect(prompt).toContain('142 links across 9 collections');
    expect(prompt).toContain('schemaVersion: 1');
    expect(prompt).toContain('"schemaVersion": 1');
    expect(prompt).toContain('Keep');
    expect(prompt).toContain('Upgrade / Modern Alternatives');
    expect(prompt).toContain('Cut / Consolidate');
    expect(prompt).toContain('Do NOT output the final JSON until I confirm');
    expect(prompt).toContain(TAB_GROUP_COLORS.join(', '));
    expect(prompt).toContain(CATALOG_ICON_KEYS[0] ?? 'terminal');
    expect(prompt).toContain(
      CATALOG_ICON_KEYS[CATALOG_ICON_KEYS.length - 1] ?? 'layers',
    );
  });

  it('builds Reorganize Only prompt instructing 100% link retention with strict schema rules', () => {
    const prompt = buildAiAuditPrompt('reorganize', {
      linkCount: 58,
      collectionCount: 4,
    });

    expect(prompt).toContain('58 links across 4 collections');
    expect(prompt).toContain('100% of my links');
    expect(prompt).toContain('do NOT delete any bookmark');
    expect(prompt).toContain('Do NOT output the final JSON until I confirm');
    expect(prompt).toContain('"schemaVersion": 1');
    expect(prompt).toContain(TAB_GROUP_COLORS.join(', '));
  });
});

describe('getBackupStaleness', () => {
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
});
