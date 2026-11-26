import { Check, Pin, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { LinkFavicon } from '@/components/LinkFavicon';
import { stashRepo } from '@/lib/storage/repo';
import type { LinkItem } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { extractDomain } from '@/lib/utils/url';

interface QuickLaunchBarProps {
  links: readonly LinkItem[];
  activeSpaceCollectionIds: ReadonlySet<string>;
  openInNewTab: boolean;
  wideBoard: boolean;
}

/**
 * Compact 1-click Quick Launch dock right below the Space bar.
 * Displays explicitly pinned links (`pinnedToDock`), or falls back to up to 8
 * starred links in the active Space until the user pins custom favorites.
 */
export function QuickLaunchBar({
  links,
  activeSpaceCollectionIds,
  openInNewTab,
  wideBoard,
}: QuickLaunchBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const pickerInputRef = useRef<HTMLInputElement | null>(null);

  const pinnedLinks = useMemo(
    () => links.filter((l) => l.pinnedToDock === true),
    [links],
  );
  const fallbackStarred = useMemo(
    () =>
      pinnedLinks.length > 0
        ? []
        : links
            .filter(
              (l) =>
                l.starred === true &&
                activeSpaceCollectionIds.has(l.collectionId),
            )
            .slice(0, 8),
    [activeSpaceCollectionIds, links, pinnedLinks.length],
  );

  const usingCustomPins = pinnedLinks.length > 0;
  const dockLinks = usingCustomPins ? pinnedLinks : fallbackStarred;

  useEffect(() => {
    if (!pickerOpen) return;
    requestAnimationFrame(() => pickerInputRef.current?.focus());
    const onPointerDown = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        event.target instanceof Node &&
        !popoverRef.current.contains(event.target)
      ) {
        setPickerOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [pickerOpen]);

  const pickerCandidates = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const filtered = q
      ? links.filter(
          (l) =>
            l.title.toLowerCase().includes(q) ||
            l.url.toLowerCase().includes(q),
        )
      : links;
    return [...filtered]
      .sort(
        (a, b) =>
          Number(Boolean(b.pinnedToDock)) - Number(Boolean(a.pinnedToDock)),
      )
      .slice(0, 14);
  }, [links, pickerQuery]);

  if (dockLinks.length === 0 && !pickerOpen) {
    return null;
  }

  const handleTogglePin = async (link: LinkItem) => {
    const nextPinned = !link.pinnedToDock;
    await stashRepo.updateLink(link.id, { pinnedToDock: nextPinned });
  };

  const handleHideBar = () => {
    void stashRepo.updateSettings({ quickLaunchVisible: false });
    toast.info('Quick Launch hidden — re-enable anytime in Settings → General');
  };

  return (
    <div
      ref={popoverRef}
      className="relative z-[15] border-b border-border/60 bg-canvas/70 backdrop-blur-xs"
    >
      <div className="px-4 sm:px-6">
        <div
          className={cn(
            'mx-auto flex items-center justify-between gap-2 py-1',
            wideBoard ? 'max-w-[1720px]' : 'max-w-[1320px]',
          )}
        >
          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
            <span
              className="inline-flex shrink-0 items-center gap-1 pr-1 font-mono text-[10px] uppercase tracking-wider text-fg-muted/85"
              title={
                usingCustomPins
                  ? 'Pinned Quick Launch sites'
                  : 'Showing Starred sites — click + to pin custom Quick Launch sites'
              }
            >
              <Pin className="h-2.5 w-2.5 text-accent" />
              <span className="hidden sm:inline">Quick</span>
            </span>

            {dockLinks.map((link) => (
              <div
                key={link.id}
                className="group/pill relative inline-flex shrink-0 items-center rounded-pill border border-border/80 bg-panel/90 transition-colors hover:border-accent/55 hover:bg-card"
              >
                <a
                  href={link.url}
                  target={openInNewTab ? '_blank' : '_self'}
                  rel={openInNewTab ? 'noopener noreferrer' : undefined}
                  onClick={() => void stashRepo.markLinkOpened(link.id)}
                  title={`${link.title}\n${extractDomain(link.url)}`}
                  className="inline-flex h-6 max-w-[150px] items-center gap-1.5 px-2 text-[11px] font-medium text-fg hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-pill"
                >
                  <LinkFavicon
                    url={link.url}
                    faviconUrl={link.faviconUrl}
                    size="sm"
                  />
                  <span className="truncate">{link.title}</span>
                </a>
                {usingCustomPins && (
                  <button
                    type="button"
                    onClick={() => void handleTogglePin(link)}
                    aria-label={`Unpin ${link.title} from Quick Launch`}
                    title="Unpin"
                    className="mr-1 hidden h-4 w-4 items-center justify-center rounded-full text-fg-muted hover:bg-canvas hover:text-danger group-hover/pill:inline-flex cursor-pointer"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                setPickerQuery('');
                setPickerOpen((prev) => !prev);
              }}
              aria-expanded={pickerOpen}
              title="Pin or unpin Quick Launch links"
              className={cn(
                'inline-flex h-6 shrink-0 items-center gap-1 rounded-pill border border-dashed px-2 font-mono text-[10px] transition-colors cursor-pointer',
                pickerOpen
                  ? 'border-accent/70 bg-accent/15 text-accent'
                  : 'border-border text-fg-muted hover:border-accent/50 hover:text-fg',
              )}
            >
              <Plus className="h-2.5 w-2.5" />
              <span>Pin</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleHideBar}
            aria-label="Hide Quick Launch bar"
            title="Hide Quick Launch strip (re-enable in Settings → General)"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-fg-muted/70 transition-colors hover:bg-panel hover:text-fg cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Inline Quick Pin Picker Popover */}
      {pickerOpen && (
        <div className="px-4 sm:px-6">
          <div
            className={cn(
              'mx-auto relative',
              wideBoard ? 'max-w-[1720px]' : 'max-w-[1320px]',
            )}
          >
            <div className="absolute left-0 top-1 z-30 w-80 rounded-card border border-border bg-panel p-2.5 shadow-xl">
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
                <input
                  ref={pickerInputRef}
                  type="text"
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="Search links to pin..."
                  className="h-7 w-full rounded-control border border-border bg-canvas pl-7 pr-2 text-xs text-fg placeholder:text-fg-muted/70 focus:border-accent focus:outline-none"
                />
              </div>
              <div className="max-h-56 space-y-0.5 overflow-y-auto">
                {pickerCandidates.map((link) => {
                  const pinned = link.pinnedToDock === true;
                  return (
                    <button
                      key={link.id}
                      type="button"
                      onClick={() => void handleTogglePin(link)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-xs transition-colors cursor-pointer',
                        pinned
                          ? 'bg-accent/12 text-fg'
                          : 'text-fg-muted hover:bg-card hover:text-fg',
                      )}
                    >
                      <LinkFavicon
                        url={link.url}
                        faviconUrl={link.faviconUrl}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {link.title}
                      </span>
                      {pinned ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                      ) : (
                        <Plus className="h-3 w-3 shrink-0 opacity-50" />
                      )}
                    </button>
                  );
                })}
                {pickerCandidates.length === 0 && (
                  <p className="py-3 text-center text-[11px] text-fg-muted">
                    No matching links
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
