import { Palette, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { stashRepo } from '@/lib/storage/repo';
import {
  COLLECTION_TINT_SWATCHES,
  CURATED_COLLECTION_ICONS,
  getCuratedCollectionIcon,
} from '@/lib/themes/collection-icons';
import { normalizeHexColor } from '@/lib/themes/contrast';
import type { Collection } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

interface CollectionAppearancePopoverProps {
  collection: Collection;
}

function firstGrapheme(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: 'grapheme',
    });
    const first = segmenter.segment(trimmed)[Symbol.iterator]().next();
    return first.done ? '' : first.value.segment;
  }
  return Array.from(trimmed)[0] ?? '';
}

export function CollectionAppearancePopover({
  collection,
}: CollectionAppearancePopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isCustomEmoji =
    Boolean(collection.icon) && !getCuratedCollectionIcon(collection.icon);
  const [emojiDraft, setEmojiDraft] = useState(
    isCustomEmoji ? (collection.icon ?? '') : '',
  );

  useEffect(() => {
    setEmojiDraft(isCustomEmoji ? (collection.icon ?? '') : '');
  }, [collection.icon, isCustomEmoji]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleSetTint = (hex: string | null) => {
    const normalized = hex ? normalizeHexColor(hex) : null;
    void stashRepo.updateCollection(collection.id, {
      tintColor: normalized,
    });
  };

  const handleSetIcon = (icon: string | null) => {
    void stashRepo.updateCollection(collection.id, {
      icon,
    });
  };

  const handleEmojiChange = (value: string) => {
    const glyph = firstGrapheme(value);
    setEmojiDraft(glyph);
    handleSetIcon(glyph || null);
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Customize appearance for ${collection.name}`}
        aria-expanded={open}
        title="Collection tint & icon"
        className={cn(
          'h-7 w-7 text-fg-muted hover:text-accent',
          (open || collection.tintColor || collection.icon) && 'text-accent',
        )}
      >
        <Palette className="h-3.5 w-3.5" />
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-72 space-y-3 rounded-card border border-border bg-panel p-3.5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
              Collection Appearance
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close appearance popover"
              className="rounded p-0.5 text-fg-muted hover:bg-card hover:text-fg cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Background Tint Swatches */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-fg">
                Background Tint
              </span>
              {collection.tintColor ? (
                <button
                  type="button"
                  onClick={() => handleSetTint(null)}
                  className="inline-flex items-center gap-1 font-mono text-[10px] text-fg-muted hover:text-fg cursor-pointer"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  None
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleSetTint(null)}
                title="No tint (neutral)"
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full border bg-canvas font-mono text-[10px] text-fg-muted cursor-pointer',
                  !collection.tintColor
                    ? 'border-accent ring-2 ring-accent/40'
                    : 'border-border',
                )}
              >
                ×
              </button>

              {COLLECTION_TINT_SWATCHES.map((swatch) => {
                const selected =
                  collection.tintColor?.toUpperCase() === swatch.hex;
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => handleSetTint(swatch.hex)}
                    title={swatch.label}
                    aria-label={`Set tint to ${swatch.label}`}
                    style={{ backgroundColor: swatch.hex }}
                    className={cn(
                      'h-6 w-6 rounded-full border border-black/20 transition-transform hover:scale-110 cursor-pointer',
                      selected &&
                        'ring-2 ring-fg ring-offset-1 ring-offset-panel',
                    )}
                  />
                );
              })}

              <label
                title="Custom hex tint"
                className="relative flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-fg-muted/50 bg-canvas"
              >
                <input
                  type="color"
                  aria-label="Custom collection tint color"
                  value={collection.tintColor ?? '#00D68F'}
                  onChange={(e) => handleSetTint(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span className="font-mono text-[10px] text-fg-muted">+</span>
              </label>
            </div>
          </div>

          {/* Curated Lucide Icons + 1-char Emoji */}
          <div className="space-y-1.5 border-t border-border pt-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-fg">
                Collection Icon
              </span>
              {collection.icon ? (
                <button
                  type="button"
                  onClick={() => {
                    setEmojiDraft('');
                    handleSetIcon(null);
                  }}
                  className="inline-flex items-center gap-1 font-mono text-[10px] text-fg-muted hover:text-fg cursor-pointer"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  Reset
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-6 gap-1">
              {CURATED_COLLECTION_ICONS.map(({ key, label, Icon }) => {
                const selected = collection.icon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setEmojiDraft('');
                      handleSetIcon(key);
                    }}
                    title={label}
                    aria-label={`Set icon to ${label}`}
                    className={cn(
                      'flex h-7 w-full items-center justify-center rounded-control border transition-colors cursor-pointer',
                      selected
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-transparent bg-canvas text-fg-muted hover:border-border hover:text-fg',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <span className="shrink-0 font-mono text-[10px] text-fg-muted">
                Or emoji:
              </span>
              <Input
                value={emojiDraft}
                onChange={(e) => handleEmojiChange(e.target.value)}
                placeholder="🔥"
                aria-label="Custom single emoji icon"
                className="h-7 w-16 text-center text-sm"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
