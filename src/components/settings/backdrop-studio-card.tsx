import { Image as ImageIcon, Layers, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { SettingsSectionCard } from '@/components/settings/settings-section-card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { stashRepo } from '@/lib/storage/repo';
import { BACKDROP_STYLE_OPTIONS } from '@/lib/themes/presets';
import {
  clearStoredWallpaper,
  getStoredWallpaper,
  type StoredWallpaper,
  saveStoredWallpaper,
  WALLPAPER_CHANGED_EVENT,
} from '@/lib/themes/wallpaper-store';
import type {
  BackdropOverride,
  StashSettings,
  ThemeDefinition,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

const MAX_WALLPAPER_BYTES = 25 * 1024 * 1024;

interface BackdropStudioCardProps {
  activeTheme: ThemeDefinition;
  settings: StashSettings;
}

export function BackdropStudioCard({
  activeTheme,
  settings,
}: BackdropStudioCardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [storedWallpaper, setStoredWallpaper] =
    useState<StoredWallpaper | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let activeUrl: string | null = null;

    const refresh = async () => {
      const item = await getStoredWallpaper();
      if (cancelled) return;
      setStoredWallpaper(item);
      const nextUrl = item ? URL.createObjectURL(item.blob) : null;
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
      activeUrl = nextUrl;
      setPreviewUrl(nextUrl);
    };

    void refresh();
    const onChanged = () => {
      void refresh();
    };
    window.addEventListener(WALLPAPER_CHANGED_EVENT, onChanged);

    return () => {
      cancelled = true;
      window.removeEventListener(WALLPAPER_CHANGED_EVENT, onChanged);
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, []);

  const themeDefaultLabel =
    BACKDROP_STYLE_OPTIONS.find(
      (opt) => opt.id === (activeTheme.backdropStyle ?? 'flat'),
    )?.label ?? 'Flat';

  const handleBackdropOverride = (override: BackdropOverride) => {
    void stashRepo.updateSettings({ backdropOverride: override });
  };

  const handlePickWallpaper = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please pick an image file (PNG, JPG, WebP, or AVIF).');
      return;
    }
    if (file.size > MAX_WALLPAPER_BYTES) {
      toast.error('Image is larger than 25 MB — please choose a smaller file.');
      return;
    }

    setUploading(true);
    try {
      const saved = await saveStoredWallpaper(file);
      if (!saved) {
        toast.error('Could not save wallpaper in local browser storage.');
        return;
      }
      await stashRepo.updateSettings({ wallpaperEnabled: true });
      toast.success(`Wallpaper set to "${saved.filename}"`);
    } catch {
      toast.error('Failed to process wallpaper image.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveWallpaper = async () => {
    await clearStoredWallpaper();
    await stashRepo.updateSettings({ wallpaperEnabled: false });
    toast.success('Removed local wallpaper');
  };

  return (
    <SettingsSectionCard
      icon={<Layers className="h-4 w-4" />}
      title="Canvas Backdrop & Wallpaper"
      badge={{
        label:
          settings.backdropOverride === 'theme'
            ? `${themeDefaultLabel}`
            : 'Override Active',
        tone: settings.backdropOverride === 'theme' ? 'neutral' : 'accent',
      }}
    >
      {/* 1. Quick Canvas Backdrop Override */}
      <div className="space-y-2">
        <p className="text-[11px] text-fg-muted">
          Override the background texture on any built-in or custom theme.
        </p>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => handleBackdropOverride('theme')}
            title={`Follow active theme default (${themeDefaultLabel})`}
            className={cn(
              'rounded-control border px-2 py-1.5 text-left text-[11px] font-medium transition-colors cursor-pointer',
              settings.backdropOverride === 'theme'
                ? 'border-accent/70 bg-accent/15 text-accent'
                : 'border-border bg-panel/60 text-fg-muted hover:border-border/80 hover:text-fg',
            )}
          >
            Theme Default
          </button>

          {BACKDROP_STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleBackdropOverride(opt.id)}
              className={cn(
                'rounded-control border px-2 py-1.5 text-left text-[11px] font-medium transition-colors cursor-pointer',
                settings.backdropOverride === opt.id
                  ? 'border-accent/70 bg-accent/15 text-accent'
                  : 'border-border bg-panel/60 text-fg-muted hover:border-border/80 hover:text-fg',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Local Wallpaper */}
      <div className="space-y-2.5 border-t border-border/70 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-accent" />
              <h3 className="text-xs font-semibold text-fg">Local Wallpaper</h3>
            </div>
            <p className="mt-0.5 text-[11px] text-fg-muted">
              Saved locally in your browser (never uploaded or included in JSON
              backups).
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="h-7 gap-1.5 px-2.5 text-[11px]"
            >
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ImageIcon className="h-3 w-3 text-accent" />
              )}
              {uploading
                ? 'Optimizing...'
                : storedWallpaper
                  ? 'Change Image'
                  : 'Choose Image'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => void handlePickWallpaper(e)}
              className="hidden"
            />
          </div>
        </div>

        {storedWallpaper ? (
          <div className="space-y-2.5 rounded-control border border-border bg-panel/60 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt=""
                    className="h-9 w-14 shrink-0 rounded border border-border object-cover"
                  />
                ) : null}
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-fg">
                    {storedWallpaper.filename}
                  </div>
                  <div className="font-mono text-[10px] text-fg-muted">
                    {Math.max(1, Math.round(storedWallpaper.blob.size / 1024))}{' '}
                    KB local
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <label
                    htmlFor="settings-wallpaper-show"
                    className="cursor-pointer text-[11px] text-fg select-none"
                  >
                    Show
                  </label>
                  <Switch
                    id="settings-wallpaper-show"
                    checked={settings.wallpaperEnabled}
                    onCheckedChange={(checked) =>
                      void stashRepo.updateSettings({
                        wallpaperEnabled: checked,
                      })
                    }
                  />
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleRemoveWallpaper()}
                  className="h-7 gap-1 px-2 text-[11px] hover:text-danger"
                  title="Remove stored wallpaper"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </Button>
              </div>
            </div>

            <div
              className={cn(
                'grid gap-3 pt-1 sm:grid-cols-2',
                !settings.wallpaperEnabled && 'opacity-50',
              )}
            >
              <label className="space-y-1 text-[11px]">
                <div className="flex items-center justify-between text-fg-muted">
                  <span>Dim Overlay</span>
                  <span className="font-mono text-[10px] text-fg">
                    {settings.wallpaperDim}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={85}
                  step={5}
                  value={settings.wallpaperDim}
                  disabled={!settings.wallpaperEnabled}
                  onChange={(e) =>
                    void stashRepo.updateSettings({
                      wallpaperDim: Number(e.target.value),
                    })
                  }
                  className="w-full cursor-pointer accent-[var(--stash-accent)]"
                />
              </label>

              <label className="space-y-1 text-[11px]">
                <div className="flex items-center justify-between text-fg-muted">
                  <span>Blur</span>
                  <span className="font-mono text-[10px] text-fg">
                    {settings.wallpaperBlur}px
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={24}
                  step={1}
                  value={settings.wallpaperBlur}
                  disabled={!settings.wallpaperEnabled}
                  onChange={(e) =>
                    void stashRepo.updateSettings({
                      wallpaperBlur: Number(e.target.value),
                    })
                  }
                  className="w-full cursor-pointer accent-[var(--stash-accent)]"
                />
              </label>
            </div>
          </div>
        ) : null}
      </div>
    </SettingsSectionCard>
  );
}
