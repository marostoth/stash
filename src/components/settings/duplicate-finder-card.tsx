import { Copy, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SettingsSectionCard } from '@/components/settings/settings-section-card';
import { Button } from '@/components/ui/button';
import { playDelete, playDrop } from '@/lib/audio/foley';
import { stashRepo } from '@/lib/storage/repo';
import type { Collection, LinkItem, Space } from '@/lib/types/stash';
import { findCrossSpaceDuplicates } from '@/lib/utils/duplicates';
import { extractDomain } from '@/lib/utils/url';

interface DuplicateFinderCardProps {
  spaces: readonly Space[];
  collections: readonly Collection[];
  links: readonly LinkItem[];
}

export function DuplicateFinderCard({
  spaces,
  collections,
  links,
}: DuplicateFinderCardProps) {
  const [expanded, setExpanded] = useState(false);

  const duplicateGroups = useMemo(
    () => findCrossSpaceDuplicates(links, collections, spaces),
    [collections, links, spaces],
  );
  const extraLinkIds = useMemo(
    () =>
      duplicateGroups.flatMap((g) =>
        g.entries.filter((e) => !e.recommendedKeep).map((e) => e.link.id),
      ),
    [duplicateGroups],
  );

  const handleRemoveIds = async (ids: readonly string[]) => {
    if (ids.length === 0) return;
    const removed = await stashRepo.deleteLinks(ids);
    if (removed.length === 0) return;
    playDelete();
    toast(
      `Removed ${removed.length} duplicate${removed.length === 1 ? '' : 's'}`,
      {
        duration: 6000,
        action: {
          label: 'Undo',
          onClick: () => {
            void stashRepo.restoreLinks(removed).then((restored) => {
              if (restored.length > 0) playDrop();
            });
          },
        },
      },
    );
  };

  return (
    <SettingsSectionCard
      icon={<Copy className="h-4 w-4" />}
      title="Cross-Space Duplicate Finder"
      subtitle="Finds the same URL saved across different collections or Spaces and keeps your richest copy (starred, priced, or tagged)."
      badge={{
        label:
          duplicateGroups.length === 0
            ? 'Clean'
            : `${extraLinkIds.length} extra${extraLinkIds.length === 1 ? '' : 's'}`,
        tone: duplicateGroups.length > 0 ? 'accent' : 'neutral',
      }}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={duplicateGroups.length === 0}
            onClick={() => setExpanded((prev) => !prev)}
            className="gap-1.5"
          >
            <Copy className="h-3.5 w-3.5 text-accent" />
            {duplicateGroups.length === 0
              ? 'No Duplicates Found'
              : expanded
                ? 'Hide Duplicate Groups'
                : `Review ${duplicateGroups.length} Group${duplicateGroups.length === 1 ? '' : 's'}`}
          </Button>

          {extraLinkIds.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => void handleRemoveIds(extraLinkIds)}
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove {extraLinkIds.length} Extra
              {extraLinkIds.length === 1 ? '' : 's'}
            </Button>
          )}
        </div>

        {expanded && duplicateGroups.length > 0 && (
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-control border border-border bg-canvas/75 p-2.5">
            {duplicateGroups.map((group) => (
              <div
                key={group.normalizedUrl}
                className="rounded-control border border-border/80 bg-panel/80 p-2 text-xs"
              >
                <div className="mb-1.5 truncate font-mono text-[10px] text-fg-muted">
                  {extractDomain(group.displayUrl)} · {group.entries.length}{' '}
                  copies
                </div>
                <div className="space-y-1">
                  {group.entries.map((entry) => (
                    <div
                      key={entry.link.id}
                      className="flex items-center justify-between gap-2 rounded bg-canvas/60 px-2 py-1"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-fg">
                          {entry.link.title}
                        </div>
                        <div className="truncate font-mono text-[10px] text-fg-muted">
                          {entry.spaceName} → {entry.collectionName}
                        </div>
                      </div>
                      {entry.recommendedKeep ? (
                        <span className="shrink-0 rounded-pill border border-accent/45 bg-accent/12 px-1.5 py-0.25 font-mono text-[9px] text-accent">
                          Keep
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleRemoveIds([entry.link.id])}
                          className="h-6 px-1.5 text-[10px] text-danger hover:bg-danger/15 hover:text-danger"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingsSectionCard>
  );
}
