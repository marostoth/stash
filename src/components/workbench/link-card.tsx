import { useSortable } from '@dnd-kit/react/sortable';
import { motion } from 'motion/react';
import { memo, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CoverCardBanner } from '@/components/CoverCardBanner';
import { LinkFavicon } from '@/components/LinkFavicon';
import { CardActionDrawer } from '@/components/workbench/card-action-drawer';
import {
  DeleteVaporPuff,
  LinkCardDragPlaceholder,
  resolveLinkCardMotion,
  StarredCardAccents,
  StarShimmerOverlay,
  useNeighborJolt,
} from '@/components/workbench/card-effects';
import { DropSparks } from '@/components/workbench/drop-sparks';
import { useCardFoilTilt } from '@/hooks/use-card-foil-tilt';
import { playDelete, playDrop, playTagPop } from '@/lib/audio/foley';
import {
  ARCADE_TAG_POP_SPRING,
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
  DropEffectStyle,
  LinkItem,
  MotionMode,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { HighlightText } from '@/lib/utils/highlight-match';
import { extractDomain } from '@/lib/utils/url';
import { useFxStore } from '@/store/fx-store';
import { useUiStore } from '@/store/ui-store';

interface LinkCardProps {
  link: LinkItem;
  index: number;
  openInNewTab: boolean;
  density: CardDensity;
  dragDisabled: boolean;
  motionMode: MotionMode;
  dropEffectStyle?: DropEffectStyle;
  fxDeskJolt?: boolean;
  fxHoverSheen?: boolean;
  fxAmbientWaves?: boolean;
  soundEffects: boolean;
  cascadeActive: boolean;
  wakeWaveActive?: boolean;
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
  dropEffectStyle = 'dust',
  fxDeskJolt = true,
  fxHoverSheen = true,
  fxAmbientWaves = true,
  soundEffects,
  cascadeActive,
  wakeWaveActive = false,
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
  const searchQuery = useUiStore((s) => s.searchQuery);
  const triggerStarFlash = useFxStore((s) => s.triggerStarFlash);
  const isStarFlashing = useFxStore((s) => s.starFlashLinkId === link.id);
  const triggerSettledImpact = useFxStore((s) => s.triggerSettledImpact);

  const [vaporizing, setVaporizing] = useState(false);
  const cardMeasureRef = useRef<HTMLDivElement | null>(null);

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
  const hoverTiltActive = tactile && fxHoverSheen;
  const foil = useCardFoilTilt(hoverTiltActive, arcade, isDragging);
  const neighborJolt = useNeighborJolt(
    cardMeasureRef,
    link.id,
    link.collectionId,
    arcade && fxDeskJolt && !isDragging,
  );
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
      if (tactile && fxAmbientWaves) {
        triggerStarFlash(link.id);
      }
    }
  };

  const handleQuickDelete = async () => {
    if (vaporizing) return;
    const snapshot: LinkItem = { ...link, tags: [...link.tags] };
    dismissPreview();
    playDelete();

    if (tactile) {
      setVaporizing(true);
      await new Promise((resolve) => setTimeout(resolve, arcade ? 175 : 120));
    }

    const deleted = await stashRepo.deleteLink(snapshot.id);
    if (!deleted) {
      setVaporizing(false);
      return;
    }

    toast('Link removed', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          void stashRepo.restoreLink(snapshot).then((restored) => {
            if (restored) {
              playDrop();
              settleLink(restored.id);
              triggerSettledImpact(restored.id, restored.collectionId);
            }
          });
        },
      },
    });
  };

  const { animate: cardAnimate, transition: cardTransition } =
    resolveLinkCardMotion({
      vaporizing,
      isHighlighted,
      isSettling,
      arcade,
      tactile,
      cascadeActive,
      index,
      neighborJolt,
    });

  const wakeDelayMs = Math.min(index, 14) * 34;

  return (
    /* Outer wrapper strictly owns @dnd-kit/react ref & transforms — never apply Motion transforms here */
    <div
      ref={ref}
      data-link-id={link.id}
      style={hoverTiltActive ? { perspective: FOIL_PERSPECTIVE_PX } : undefined}
      className="relative h-full"
    >
      {isDragging ? (
        <LinkCardDragPlaceholder
          title={link.title}
          domain={domain}
          note={link.note}
          visibleTags={visibleTags}
          isMicro={isMicro}
          showNote={showNote}
          showTags={showTags}
          cardPadding={cardPadding}
        />
      ) : (
        <div
          ref={cardMeasureRef}
          className={cn(
            'relative h-full rounded-card',
            wakeWaveActive &&
              fxAmbientWaves &&
              tactile &&
              'stash-wake-ignition',
          )}
          style={
            wakeWaveActive && fxAmbientWaves && tactile
              ? { animationDelay: `${wakeDelayMs}ms` }
              : undefined
          }
        >
          {/* Arcade shockwave & edge dust erupting strictly BEHIND the card */}
          <DropSparks active={arcade && isSettling} variant={dropEffectStyle} />
          <DeleteVaporPuff active={arcade && vaporizing} />

          {/* Gliding keyboard navigation spotlight frame */}
          {isKeyboardFocused && tactile && (
            <motion.div
              layoutId="stash-kbd-spotlight"
              transition={TACTILE_SPRING}
              aria-hidden="true"
              className="pointer-events-none absolute -inset-[2px] z-[18] rounded-[calc(var(--stash-radius-card)+2px)] border-2 border-accent shadow-[0_0_18px_-3px_color-mix(in_srgb,var(--stash-accent)_68%,transparent)]"
            />
          )}

          <motion.div
            initial={
              cascadeActive && arcade
                ? { opacity: 0, y: 16, x: -10, rotate: -2.5, scale: 0.94 }
                : cascadeActive && tactile
                  ? { opacity: 0, y: 10, scale: 0.97 }
                  : false
            }
            animate={cardAnimate}
            whileHover={tactile && !vaporizing ? { y: -2 } : undefined}
            whileTap={tactile && !vaporizing ? { scale: 0.98 } : undefined}
            transition={cardTransition}
            style={
              hoverTiltActive
                ? { rotateX: foil.rotateX, rotateY: foil.rotateY }
                : undefined
            }
            onPointerEnter={foil.handlePointerEnter}
            onPointerMove={foil.handlePointerMove}
            onPointerLeave={foil.handlePointerLeave}
            className={cn(
              'group relative z-[1] h-full rounded-card border border-border bg-card transition-colors hover:border-accent/45 hover:bg-card-hover',
              isStarred && 'stash-card-starred',
              !dragDisabled && 'cursor-grab active:cursor-grabbing',
              isDropTarget && 'border-accent ring-2 ring-accent/40',
              isKeyboardFocused &&
                !tactile &&
                'border-accent ring-2 ring-accent/75 ring-offset-2 ring-offset-canvas',
              isHighlighted && !arcade && 'stash-duplicate-pulse',
              isHighlighted && arcade && 'border-danger ring-2 ring-danger/45',
              isTagging && arcade && 'border-accent/65',
            )}
          >
            {isStarred && <StarredCardAccents viewMode={viewMode} />}

            {/* Star pop shimmer sweep + Arcade micro-burst */}
            <StarShimmerOverlay
              active={isStarFlashing && tactile && fxAmbientWaves}
              arcade={arcade}
            />

            {/* 3D hover tilt specular sheen overlay */}
            {hoverTiltActive && (
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
                        isMicro
                          ? 'truncate text-[13px]'
                          : 'line-clamp-2 text-sm',
                      )}
                    >
                      <HighlightText text={link.title} query={searchQuery} />
                    </div>
                    <div
                      className={cn(
                        'mt-0.5 truncate font-mono text-fg-muted',
                        isMicro ? 'text-[10px]' : 'text-[11px]',
                      )}
                    >
                      <HighlightText text={domain} query={searchQuery} />
                    </div>
                  </div>
                </div>

                {showNote && (
                  <p className="line-clamp-1 text-xs text-fg-muted">
                    <HighlightText text={link.note} query={searchQuery} />
                  </p>
                )}

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
        </div>
      )}
    </div>
  );
});
