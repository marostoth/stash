import { useSortable } from '@dnd-kit/react/sortable';
import { motion } from 'motion/react';
import { memo, useEffect, useRef, useState } from 'react';
import { CoverCardBanner } from '@/components/CoverCardBanner';
import { LinkFavicon } from '@/components/LinkFavicon';
import {
  CardActionDrawer,
  useActionDrawerHover,
} from '@/components/workbench/card-action-drawer';
import {
  CardTagsRow,
  DeleteVaporPuff,
  LinkCardDragPlaceholder,
  resolveLinkCardMotion,
  StarredCardAccents,
  StarShimmerOverlay,
  showDeletedLinkToast,
  useNeighborJolt,
} from '@/components/workbench/card-effects';
import { LinkCardMotionShell } from '@/components/workbench/card-foil-wrapper';
import { DropSparks } from '@/components/workbench/drop-sparks';
import { playDelete, playTagPop, playUncheck } from '@/lib/audio/foley';
import {
  isArcadeMotion,
  isTactileMotion,
  TACTILE_SPRING,
} from '@/lib/motion/presets';
import { stashRepo } from '@/lib/storage/repo';
import type {
  CardDensity,
  CollectionViewMode,
  LinkItem,
  MotionMode,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { HighlightText } from '@/lib/utils/highlight-match';
import { extractDomain, toSafeHref } from '@/lib/utils/url';
import { spawnDeleteForElement } from '@/lib/vfx/engine';
import { useFxStore } from '@/store/fx-store';
import { useSelectionStore } from '@/store/selection-store';
import { useUiStore } from '@/store/ui-store';

interface LinkCardProps {
  link: LinkItem;
  index: number;
  showInsertBefore?: boolean;
  openInNewTab: boolean;
  density: CardDensity;
  dragDisabled: boolean;
  motionMode: MotionMode;
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
  showInsertBefore = false,
  openInNewTab,
  density,
  dragDisabled,
  motionMode,
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
  const { openEditLink, schedulePreview, dismissPreview } =
    useUiStore.getState();
  const isHighlighted = useUiStore((s) => s.highlightedLinkId === link.id);
  const settledBurstKey = useUiStore((s) =>
    s.settledLinkId === link.id ? s.settledSeq : 0,
  );
  const isTagging = useUiStore((s) => s.taggingLinkIds.includes(link.id));
  const isKeyboardFocused = useUiStore(
    (s) => s.keyboardFocusedLinkId === link.id,
  );
  const searchQuery = useUiStore((s) => s.searchQuery);
  const isStarFlashing = useFxStore((s) => s.starFlashLinkId === link.id);
  const {
    triggerStarFlash,
    triggerVacuumImplosion,
    recordComboHit,
    triggerContainerShake,
  } = useFxStore.getState();
  const isSelected = useSelectionStore((s) => s.selectedIds.includes(link.id));
  const selectionMode = useSelectionStore((s) => s.selectedIds.length > 0);
  const { toggleSelect, selectRangeTo } = useSelectionStore.getState();

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
  const neighborJolt = useNeighborJolt(
    cardMeasureRef,
    link.id,
    link.collectionId,
    arcade && fxDeskJolt && !isDragging,
  );
  const isSettling = tactile && settledBurstKey > 0;
  const domain = extractDomain(link.url);

  const isStarred = Boolean(link.starred);
  const isChecked = Boolean(link.checked);
  const isMicro = density === 'micro';
  const isCompact = density === 'compact';
  const showNote = density === 'comfortable' && Boolean(link.note);
  const visibleTags = link.tags.slice(0, 3);
  const showTags = !isMicro && visibleTags.length > 0;
  const hiddenTagCount = Math.max(0, link.tags.length - visibleTags.length);
  const cardPadding = isMicro
    ? 'gap-1 px-2.5 py-2'
    : isCompact
      ? 'gap-1.5 px-3 py-2.5'
      : 'gap-2.5 p-4';

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    openEditLink(link);
  };

  const handleOpen = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.shiftKey) {
      event.preventDefault();
      selectRangeTo(link.id);
      return;
    }
    if (event.altKey || selectionMode) {
      event.preventDefault();
      toggleSelect(link.id);
      return;
    }
    dismissPreview();
    void stashRepo.markLinkOpened(link.id);
  };

  const handleBodyPointerEnter = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (!hoverPreviews || isDragging) return;
    const { top, right, bottom, left, width, height } =
      e.currentTarget.getBoundingClientRect();
    schedulePreview({
      id: `link:${link.id}`,
      url: link.url,
      title: link.title,
      note: link.note || undefined,
      tags: link.tags,
      faviconUrl: link.faviconUrl,
      anchor: { top, right, bottom, left, width, height },
      preferredSide: 'bottom',
    });
  };

  const handleToggleStar = async () => {
    const nextStarred = !isStarred;
    const res = await stashRepo.updateLink(link.id, { starred: nextStarred });
    if (res.ok && nextStarred) {
      playTagPop(soundEffects, motionMode);
      if (tactile && fxAmbientWaves) triggerStarFlash(link.id);
    }
  };

  const handleToggleChecked = async () => {
    const nextChecked = !isChecked;
    const res = await stashRepo.updateLink(link.id, { checked: nextChecked });
    if (!res.ok) return;
    if (nextChecked) {
      playTagPop(soundEffects, motionMode);
      if (arcade && recordComboHit() >= 5 && fxDeskJolt)
        triggerContainerShake('combo');
    } else {
      playUncheck(soundEffects);
    }
  };

  const handleQuickDelete = async () => {
    if (vaporizing) return;
    const snapshot: LinkItem = { ...link, tags: [...link.tags] };
    dismissPreview();
    playDelete();

    if (motionMode !== 'off') {
      if (arcade) spawnDeleteForElement(cardMeasureRef.current);
      setVaporizing(true);
      if (arcade && fxDeskJolt)
        triggerVacuumImplosion(link.id, link.collectionId);
      await new Promise((resolve) =>
        setTimeout(resolve, motionMode === 'reduced' ? 115 : 145),
      );
    }

    const deleted = await stashRepo.deleteLink(snapshot.id);
    if (!deleted) {
      setVaporizing(false);
      return;
    }

    showDeletedLinkToast(snapshot, {
      soundEffects,
      motionMode,
      fxDeskJolt,
    });
  };

  const { animate: cardAnimate, transition: cardTransition } =
    resolveLinkCardMotion({
      vaporizing,
      isHighlighted,
      isSettling,
      arcade,
      tactile,
      reduced: motionMode === 'reduced',
      cascadeActive,
      index,
      neighborJolt,
    });

  const drawerHover = useActionDrawerHover(dismissPreview);
  const wakeDelayMs = Math.min(index, 14) * 62;

  return (
    /* Direct CSS grid child — strictly owns @dnd-kit/react ref & transforms (never wrap in another div!) */
    <div ref={ref} data-link-id={link.id} className="relative h-full">
      {showInsertBefore && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-2 inset-y-1 z-20 w-1 rounded-full bg-accent shadow-[0_0_8px_var(--stash-accent)]"
        />
      )}
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
          data-vfx-occluder="true"
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
          {/* Clipped 1px rim-light drop & delete flashes (+ tight Arcade micro-sparks) */}
          <DropSparks
            active={tactile && isSettling}
            arcade={arcade}
            burstKey={settledBurstKey}
          />
          <DeleteVaporPuff
            active={motionMode !== 'off' && vaporizing}
            arcade={arcade}
          />

          {/* Gliding keyboard navigation spotlight frame */}
          {isKeyboardFocused && tactile && (
            <motion.div
              layoutId="stash-kbd-spotlight"
              transition={TACTILE_SPRING}
              aria-hidden="true"
              className="pointer-events-none absolute -inset-[2px] z-[18] rounded-[calc(var(--stash-radius-card)+2px)] border-2 border-accent shadow-[0_0_18px_-3px_color-mix(in_srgb,var(--stash-accent)_68%,transparent)]"
            />
          )}

          <LinkCardMotionShell
            hoverTiltActive={hoverTiltActive}
            arcade={arcade}
            isDragging={isDragging}
            initial={
              isSettling && arcade
                ? { opacity: 1, scale: 1.08, y: -4 }
                : cascadeActive && arcade
                  ? { opacity: 0, y: 16, x: -10, rotate: -2.5, scale: 0.94 }
                  : cascadeActive && tactile
                    ? { opacity: 0, y: 10, scale: 0.97 }
                    : false
            }
            animate={cardAnimate}
            whileHover={tactile && !vaporizing ? { y: -2 } : undefined}
            whileTap={tactile && !vaporizing ? { scale: 0.98 } : undefined}
            transition={cardTransition}
            onCardPointerMove={drawerHover.handleCardPointerMove}
            onCardPointerLeave={drawerHover.handleCardPointerLeave}
            className={cn(
              'group relative z-[1] h-full rounded-card border border-hairline bg-card transition-[background-color,border-color,opacity,box-shadow] hover:border-border/90 hover:bg-card-hover',
              isSelected &&
                'border-accent bg-accent/[0.11] ring-2 ring-accent/70',
              isChecked && 'opacity-65 hover:opacity-95',
              !dragDisabled && 'cursor-grab active:cursor-grabbing',
              isDropTarget && 'border-accent/65 ring-1 ring-accent/35',
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
              href={toSafeHref(link.url)}
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
                      'mt-0.5 flex shrink-0 items-center justify-center overflow-hidden rounded-control border border-hairline bg-panel',
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
                        'font-medium leading-snug',
                        isChecked
                          ? 'text-fg-muted line-through decoration-fg-muted/70'
                          : 'text-fg',
                        isMicro
                          ? 'truncate text-[13px]'
                          : 'line-clamp-2 min-h-[2.35rem] text-sm',
                      )}
                    >
                      <HighlightText text={link.title} query={searchQuery} />
                    </div>
                    <div
                      className={cn(
                        'mt-1 truncate font-mono text-fg-muted',
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
                  <CardTagsRow
                    visibleTags={visibleTags}
                    hiddenTagCount={hiddenTagCount}
                    seenTags={seenTagsRef.current}
                    tactile={tactile}
                    arcade={arcade}
                    isCompact={isCompact}
                  />
                )}
              </div>
            </a>

            <CardActionDrawer
              linkTitle={link.title}
              starred={isStarred}
              checked={isChecked}
              motionMode={motionMode}
              drawer={drawerHover}
              onToggleChecked={() => void handleToggleChecked()}
              onToggleStar={() => void handleToggleStar()}
              onEdit={() => openEditLink(link)}
              onDelete={() => void handleQuickDelete()}
            />
          </LinkCardMotionShell>
        </div>
      )}
    </div>
  );
});
