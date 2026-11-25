import { useEffect, useState } from 'react';
import { getPreviewEntry } from '@/lib/previews/cache';
import { getMonogram } from '@/lib/utils/url';

interface CoverCardBannerProps {
  url: string;
  title: string;
  faviconUrl?: string;
  collectionTint?: string;
}

/**
 * Fixed-height (~100px) top banner strip for Cover View cards.
 * Lazily reads cached screenshotBlob (with strict URL.revokeObjectURL cleanup)
 * or ogImageUrl from the v1.4 IndexedDB preview cache, falling back to a sleek
 * tint/accent gradient strip with centered favicon so card grids stay aligned.
 */
export function CoverCardBanner({
  url,
  title,
  faviconUrl,
  collectionTint,
}: CoverCardBannerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [ogImageUrl, setOgImageUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let createdObjectUrl: string | null = null;

    setImageFailed(false);
    setBlobUrl(null);
    setOgImageUrl(null);

    void getPreviewEntry(url).then((entry) => {
      if (!active || !entry) return;
      if (entry.screenshotBlob) {
        createdObjectUrl = URL.createObjectURL(entry.screenshotBlob);
        setBlobUrl(createdObjectUrl);
      } else if (entry.ogImageUrl) {
        setOgImageUrl(entry.ogImageUrl);
      }
    });

    return () => {
      active = false;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [url]);

  const activeImageSrc = !imageFailed ? (blobUrl ?? ogImageUrl) : null;
  const monogram = getMonogram(title, url);
  const tintBase = collectionTint || 'var(--stash-accent)';

  return (
    <div
      className="relative h-[100px] w-full shrink-0 overflow-hidden border-b border-border/70"
      style={{
        backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${tintBase} 20%, var(--stash-panel)) 0%, color-mix(in srgb, ${tintBase} 6%, var(--stash-canvas)) 100%)`,
      }}
    >
      {activeImageSrc ? (
        <img
          src={activeImageSrc}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setImageFailed(true)}
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-card border border-border/80 bg-panel/90 shadow-sm">
            {faviconUrl && !faviconFailed ? (
              <img
                src={faviconUrl}
                alt=""
                width={22}
                height={22}
                loading="lazy"
                draggable={false}
                onError={() => setFaviconFailed(true)}
                className="h-5 w-5 object-contain"
              />
            ) : (
              <span
                aria-hidden="true"
                className="font-mono text-sm font-semibold text-accent"
              >
                {monogram}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
