import { Check, Download, Palette, Trash2, Upload } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { triggerFileDownload } from '@/lib/import-export/chrome-bookmarks';
import { stashRepo } from '@/lib/storage/repo';
import {
  serializeThemeForExport,
  validateThemeDefinition,
} from '@/lib/themes/theme-validator';
import type { ThemeDefinition } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

interface ThemesPanelProps {
  allThemes: readonly ThemeDefinition[];
  activeTheme: ThemeDefinition;
}

export function ThemesPanel({ allThemes, activeTheme }: ThemesPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleApply = (themeId: string) => {
    void stashRepo.updateSettings({ activeThemeId: themeId });
  };

  const handleExport = (theme: ThemeDefinition) => {
    const filename = `${theme.id}.stash-theme.json`;
    triggerFileDownload(filename, serializeThemeForExport(theme));
    toast.success(`Exported ${filename}`);
  };

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const validated = validateThemeDefinition(parsed);
      if (!validated.ok) {
        toast.error(validated.error);
        return;
      }

      const saved = await stashRepo.saveCustomTheme(validated.theme);
      await stashRepo.updateSettings({ activeThemeId: saved.id });
      toast.success(`Imported & applied "${saved.name}"`);
    } catch {
      toast.error('Could not parse .stash-theme.json file.');
    }
  };

  const handleDelete = async (theme: ThemeDefinition) => {
    await stashRepo.deleteCustomTheme(theme.id);
    toast.success(`Removed custom theme "${theme.name}"`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-fg-muted">
          Export any theme as{' '}
          <span className="font-mono text-fg">.stash-theme.json</span>, tweak
          its color or radius tokens, and re-import to load a custom skin live.
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0"
        >
          <Upload className="h-3.5 w-3.5" />
          Import Theme JSON
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={(e) => void handleImportFile(e)}
          className="hidden"
        />
      </div>

      <div className="space-y-2">
        {allThemes.map((theme) => {
          const isActive = theme.id === activeTheme.id;
          return (
            <div
              key={theme.id}
              className={cn(
                'flex flex-wrap items-center justify-between gap-3 rounded-card border bg-canvas px-3.5 py-2.5 transition-colors',
                isActive ? 'border-accent/60' : 'border-border',
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                {/* 4-token swatch preview */}
                <div className="flex shrink-0 overflow-hidden rounded-control border border-border">
                  <span
                    className="h-6 w-3.5"
                    style={{ backgroundColor: theme.colors.canvas }}
                    title="Canvas"
                  />
                  <span
                    className="h-6 w-3.5"
                    style={{ backgroundColor: theme.colors.panel }}
                    title="Panel"
                  />
                  <span
                    className="h-6 w-3.5"
                    style={{ backgroundColor: theme.colors.card }}
                    title="Card"
                  />
                  <span
                    className="h-6 w-3.5"
                    style={{ backgroundColor: theme.colors.accent }}
                    title="Accent"
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-fg">
                      {theme.name}
                    </span>
                    <span className="rounded-pill border border-border bg-panel px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
                      {theme.mode}
                    </span>
                    {!theme.isBuiltIn && (
                      <span className="rounded-pill border border-accent/35 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                        custom
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[10px] text-fg-muted">
                    accent {theme.colors.accent} · radius {theme.radius.card}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {isActive ? (
                  <span className="inline-flex items-center gap-1 rounded-control border border-accent/40 bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
                    <Check className="h-3.5 w-3.5" />
                    Active
                  </span>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleApply(theme.id)}
                    className="h-7 px-2.5 text-xs"
                  >
                    <Palette className="h-3 w-3" />
                    Apply
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleExport(theme)}
                  aria-label={`Export ${theme.name} theme JSON`}
                  title="Export .stash-theme.json"
                  className="h-7 w-7"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>

                {!theme.isBuiltIn && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleDelete(theme)}
                    aria-label={`Delete ${theme.name} custom theme`}
                    title="Remove custom theme"
                    className="h-7 w-7 hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
