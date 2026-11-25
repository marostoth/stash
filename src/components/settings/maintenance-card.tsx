import { HeartPulse, Sparkles, Wand2 } from 'lucide-react';
import { useMemo } from 'react';
import { InlineProgressPill } from '@/components/ui/ai-activity-panel';
import { Button } from '@/components/ui/button';
import type { NanoAvailabilityStatus } from '@/lib/categorizer/types';
import { startAutoIconSweep } from '@/lib/jobs/background-sweeps';
import type { Collection, LinkItem } from '@/lib/types/stash';
import { useBackgroundJobsStore } from '@/store/background-jobs-store';

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
  const autoIconJob = useBackgroundJobsStore((s) =>
    s.jobs.find((job) => job.id === 'auto-icon'),
  );
  const cancelJob = useBackgroundJobsStore((s) => s.cancelJob);

  const missingIconCollections = useMemo(
    () => collections.filter((c) => !c.icon),
    [collections],
  );

  const iconifying = autoIconJob?.status === 'running';

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
        8-second Undo. Any running task continues in the bottom-right tray if
        you close this menu.
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
            label={`Icons ${autoIconJob.progress?.current ?? 0} / ${autoIconJob.progress?.total ?? missingIconCollections.length}...`}
            current={autoIconJob.progress?.current ?? 0}
            total={autoIconJob.progress?.total ?? missingIconCollections.length}
            onCancel={() => cancelJob('auto-icon')}
            className="h-8 px-2.5 text-xs"
          />
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={
              nanoStatus !== 'available' || missingIconCollections.length === 0
            }
            onClick={() => void startAutoIconSweep(collections, links)}
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
