import {
  Check,
  Copy,
  Download,
  Palette,
  Pencil,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ThemeStudio } from '@/components/themes/ThemeStudio';
import { Button } from '@/components/ui/button';
import { triggerFileDownload } from '@/lib/import-export/chrome-bookmarks';
import { stashRepo } from '@/lib/storage/repo';
import {
  buildThemeFromCoreTokens,
  extractCoreThemeColors,
  inferCardRadiusPreset,
} from '@/lib/themes/presets';
import {
  encodeThemeShareCode,
  parseAndValidateThemeShareInput,
} from '@/lib/themes/share';
import { serializeThemeForExport } from '@/lib/themes/theme-validator';
import type { ThemeDefinition } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

interface ThemesPanelProps {
  allThemes: readonly ThemeDefinition[];
  activeTheme: ThemeDefinition;
}

export function ThemesPanel({ allThemes, activeTheme }: ThemesPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importInput, setImportInput] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const editingTheme =
    editingThemeId !== null
      ? (allThemes.find((t) => t.id === editingThemeId && !t.isBuiltIn) ?? null)
      : null;

  const handleApply = (themeId: string) => {
    void stashRepo.updateSettings({ activeThemeId: themeId });
  };

  const handleDuplicateAndCustomize = async (source: ThemeDefinition) => {
    const core = extractCoreThemeColors(source);
    const cloned = buildThemeFromCoreTokens({
      id: `custom-${crypto.randomUUID().slice(0, 8)}`,
      name: `${source.name} Remix`,
      isBuiltIn: false,
      core,
      cardRadius:
        source.cardRadius ?? inferCardRadiusPreset(source.radius.card),
      backdropStyle: source.backdropStyle ?? 'flat',
    });

    const saved = await stashRepo.saveCustomTheme(cloned);
    await stashRepo.updateSettings({ activeThemeId: saved.id });
    setEditingThemeId(saved.id);
    toast.success(`Created "${saved.name}" — editing live`);
  };

  const handleCopyShareCode = async (theme: ThemeDefinition) => {
    const code = encodeThemeShareCode(theme);
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Copied theme code for "${theme.name}"`);
    } catch {
      toast.error('Could not copy theme code to clipboard.');
    }
  };

  const handleExportFile = (theme: ThemeDefinition) => {
    const filename = `${theme.id}.stash-theme.json`;
    triggerFileDownload(filename, serializeThemeForExport(theme));
    toast.success(`Exported ${filename}`);
  };

  const handleImportText = async () => {
    setImportError(null);
    const parsed = parseAndValidateThemeShareInput(importInput);
    if (!parsed.ok) {
      setImportError(parsed.error);
      return;
    }

    const saved = await stashRepo.saveCustomTheme(parsed.theme);
    await stashRepo.updateSettings({ activeThemeId: saved.id });
    setImportInput('');
    setImportOpen(false);
    setEditingThemeId(saved.id);
    toast.success(`Imported & applied "${saved.name}"`);
  };

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseAndValidateThemeShareInput(text);
      if (!parsed.ok) {
        toast.error(parsed.error);
        return;
      }

      const saved = await stashRepo.saveCustomTheme(parsed.theme);
      await stashRepo.updateSettings({ activeThemeId: saved.id });
      setEditingThemeId(saved.id);
      toast.success(`Imported & applied "${saved.name}"`);
    } catch {
      toast.error('Could not read theme JSON file.');
    }
  };

  const handleDelete = async (theme: ThemeDefinition) => {
    if (theme.isBuiltIn) return;
    if (editingThemeId === theme.id) {
      setEditingThemeId(null);
    }
    await stashRepo.deleteCustomTheme(theme.id);
    toast.success(`Removed custom theme "${theme.name}"`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-fg-muted">
          Pick a built-in skin, duplicate any theme to remix live in Theme
          Studio, or paste a shared theme code.
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setImportOpen((prev) => !prev);
              setImportError(null);
            }}
            className="gap-1.5"
          >
            <Upload className="h-3.5 w-3.5 text-accent" />
            Import Theme
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            title="Upload .stash-theme.json file"
          >
            .json file
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => void handleImportFile(e)}
            className="hidden"
          />
        </div>
      </div>

      {/* Paste Share Code / JSON Import Box */}
      {importOpen ? (
        <div className="space-y-2 rounded-card border border-accent/40 bg-canvas p-3.5">
          <label
            htmlFor="theme-share-paste"
            className="block font-mono text-[10px] uppercase tracking-wider text-fg-muted"
          >
            Paste Theme Share Code or JSON
          </label>
          <textarea
            id="theme-share-paste"
            rows={3}
            value={importInput}
            onChange={(e) => {
              setImportInput(e.target.value);
              setImportError(null);
            }}
            placeholder='stash-theme:eyJ2IjoxLC...  or  {"name":"My Theme","colors":{...}}'
            className="w-full rounded-control border border-border bg-panel px-2.5 py-2 font-mono text-[11px] text-fg placeholder:text-fg-muted/60 focus:border-accent focus:outline-none"
          />
          {importError ? (
            <p className="font-mono text-[11px] text-danger">{importError}</p>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setImportOpen(false);
                setImportError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!importInput.trim()}
              onClick={() => void handleImportText()}
            >
              Import &amp; Apply
            </Button>
          </div>
        </div>
      ) : null}

      {/* Live Theme Studio Editor */}
      {editingTheme ? (
        <ThemeStudio
          theme={editingTheme}
          onClose={() => setEditingThemeId(null)}
          onDelete={handleDelete}
        />
      ) : null}

      {/* Swatch Grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {allThemes.map((theme) => {
          const isActive = theme.id === activeTheme.id;
          const isEditing = editingTheme?.id === theme.id;
          const core = extractCoreThemeColors(theme);
          const backdropLabel = theme.backdropStyle ?? 'flat';

          return (
            <div
              key={theme.id}
              className={cn(
                'flex flex-col justify-between gap-2.5 rounded-card border bg-canvas p-3 transition-colors',
                isActive ? 'border-accent/70' : 'border-border',
                isEditing && 'ring-1 ring-accent/50',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  {/* Visual swatch dots: canvas, surface, accent */}
                  <div
                    className="flex h-8 w-12 shrink-0 items-center justify-center gap-1 rounded-control border"
                    style={{
                      backgroundColor: core.canvas,
                      borderColor: core.border,
                    }}
                    title="Canvas / Surface / Accent preview"
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-black/20"
                      style={{ backgroundColor: core.surface }}
                    />
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-black/20"
                      style={{ backgroundColor: core.accent }}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-fg">
                        {theme.name}
                      </span>
                      {!theme.isBuiltIn ? (
                        <span className="rounded-pill border border-accent/35 bg-accent/10 px-1.5 py-0.25 font-mono text-[9px] uppercase text-accent">
                          custom
                        </span>
                      ) : null}
                    </div>
                    <div className="font-mono text-[10px] text-fg-muted">
                      {theme.mode} · {backdropLabel} · {theme.radius.card}
                    </div>
                  </div>
                </div>

                {isActive ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-accent/45 bg-accent/15 px-2 py-0.5 font-mono text-[10px] text-accent">
                    <Check className="h-3 w-3" />
                    Active
                  </span>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleApply(theme.id)}
                    className="h-6 shrink-0 px-2 text-[11px]"
                  >
                    <Palette className="h-3 w-3" />
                    Apply
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-1 border-t border-border/60 pt-2">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDuplicateAndCustomize(theme)}
                    className="h-6 gap-1 px-2 text-[11px] text-fg-muted hover:text-accent"
                  >
                    <Sparkles className="h-3 w-3" />
                    Duplicate &amp; Customize
                  </Button>
                  {!theme.isBuiltIn ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleApply(theme.id);
                        setEditingThemeId(theme.id);
                      }}
                      className="h-6 gap-1 px-2 text-[11px] text-fg-muted hover:text-fg"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                  ) : null}
                </div>

                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleCopyShareCode(theme)}
                    aria-label={`Copy share code for ${theme.name}`}
                    title="Copy theme share code"
                    className="h-6 w-6"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleExportFile(theme)}
                    aria-label={`Download ${theme.name} JSON`}
                    title="Download .stash-theme.json"
                    className="h-6 w-6"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  {!theme.isBuiltIn ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleDelete(theme)}
                      aria-label={`Delete ${theme.name}`}
                      title="Delete custom theme"
                      className="h-6 w-6 hover:text-danger"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
