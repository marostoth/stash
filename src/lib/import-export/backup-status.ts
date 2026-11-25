export const BACKUP_STALE_DAYS = 14;

const MS_PER_DAY = 86_400_000;

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
