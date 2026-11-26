import { Folder, Link2, RotateCcw, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SettingsSectionCard } from '@/components/settings/settings-section-card';
import { Button } from '@/components/ui/button';
import { stashRepo } from '@/lib/storage/repo';
import { TRASH_RETENTION_DAYS } from '@/lib/storage/trash-ops';
import type { TrashEntry } from '@/lib/types/stash';
import { extractDomain } from '@/lib/utils/url';

function formatRelativeAge(iso: string): string {
  const diffMs = Math.max(0, Date.now() - Date.parse(iso));
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function TrashCard() {
  const [entries, setEntries] = useState<TrashEntry[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void stashRepo.getTrash().then((loaded) => {
      if (mounted) setEntries(loaded);
    });
    const unwatch = stashRepo.watchTrash((next) => {
      if (mounted) setEntries(next);
    });
    return () => {
      mounted = false;
      unwatch();
    };
  }, []);

  const handleRestore = async (entry: TrashEntry) => {
    setBusyId(entry.id);
    try {
      const res = await stashRepo.restoreTrashEntry(entry.id);
      if (!res) return;
      if (res.restoredKind === 'collection') {
        toast.success(
          `Restored "${res.label}" (${res.restoredCount} link${res.restoredCount === 1 ? '' : 's'})`,
        );
      } else if (res.restoredCount > 0) {
        toast.success(`Restored "${res.label}"`);
      } else {
        toast.info('Link already exists in that collection');
      }
    } finally {
      setBusyId(null);
    }
  };

  const handlePermanentDelete = async (entryId: string) => {
    setBusyId(entryId);
    try {
      await stashRepo.deleteTrashEntry(entryId);
    } finally {
      setBusyId(null);
    }
  };

  const handleEmptyTrash = async () => {
    await stashRepo.emptyTrash();
    toast.info('Emptied Recently Deleted');
  };

  return (
    <SettingsSectionCard
      icon={<Trash2 className="h-4 w-4" />}
      title={`Recently Deleted (${TRASH_RETENTION_DAYS}-Day Trash)`}
      subtitle="Deleted links and collections stay recoverable here for 7 days before auto-clearing."
      badge={{
        label: entries.length > 0 ? `${entries.length} in trash` : 'Empty',
        tone: entries.length > 0 ? 'accent' : 'neutral',
      }}
      headerAction={
        entries.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleEmptyTrash()}
            className="h-7 gap-1 px-2 text-[11px] text-danger hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="h-3 w-3" />
            Empty Trash
          </Button>
        ) : null
      }
    >
      {entries.length === 0 ? (
        <p className="text-xs text-fg-muted">No recently deleted items.</p>
      ) : (
        <div className="max-h-64 divide-y divide-border/60 overflow-y-auto rounded-control border border-border/80 bg-panel/45">
          {entries.map((entry) => {
            const busy = busyId === entry.id;
            const title =
              entry.kind === 'collection'
                ? entry.collection.name
                : entry.link.title;
            const subtitle =
              entry.kind === 'collection'
                ? `Collection · ${entry.links.length} link${entry.links.length === 1 ? '' : 's'}`
                : `${extractDomain(entry.link.url)}${entry.collectionName ? ` · from ${entry.collectionName}` : ''}`;

            return (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border bg-panel text-fg-muted">
                    {entry.kind === 'collection' ? (
                      <Folder className="h-3.5 w-3.5 text-accent" />
                    ) : (
                      <Link2 className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-fg">
                      {title}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-fg-muted">
                      {subtitle} · {formatRelativeAge(entry.deletedAt)}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleRestore(entry)}
                    className="h-7 gap-1 px-2 text-[11px]"
                  >
                    <RotateCcw className="h-3 w-3 text-accent" />
                    <span>Restore</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    onClick={() => void handlePermanentDelete(entry.id)}
                    aria-label={`Permanently delete ${title}`}
                    title="Delete permanently"
                    className="h-7 w-7 text-fg-muted hover:text-danger"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SettingsSectionCard>
  );
}
