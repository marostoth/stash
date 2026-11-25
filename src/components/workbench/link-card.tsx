import { useSortable } from '@dnd-kit/react/sortable';
import { Pencil } from 'lucide-react';
import { motion } from 'motion/react';
import { memo, useEffect, useRef, useState } from 'react';
import {
  isTactileMotion,
  TACTILE_SPRING,
  TAG_POP_SPRING,
} from '@/lib/motion/physics';
import { stashRepo } from '@/lib/storage/repo';
import type { LinkItem, MotionMode } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { extractDomain, getMonogram } from '@/lib/utils/url';
import { useUiStore } from '@/store/ui-store';

interface LinkCardProps {
  link: LinkItem;
  index: number;
  openInNewTab: boolean;
  compact: boolean;
  dragDisabled: boolean;
  motionMode: MotionMode;
}

export const LinkCard = memo(function LinkCard({
  link,
  index,
  openInNewTab,
  compact,
  dragDisabled,
  motionMode,
}: LinkCardProps) {
  const openEditLink = useUiStore((s) => s.openEditLink);
  const highlightedLinkId = useUiStore((s) => s.highlightedLinkId);
  const settledLinkId = useUiStore((s) => s.settledLinkId);
  const [faviconFailed, setFaviconFailed] = useState(false);

  // Track which tags were already rendered so only newly appearing tags (e.g. from Nano) pop in
  const seenTagsRef = useRef<Set<string>>(new Set(link.tags));

  useEffect(() => {
    for (const tag of link.tags) {
      seenTagsRef.current.add(tag);
    }
  }, [link.tags]);

  const { ref, isDragging, isDropTarget } = useSortable({
    id: `link:${link.id}`,
    type: 'link',
    accept: ['link', 'open-tab'],
    group: link.collectionId,
    index,
    disabled: dragDisabled,
    data: {
      kind: 'link',
      link,
      collectionId: link.collectionId,
      index,
    },
  });

  const tactile = isTactileMotion(motionMode);
  const isHighlighted = highlightedLinkId === link.id;
  const isSettling = tactile && settledLinkId === link.id;
  const domain = extractDomain(link.url);
  const monogram = getMonogram(link.title, link.url);
  const showFavicon = Boolean(link.faviconUrl) && !faviconFailed;

  const visibleTags = link.tags.slice(0, 3);
  const hiddenTagCount = Math.max(0, link.tags.length - visibleTags.length);

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    openEditLink(link);
  };

  const handleOpen = () => {
    void stashRepo.markLinkOpened(link.id);
  };

  return (
    /* Outer wrapper strictly owns @dnd-kit/react ref & transforms — never apply Motion transforms here */
    <div ref={ref} data-link-id={link.id} className="relative h-full">
      {isDragging ? (
        <div
          aria-hidden="true"
          className={cn(
            'flex h-full flex-col gap-2 rounded-card border border-dashed border-accent/55 bg-panel/35',
            compact ? 'p-2.5' : 'p-3.5',
          )}
        >
          <div className="invisible flex items-start gap-2.5 pr-6">
            <div className="mt-0.5 h-7 w-7 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-sm font-medium leading-snug">
                {link.title}
              </div>
              <div className="mt-0.5 truncate font-mono text-[11px]">
                {domain}
              </div>
            </div>
          </div>
          {link.note && (
            <p className="invisible line-clamp-1 text-xs">{link.note}</p>
          )}
          {visibleTags.length > 0 && (
            <div className="invisible mt-auto flex flex-wrap items-center gap-1 pt-0.5">
              {visibleTags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 font-mono text-[10px]">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <motion.div
          animate={
            isSettling
              ? { scale: [1.035, 0.985, 1], y: [-3, 0, 0] }
              : { scale: 1, y: 0 }
          }
          whileHover={tactile ? { y: -2 } : undefined}
          whileTap={tactile ? { scale: 0.98 } : undefined}
          transition={TACTILE_SPRING}
          className={cn(
            'group relative h-full rounded-card border border-border bg-card transition-colors hover:border-accent/45 hover:bg-card-hover',
            !dragDisabled && 'cursor-grab active:cursor-grabbing',
            isDropTarget && 'border-accent ring-2 ring-accent/40',
            isHighlighted && 'stash-duplicate-pulse',
          )}
        >
          <a
            href={link.url}
            draggable={false}
            target={openInNewTab ? '_blank' : '_self'}
            rel={openInNewTab ? 'noopener noreferrer' : undefined}
            onClick={handleOpen}
            onContextMenu={handleContextMenu}
            className={cn(
              'flex h-full flex-col gap-2 rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
              compact ? 'p-2.5' : 'p-3.5',
            )}
          >
            {/* Header: Favicon + Title */}
            <div className="flex items-start gap-2.5 pr-6">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-control border border-border bg-panel font-mono text-xs font-semibold text-accent">
                {showFavicon ? (
                  <img
                    src={link.faviconUrl}
                    alt=""
                    width={16}
                    height={16}
                    loading="lazy"
                    draggable={false}
                    onError={() => setFaviconFailed(true)}
                    className="h-4 w-4 object-contain"
                  />
                ) : (
                  <span aria-hidden="true">{monogram}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-sm font-medium leading-snug text-fg">
                  {link.title}
                </div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-fg-muted">
                  {domain}
                </div>
              </div>
            </div>

            {/* Optional "Why I saved this" Note */}
            {link.note && (
              <p className="line-clamp-1 text-xs text-fg-muted">{link.note}</p>
            )}

            {/* Optional Tag Pills (newly appearing AI tags pop in with spring) */}
            {visibleTags.length > 0 && (
              <div className="mt-auto flex flex-wrap items-center gap-1 pt-0.5">
                {visibleTags.map((tag) => {
                  const isNewlyAdded = !seenTagsRef.current.has(tag);
                  return (
                    <motion.span
                      key={tag}
                      initial={
                        isNewlyAdded && tactile
                          ? { scale: 0.7, opacity: 0 }
                          : false
                      }
                      animate={{ scale: 1, opacity: 1 }}
                      transition={TAG_POP_SPRING}
                      className="rounded-pill border border-border bg-panel px-2 py-0.5 font-mono text-[10px] text-fg-muted"
                    >
                      #{tag}
                    </motion.span>
                  );
                })}
                {hiddenTagCount > 0 && (
                  <span className="font-mono text-[10px] text-fg-muted">
                    +{hiddenTagCount}
                  </span>
                )}
              </div>
            )}
          </a>

          {/* Hover Quick Edit Trigger */}
          <button
            type="button"
            data-dnd-no-drag="true"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openEditLink(link);
            }}
            aria-label={`Edit ${link.title}`}
            title="Quick edit (or right-click card)"
            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-control border border-transparent bg-panel/90 text-fg-muted opacity-0 transition-all hover:border-border hover:text-fg focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 group-hover:opacity-100 cursor-pointer"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </div>
  );
});
