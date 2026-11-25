import { useEffect, useState } from 'react';
import {
  getStoredWallpaper,
  WALLPAPER_CHANGED_EVENT,
} from '@/lib/themes/wallpaper-store';
import type { StashSettings } from '@/lib/types/stash';

interface WallpaperLayerProps {
  settings: StashSettings;
}

export function WallpaperLayer({ settings }: WallpaperLayerProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.wallpaperEnabled) {
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    let cancelled = false;
    let activeUrl: string | null = null;

    const load = async () => {
      const stored = await getStoredWallpaper();
      if (cancelled) return;
      const nextUrl = stored ? URL.createObjectURL(stored.blob) : null;
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
      activeUrl = nextUrl;
      setObjectUrl(nextUrl);
    };

    void load();

    const onChanged = () => {
      void load();
    };
    window.addEventListener(WALLPAPER_CHANGED_EVENT, onChanged);

    return () => {
      cancelled = true;
      window.removeEventListener(WALLPAPER_CHANGED_EVENT, onChanged);
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [settings.wallpaperEnabled]);

  if (!settings.wallpaperEnabled || !objectUrl) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <img
        src={objectUrl}
        alt=""
        className="h-full w-full scale-105 object-cover transition-[filter] duration-150"
        style={{
          filter:
            settings.wallpaperBlur > 0
              ? `blur(${settings.wallpaperBlur}px)`
              : undefined,
        }}
      />
      <div
        className="absolute inset-0 transition-colors duration-150"
        style={{
          backgroundColor: `color-mix(in srgb, var(--stash-canvas) ${settings.wallpaperDim}%, transparent)`,
        }}
      />
    </div>
  );
}
