import {
  Bookmark,
  Check,
  Copy,
  Download,
  FileCode2,
  FolderSync,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  SettingsGroupHeading,
  SettingsSectionCard,
} from '@/components/settings/settings-section-card';
import { Button } from '@/components/ui/button';
import {
  type AiAuditPromptMode,
  buildAiAuditPrompt,
} from '@/lib/import-export/ai-audit-prompt';
import {
  getBackupStaleness,
  isLikelyTruncatedBackup,
} from '@/lib/import-export/backup-status';
import { parseNetscapeBookmarksHtml } from '@/lib/import-export/bookmarks-html';
import {
  buildNetscapeBookmarksHtml,
  formatBookmarksHtmlFilename,
} from '@/lib/import-export/bookmarks-html-export';
import {
  buildExportBundle,
  formatBackupFilename,
  validateExportBundle,
} from '@/lib/import-export/bundle';
import {
  readChromeBookmarksWithPermission,
  triggerFileDownload,
} from '@/lib/import-export/chrome-bookmarks';
import { stashRepo } from '@/lib/storage/repo';
import type {
  Space,
  StashExportBundle,
  StashSettings,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

interface BackupImportPanelProps {
  settings: StashSettings;
  spaces: readonly Space[];
  linkCount: number;
  collectionCount: number;
}

export function BackupImportPanel({
  settings,
  spaces,
  linkCount,
  collectionCount,
}: BackupImportPanelProps) {
  const jsonInputRef = useRef<HTMLInputElement | null>(null);
  const htmlInputRef = useRef<HTMLInputElement | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pendingBundle, setPendingBundle] = useState<StashExportBundle | null>(
    null,
  );
  const [busyAction, setBusyAction] = useState<
    'merge' | 'replace' | 'chrome' | 'html' | null
  >(null);
  const [promptMode, setPromptMode] = useState<AiAuditPromptMode>('audit');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const busy = busyAction !== null;

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const staleness = getBackupStaleness(settings.lastBackupAt, linkCount);

  const handleExportJson = async () => {
    try {
      const exportedAt = new Date().toISOString();
      const snapshot = await stashRepo.getSnapshot();
      const bundle = buildExportBundle(snapshot, exportedAt);
      const filename = formatBackupFilename();
      triggerFileDownload(filename, `${JSON.stringify(bundle, null, 2)}\n`);
      await stashRepo.updateSettings({ lastBackupAt: exportedAt });
      toast.success(`Exported ${filename}`);
    } catch {
      toast.error('Could not export JSON backup. Please try again.');
    }
  };

  const handleExportHtml = async () => {
    try {
      const snapshot = await stashRepo.getSnapshot();
      const html = buildNetscapeBookmarksHtml(
        snapshot.spaces,
        snapshot.collections,
        snapshot.links,
      );
      const filename = formatBookmarksHtmlFilename();
      triggerFileDownload(filename, html, 'text/html;charset=utf-8');
      toast.success(`Exported ${filename}`);
    } catch {
      toast.error('Could not export HTML bookmarks. Please try again.');
    }
  };

  const handleCopyAuditPrompt = async () => {
    const prompt = buildAiAuditPrompt(promptMode, {
      linkCount,
      collectionCount,
      spaces,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(true);
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = setTimeout(() => {
        setCopiedPrompt(false);
        copiedTimerRef.current = null;
      }, 2200);
      toast.success('AI audit prompt copied to clipboard');
    } catch {
      toast.error('Could not access clipboard.');
    }
  };

  const handleSelectBackupFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const validated = validateExportBundle(parsed);
      if (!validated.ok) {
        toast.error(validated.error);
        return;
      }
      setPendingBundle(validated.bundle);
    } catch {
      toast.error('Could not parse JSON backup file.');
    }
  };

  const handleRestore = async (mode: 'merge' | 'replace') => {
    if (!pendingBundle || busy) return;
    setBusyAction(mode);
    try {
      const stats = await stashRepo.restoreBundle(pendingBundle, mode);
      setPendingBundle(null);
      if (mode === 'replace') {
        toast.success(
          `Restored ${stats.addedCollections} collections and ${stats.addedLinks} links.`,
        );
      } else {
        toast.success(
          `Merged +${stats.addedCollections} collections, +${stats.addedLinks} links (${stats.skippedLinks} duplicates skipped).`,
        );
      }
    } catch {
      toast.error('Could not restore backup into local storage.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleImportChromeBookmarks = async () => {
    if (busy) return;
    setBusyAction('chrome');
    try {
      const result = await readChromeBookmarksWithPermission();
      if (!result.ok) {
        toast.info(result.message);
        return;
      }
      if (result.folders.length === 0) {
        toast.info('No web bookmarks found in Chrome.');
        return;
      }
      const summary = await stashRepo.importBookmarkFolders(result.folders);
      toast.success(
        `Imported ${summary.linksAdded} bookmarks across ${summary.collectionsCreated} new collection${summary.collectionsCreated === 1 ? '' : 's'}${summary.linksSkipped > 0 ? ` (${summary.linksSkipped} duplicates skipped)` : ''}.`,
      );
    } catch {
      toast.error('Could not import Chrome bookmarks. Please try again.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSelectHtmlFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy) return;

    setBusyAction('html');
    try {
      const html = await file.text();
      const folders = parseNetscapeBookmarksHtml(html);
      if (folders.length === 0) {
        toast.error('No valid bookmarks found in that HTML file.');
        return;
      }
      const summary = await stashRepo.importBookmarkFolders(folders);
      toast.success(
        `Imported ${summary.linksAdded} bookmarks across ${summary.collectionsCreated} new collection${summary.collectionsCreated === 1 ? '' : 's'}${summary.linksSkipped > 0 ? ` (${summary.linksSkipped} duplicates skipped)` : ''}.`,
      );
    } catch {
      toast.error('Could not import HTML bookmark file.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-7">
      {/* Group 1: Backups & Portability */}
      <div className="space-y-3">
        <SettingsGroupHeading>Backups &amp; Portability</SettingsGroupHeading>
        <SettingsSectionCard
          icon={<FolderSync className="h-4 w-4" />}
          title="Export & Restore"
          subtitle="Save your full Stash library as portable JSON (collections, links, notes, tags, rules, settings, and custom themes) or export universal HTML bookmarks."
          badge={{ label: 'Schema v1', tone: 'neutral' }}
          headerAction={
            <span
              className={cn(
                'rounded-pill border px-2 py-0.5 font-mono text-[10px]',
                staleness.isStale
                  ? 'border-warning/40 bg-warning/15 text-warning'
                  : 'border-border bg-panel text-fg-muted',
              )}
            >
              {staleness.label}
            </span>
          }
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleExportJson()}
            >
              <Download className="h-3.5 w-3.5" />
              Export JSON Backup
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleExportHtml()}
              title="Export standard Netscape HTML bookmarks for Chrome, Edge, or Firefox"
            >
              <FileCode2 className="h-3.5 w-3.5 text-accent" />
              Export HTML Bookmarks (.html)
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => jsonInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Import JSON Backup
            </Button>
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => void handleSelectBackupFile(e)}
              className="hidden"
            />
          </div>

          <p className="text-xs leading-relaxed text-fg-muted">
            JSON backups stay compact by excluding locally uploaded wallpaper
            images and custom audio clips (re-upload them on a new device if
            needed).
          </p>

          {pendingBundle && (
            <div className="space-y-2.5 rounded-control border border-accent/45 bg-panel p-3.5">
              <div className="text-xs font-medium text-fg">
                Ready to import backup:
              </div>
              <div className="font-mono text-[11px] text-fg-muted">
                {pendingBundle.collections.length} collections ·{' '}
                {pendingBundle.links.length} links ·{' '}
                {pendingBundle.rules.length} rules ·{' '}
                {pendingBundle.customThemes.length} custom themes
              </div>
              {isLikelyTruncatedBackup(
                linkCount,
                pendingBundle.links.length,
              ) && (
                <p className="rounded-control border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
                  This backup has {pendingBundle.links.length} links vs. your
                  current {linkCount} links — check that an AI tool didn&apos;t
                  truncate the file before replacing.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleRestore('merge')}
                >
                  {busyAction === 'merge' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {busyAction === 'merge'
                    ? 'Merging...'
                    : 'Merge (Skip Duplicates)'}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleRestore('replace')}
                >
                  {busyAction === 'replace' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {busyAction === 'replace' ? 'Replacing...' : 'Replace All'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setPendingBundle(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </SettingsSectionCard>
      </div>

      {/* Group 2: Import from Browser */}
      <div className="space-y-3">
        <SettingsGroupHeading>Import from Browser</SettingsGroupHeading>
        <SettingsSectionCard
          icon={<Bookmark className="h-4 w-4" />}
          title="Import Bookmarks"
          subtitle="Bring existing bookmarks into Stash collections. Duplicate URLs within a collection are automatically skipped."
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void handleImportChromeBookmarks()}
            >
              {busyAction === 'chrome' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
              ) : (
                <Bookmark className="h-3.5 w-3.5 text-accent" />
              )}
              {busyAction === 'chrome'
                ? 'Importing Bookmarks...'
                : 'Import Chrome Bookmarks'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => htmlInputRef.current?.click()}
            >
              {busyAction === 'html' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
              ) : (
                <FileCode2 className="h-3.5 w-3.5 text-fg-muted" />
              )}
              {busyAction === 'html'
                ? 'Importing HTML...'
                : 'Import HTML File (.html)'}
            </Button>
            <input
              ref={htmlInputRef}
              type="file"
              accept=".html,.htm,text/html"
              onChange={(e) => void handleSelectHtmlFile(e)}
              className="hidden"
            />
          </div>
          <p className="text-xs leading-relaxed text-fg-muted">
            Direct Chrome import requests optional bookmarks permission on
            click. HTML import supports standard Netscape HTML exports from
            Chrome, Edge, Firefox, and other bookmark managers.
          </p>
        </SettingsSectionCard>
      </div>

      {/* Group 3: External AI Workflow */}
      <div className="space-y-3">
        <SettingsGroupHeading>External AI Workflow</SettingsGroupHeading>
        <SettingsSectionCard
          icon={<Sparkles className="h-4 w-4" />}
          title="AI Library Audit (External LLM)"
          subtitle="Use Gemini, Claude, or ChatGPT to audit dead links, modernize outdated tools, or rebalance your collections without breaking Stash's schema."
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <fieldset
              aria-label="AI audit prompt mode"
              className="inline-flex rounded-control border border-border bg-panel p-0.5"
            >
              <button
                type="button"
                aria-pressed={promptMode === 'audit'}
                onClick={() => setPromptMode('audit')}
                className={cn(
                  'rounded-[calc(var(--stash-radius-control)-2px)] px-3 py-1 text-xs font-medium transition-colors cursor-pointer',
                  promptMode === 'audit'
                    ? 'bg-accent text-accent-fg'
                    : 'text-fg-muted hover:text-fg',
                )}
              >
                Full Audit &amp; Modernize
              </button>
              <button
                type="button"
                aria-pressed={promptMode === 'reorganize'}
                onClick={() => setPromptMode('reorganize')}
                className={cn(
                  'rounded-[calc(var(--stash-radius-control)-2px)] px-3 py-1 text-xs font-medium transition-colors cursor-pointer',
                  promptMode === 'reorganize'
                    ? 'bg-accent text-accent-fg'
                    : 'text-fg-muted hover:text-fg',
                )}
              >
                Reorganize Only
              </button>
            </fieldset>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleCopyAuditPrompt()}
              className="gap-1.5 border-accent/45 text-accent hover:bg-accent/10"
            >
              {copiedPrompt ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiedPrompt ? 'Copied!' : 'Copy AI Audit Prompt'}
            </Button>
          </div>

          <div className="space-y-1.5 border-t border-border/60 pt-3">
            <p className="font-mono text-[11px] text-fg-muted">
              1. Export JSON → 2. Copy Prompt → 3. Drop both into Gemini/Claude
              → 4. Import (Replace).
            </p>
            <p className="text-xs text-fg-muted/90">
              Tip: Remove any private or internal URLs from your exported JSON
              before uploading it to an external LLM.
            </p>
          </div>
        </SettingsSectionCard>
      </div>
    </div>
  );
}
