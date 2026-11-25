import { useSortable } from '@dnd-kit/react/sortable';
import { Star } from 'lucide-react';
import { motion } from 'motion/react';
import { memo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { CoverCardBanner } from '@/components/CoverCardBanner';
import { LinkFavicon } from '@/components/LinkFavicon';
import { CardActionDrawer } from '@/components/workbench/card-action-drawer';
import { DropSparks } from '@/components/workbench/drop-sparks';
import { useCardFoilTilt } from '@/hooks/use-card-foil-tilt';
import { playDelete, playDrop, playTagPop } from '@/lib/audio/foley';
import {
  ARCADE_HEADSHAKE_KEYFRAMES,
  ARCADE_HEADSHAKE_TRANSITION,
  ARCADE_SQUASH_KEYFRAMES,
  ARCADE_SQUASH_TRANSITION,
  ARCADE_TAG_POP_SPRING,
  computeCascadeDelay,
  FOIL_PERSPECTIVE_PX,
  isArcadeMotion,
  isTactileMotion,
  TACTILE_SPRING,
  TAG_POP_SPRING,
} from '@/lib/motion/presets';
import { stashRepo } from '@/lib/storage/repo';
import type {
  CardDensity,
  CollectionViewMode,
  LinkItem,
  MotionMode,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { extractDomain } from '@/lib/utils/url';
import { useUiStore } from '@/store/ui-store';

interface LinkCardProps {
  link: LinkItem;
  index: number;
  openInNewTab: boolean;
  density: CardDensity;
  dragDisabled: boolean;
  motionMode: MotionMode;
  soundEffects: boolean;
  cascadeActive: boolean;
  hoverPreviews: boolean;
  viewMode?: CollectionViewMode;
  collectionTint?: string;
}

export const LinkCard = memo(function LinkCard({
  link,
  index,
  openInNewTab,
  density,
  dragDisabled,
  motionMode,
  soundEffects,
  cascadeActive,
  hoverPreviews,
  viewMode = 'compact',
  collectionTint,
}: LinkCardProps) {
  const openEditLink = useUiStore((s) => s.openEditLink);
  const highlightedLinkId = useUiStore((s) => s.highlightedLinkId);
  const settledLinkId = useUiStore((s) => s.settledLinkId);
  const settleLink = useUiStore((s) => s.settleLink);
  const schedulePreview = useUiStore((s) => s.schedulePreview);
  const dismissPreview = useUiStore((s) => s.dismissPreview);
  const isTagging = useUiStore((s) => s.taggingLinkIds.includes(link.id));
  const isKeyboardFocused = useUiStore(
    (s) => s.keyboardFocusedLinkId === link.id,
  );

  // Track previously rendered tags so only newly arriving AI tags pop in
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

  const arcade = isArcadeMotion(motionMode);
  const tactile = isTactileMotion(motionMode);
  const foil = useCardFoilTilt(arcade, isDragging);
  const isHighlighted = highlightedLinkId === link.id;
  const isSettling = tactile && settledLinkId === link.id;
  const domain = extractDomain(link.url);

  const isStarred = Boolean(link.starred);
  const isMicro = density === 'micro';
  const isCompact = density === 'compact';
  const showNote = density === 'comfortable' && Boolean(link.note);
  const visibleTags = link.tags.slice(0, 3);
  const showTags = !isMicro && visibleTags.length > 0;
  const hiddenTagCount = Math.max(0, link.tags.length - visibleTags.length);
  const cardPadding = isMicro
    ? 'gap-1 px-2.5 py-2'
    : isCompact
      ? 'gap-1.5 px-2.5 py-2'
      : 'gap-2 p-3.5';

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    openEditLink(link);
  };

  const handleOpen = () => {
    dismissPreview();
    void stashRepo.markLinkOpened(link.id);
  };

  const handleBodyPointerEnter = (
    event: React.PointerEvent<HTMLAnchorElement>,
  ) => {
    if (!hoverPreviews || isDragging) return;
    const rect = event.currentTarget.getBoundingClientRect();
    schedulePreview({
      id: `link:${link.id}`,
      url: link.url,
      title: link.title,
      note: link.note || undefined,
      tags: link.tags,
      faviconUrl: link.faviconUrl,
      anchor: {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
      preferredSide: 'bottom',
    });
  };

  const handleToggleStar = async () => {
    const nextStarred = !isStarred;
    const result = await stashRepo.updateLink(link.id, {
      starred: nextStarred,
    });
    if (result.ok && nextStarred) {
      playTagPop(soundEffects, motionMode);
    }
  };

  const handleQuickDelete = async () => {
    const snapshot: LinkItem = { ...link, tags: [...link.tags] };
    dismissPreview();
    const deleted = await stashRepo.deleteLink(snapshot.id);
    if (!deleted) return;

    playDelete();
    toast('Link removed', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          void stashRepo.restoreLink(snapshot).then((restored) => {
            if (restored) {
              playDrop();
              settleLink(restored.id);
            }
          });
        },
      },
    });
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
            'flex h-full flex-col rounded-card border border-dashed border-accent/55 bg-panel/35',
            cardPadding,
          )}
        >
          <div className="invisible flex items-start gap-2.5 pr-6">
            <div
              className={cn('mt-0.5 shrink-0', isMicro ? 'h-6 w-6' : 'h-7 w-7')}
            />
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  'font-medium leading-snug',
                  isMicro ? 'truncate text-[13px]' : 'line-clamp-2 text-sm',
                )}
              >
                {link.title}
              </div>
              <div
                className={cn(
                  'mt-0.5 truncate font-mono',
                  isMicro ? 'text-[10px]' : 'text-[11px]',
                )}
              >
                {domain}
              </div>
            </div>
          </div>
          {showNote && (
            <p className="invisible line-clamp-1 text-xs">{link.note}</p>
          )}
          {showTags && (
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
          style={
            arcade
              ? { rotateX: foil.rotateX, rotateY: foil.rotateY }
              : undefined
          }
          onPointerEnter={foil.handlePointerEnter}
          onPointerMove={foil.handlePointerMove}
          onPointerLeave={foil.handlePointerLeave}
          className={cn(
            'group relative h-full rounded-card border border-border bg-card transition-colors hover:border-accent/45 hover:bg-card-hover',
            isStarred && 'stash-card-starred',
            !dragDisabled && 'cursor-grab active:cursor-grabbing',
            isDropTarget && 'border-accent ring-2 ring-accent/40',
            isKeyboardFocused &&
              'border-accent ring-2 ring-accent/75 ring-offset-2 ring-offset-canvas',
            isHighlighted && !arcade && 'stash-duplicate-pulse',
            isHighlighted && arcade && 'border-danger ring-2 ring-danger/45',
            isTagging && arcade && 'border-accent/65',
          )}
        >
          {/* Starred bottom hardware underglow strip (clipped cleanly to card radius) */}
          {isStarred && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-[2] overflow-hidden rounded-card"
            >
              <div className="stash-card-underglow-strip absolute inset-x-0 bottom-0 h-[2px]" />
            </div>
          )}

          {/* Idle Star badge in top-right, fades out cleanly on hover/focus-within */}
          {isStarred && (
            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute right-2 top-2 z-[12] flex items-center justify-center text-accent opacity-90 transition-opacity duration-150 group-focus-within:opacity-0 group-hover:opacity-0',
                viewMode === 'cover' && 'rounded-full bg-panel/95 p-1',
              )}
            >
              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
            </span>
          )}

          {/* Arcade 3D foil sheen overlay */}
          {arcade && (
            <motion.div
              aria-hidden="true"
              style={{
                backgroundImage: foil.glareBackground,
                opacity: foil.glareOpacity,
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
            onPointerEnter={handleBodyPointerEnter}
            onPointerLeave={dismissPreview}
            className={cn(
              'relative z-[1] flex h-full flex-col overflow-hidden rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
              viewMode === 'cover' ? 'p-0' : cardPadding,
            )}
          >
            {viewMode === 'cover' ? (
              <CoverCardBanner
                url={link.url}
                title={link.title}
                faviconUrl={link.faviconUrl}
                collectionTint={collectionTint}
              />
            ) : null}

            <div
              className={cn(
                'flex flex-1 flex-col',
                isMicro ? 'gap-1' : isCompact ? 'gap-1.5' : 'gap-2',
                viewMode === 'cover' &&
                  (isMicro || isCompact ? 'px-2.5 py-2' : 'p-3'),
              )}
            >
              {/* Header: Favicon + Title */}
              <div
                className={cn(
                  'flex items-start pr-6',
                  isMicro ? 'gap-2' : 'gap-2.5',
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 flex shrink-0 items-center justify-center overflow-hidden rounded-control border border-border bg-panel',
                    isMicro ? 'h-6 w-6' : 'h-7 w-7',
                  )}
                >
                  <LinkFavicon
                    url={link.url}
                    faviconUrl={link.faviconUrl}
                    size={isMicro ? 'sm' : 'md'}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'font-medium leading-snug text-fg',
                      isMicro ? 'truncate text-[13px]' : 'line-clamp-2 text-sm',
                    )}
                  >
                    {link.title}
                  </div>
                  <div
                    className={cn(
                      'mt-0.5 truncate font-mono text-fg-muted',
                      isMicro ? 'text-[10px]' : 'text-[11px]',
                    )}
                  >
                    {domain}
                  </div>
                </div>
              </div>

              {/* Optional "Why I saved this" Note (Comfortable density only) */}
              {showNote && (
                <p className="line-clamp-1 text-xs text-fg-muted">
                  {link.note}
                </p>
              )}

              {/* Optional Tag Pills (Compact & Comfortable densities) */}
              {showTags && (
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
                        className={cn(
                          'rounded-pill border border-border bg-panel py-0.5 font-mono text-[10px] text-fg-muted',
                          isCompact ? 'px-1.5' : 'px-2',
                        )}
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
            </div>
          </a>

          {/* Mechanical Star + Edit + Slide-Down Delete Drawer */}
          <CardActionDrawer
            linkTitle={link.title}
            starred={isStarred}
            motionMode={motionMode}
            onEnterDrawer={dismissPreview}
            onToggleStar={() => void handleToggleStar()}
            onEdit={() => openEditLink(link)}
            onDelete={() => void handleQuickDelete()}
          />
        </motion.div>
      )}
    </div>
  );
});
