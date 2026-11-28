import { useState } from 'react';
import {
  getFallbackLinkIcon,
  matchFallbackLinkIcon,
} from '@/lib/icons/catalog';
import { cn } from '@/lib/utils/cn';
import { sanitizeFaviconUrl } from '@/lib/utils/url';

type FaviconSize = 'sm' | 'md' | 'lg';

interface LinkFaviconProps {
  url: string;
  faviconUrl?: string;
  size?: FaviconSize;
  className?: string;
}

const SIZE_STYLES: Record<
  FaviconSize,
  { imgPx: number; imgClass: string; iconClass: string }
> = {
  sm: { imgPx: 14, imgClass: 'h-3.5 w-3.5', iconClass: 'h-3.5 w-3.5' },
  md: { imgPx: 16, imgClass: 'h-4 w-4', iconClass: 'h-4 w-4' },
  lg: { imgPx: 20, imgClass: 'h-5 w-5', iconClass: 'h-5 w-5' },
};

/**
 * Renders a site favicon when available and valid; smoothly falls back to a
 * monochrome domain/path-matched Lucide icon on missing or broken favicons.
 */
export function LinkFavicon({
  url,
  faviconUrl,
  size = 'md',
  className,
}: LinkFaviconProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const safeFaviconUrl = sanitizeFaviconUrl(faviconUrl);
  const spec = SIZE_STYLES[size];
  const showImage = Boolean(safeFaviconUrl) && failedUrl !== safeFaviconUrl;

  if (showImage && safeFaviconUrl) {
    return (
      <img
        src={safeFaviconUrl}
        alt=""
        width={spec.imgPx}
        height={spec.imgPx}
        loading="lazy"
        draggable={false}
        onError={() => setFailedUrl(safeFaviconUrl)}
        className={cn(spec.imgClass, 'object-contain', className)}
      />
    );
  }

  const FallbackIcon = getFallbackLinkIcon(matchFallbackLinkIcon(url));
  return (
    <FallbackIcon
      aria-hidden="true"
      className={cn(spec.iconClass, 'text-fg-muted', className)}
    />
  );
}
