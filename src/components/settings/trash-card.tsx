import { Folder, Link2, RotateCcw, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { SettingsSectionCard } from '@/components/settings/settings-section-card';
import { Button } from '@/components/ui/button';
import { stashRepo } from '@/lib/storage/repo';
import { TRASH_RETENTION_DAYS } from '@/lib/storage/trash-ops';
import type { TrashEntry } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { extractDomain } from '@/lib/utils/url';

const EMPTY_ARM_DURATION_MS = 3000;

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
  const [emptyArmed, setEmptyArmed] = useState(false);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emptyWrapperRef = useRef<HTMLSpanElement | null>(null);

  const disarmEmpty = useCallback(() => {
    if (armTimerRef.current !== null) {
      clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
    setEmptyArmed(false);
  }, []);

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

  useEffect(() => {
    if (entries.length === 0 && emptyArmed) disarmEmpty();
  }, [entries.length, emptyArmed, disarmEmpty]);

  useEffect(() => {
    return () => {
      if (armTimerRef.current !== null) clearTimeout(armTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!emptyArmed) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        disarmEmpty();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !emptyWrapperRef.current?.contains(target)
      ) {
        disarmEmpty();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [emptyArmed, disarmEmpty]);

  const anyBusy = busyId !== null;

  const handleRestore = async (entry: TrashEntry) => {
    if (anyBusy) return;
    disarmEmpty();
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
    if (anyBusy) return;
    disarmEmpty();
    setBusyId(entryId);
    try {
      await stashRepo.deleteTrashEntry(entryId);
    } finally {
      setBusyId(null);
    }
  };

  const handleEmptyTrash = async () => {
    if (anyBusy || entries.length === 0) return;
    if (!emptyArmed) {
      setEmptyArmed(true);
      if (armTimerRef.current !== null) clearTimeout(armTimerRef.current);
      armTimerRef.current = setTimeout(() => {
        armTimerRef.current = null;
        setEmptyArmed(false);
      }, EMPTY_ARM_DURATION_MS);
      return;
    }

    disarmEmpty();
    setBusyId('__empty__');
    try {
      await stashRepo.emptyTrash();
      toast.info('Emptied Recently Deleted');
    } finally {
      setBusyId(null);
    }
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
          <span ref={emptyWrapperRef}>
            <Button
              variant="ghost"
              size="sm"
              disabled={anyBusy}
              onClick={() => void handleEmptyTrash()}
              onBlur={() => {
                if (emptyArmed) disarmEmpty();
              }}
              className={cn(
                'h-7 gap-1 px-2 text-[11px] text-danger hover:bg-danger/10 hover:text-danger',
                emptyArmed &&
                  'border border-danger/60 bg-danger/15 font-medium',
              )}
            >
              <Trash2 className="h-3 w-3" />
              {emptyArmed
                ? `Confirm Empty (${entries.length})?`
                : 'Empty Trash'}
            </Button>
          </span>
        ) : null
      }
    >
      {entries.length === 0 ? (
        <p className="text-xs text-fg-muted">No recently deleted items.</p>
      ) : (
        <div className="max-h-64 divide-y divide-border/60 overflow-y-auto rounded-control border border-border/80 bg-panel/45">
          {entries.map((entry) => {
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
                    disabled={anyBusy}
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
                    disabled={anyBusy}
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
