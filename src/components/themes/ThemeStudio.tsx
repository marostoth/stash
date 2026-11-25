import { AlertTriangle, Check, Copy, Palette, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { stashRepo } from '@/lib/storage/repo';
import {
  evaluateThemeContrast,
  normalizeHexColor,
} from '@/lib/themes/contrast';
import {
  BACKDROP_STYLE_OPTIONS,
  buildThemeFromCoreTokens,
  CARD_RADIUS_PRESETS,
  extractCoreThemeColors,
  inferCardRadiusPreset,
} from '@/lib/themes/presets';
import { encodeThemeShareCode } from '@/lib/themes/share';
import type {
  BackdropStyle,
  CardRadiusPreset,
  CoreThemeColors,
  ThemeDefinition,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

interface ThemeStudioProps {
  theme: ThemeDefinition;
  onClose: () => void;
  onDelete: (theme: ThemeDefinition) => Promise<void>;
}

const COLOR_FIELDS: ReadonlyArray<{
  key: keyof CoreThemeColors;
  label: string;
}> = [
  { key: 'canvas', label: 'Canvas' },
  { key: 'surface', label: 'Surface / Card' },
  { key: 'accent', label: 'Accent' },
  { key: 'text', label: 'Text' },
  { key: 'border', label: 'Border' },
];

const RADIUS_ORDER: readonly CardRadiusPreset[] = [
  'sharp',
  'standard',
  'rounded',
];

export function ThemeStudio({ theme, onClose, onDelete }: ThemeStudioProps) {
  const [name, setName] = useState(theme.name);
  const [core, setCore] = useState<CoreThemeColors>(() =>
    extractCoreThemeColors(theme),
  );
  const [hexDrafts, setHexDrafts] = useState<CoreThemeColors>(() =>
    extractCoreThemeColors(theme),
  );
  const [cardRadius, setCardRadius] = useState<CardRadiusPreset>(
    () => theme.cardRadius ?? inferCardRadiusPreset(theme.radius.card),
  );
  const [backdropStyle, setBackdropStyle] = useState<BackdropStyle>(
    () => theme.backdropStyle ?? 'flat',
  );
  const [copied, setCopied] = useState(false);

  // Sync studio inputs if user switches which custom theme they are editing
  useEffect(() => {
    const nextCore = extractCoreThemeColors(theme);
    setName(theme.name);
    setCore(nextCore);
    setHexDrafts(nextCore);
    setCardRadius(theme.cardRadius ?? inferCardRadiusPreset(theme.radius.card));
    setBackdropStyle(theme.backdropStyle ?? 'flat');
  }, [theme.id, theme]);

  const persistLive = (next: {
    name?: string;
    core?: CoreThemeColors;
    cardRadius?: CardRadiusPreset;
    backdropStyle?: BackdropStyle;
  }) => {
    const built = buildThemeFromCoreTokens({
      id: theme.id,
      name: next.name ?? name,
      isBuiltIn: false,
      core: next.core ?? core,
      cardRadius: next.cardRadius ?? cardRadius,
      backdropStyle: next.backdropStyle ?? backdropStyle,
    });
    void stashRepo.saveCustomTheme(built);
  };

  const handleNameChange = (value: string) => {
    setName(value);
    persistLive({ name: value });
  };

  const handlePickerChange = (key: keyof CoreThemeColors, rawHex: string) => {
    const normalized = normalizeHexColor(rawHex);
    if (!normalized) return;
    const nextCore = { ...core, [key]: normalized };
    setCore(nextCore);
    setHexDrafts(nextCore);
    persistLive({ core: nextCore });
  };

  const handleHexInputChange = (key: keyof CoreThemeColors, value: string) => {
    setHexDrafts((prev) => ({ ...prev, [key]: value }));
    const normalized = normalizeHexColor(value);
    if (normalized) {
      const nextCore = { ...core, [key]: normalized };
      setCore(nextCore);
      persistLive({ core: nextCore });
    }
  };

  const handleRadiusChange = (nextRadius: CardRadiusPreset) => {
    setCardRadius(nextRadius);
    persistLive({ cardRadius: nextRadius });
  };

  const handleBackdropChange = (nextBackdrop: BackdropStyle) => {
    setBackdropStyle(nextBackdrop);
    persistLive({ backdropStyle: nextBackdrop });
  };

  const handleCopyShareCode = async () => {
    const built = buildThemeFromCoreTokens({
      id: theme.id,
      name,
      isBuiltIn: false,
      core,
      cardRadius,
      backdropStyle,
    });
    const code = encodeThemeShareCode(built);
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`Copied theme code for "${built.name}"`);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy theme code to clipboard.');
    }
  };

  const contrast = evaluateThemeContrast(core);

  return (
    <div className="space-y-4 rounded-card border border-accent/45 bg-canvas p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-accent" />
          <h3 className="text-xs font-semibold text-fg">
            Theme Studio — Live Preview
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleCopyShareCode()}
            className="h-7 gap-1 px-2 text-[11px]"
          >
            {copied ? (
              <Check className="h-3 w-3 text-accent" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? 'Copied' : 'Copy Theme Code'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void onDelete(theme)}
            className="h-7 gap-1 px-2 text-[11px] hover:text-danger"
            title="Delete custom theme"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close Theme Studio"
            className="h-7 w-7"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Theme Name */}
      <div className="space-y-1">
        <label
          htmlFor="theme-studio-name"
          className="font-mono text-[10px] uppercase tracking-wider text-fg-muted"
        >
          Theme Name
        </label>
        <Input
          id="theme-studio-name"
          value={name}
          maxLength={48}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="My Custom Theme"
          className="h-8 text-xs"
        />
      </div>

      {/* 5 Core Color Pickers */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {COLOR_FIELDS.map(({ key, label }) => {
          const valid = normalizeHexColor(hexDrafts[key]) !== null;
          return (
            <div
              key={key}
              className="flex items-center gap-2 rounded-control border border-border bg-panel/60 px-2.5 py-2"
            >
              <input
                type="color"
                aria-label={`${label} color picker`}
                value={core[key]}
                onChange={(e) => handlePickerChange(key, e.target.value)}
                className="h-7 w-7 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0"
              />
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="text-[10px] font-medium text-fg-muted">
                  {label}
                </div>
                <input
                  type="text"
                  aria-label={`${label} hex value`}
                  value={hexDrafts[key]}
                  maxLength={7}
                  onChange={(e) => handleHexInputChange(key, e.target.value)}
                  className={cn(
                    'w-full bg-transparent font-mono text-xs text-fg focus:outline-none',
                    !valid && 'text-danger',
                  )}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* WCAG Contrast Readout */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-2 rounded-control border px-3 py-2 text-[11px]',
          contrast.passesAA
            ? 'border-border bg-panel/50 text-fg-muted'
            : 'border-amber-500/45 bg-amber-500/10 text-amber-300',
        )}
      >
        <div className="flex items-center gap-1.5">
          {!contrast.passesAA ? (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          ) : null}
          <span>
            {contrast.passesAA
              ? 'Readability looks crisp (WCAG AA).'
              : 'Low text contrast (< 4.5:1) — consider adjusting Text, Surface, or Canvas.'}
          </span>
        </div>
        <span className="font-mono text-[10px]">
          Surface {contrast.textOnSurface.toFixed(1)}:1 · Canvas{' '}
          {contrast.textOnCanvas.toFixed(1)}:1
        </span>
      </div>

      {/* Card Radius + Backdrop Style */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">
            Card Radius
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-control border border-border bg-panel p-1">
            {RADIUS_ORDER.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleRadiusChange(preset)}
                className={cn(
                  'rounded-control px-2 py-1 text-xs font-medium transition-colors cursor-pointer',
                  cardRadius === preset
                    ? 'bg-accent text-accent-fg'
                    : 'text-fg-muted hover:text-fg',
                )}
              >
                {CARD_RADIUS_PRESETS[preset].label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">
            Backdrop Style
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-control border border-border bg-panel p-1">
            {BACKDROP_STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleBackdropChange(opt.id)}
                className={cn(
                  'rounded-control px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                  backdropStyle === opt.id
                    ? 'bg-accent text-accent-fg'
                    : 'text-fg-muted hover:text-fg',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
