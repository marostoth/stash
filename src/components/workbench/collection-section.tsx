import { useDroppable } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Image as ImageIcon,
  LayoutGrid,
  Plus,
  Sparkles,
  Tag,
} from 'lucide-react';
import { motion } from 'motion/react';
import { type CSSProperties, memo } from 'react';
import { toast } from 'sonner';
import { CollectionAppearancePopover } from '@/components/CollectionAppearancePopover';
import { InlineProgressPill } from '@/components/ui/ai-activity-panel';
import { Button } from '@/components/ui/button';
import { CollectionActionsMenu } from '@/components/workbench/collection-actions-menu';
import {
  CollectionHeaderBadges,
  DropSlotPlaceholder,
  EmptyCollectionDropButton,
  resolveCollectionGridClass,
} from '@/components/workbench/collection-header-badges';
import { CollectionSortMenu } from '@/components/workbench/collection-sort-menu';
import { deleteCollectionWithUndo } from '@/components/workbench/delete-collection-toast';
import { LinkCard } from '@/components/workbench/link-card';
import { SmoothCollapse } from '@/components/workbench/smooth-collapse';
import { useAutoTagSweep } from '@/hooks/use-auto-tag-sweep';
import { playSessionFreeze } from '@/lib/audio/foley';
import { isTactileMotion } from '@/lib/motion/presets';
import { stashRepo } from '@/lib/storage/repo';
import {
  wakeUpCollectionInNewWindow,
  wakeUpCollectionInTabGroup,
} from '@/lib/tabs/tab-actions';
import { isEligibleForAutoTag } from '@/lib/tagging/auto-tagger';
import { getCuratedCollectionIcon } from '@/lib/themes/collection-icons';
import {
  type CardDensity,
  type Collection,
  DEFAULT_SPACE_ID,
  type LinkItem,
  type MotionMode,
  type Space,
  TAB_GROUP_COLOR_SWATCH,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import {
  formatCurrencySummaries,
  summarizePrices,
} from '@/lib/utils/price-math';
import { spawnBulkPulseForSelector } from '@/lib/vfx/engine';
import { useFxStore } from '@/store/fx-store';
import { useUiStore } from '@/store/ui-store';

interface CollectionSectionProps {
  collection: Collection;
  index: number;
  links: readonly LinkItem[];
  spaces: readonly Space[];
  spaceBadge?: Space;
  onSwitchSpace?: (spaceId: string) => void;
  openInNewTab: boolean;
  defaultCurrency?: string;
  density: CardDensity;
  wideBoard?: boolean;
  forceExpanded: boolean;
  dragDisabled: boolean;
  hasHiddenChecked?: boolean;
  motionMode: MotionMode;
  fxDeskJolt?: boolean;
  fxHoverSheen?: boolean;
  fxAmbientWaves?: boolean;
  soundEffects: boolean;
  hoverPreviews: boolean;
}

export const CollectionSection = memo(function CollectionSection({
  collection,
  index,
  links,
  spaces,
  spaceBadge,
  onSwitchSpace,
  openInNewTab,
  defaultCurrency = 'GBP',
  density,
  wideBoard = false,
  forceExpanded,
  dragDisabled,
  hasHiddenChecked = false,
  motionMode,
  fxDeskJolt = true,
  fxHoverSheen = true,
  fxAmbientWaves = true,
  soundEffects,
  hoverPreviews,
}: CollectionSectionProps) {
  const {
    openCreateLink,
    openEditCollection,
    openTriage,
    triggerCollectionCascade,
  } = useUiStore.getState();
  const isCascading = useUiStore((s) =>
    s.cascadingCollectionIds.includes(collection.id),
  );
  const isWaking = useFxStore((s) => s.wakingCollectionId === collection.id);
  const isSlammed = useFxStore((s) => s.slammedCollectionId === collection.id);
  const dragInsertIndex = useFxStore((s) =>
    s.dragInsertTarget?.collectionId === collection.id
      ? s.dragInsertTarget.index
      : null,
  );
  const { triggerWakeWave } = useFxStore.getState();
  const tactile = isTactileMotion(motionMode);
  const autoTag = useAutoTagSweep(collection.id);
  const untaggedCount = links.filter(isEligibleForAutoTag).length;

  const {
    ref: sortableRef,
    handleRef,
    isDragging,
  } = useSortable({
    id: `collection:${collection.id}`,
    type: 'collection',
    accept: 'collection',
    index,
    disabled: dragDisabled,
    data: {
      kind: 'collection',
      collection,
      index,
    },
  });

  const { ref: dropRef, isDropTarget } = useDroppable({
    id: `collection-drop:${collection.id}`,
    accept: ['link', 'open-tab'],
    collisionPriority: 1,
    data: {
      kind: 'collection-drop',
      collectionId: collection.id,
    },
  });

  const isCollapsed = collection.collapsed && !forceExpanded;
  const isAutoSorted =
    collection.sortMode !== undefined && collection.sortMode !== 'manual';
  const colorHex =
    collection.tintColor ?? TAB_GROUP_COLOR_SWATCH[collection.color];
  const viewMode = collection.viewMode ?? 'compact';
  const CuratedIcon = getCuratedCollectionIcon(collection.icon);
  const tintStyle = collection.tintColor
    ? ({ '--collection-tint': collection.tintColor } as CSSProperties)
    : undefined;

  const handleToggleViewMode = () =>
    void stashRepo.updateCollection(collection.id, {
      viewMode: viewMode === 'cover' ? 'compact' : 'cover',
    });

  const handleToggleCollapse = () => {
    if (collection.collapsed) triggerCollectionCascade(collection.id);
    void stashRepo.toggleCollectionCollapsed(collection.id);
  };

  const handleDeleteCollection = () =>
    deleteCollectionWithUndo(collection.id, collection.name);

  const handleMoveToSpace = async (targetSpace: Space) => {
    const moved = await stashRepo.moveCollectionToSpace(
      collection.id,
      targetSpace.id,
    );
    if (moved)
      toast.success(`Moved "${collection.name}" to ${targetSpace.name}`);
  };

  const currentSpaceId =
    collection.spaceId ?? spaces[0]?.id ?? DEFAULT_SPACE_ID;
  const otherSpaces = spaces.filter((s) => s.id !== currentSpaceId);
  const collectionTotalText = formatCurrencySummaries(
    summarizePrices(links, defaultCurrency),
  );
  const starredLinks = links.filter((l) => l.starred === true);
  const starredTotalText = formatCurrencySummaries(
    summarizePrices(starredLinks, defaultCurrency),
  );

  const runWakeAction = async (mode: 'group' | 'window') => {
    if (links.length === 0) {
      toast.info('No links in this collection to open.');
      return;
    }
    playSessionFreeze(soundEffects, motionMode);
    if (motionMode === 'arcade' && fxDeskJolt) {
      useFxStore.getState().triggerContainerShake('heavy');
    }
    if (tactile && fxAmbientWaves) {
      triggerWakeWave(collection.id);
      if (motionMode === 'arcade')
        spawnBulkPulseForSelector(
          `[data-collection-id="${CSS.escape(collection.id)}"]`,
        );
      await new Promise((resolve) => setTimeout(resolve, 140));
    }
    const opened =
      mode === 'group'
        ? await wakeUpCollectionInTabGroup(collection, links)
        : await wakeUpCollectionInNewWindow(links);
    if (opened > 0) {
      toast.success(
        mode === 'group'
          ? `Opened ${opened} tab${opened === 1 ? '' : 's'} in "${collection.name}" group`
          : `Opened ${opened} tab${opened === 1 ? '' : 's'} in a new window`,
      );
    }
  };
  const handleWakeUp = () => runWakeAction('group');
  const handleOpenInNewWindow = () => runWakeAction('window');

  return (
    <section
      ref={sortableRef}
      data-collection-id={collection.id}
      className={cn(
        'rounded-card transition-colors',
        isDragging && 'opacity-40',
      )}
    >
      <div ref={dropRef}>
        <motion.div
          style={tintStyle}
          animate={
            isSlammed && tactile
              ? { scale: [1.03, 0.985, 1.004, 1], y: [-10, 2, 0, 0] }
              : { scale: 1, y: 0 }
          }
          transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'space-y-4 rounded-card transition-colors',
            collection.tintColor
              ? 'stash-collection-tinted p-4'
              : 'p-1.5 -m-1.5',
            isDropTarget && 'bg-panel/45 ring-1 ring-accent/35',
          )}
        >
          {/* Collection Header */}
          <div
            className={cn(
              'relative flex items-center justify-between gap-2 border-b border-hairline pb-2.5 transition-transform duration-150',
              isDropTarget && tactile && '-translate-y-0.5',
            )}
          >
            {motionMode === 'arcade' && fxAmbientWaves && isWaking && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
              >
                <div className="stash-action-sweep absolute inset-y-0 w-1/2" />
              </div>
            )}
            <div className="flex min-w-0 items-center gap-1.5">
              {!dragDisabled && (
                <button
                  ref={handleRef}
                  type="button"
                  aria-label={`Reorder ${collection.name}`}
                  title="Drag to reorder collection"
                  className="inline-flex h-6 w-5 shrink-0 items-center justify-center rounded text-fg-muted/60 transition-colors hover:bg-card hover:text-fg cursor-grab active:cursor-grabbing"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleCollapse}
                aria-expanded={!isCollapsed}
                className="group flex min-w-0 items-center gap-2 rounded-control pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 cursor-pointer"
              >
                <span className="text-fg-muted transition-colors group-hover:text-fg">
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </span>
                {CuratedIcon ? (
                  <CuratedIcon
                    className="h-4 w-4 shrink-0"
                    style={{ color: colorHex }}
                    aria-hidden="true"
                  />
                ) : collection.icon ? (
                  <span
                    className="shrink-0 text-sm leading-none"
                    aria-hidden="true"
                  >
                    {collection.icon}
                  </span>
                ) : (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: colorHex }}
                    aria-hidden="true"
                  />
                )}
                <h2 className="truncate text-sm font-semibold tracking-tight text-fg">
                  {collection.name}
                </h2>
                <CollectionHeaderBadges
                  collection={collection}
                  linkCount={links.length}
                  collectionTotalText={collectionTotalText}
                  starredCount={starredLinks.length}
                  starredTotalText={starredTotalText}
                  spaceBadge={spaceBadge}
                  motionMode={motionMode}
                  fxAmbientWaves={fxAmbientWaves}
                  onSwitchSpace={onSwitchSpace}
                />
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {autoTag.running ? (
                <InlineProgressPill
                  label={`Tagging ${autoTag.progress?.current ?? 1} / ${autoTag.progress?.total ?? untaggedCount}...`}
                  current={autoTag.progress?.current ?? 1}
                  total={autoTag.progress?.total ?? untaggedCount}
                  onCancel={autoTag.cancel}
                />
              ) : (
                untaggedCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void autoTag.start()}
                    title={`Auto-tag ${untaggedCount} untagged link${untaggedCount === 1 ? '' : 's'} with on-device AI`}
                    className="h-7 gap-1 px-2 text-xs text-fg/80 hover:text-accent"
                  >
                    <Tag className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">Auto-Tag</span>
                  </Button>
                )
              )}

              {collection.isSession && links.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openTriage(collection.id)}
                  title="Auto-categorize and file links from this session"
                  className="h-7 gap-1 border-accent/45 px-2 text-xs text-accent hover:bg-accent/10"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Auto-Categorize</span>
                </Button>
              )}

              {links.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleWakeUp()}
                  title="Open all links in a Chrome Tab Group"
                  className="h-7 gap-1 border-fg-muted/30 px-2 text-xs text-fg hover:border-accent/50"
                >
                  <span>Wake Up</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-accent" />
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => openCreateLink(collection.id)}
                className="h-7 gap-1 px-2 text-xs text-fg/85 hover:text-fg"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Add Link</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleViewMode}
                aria-label={
                  viewMode === 'cover'
                    ? `Switch ${collection.name} to compact view`
                    : `Switch ${collection.name} to visual cover view`
                }
                title={
                  viewMode === 'cover'
                    ? 'Cover view active (click for Compact)'
                    : 'Compact view active (click for Visual Cover view)'
                }
                className={cn(
                  'h-7 w-7 text-fg-muted hover:text-accent',
                  viewMode === 'cover' && 'bg-accent/15 text-accent',
                )}
              >
                {viewMode === 'cover' ? (
                  <ImageIcon className="h-3.5 w-3.5" />
                ) : (
                  <LayoutGrid className="h-3.5 w-3.5" />
                )}
              </Button>

              <CollectionSortMenu collection={collection} />

              <CollectionAppearancePopover
                collection={collection}
                sampleLinkTitles={links.slice(0, 5).map((l) => l.title)}
              />

              <CollectionActionsMenu
                collectionName={collection.name}
                hasLinks={links.length > 0}
                otherSpaces={otherSpaces}
                onAddLink={() => openCreateLink(collection.id)}
                onWakeUp={() => void handleWakeUp()}
                onOpenInNewWindow={() => void handleOpenInNewWindow()}
                onEditCollection={() => openEditCollection(collection)}
                onMoveToSpace={(targetSpace) =>
                  void handleMoveToSpace(targetSpace)
                }
                onDeleteCollection={() => void handleDeleteCollection()}
              />
            </div>
          </div>

          {/* Links Grid (native CSS grid-rows smooth expand/collapse) */}
          <SmoothCollapse open={!isCollapsed} motionMode={motionMode}>
            <div className="px-0.5 py-1">
              {links.length > 0 ? (
                <div
                  className={resolveCollectionGridClass(
                    density,
                    viewMode,
                    wideBoard,
                  )}
                >
                  {links.map((link, cardIndex) => (
                    <LinkCard
                      key={link.id}
                      link={link}
                      index={cardIndex}
                      showInsertBefore={dragInsertIndex === cardIndex}
                      openInNewTab={openInNewTab}
                      density={density}
                      dragDisabled={
                        dragDisabled || isAutoSorted || hasHiddenChecked
                      }
                      motionMode={motionMode}
                      fxDeskJolt={fxDeskJolt}
                      fxHoverSheen={fxHoverSheen}
                      fxAmbientWaves={fxAmbientWaves}
                      soundEffects={soundEffects}
                      cascadeActive={isCascading}
                      wakeWaveActive={isWaking}
                      hoverPreviews={hoverPreviews}
                      viewMode={viewMode}
                      collectionTint={collection.tintColor}
                    />
                  ))}
                  {dragInsertIndex === -1 && (
                    <DropSlotPlaceholder density={density} />
                  )}
                </div>
              ) : (
                <EmptyCollectionDropButton
                  collectionName={collection.name}
                  isDropTarget={isDropTarget}
                  onAddLink={() => openCreateLink(collection.id)}
                />
              )}
            </div>
          </SmoothCollapse>
        </motion.div>
      </div>
    </section>
  );
});
