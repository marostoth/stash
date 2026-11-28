import { useDraggable } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { Check, GripVertical, Pencil, Star, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { memo, useEffect, useRef, useState } from 'react';
import { LinkFavicon } from '@/components/LinkFavicon';
import { showDeletedLinkToast } from '@/components/workbench/card-effects';
import {
  buildPriceTooltip,
  InlinePriceCell,
  InlineQtyCell,
  InlineSpecCell,
} from '@/components/workbench/details-inline-cells';
import { DropSparks } from '@/components/workbench/drop-sparks';
import { playDelete, playTagPop, playUncheck } from '@/lib/audio/foley';
import { isArcadeMotion, isTactileMotion } from '@/lib/motion/presets';
import { stashRepo } from '@/lib/storage/repo';
import type { LinkItem, MotionMode, ProductMeta } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import {
  createDebouncedWriter,
  type DebouncedWriter,
} from '@/lib/utils/coalesce';
import { HighlightText } from '@/lib/utils/highlight-match';
import { normalizeCurrencyCode } from '@/lib/utils/price-math';
import { normalizeStoreName } from '@/lib/utils/product-url';
import { toSafeHref } from '@/lib/utils/url';
import { captureSelectorRect, vfxEngine } from '@/lib/vfx/engine';
import { useFxStore } from '@/store/fx-store';
import { useSelectionStore } from '@/store/selection-store';
import { useUiStore } from '@/store/ui-store';

const QTY_SAVE_DEBOUNCE_MS = 250;

export type DetailsRowDragMode = 'collection' | 'cross-only' | 'none';

interface DetailsRowProps {
  link: LinkItem;
  index: number;
  dragMode: DetailsRowDragMode;
  contextLabel?: string;
  showPriceColumn: boolean;
  defaultCurrency: string;
  openInNewTab: boolean;
  motionMode: MotionMode;
  soundEffects: boolean;
  hoverPreviews: boolean;
  gridTemplateClass: string;
}

interface DetailsRowViewProps extends DetailsRowProps {
  rowRef?: (element: Element | null) => void;
  handleRef?: (element: Element | null) => void;
  isDragging: boolean;
  isDropTarget: boolean;
}

function DetailsRowView({
  link,
  dragMode,
  contextLabel,
  showPriceColumn,
  defaultCurrency,
  openInNewTab,
  motionMode,
  soundEffects,
  hoverPreviews,
  gridTemplateClass,
  rowRef,
  handleRef,
  isDragging,
  isDropTarget,
}: DetailsRowViewProps) {
  const { openEditLink, schedulePreview, dismissPreview } =
    useUiStore.getState();
  const isKeyboardFocused = useUiStore(
    (s) => s.keyboardFocusedLinkId === link.id,
  );
  const settledBurstKey = useUiStore((s) =>
    s.settledLinkId === link.id ? s.settledSeq : 0,
  );
  const isSettling = settledBurstKey > 0;
  const searchQuery = useUiStore((s) => s.searchQuery);
  const { recordComboHit, triggerContainerShake } = useFxStore.getState();
  const isSelected = useSelectionStore((s) => s.selectedIds.includes(link.id));
  const selectionMode = useSelectionStore((s) => s.selectedIds.length > 0);
  const { toggleSelect, selectRangeTo } = useSelectionStore.getState();
  const arcade = isArcadeMotion(motionMode);
  const tactile = isTactileMotion(motionMode);

  const isStarred = link.starred === true;
  const isChecked = link.checked === true;
  const product = link.product;
  const hasPrice =
    typeof product?.price === 'number' && Number.isFinite(product.price);
  const qty =
    typeof product?.orderQty === 'number' && product.orderQty >= 1
      ? Math.floor(product.orderQty)
      : 1;
  const [displayQty, setDisplayQty] = useState(qty);
  const productRef = useRef<ProductMeta | undefined>(product);
  productRef.current = product;
  const qtyWriterRef = useRef<DebouncedWriter<number> | null>(null);

  useEffect(() => {
    setDisplayQty(qty);
  }, [qty]);

  useEffect(() => {
    const linkId = link.id;
    const writer = createDebouncedWriter<number>((nextQty) => {
      const latestProduct = productRef.current;
      if (!latestProduct) return;
      void stashRepo.updateLink(linkId, {
        product: {
          ...latestProduct,
          orderQty: nextQty,
        },
      });
    }, QTY_SAVE_DEBOUNCE_MS);
    qtyWriterRef.current = writer;
    return () => {
      writer.flush();
      qtyWriterRef.current = null;
    };
  }, [link.id]);

  const storeName = normalizeStoreName(link.url, product?.store);
  const resolvedContext = contextLabel ?? storeName;
  const specOrNote = product?.spec || link.note || '';
  const visibleTags = link.tags.slice(0, 2);
  const resolvedCurrency = normalizeCurrencyCode(
    product?.currency,
    defaultCurrency,
  );
  const unitPrice =
    hasPrice && product?.price !== undefined ? product.price : undefined;
  const priceTooltip = buildPriceTooltip(
    product,
    unitPrice,
    displayQty,
    resolvedCurrency,
  );

  const handleToggleStar = async () => {
    const nextStarred = !isStarred;
    const res = await stashRepo.updateLink(link.id, { starred: nextStarred });
    if (res.ok && nextStarred) {
      playTagPop(soundEffects, motionMode);
    }
  };

  const handleToggleChecked = async () => {
    const nextChecked = !isChecked;
    const res = await stashRepo.updateLink(link.id, { checked: nextChecked });
    if (res.ok) {
      if (nextChecked) {
        playTagPop(soundEffects, motionMode);
        if (arcade && recordComboHit() >= 5) {
          triggerContainerShake('combo');
        }
      } else {
        playUncheck(soundEffects);
      }
    }
  };

  const handleChangeQty = (delta: number) => {
    if (!product || !hasPrice) return;
    setDisplayQty((prev) => {
      const nextQty = Math.max(1, Math.min(999, prev + delta));
      if (nextQty !== prev) {
        qtyWriterRef.current?.schedule(nextQty);
      }
      return nextQty;
    });
  };

  const handleDelete = async () => {
    const snapshot: LinkItem = {
      ...link,
      tags: [...link.tags],
      ...(link.product ? { product: { ...link.product } } : {}),
    };
    dismissPreview();
    const preDeleteRect = arcade
      ? captureSelectorRect(`[data-link-id="${CSS.escape(snapshot.id)}"]`)
      : null;
    const deleted = await stashRepo.deleteLink(snapshot.id);
    if (!deleted) return;
    playDelete(soundEffects);
    if (preDeleteRect) vfxEngine.spawnDelete(preDeleteRect);
    showDeletedLinkToast(snapshot, {
      soundEffects,
      motionMode,
    });
  };

  const handlePointerEnterTitle = (
    event: React.PointerEvent<HTMLAnchorElement>,
  ) => {
    if (!hoverPreviews) return;
    const rect = event.currentTarget.getBoundingClientRect();
    schedulePreview({
      id: `link:${link.id}`,
      url: link.url,
      title: link.title,
      note: specOrNote || undefined,
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

  return (
    <div
      ref={rowRef}
      data-link-id={link.id}
      data-vfx-occluder="true"
      className={cn(
        'group relative grid min-h-[42px] items-center gap-3.5 border-b border-hairline px-3.5 py-1.5 text-xs transition-colors last:border-b-0 hover:bg-card-hover/80',
        gridTemplateClass,
        isSelected && 'bg-accent/[0.14] ring-1 ring-inset ring-accent/75',
        isChecked && 'opacity-60 hover:opacity-90',
        isDragging && 'opacity-40',
        isDropTarget && 'bg-elevated ring-1 ring-inset ring-accent/45',
        isKeyboardFocused && 'bg-elevated ring-1 ring-inset ring-accent/55',
      )}
    >
      <DropSparks
        active={tactile && isSettling}
        arcade={arcade}
        burstKey={settledBurstKey}
        compact
      />

      {/* 1. Left Drag Handle + Checked + Star toggle */}
      <div className="flex items-center gap-0.5">
        {dragMode !== 'none' ? (
          <button
            ref={handleRef}
            type="button"
            aria-label={`Drag ${link.title}`}
            title={
              dragMode === 'collection'
                ? 'Drag to reorder or move to another collection / Space'
                : 'Drag to move to another collection or Space'
            }
            className="inline-flex h-5 w-4 shrink-0 items-center justify-center rounded text-fg-muted/45 transition-colors hover:bg-panel hover:text-fg group-hover:text-fg-muted cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-3 w-3" />
          </button>
        ) : (
          <span aria-hidden="true" className="w-4 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => void handleToggleChecked()}
          aria-pressed={isChecked}
          aria-label={
            isChecked
              ? `Uncheck ${link.title}`
              : `Mark ${link.title} as bought / done`
          }
          title={isChecked ? 'Unmark done / bought' : 'Mark as bought / done'}
          className={cn(
            'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors cursor-pointer',
            isChecked
              ? 'border-accent bg-accent text-accent-fg'
              : 'border-border/80 bg-canvas/70 text-transparent hover:border-accent/65',
          )}
        >
          <motion.span
            key={isChecked ? 'chk' : 'unchk'}
            initial={tactile && isChecked ? { scale: 0.35 } : false}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 600, damping: 20 }}
            className="inline-flex items-center justify-center"
          >
            <Check className="h-3 w-3 stroke-[2.8]" />
          </motion.span>
        </button>
        <button
          type="button"
          onClick={() => void handleToggleStar()}
          aria-pressed={isStarred}
          aria-label={isStarred ? `Unstar ${link.title}` : `Star ${link.title}`}
          className={cn(
            'inline-flex h-6 w-5 shrink-0 items-center justify-center rounded transition-colors cursor-pointer',
            isStarred ? 'text-accent' : 'text-fg-muted/50 hover:text-accent',
          )}
        >
          <Star
            className={cn(
              'h-3.5 w-3.5',
              isStarred && 'fill-accent text-accent',
            )}
          />
        </button>
      </div>

      {/* 2. Item (Favicon + Title) */}
      <a
        href={toSafeHref(link.url)}
        target={openInNewTab ? '_blank' : '_self'}
        rel={openInNewTab ? 'noopener noreferrer' : undefined}
        onClick={(event) => {
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
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          openEditLink(link);
        }}
        onPointerEnter={handlePointerEnterTitle}
        onPointerLeave={dismissPreview}
        className="flex min-w-0 items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded border border-border/80 bg-panel">
          <LinkFavicon url={link.url} faviconUrl={link.faviconUrl} size="sm" />
        </div>
        <span
          className={cn(
            'truncate font-medium transition-colors',
            isChecked
              ? 'text-fg-muted line-through decoration-fg-muted/70'
              : 'text-fg group-hover:text-accent',
          )}
        >
          <HighlightText text={link.title} query={searchQuery} />
        </span>
      </a>

      {/* 3. Spec / Note (click to edit inline) */}
      <InlineSpecCell link={link} specOrNote={specOrNote} />

      {/* 4. Context (Store when grouped by Collection, Collection when grouped by Store) */}
      <span
        title={resolvedContext}
        className="truncate font-mono text-[11px] text-fg-muted"
      >
        {resolvedContext}
      </span>

      {/* 5. Tags */}
      <div className="hidden items-center gap-1 overflow-hidden lg:flex">
        {visibleTags.map((tag) => (
          <span
            key={tag}
            className="truncate rounded-pill border border-border bg-panel px-1.5 py-0.25 font-mono text-[10px] text-fg-muted"
          >
            #{tag}
          </span>
        ))}
      </div>

      {/* 6. Qty Stepper (before Price so Price updates dynamically beside it) */}
      {showPriceColumn && (
        <InlineQtyCell
          linkTitle={link.title}
          hasPrice={hasPrice}
          displayQty={displayQty}
          onChangeQty={handleChangeQty}
        />
      )}

      {/* 7. Price (unitPrice × qty; click to edit unit price inline) */}
      {showPriceColumn && (
        <InlinePriceCell
          link={link}
          defaultCurrency={defaultCurrency}
          displayQty={displayQty}
          isStarred={isStarred}
          priceTooltip={priceTooltip}
        />
      )}

      {/* 8. Hover Actions */}
      <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={() => openEditLink(link)}
          aria-label={`Edit ${link.title}`}
          title="Quick edit"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-panel hover:text-fg cursor-pointer"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => void handleDelete()}
          aria-label={`Delete ${link.title}`}
          title="Delete link (Undo available)"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-danger/15 hover:text-danger cursor-pointer"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function SortableDetailsRow(props: DetailsRowProps) {
  const { ref, handleRef, isDragging, isDropTarget } = useSortable({
    id: `link:${props.link.id}`,
    group: props.link.collectionId,
    type: 'link',
    accept: ['link', 'open-tab'],
    index: props.index,
    data: {
      kind: 'link' as const,
      link: props.link,
      collectionId: props.link.collectionId,
      index: props.index,
    },
  });

  return (
    <DetailsRowView
      {...props}
      rowRef={ref}
      handleRef={handleRef}
      isDragging={isDragging}
      isDropTarget={isDropTarget}
    />
  );
}

function DraggableDetailsRow(props: DetailsRowProps) {
  const { ref, handleRef, isDragging } = useDraggable({
    id: `link:${props.link.id}`,
    type: 'link',
    data: {
      kind: 'link' as const,
      link: props.link,
      collectionId: props.link.collectionId,
      index: props.index,
    },
  });

  return (
    <DetailsRowView
      {...props}
      rowRef={ref}
      handleRef={handleRef}
      isDragging={isDragging}
      isDropTarget={false}
    />
  );
}

export const DetailsRow = memo(function DetailsRow(props: DetailsRowProps) {
  if (props.dragMode === 'collection') {
    return <SortableDetailsRow {...props} />;
  }
  if (props.dragMode === 'cross-only') {
    return <DraggableDetailsRow {...props} />;
  }
  return <DetailsRowView {...props} isDragging={false} isDropTarget={false} />;
});
