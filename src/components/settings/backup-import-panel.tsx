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
import { SettingsSectionCard } from '@/components/settings/settings-section-card';
import { Button } from '@/components/ui/button';
import {
  type AiAuditPromptMode,
  buildAiAuditPrompt,
} from '@/lib/import-export/ai-audit-prompt';
import { getBackupStaleness } from '@/lib/import-export/backup-status';
import { parseNetscapeBookmarksHtml } from '@/lib/import-export/bookmarks-html';
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
    const exportedAt = new Date().toISOString();
    const snapshot = await stashRepo.getSnapshot();
    const bundle = buildExportBundle(snapshot, exportedAt);
    const filename = formatBackupFilename();
    triggerFileDownload(filename, `${JSON.stringify(bundle, null, 2)}\n`);
    await stashRepo.updateSettings({ lastBackupAt: exportedAt });
    toast.success(`Exported ${filename}`);
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
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* JSON Backup & Restore */}
      <SettingsSectionCard
        icon={<FolderSync className="h-4 w-4" />}
        title="JSON Backup & Restore"
        subtitle="Export your entire Stash library—collections, links, notes, tags, rules, settings, and custom themes—as a single portable JSON file."
        badge={{ label: 'Schema v1', tone: 'neutral' }}
        headerAction={
          <span
            className={cn(
              'rounded-pill border px-2 py-0.5 font-mono text-[10px]',
              staleness.isStale
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                : 'border-border bg-panel text-fg-muted',
            )}
          >
            {staleness.label}
          </span>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
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

        <p className="font-mono text-[10px] text-fg-muted">
          JSON backups stay compact by excluding locally uploaded wallpaper
          images and custom audio clips (re-upload them on a new device if
          needed).
        </p>

        {pendingBundle && (
          <div className="space-y-2.5 rounded-control border border-accent/45 bg-panel p-3">
            <div className="text-xs font-medium text-fg">
              Ready to import backup:
            </div>
            <div className="font-mono text-[11px] text-fg-muted">
              {pendingBundle.collections.length} collections ·{' '}
              {pendingBundle.links.length} links · {pendingBundle.rules.length}{' '}
              rules · {pendingBundle.customThemes.length} custom themes
            </div>
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

      {/* AI Library Audit (External LLM) */}
      <SettingsSectionCard
        icon={<Sparkles className="h-4 w-4" />}
        title="AI Library Audit (External LLM)"
        subtitle="Use Gemini, Claude, or ChatGPT to audit dead links, modernize outdated tools, or rebalance your collections without breaking Stash's schema."
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <fieldset
            aria-label="AI audit prompt mode"
            className="inline-flex rounded-control border border-border bg-panel p-0.5"
          >
            <button
              type="button"
              aria-pressed={promptMode === 'audit'}
              onClick={() => setPromptMode('audit')}
              className={cn(
                'rounded-[calc(var(--stash-radius-control)-2px)] px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
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
                'rounded-[calc(var(--stash-radius-control)-2px)] px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
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

        <div className="space-y-1">
          <p className="font-mono text-[10px] text-fg-muted">
            Export JSON → Copy Prompt → Drop both into Gemini/Claude → Import
            (Replace).
          </p>
          <p className="text-[11px] text-fg-muted/85">
            Tip: You can remove any private or internal URLs from your exported
            JSON before uploading it to an external LLM.
          </p>
        </div>
      </SettingsSectionCard>

      {/* Bookmark Importers */}
      <SettingsSectionCard
        icon={<Bookmark className="h-4 w-4" />}
        title="Import Bookmarks"
        subtitle="Bring existing bookmarks into Stash collections. Duplicate URLs within a collection are automatically skipped."
      >
        <div className="flex flex-wrap items-center gap-2">
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
        <p className="font-mono text-[10px] text-fg-muted">
          Direct Chrome import requests optional bookmarks permission on click.
          HTML import supports standard Netscape HTML bookmark exports (Chrome,
          Edge, Firefox, and other bookmark managers).
        </p>
      </SettingsSectionCard>
    </div>
  );
}
