import { HeartPulse, Sparkles, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { InlineProgressPill } from '@/components/ui/ai-activity-panel';
import { Button } from '@/components/ui/button';
import type { NanoAvailabilityStatus } from '@/lib/categorizer/types';
import {
  type BatchIconProgress,
  pickIconsForCollections,
} from '@/lib/icons/aiIconPicker';
import { stashRepo } from '@/lib/storage/repo';
import type { Collection, LinkItem } from '@/lib/types/stash';

interface MaintenanceCardProps {
  collections: readonly Collection[];
  links: readonly LinkItem[];
  nanoStatus: NanoAvailabilityStatus;
  onOpenHealthCheck: () => void;
  onOpenReorganize: () => void;
}

export function MaintenanceCard({
  collections,
  links,
  nanoStatus,
  onOpenHealthCheck,
  onOpenReorganize,
}: MaintenanceCardProps) {
  const [iconifying, setIconifying] = useState(false);
  const [iconProgress, setIconProgress] = useState<BatchIconProgress | null>(
    null,
  );
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const missingIconCollections = useMemo(
    () => collections.filter((c) => !c.icon),
    [collections],
  );

  const handleAutoIconCollections = async () => {
    if (
      iconifying ||
      nanoStatus !== 'available' ||
      missingIconCollections.length === 0
    ) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIconifying(true);
    setIconProgress({
      completed: 0,
      total: missingIconCollections.length,
      currentTitle: missingIconCollections[0]?.name ?? '',
    });

    try {
      const sampleTitlesByCol = new Map<string, string[]>();
      for (const link of links) {
        const list = sampleTitlesByCol.get(link.collectionId);
        if (list) {
          if (list.length < 5) list.push(link.title);
        } else {
          sampleTitlesByCol.set(link.collectionId, [link.title]);
        }
      }

      const items = missingIconCollections.map((col) => ({
        id: col.id,
        title: col.name,
        sampleLinkTitles: sampleTitlesByCol.get(col.id),
      }));

      const pickedMap = await pickIconsForCollections(items, {
        signal: controller.signal,
        onProgress: (p) => setIconProgress(p),
      });

      const latest = await stashRepo.getCollections();
      const latestById = new Map(latest.map((c) => [c.id, c]));

      let applied = 0;
      for (const [id, icon] of Object.entries(pickedMap)) {
        const current = latestById.get(id);
        if (!current || current.icon) continue;
        await stashRepo.updateCollection(id, { icon });
        applied += 1;
      }

      if (controller.signal.aborted) {
        toast.info(
          applied > 0
            ? `Stopped early — assigned ${applied} collection ${applied === 1 ? 'icon' : 'icons'}.`
            : 'Canceled icon assignment.',
        );
      } else if (applied > 0) {
        toast.success(
          `Assigned AI icons to ${applied} ${applied === 1 ? 'collection' : 'collections'}`,
        );
      } else {
        toast.info('No new collection icons were assigned.');
      }
    } finally {
      setIconifying(false);
      setIconProgress(null);
      abortRef.current = null;
    }
  };

  return (
    <div className="space-y-2.5 rounded-card border border-border bg-canvas p-4">
      <div className="flex items-center gap-2">
        <HeartPulse className="h-4 w-4 text-accent" />
        <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
          Maintenance &amp; Library
        </h3>
      </div>
      <p className="text-xs leading-relaxed text-fg-muted">
        Run an on-demand scan to detect dead links, parked domains, root
        redirects, duplicates, and search/dev clutter—with safe bulk cleanup and
        8-second Undo.
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <Button
          variant="secondary"
          size="sm"
          onClick={onOpenHealthCheck}
          className="gap-1.5"
        >
          <HeartPulse className="h-3.5 w-3.5 text-accent" />
          Library Health Check ({links.length} links)
        </Button>

        <Button
          variant="secondary"
          size="sm"
          disabled={nanoStatus !== 'available' || links.length === 0}
          onClick={onOpenReorganize}
          className="gap-1.5"
          title={
            nanoStatus !== 'available'
              ? 'Requires Chrome on-device Gemini Nano (enable below)'
              : 'Restructure collections with 2-pass on-device AI'
          }
        >
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Smart Reorganize (AI)
        </Button>

        {iconifying ? (
          <InlineProgressPill
            label={`Icons ${iconProgress?.completed ?? 0} / ${iconProgress?.total ?? missingIconCollections.length}...`}
            current={iconProgress?.completed ?? 0}
            total={iconProgress?.total ?? missingIconCollections.length}
            onCancel={() => abortRef.current?.abort()}
            className="h-8 px-2.5 text-xs"
          />
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={
              nanoStatus !== 'available' || missingIconCollections.length === 0
            }
            onClick={() => void handleAutoIconCollections()}
            className="gap-1.5"
            title={
              nanoStatus !== 'available'
                ? 'Requires Chrome on-device Gemini Nano (enable below)'
                : missingIconCollections.length === 0
                  ? 'Every collection already has an icon'
                  : 'Assign matching icons to collections missing one'
            }
          >
            <Wand2 className="h-3.5 w-3.5 text-accent" />
            Auto-Icon Collections ({missingIconCollections.length})
          </Button>
        )}
      </div>
      {nanoStatus !== 'available' ? (
        <p className="font-mono text-[10px] text-fg-muted">
          Smart Reorganize and Auto-Icon require Chrome&apos;s on-device Gemini
          Nano model (status: {nanoStatus}).
        </p>
      ) : null}
    </div>
  );
}
