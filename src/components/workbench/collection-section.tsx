import { useDroppable } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GripVertical,
  Image as ImageIcon,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { toast } from 'sonner';
import { CollectionAppearancePopover } from '@/components/CollectionAppearancePopover';
import { InlineProgressPill } from '@/components/ui/ai-activity-panel';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OdometerCounter } from '@/components/ui/odometer-counter';
import { LinkCard } from '@/components/workbench/link-card';
import { useAutoTagSweep } from '@/hooks/use-auto-tag-sweep';
import { COLLAPSE_SPRING } from '@/lib/motion/physics';
import { stashRepo } from '@/lib/storage/repo';
import {
  wakeUpCollectionInNewWindow,
  wakeUpCollectionInTabGroup,
} from '@/lib/tabs/tab-actions';
import { isEligibleForAutoTag } from '@/lib/tagging/auto-tagger';
import { getCuratedCollectionIcon } from '@/lib/themes/collection-icons';
import {
  type Collection,
  type LinkItem,
  type MotionMode,
  TAB_GROUP_COLOR_SWATCH,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { useUiStore } from '@/store/ui-store';

interface CollectionSectionProps {
  collection: Collection;
  index: number;
  links: readonly LinkItem[];
  openInNewTab: boolean;
  compact: boolean;
  forceExpanded: boolean;
  dragDisabled: boolean;
  motionMode: MotionMode;
  hoverPreviews: boolean;
}

export function CollectionSection({
  collection,
  index,
  links,
  openInNewTab,
  compact,
  forceExpanded,
  dragDisabled,
  motionMode,
  hoverPreviews,
}: CollectionSectionProps) {
  const openCreateLink = useUiStore((s) => s.openCreateLink);
  const openEditCollection = useUiStore((s) => s.openEditCollection);
  const openTriage = useUiStore((s) => s.openTriage);
  const triggerCollectionCascade = useUiStore(
    (s) => s.triggerCollectionCascade,
  );
  const isCascading = useUiStore((s) =>
    s.cascadingCollectionIds.includes(collection.id),
  );
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
  const colorHex =
    collection.tintColor ?? TAB_GROUP_COLOR_SWATCH[collection.color];
  const viewMode = collection.viewMode ?? 'compact';
  const CuratedIcon = getCuratedCollectionIcon(collection.icon);
  const tintStyle = collection.tintColor
    ? ({ '--collection-tint': collection.tintColor } as CSSProperties)
    : undefined;

  const handleToggleViewMode = () => {
    void stashRepo.updateCollection(collection.id, {
      viewMode: viewMode === 'cover' ? 'compact' : 'cover',
    });
  };

  const handleToggleCollapse = () => {
    if (collection.collapsed) {
      triggerCollectionCascade(collection.id);
    }
    void stashRepo.toggleCollectionCollapsed(collection.id);
  };

  const handleDeleteCollection = async () => {
    await stashRepo.deleteCollection(collection.id);
    toast.success(`Deleted "${collection.name}"`);
  };

  const handleWakeUp = async () => {
    if (links.length === 0) {
      toast.info('No links in this collection to open.');
      return;
    }
    const opened = await wakeUpCollectionInTabGroup(collection, links);
    if (opened > 0) {
      toast.success(
        `Opened ${opened} tab${opened === 1 ? '' : 's'} in "${collection.name}" group`,
      );
    }
  };

  const handleOpenInNewWindow = async () => {
    if (links.length === 0) {
      toast.info('No links in this collection to open.');
      return;
    }
    const opened = await wakeUpCollectionInNewWindow(links);
    if (opened > 0) {
      toast.success(
        `Opened ${opened} tab${opened === 1 ? '' : 's'} in a new window`,
      );
    }
  };

  return (
    <section
      ref={sortableRef}
      className={cn(
        'rounded-card transition-colors',
        isDragging && 'opacity-40',
      )}
    >
      <div
        ref={dropRef}
        style={tintStyle}
        className={cn(
          'space-y-3 rounded-card transition-colors',
          collection.tintColor
            ? 'stash-collection-tinted p-3.5'
            : 'p-1.5 -m-1.5',
          isDropTarget && 'bg-panel/60 ring-2 ring-accent/55',
        )}
      >
        {/* Collection Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
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
              <span className="shrink-0 rounded-pill border border-border bg-panel px-2 py-0.5 font-mono text-[10px] text-fg-muted">
                <OdometerCounter value={links.length} motionMode={motionMode} />
              </span>
              {collection.isSession && (
                <span className="hidden shrink-0 rounded-pill border border-accent/55 bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent sm:inline-block">
                  SESSION
                </span>
              )}
              {collection.description && (
                <span className="hidden truncate text-xs text-fg-muted lg:inline">
                  — {collection.description}
                </span>
              )}
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

            <CollectionAppearancePopover collection={collection} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Collection actions for ${collection.name}`}
                  className="h-7 w-7"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onSelect={() => openCreateLink(collection.id)}
                >
                  <Plus className="h-3.5 w-3.5 text-fg-muted" />
                  Add link
                </DropdownMenuItem>
                {links.length > 0 && (
                  <>
                    <DropdownMenuItem onSelect={() => void handleWakeUp()}>
                      <ArrowUpRight className="h-3.5 w-3.5 text-fg-muted" />
                      Wake Up (Tab Group)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => void handleOpenInNewWindow()}
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-fg-muted" />
                      Open in New Window
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem
                  onSelect={() => openEditCollection(collection)}
                >
                  <Pencil className="h-3.5 w-3.5 text-fg-muted" />
                  Edit collection
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => void handleDeleteCollection()}
                  className="text-danger focus:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete collection
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Links Grid (smooth spring expand/collapse) */}
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              key="collection-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={COLLAPSE_SPRING}
              className="overflow-hidden"
            >
              <div className="px-0.5 py-1">
                {links.length > 0 ? (
                  <div
                    className={cn(
                      'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
                      compact ? 'gap-2.5' : 'gap-3.5',
                    )}
                  >
                    {links.map((link, cardIndex) => (
                      <LinkCard
                        key={link.id}
                        link={link}
                        index={cardIndex}
                        openInNewTab={openInNewTab}
                        compact={compact}
                        dragDisabled={dragDisabled}
                        motionMode={motionMode}
                        cascadeActive={isCascading}
                        hoverPreviews={hoverPreviews}
                        viewMode={viewMode}
                        collectionTint={collection.tintColor}
                      />
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openCreateLink(collection.id)}
                    className={cn(
                      'flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-border bg-panel/40 px-4 py-5 text-xs text-fg-muted transition-colors hover:border-accent/50 hover:bg-panel hover:text-fg cursor-pointer',
                      isDropTarget && 'border-accent bg-accent/10 text-accent',
                    )}
                  >
                    <Plus className="h-3.5 w-3.5 text-accent" />
                    <span>
                      {isDropTarget
                        ? `Drop to stash into ${collection.name}`
                        : `Drop an open tab here or add your first link to ${collection.name}`}
                    </span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
