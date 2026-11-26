import { Cpu, Download, Loader2 } from 'lucide-react';
import { RulesManager } from '@/components/settings/rules-manager';
import {
  SettingsSectionCard,
  SettingsToggleRow,
} from '@/components/settings/settings-section-card';
import { Button } from '@/components/ui/button';
import type { NanoAvailabilityStatus } from '@/lib/categorizer/types';
import { startNanoModelDownload } from '@/lib/jobs/background-sweeps';
import { stashRepo } from '@/lib/storage/repo';
import type {
  CategorizationRule,
  Collection,
  StashSettings,
} from '@/lib/types/stash';
import { useBackgroundJobsStore } from '@/store/background-jobs-store';

interface AiRulesPanelProps {
  collections: readonly Collection[];
  rules: readonly CategorizationRule[];
  settings: StashSettings;
  nanoStatus: NanoAvailabilityStatus;
  onNanoStatusChange: (status: NanoAvailabilityStatus) => void;
}

export function AiRulesPanel({
  collections,
  rules,
  settings,
  nanoStatus,
  onNanoStatusChange,
}: AiRulesPanelProps) {
  const downloadJob = useBackgroundJobsStore((s) =>
    s.jobs.find((job) => job.id === 'nano-download'),
  );
  const downloadProgress =
    downloadJob?.status === 'running'
      ? (downloadJob.progress?.current ?? 0)
      : null;

  const badgeTone =
    nanoStatus === 'available'
      ? 'accent'
      : nanoStatus === 'downloadable' || nanoStatus === 'downloading'
        ? 'warning'
        : 'neutral';

  const handleDownloadModel = async () => {
    await startNanoModelDownload((refreshed) => onNanoStatusChange(refreshed));
  };

  return (
    <div className="space-y-6">
      <SettingsSectionCard
        icon={<Cpu className="h-4 w-4" />}
        title="On-Device AI (Chrome Gemini Nano)"
        subtitle="Runs locally inside Chrome when no Tier 1 rule matches to suggest collections, up to 3 tags, and short summary notes. Never sends your bookmarks to external servers."
        badge={{ label: nanoStatus, tone: badgeTone }}
      >
        <div className="divide-y divide-border/55">
          <SettingsToggleRow
            id="settings-enable-ai"
            label="Use On-Device AI fallback when available"
            hint="Automatically classify new links during Auto-Categorize when no custom rule matches."
            checked={settings.enableOnDeviceAi}
            onCheckedChange={(checked) =>
              void stashRepo.updateSettings({ enableOnDeviceAi: checked })
            }
          />

          <SettingsToggleRow
            id="settings-auto-tag-on-save"
            label="Auto-tag manually added links"
            hint="Quietly suggest up to 3 concise tags right after you stash or create a link."
            checked={settings.autoTagOnSave}
            onCheckedChange={(checked) =>
              void stashRepo.updateSettings({ autoTagOnSave: checked })
            }
          />
        </div>

        {nanoStatus === 'downloadable' || downloadProgress !== null ? (
          <div className="space-y-2 pt-1">
            <Button
              variant="primary"
              size="sm"
              disabled={downloadProgress !== null}
              onClick={() => void handleDownloadModel()}
            >
              {downloadProgress !== null ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {downloadProgress !== null
                ? `Downloading model (${downloadProgress}%)...`
                : 'Enable On-Device AI (Download Model)'}
            </Button>

            {downloadProgress !== null ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between font-mono text-[10px] text-fg-muted">
                  <span>Downloading Chrome Gemini Nano model...</span>
                  <span>{downloadProgress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-150"
                    style={{ width: `${Math.min(100, downloadProgress)}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </SettingsSectionCard>

      <RulesManager rules={rules} collections={collections} />
    </div>
  );
}
