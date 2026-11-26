import { Eye, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  SettingsSectionCard,
  SettingsToggleRow,
} from '@/components/settings/settings-section-card';
import { Button } from '@/components/ui/button';
import { clearPreviewCache, getPreviewCacheCount } from '@/lib/previews/cache';
import {
  hasVisualPreviewPermission,
  requestVisualPreviewPermission,
} from '@/lib/previews/permissions';
import { stashRepo } from '@/lib/storage/repo';
import type { StashSettings } from '@/lib/types/stash';

interface PreviewsSettingsCardProps {
  settings: StashSettings;
  settingsOpen: boolean;
}

export function PreviewsSettingsCard({
  settings,
  settingsOpen,
}: PreviewsSettingsCardProps) {
  const [hasPermission, setHasPermission] = useState(false);
  const [cacheCount, setCacheCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const refreshState = useCallback(async () => {
    const [granted, count] = await Promise.all([
      hasVisualPreviewPermission(),
      getPreviewCacheCount(),
    ]);
    setHasPermission(granted);
    setCacheCount(count);
    if (granted) {
      setLastError(null);
    }
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    void refreshState();
    const onFocus = () => void refreshState();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [settingsOpen, refreshState]);

  const effectiveVisualEnabled =
    settings.visualPreviewsEnabled && hasPermission;

  const handleToggleVisualPreviews = () => {
    if (busy) return;
    if (effectiveVisualEnabled) {
      setBusy(true);
      void stashRepo
        .updateSettings({ visualPreviewsEnabled: false })
        .then(() => toast.info('Visual previews turned off'))
        .finally(() => setBusy(false));
      return;
    }

    if (hasPermission) {
      setBusy(true);
      setLastError(null);
      void stashRepo
        .updateSettings({ visualPreviewsEnabled: true })
        .then(() => toast.success('Visual previews enabled'))
        .finally(() => setBusy(false));
      return;
    }

    // Call permissions.request() synchronously as the VERY FIRST operation
    // inside this click handler before any state updates or awaits.
    const requestPromise = requestVisualPreviewPermission();
    setBusy(true);
    setLastError(null);
    void requestPromise
      .then(async (result) => {
        setHasPermission(result.granted);
        if (!result.granted) {
          await stashRepo.updateSettings({ visualPreviewsEnabled: false });
          if (result.error) {
            setLastError(result.error);
            toast.error(`Site access permission error: ${result.error}`);
          } else {
            toast.info(
              'Site access permission was not granted. Text hover previews remain active.',
            );
          }
          return;
        }

        await stashRepo.updateSettings({ visualPreviewsEnabled: true });
        toast.success('Visual previews enabled');
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const handleClearCache = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await clearPreviewCache();
      setCacheCount(0);
      toast.success('Preview cache cleared');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSectionCard
      icon={<Eye className="h-4 w-4" />}
      title="Hover & Visual Previews"
      subtitle="Inspect full titles, notes, and optional local page snapshots before opening a link."
      badge={{
        label: effectiveVisualEnabled ? 'Visual On' : 'Text Only',
        tone: effectiveVisualEnabled ? 'accent' : 'neutral',
      }}
    >
      <div className="divide-y divide-border/55">
        <SettingsToggleRow
          id="settings-hover-previews"
          label="Hover previews"
          hint="Pause 500ms or press Space while hovering a card to peek at its full details."
          checked={settings.hoverPreviews}
          onCheckedChange={(checked) =>
            void stashRepo.updateSettings({ hoverPreviews: checked })
          }
        />

        <SettingsToggleRow
          id="settings-visual-previews"
          label="Visual Previews (Screenshots & Site Cards)"
          hint="Local-only IndexedDB cache; skips incognito, login, and checkout pages."
          checked={effectiveVisualEnabled}
          disabled={busy}
          onCheckedChange={handleToggleVisualPreviews}
        />
      </div>

      {lastError ? (
        <p className="rounded-control border border-danger/40 bg-danger/10 px-3 py-2 font-mono text-[11px] text-danger">
          Chrome error: {lastError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
        <span className="text-xs text-fg-muted">
          {cacheCount === 0
            ? 'No cached page snapshots stored locally.'
            : `${cacheCount} cached snapshot${cacheCount === 1 ? '' : 's'} stored in local IndexedDB.`}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || cacheCount === 0}
          onClick={() => void handleClearCache()}
          className="gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5 text-fg-muted" />
          Clear Cache ({cacheCount})
        </Button>
      </div>
    </SettingsSectionCard>
  );
}
