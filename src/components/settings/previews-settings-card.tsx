import { Eye, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { clearPreviewCache, getPreviewCacheCount } from '@/lib/previews/cache';
import {
  hasVisualPreviewPermission,
  requestVisualPreviewPermission,
} from '@/lib/previews/permissions';
import { stashRepo } from '@/lib/storage/repo';
import type { StashSettings } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

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
    <div className="space-y-2.5 rounded-card border border-border bg-canvas p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-accent" />
          <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
            Previews
          </h3>
        </div>
        <span
          className={cn(
            'rounded-pill border px-2 py-0.5 font-mono text-[10px] uppercase',
            effectiveVisualEnabled
              ? 'border-accent/40 bg-accent/15 text-accent'
              : 'border-border bg-panel text-fg-muted',
          )}
        >
          {effectiveVisualEnabled ? 'Visual Active' : 'Text Only'}
        </span>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-xs text-fg">
        <span>Hover previews (500ms pause or Space to peek)</span>
        <input
          type="checkbox"
          checked={settings.hoverPreviews}
          onChange={() =>
            void stashRepo.updateSettings({
              hoverPreviews: !settings.hoverPreviews,
            })
          }
          className="h-4 w-4 accent-[var(--stash-accent)] cursor-pointer"
        />
      </label>

      <div className="flex items-center justify-between gap-3 py-1 text-xs text-fg">
        <span>Visual Previews (Screenshots &amp; Site Cards)</span>
        <button
          type="button"
          role="switch"
          aria-checked={effectiveVisualEnabled}
          disabled={busy}
          onClick={handleToggleVisualPreviews}
          className={cn(
            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50',
            effectiveVisualEnabled
              ? 'border-accent bg-accent'
              : 'border-border bg-panel',
          )}
        >
          <span
            className={cn(
              'pointer-events-none block h-3.5 w-3.5 rounded-full bg-canvas shadow-sm transition-transform',
              effectiveVisualEnabled ? 'translate-x-4' : 'translate-x-0.5',
            )}
          />
        </button>
      </div>

      {lastError ? (
        <p className="rounded-control border border-danger/40 bg-danger/10 px-2.5 py-1.5 font-mono text-[11px] text-danger">
          Chrome error: {lastError}
        </p>
      ) : null}

      <p className="text-[11px] leading-relaxed text-fg-muted">
        Opt-in local-only previews: caches compressed tab snapshots as you
        browse and falls back to Open Graph metadata on hover. Skips incognito,
        login, checkout, and password-manager pages. Stored separately in local
        IndexedDB (never exported in JSON backups).
      </p>

      <div className="pt-1">
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || cacheCount === 0}
          onClick={() => void handleClearCache()}
          className="gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5 text-fg-muted" />
          Clear Preview Cache ({cacheCount})
        </Button>
      </div>
    </div>
  );
}
