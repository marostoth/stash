import { HeartPulse, Sparkles, Tag, Wand2 } from 'lucide-react';
import { useMemo } from 'react';
import { SettingsSectionCard } from '@/components/settings/settings-section-card';
import { InlineProgressPill } from '@/components/ui/ai-activity-panel';
import { Button } from '@/components/ui/button';
import { useAutoTagSweep } from '@/hooks/use-auto-tag-sweep';
import type { NanoAvailabilityStatus } from '@/lib/categorizer/types';
import { startAutoIconSweep } from '@/lib/jobs/background-sweeps';
import { filterEligibleLinks } from '@/lib/tagging/auto-tagger';
import type { Collection, LinkItem } from '@/lib/types/stash';
import { useBackgroundJobsStore } from '@/store/background-jobs-store';

interface LibraryToolsPanelProps {
  collections: readonly Collection[];
  links: readonly LinkItem[];
  nanoStatus: NanoAvailabilityStatus;
  onOpenHealthCheck: () => void;
  onOpenReorganize: () => void;
}

export function LibraryToolsPanel({
  collections,
  links,
  nanoStatus,
  onOpenHealthCheck,
  onOpenReorganize,
}: LibraryToolsPanelProps) {
  const autoTagAll = useAutoTagSweep();
  const autoIconJob = useBackgroundJobsStore((s) =>
    s.jobs.find((job) => job.id === 'auto-icon'),
  );
  const cancelJob = useBackgroundJobsStore((s) => s.cancelJob);

  const missingIconCount = useMemo(
    () => collections.filter((c) => !c.icon).length,
    [collections],
  );
  const untaggedCount = useMemo(
    () => filterEligibleLinks(links).length,
    [links],
  );

  const iconifying = autoIconJob?.status === 'running';
  const nanoReady = nanoStatus === 'available';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* 1. Library Health Check */}
        <SettingsSectionCard
          icon={<HeartPulse className="h-4 w-4" />}
          title="Library Health Check"
          subtitle="Detect dead links, parked domains, root redirects, duplicates, and dev clutter with safe bulk Undo."
          badge={{ label: `${links.length} links`, tone: 'neutral' }}
          className="flex flex-col justify-between"
        >
          <div className="pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenHealthCheck}
              className="gap-1.5"
            >
              <HeartPulse className="h-3.5 w-3.5 text-accent" />
              Library Health Check ({links.length})
            </Button>
          </div>
        </SettingsSectionCard>

        {/* 2. Smart Reorganize (AI) */}
        <SettingsSectionCard
          icon={<Sparkles className="h-4 w-4" />}
          title="Smart Reorganize"
          subtitle="2-pass Gemini Nano workflow that proposes clean categories with a human checkpoint and full Undo."
          badge={{
            label: nanoReady ? 'AI Ready' : 'Needs AI',
            tone: nanoReady ? 'accent' : 'neutral',
          }}
          className="flex flex-col justify-between"
        >
          <div className="pt-1">
            <Button
              variant="secondary"
              size="sm"
              disabled={!nanoReady || links.length === 0}
              onClick={onOpenReorganize}
              title={
                !nanoReady
                  ? 'Requires Chrome on-device Gemini Nano (enable in AI & Rules)'
                  : 'Restructure collections with 2-pass on-device AI'
              }
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Smart Reorganize
            </Button>
          </div>
        </SettingsSectionCard>

        {/* 3. Auto-Icon Collections */}
        <SettingsSectionCard
          icon={<Wand2 className="h-4 w-4" />}
          title="Auto-Icon Collections"
          subtitle="Assign matching icons from Stash's catalog to collections currently missing an icon."
          badge={{
            label: `${missingIconCount} missing`,
            tone: missingIconCount > 0 ? 'accent' : 'neutral',
          }}
          className="flex flex-col justify-between"
        >
          <div className="pt-1">
            {iconifying ? (
              <InlineProgressPill
                label={`Icons ${autoIconJob.progress?.current ?? 0} / ${autoIconJob.progress?.total ?? missingIconCount}...`}
                current={autoIconJob.progress?.current ?? 0}
                total={autoIconJob.progress?.total ?? missingIconCount}
                onCancel={() => cancelJob('auto-icon')}
                className="h-8 px-2.5 text-xs"
              />
            ) : (
              <Button
                variant="secondary"
                size="sm"
                disabled={!nanoReady || missingIconCount === 0}
                onClick={() => void startAutoIconSweep(collections, links)}
                title={
                  !nanoReady
                    ? 'Requires Chrome on-device Gemini Nano (enable in AI & Rules)'
                    : missingIconCount === 0
                      ? 'Every collection already has an icon'
                      : 'Assign matching icons to collections missing one'
                }
                className="gap-1.5"
              >
                <Wand2 className="h-3.5 w-3.5 text-accent" />
                Auto-Icon Collections ({missingIconCount})
              </Button>
            )}
          </div>
        </SettingsSectionCard>

        {/* 4. Auto-Tag All Untagged */}
        <SettingsSectionCard
          icon={<Tag className="h-4 w-4" />}
          title="Auto-Tag All Untagged"
          subtitle="Run a batch on-device Gemini Nano pass to add up to 3 tags to untagged, unlocked links."
          badge={{
            label: `${untaggedCount} untagged`,
            tone: untaggedCount > 0 ? 'accent' : 'neutral',
          }}
          className="flex flex-col justify-between"
        >
          <div className="pt-1">
            {autoTagAll.running ? (
              <InlineProgressPill
                label={`Tagging ${autoTagAll.progress?.current ?? 1} / ${autoTagAll.progress?.total ?? untaggedCount}...`}
                current={autoTagAll.progress?.current ?? 1}
                total={autoTagAll.progress?.total ?? untaggedCount}
                onCancel={autoTagAll.cancel}
                className="h-8 px-2.5 text-xs"
              />
            ) : (
              <Button
                variant="secondary"
                size="sm"
                disabled={!nanoReady || untaggedCount === 0}
                onClick={() => void autoTagAll.start()}
                title={
                  !nanoReady
                    ? 'Requires Chrome on-device Gemini Nano (enable in AI & Rules)'
                    : untaggedCount === 0
                      ? 'No untagged, unlocked links remaining'
                      : 'Auto-tag all untagged links with Gemini Nano'
                }
                className="gap-1.5"
              >
                <Tag className="h-3.5 w-3.5 text-accent" />
                Auto-Tag All ({untaggedCount})
              </Button>
            )}
          </div>
        </SettingsSectionCard>
      </div>

      <p className="font-mono text-[10px] text-fg-muted">
        Running tasks continue in the bottom-right activity tray if you close
        Settings.
        {!nanoReady
          ? ` AI tools require Chrome Gemini Nano (current status: ${nanoStatus}).`
          : ''}
      </p>
    </div>
  );
}
