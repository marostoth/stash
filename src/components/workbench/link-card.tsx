import { useSortable } from '@dnd-kit/react/sortable';
import { Pencil } from 'lucide-react';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from 'motion/react';
import { memo, useEffect, useRef, useState } from 'react';
import { DropSparks } from '@/components/workbench/drop-sparks';
import { playHoverRiffle } from '@/lib/audio/foley';
import {
  ARCADE_HEADSHAKE_KEYFRAMES,
  ARCADE_HEADSHAKE_TRANSITION,
  ARCADE_SQUASH_KEYFRAMES,
  ARCADE_SQUASH_TRANSITION,
  ARCADE_TAG_POP_SPRING,
  computeCascadeDelay,
  computeFoilTilt,
  FOIL_PERSPECTIVE_PX,
  FOIL_SPRING_CONFIG,
  isArcadeMotion,
  isTactileMotion,
  TACTILE_SPRING,
  TAG_POP_SPRING,
} from '@/lib/motion/presets';
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
  cascadeActive: boolean;
}

export const LinkCard = memo(function LinkCard({
  link,
  index,
  openInNewTab,
  compact,
  dragDisabled,
  motionMode,
  cascadeActive,
}: LinkCardProps) {
  const openEditLink = useUiStore((s) => s.openEditLink);
  const highlightedLinkId = useUiStore((s) => s.highlightedLinkId);
  const settledLinkId = useUiStore((s) => s.settledLinkId);
  const isTagging = useUiStore((s) => s.taggingLinkIds.includes(link.id));
  const [faviconFailed, setFaviconFailed] = useState(false);

  // Track previously rendered tags so only newly arriving AI tags pop in
  const seenTagsRef = useRef<Set<string>>(new Set(link.tags));
  useEffect(() => {
    for (const tag of link.tags) {
      seenTagsRef.current.add(tag);
    }
  }, [link.tags]);

  // 3D foil hover MotionValues (zero React state updates on pointer move)
  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  const glareOpacity = useMotionValue(0);

  const rotateX = useSpring(rawRotateX, FOIL_SPRING_CONFIG);
  const rotateY = useSpring(rawRotateY, FOIL_SPRING_CONFIG);
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, color-mix(in srgb, var(--stash-accent) 20%, transparent) 0%, color-mix(in srgb, var(--stash-accent) 6%, transparent) 38%, transparent 68%)`;

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

  const arcade = isArcadeMotion(motionMode);
  const tactile = isTactileMotion(motionMode);
  const isHighlighted = highlightedLinkId === link.id;
  const isSettling = tactile && settledLinkId === link.id;
  const domain = extractDomain(link.url);
  const monogram = getMonogram(link.title, link.url);
  const showFavicon = Boolean(link.faviconUrl) && !faviconFailed;

  const visibleTags = link.tags.slice(0, 3);
  const hiddenTagCount = Math.max(0, link.tags.length - visibleTags.length);

  // Reset foil tilt cleanly if Arcade mode turns off or card starts dragging
  useEffect(() => {
    if (!arcade || isDragging) {
      rawRotateX.set(0);
      rawRotateY.set(0);
      glareOpacity.set(0);
    }
  }, [arcade, isDragging, rawRotateX, rawRotateY, glareOpacity]);

  const handlePointerEnter = () => {
    if (!arcade) return;
    glareOpacity.set(1);
    playHoverRiffle();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!arcade) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const relX = (event.clientX - rect.left) / rect.width;
    const relY = (event.clientY - rect.top) / rect.height;
    const tilt = computeFoilTilt(relX, relY);
    rawRotateX.set(tilt.rotateX);
    rawRotateY.set(tilt.rotateY);
    glareX.set(tilt.glareX);
    glareY.set(tilt.glareY);
  };

  const handlePointerLeave = () => {
    if (!arcade) return;
    rawRotateX.set(0);
    rawRotateY.set(0);
    glareOpacity.set(0);
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    openEditLink(link);
  };

  const handleOpen = () => {
    void stashRepo.markLinkOpened(link.id);
  };

  const cardAnimate =
    isHighlighted && arcade
      ? {
          ...ARCADE_HEADSHAKE_KEYFRAMES,
          opacity: 1,
          y: 0,
          rotate: 0,
          scale: 1,
          scaleX: 1,
          scaleY: 1,
        }
      : isSettling && arcade
        ? {
            ...ARCADE_SQUASH_KEYFRAMES,
            opacity: 1,
            x: 0,
            y: 0,
            rotate: 0,
          }
        : isSettling
          ? {
              scale: [1.035, 0.985, 1],
              y: [-3, 0, 0],
              opacity: 1,
              x: 0,
              rotate: 0,
            }
          : {
              opacity: 1,
              x: 0,
              y: 0,
              rotate: 0,
              scale: 1,
              scaleX: 1,
              scaleY: 1,
            };

  const cardTransition =
    isHighlighted && arcade
      ? ARCADE_HEADSHAKE_TRANSITION
      : isSettling && arcade
        ? ARCADE_SQUASH_TRANSITION
        : arcade && cascadeActive
          ? { ...TACTILE_SPRING, delay: computeCascadeDelay(index) }
          : TACTILE_SPRING;

  return (
    /* Outer wrapper strictly owns @dnd-kit/react ref & transforms — never apply Motion transforms here */
    <div
      ref={ref}
      data-link-id={link.id}
      style={arcade ? { perspective: FOIL_PERSPECTIVE_PX } : undefined}
      className="relative h-full"
    >
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
          initial={
            arcade && cascadeActive ? { opacity: 0, y: 12, rotate: -2 } : false
          }
          animate={cardAnimate}
          whileHover={tactile ? { y: -2 } : undefined}
          whileTap={tactile ? { scale: 0.98 } : undefined}
          transition={cardTransition}
          style={arcade ? { rotateX, rotateY } : undefined}
          onPointerEnter={handlePointerEnter}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          className={cn(
            'group relative h-full rounded-card border border-border bg-card transition-colors hover:border-accent/45 hover:bg-card-hover',
            !dragDisabled && 'cursor-grab active:cursor-grabbing',
            isDropTarget && 'border-accent ring-2 ring-accent/40',
            isHighlighted && !arcade && 'stash-duplicate-pulse',
            isHighlighted && arcade && 'border-danger ring-2 ring-danger/45',
            isTagging && arcade && 'border-accent/65',
          )}
        >
          {/* Arcade 3D foil sheen overlay */}
          {arcade && (
            <motion.div
              aria-hidden="true"
              style={{
                backgroundImage: glareBackground,
                opacity: glareOpacity,
              }}
              className="pointer-events-none absolute inset-0 z-10 rounded-card transition-opacity duration-150"
            />
          )}

          {/* Arcade live AI phosphor scan beam while Gemini Nano is tagging */}
          {arcade && isTagging && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-card"
            >
              <div className="stash-phosphor-scan-beam absolute inset-y-0 w-1/2" />
            </div>
          )}

          {/* Arcade impact sparks on card drop */}
          <DropSparks active={arcade && isSettling} />

          <a
            href={link.url}
            draggable={false}
            target={openInNewTab ? '_blank' : '_self'}
            rel={openInNewTab ? 'noopener noreferrer' : undefined}
            onClick={handleOpen}
            onContextMenu={handleContextMenu}
            className={cn(
              'relative z-[1] flex h-full flex-col gap-2 rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
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
                      transition={
                        arcade ? ARCADE_TAG_POP_SPRING : TAG_POP_SPRING
                      }
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
            className="absolute right-2 top-2 z-20 inline-flex h-7 w-7 items-center justify-center rounded-control border border-transparent bg-panel/90 text-fg-muted opacity-0 transition-all hover:border-border hover:text-fg focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 group-hover:opacity-100 cursor-pointer"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </div>
  );
});
