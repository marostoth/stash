export const BACKUP_STALE_DAYS = 14;
export const TRUNCATION_MIN_LIBRARY_LINKS = 10;
export const TRUNCATION_DROP_RATIO = 0.3;

const MS_PER_DAY = 86_400_000;

/**
 * Flags a backup as potentially truncated (e.g. by an external LLM cutting off
 * output) when the current library has >= 10 links and the backup drops > 30%.
 */
export function isLikelyTruncatedBackup(
  currentLinkCount: number,
  backupLinkCount: number,
): boolean {
  if (currentLinkCount < TRUNCATION_MIN_LIBRARY_LINKS) return false;
  const dropped = currentLinkCount - backupLinkCount;
  return dropped / currentLinkCount > TRUNCATION_DROP_RATIO;
}

export interface BackupStalenessInfo {
  label: string;
  isStale: boolean;
  daysSinceBackup: number | null;
}

/**
 * Evaluates backup freshness for the subtle Backup & Import status pill.
 * Flags as stale when the library has links and no backup was exported in >= 14 days.
 */
export function getBackupStaleness(
  lastBackupAt: string | undefined,
  linkCount: number,
  now: Date = new Date(),
): BackupStalenessInfo {
  if (!lastBackupAt) {
    return {
      label: 'Never backed up',
      isStale: linkCount > 0,
      daysSinceBackup: null,
    };
  }

  const parsedMs = Date.parse(lastBackupAt);
  if (Number.isNaN(parsedMs)) {
    return {
      label: 'Never backed up',
      isStale: linkCount > 0,
      daysSinceBackup: null,
    };
  }

  const diffMs = Math.max(0, now.getTime() - parsedMs);
  const days = Math.floor(diffMs / MS_PER_DAY);
  const label = days === 0 ? 'Last backup: Today' : `Last backup: ${days}d ago`;

  return {
    label,
    isStale: linkCount > 0 && days >= BACKUP_STALE_DAYS,
    daysSinceBackup: days,
  };
}
