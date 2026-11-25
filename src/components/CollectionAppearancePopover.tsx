import { Loader2, Palette, RotateCcw, Search, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { checkNanoAvailability } from '@/lib/categorizer/nano-engine';
import { pickCollectionIcon } from '@/lib/icons/aiIconPicker';
import { filterIconCatalog, getCatalogIcon } from '@/lib/icons/catalog';
import { stashRepo } from '@/lib/storage/repo';
import { COLLECTION_TINT_SWATCHES } from '@/lib/themes/collection-icons';
import { normalizeHexColor } from '@/lib/themes/contrast';
import type { Collection } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

interface CollectionAppearancePopoverProps {
  collection: Collection;
  sampleLinkTitles?: readonly string[];
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
  sampleLinkTitles,
}: CollectionAppearancePopoverProps) {
  const [open, setOpen] = useState(false);
  const [iconQuery, setIconQuery] = useState('');
  const [nanoAvailable, setNanoAvailable] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isCustomEmoji =
    Boolean(collection.icon) && !getCatalogIcon(collection.icon);
  const [emojiDraft, setEmojiDraft] = useState(
    isCustomEmoji ? (collection.icon ?? '') : '',
  );

  useEffect(() => {
    setEmojiDraft(isCustomEmoji ? (collection.icon ?? '') : '');
  }, [collection.icon, isCustomEmoji]);

  useEffect(() => {
    if (!open) {
      setIconQuery('');
      return;
    }

    let active = true;
    void checkNanoAvailability()
      .then((status) => {
        if (active) setNanoAvailable(status === 'available');
      })
      .catch(() => {
        if (active) setNanoAvailable(false);
      });

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
      active = false;
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const filteredIcons = useMemo(
    () => filterIconCatalog(iconQuery),
    [iconQuery],
  );

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

  const handleSuggestWithAi = async () => {
    if (suggesting || !nanoAvailable) return;
    setSuggesting(true);
    try {
      const suggested = await pickCollectionIcon(
        collection.name,
        sampleLinkTitles,
      );
      if (!suggested) {
        toast.info('Could not suggest an icon right now.');
        return;
      }
      setEmojiDraft('');
      await stashRepo.updateCollection(collection.id, { icon: suggested });
      toast.success(`Applied "${suggested}" icon to "${collection.name}"`);
    } finally {
      setSuggesting(false);
    }
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
        <div className="absolute right-0 top-full z-40 mt-1.5 w-76 space-y-3 rounded-card border border-border bg-panel p-3.5 shadow-xl">
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

          {/* Searchable Curated Lucide Icons + AI Suggest + 1-char Emoji */}
          <div className="space-y-2 border-t border-border pt-2.5">
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

            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-fg-muted" />
                <Input
                  value={iconQuery}
                  onChange={(e) => setIconQuery(e.target.value)}
                  placeholder="Search icons..."
                  aria-label="Search collection icons"
                  className="h-7 pl-6.5 pr-2 text-[11px]"
                />
              </div>

              {nanoAvailable ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={suggesting}
                  onClick={() => void handleSuggestWithAi()}
                  title="Suggest a matching icon with on-device Gemini Nano"
                  className="h-7 shrink-0 gap-1 px-2 text-[10px]"
                >
                  {suggesting ? (
                    <Loader2 className="h-3 w-3 animate-spin text-accent" />
                  ) : (
                    <Sparkles className="h-3 w-3 text-accent" />
                  )}
                  <span>{suggesting ? '...' : 'AI'}</span>
                </Button>
              ) : null}
            </div>

            {filteredIcons.length === 0 ? (
              <p className="py-3 text-center font-mono text-[10px] text-fg-muted">
                No icons match &ldquo;{iconQuery.trim()}&rdquo;
              </p>
            ) : (
              <div className="grid max-h-40 grid-cols-6 gap-1 overflow-y-auto pr-0.5">
                {filteredIcons.map(({ key, label, Icon }) => {
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
            )}

            <div className="flex items-center gap-2 pt-0.5">
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
