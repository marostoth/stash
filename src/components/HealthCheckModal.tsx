import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  HeartPulse,
  Layers,
  Loader2,
  ScanSearch,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  HealthGroupSection,
  type HealthTriageRow,
} from '@/components/health/health-group-section';
import { AiActivityPanel } from '@/components/ui/ai-activity-panel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useHealthScan } from '@/hooks/use-health-scan';
import { playDelete } from '@/lib/audio/foley';
import { detectClutter } from '@/lib/health/clutter';
import {
  buildExportBundle,
  formatBackupFilename,
} from '@/lib/import-export/bundle';
import { triggerFileDownload } from '@/lib/import-export/chrome-bookmarks';
import { stashRepo } from '@/lib/storage/repo';
import type { Collection, LinkItem } from '@/lib/types/stash';
import { normalizeUrlForComparison } from '@/lib/utils/url';
import { useUiStore } from '@/store/ui-store';

interface HealthCheckModalProps {
  collections: readonly Collection[];
  links: readonly LinkItem[];
}

export function HealthCheckModal({
  collections,
  links,
}: HealthCheckModalProps) {
  const open = useUiStore((s) => s.healthCheckOpen);
  const closeHealthCheck = useUiStore((s) => s.closeHealthCheck);
  const openReorganize = useUiStore((s) => s.openReorganize);
  const [removing, setRemoving] = useState(false);
  const [didCleanup, setDidCleanup] = useState(false);

  const {
    hasPermission,
    scanError,
    scanning,
    hasScanned,
    wasCanceled,
    progress,
    urlResults,
    selectedIds,
    setSelectedIds,
    startScan,
    cancelScan,
  } = useHealthScan(open, links);

  const collectionNameById = useMemo(
    () => new Map(collections.map((c) => [c.id, c.name])),
    [collections],
  );

  const clutterFindings = useMemo(() => detectClutter(links), [links]);

  const { deadRows, reviewRows, clutterRows, healthyRows } = useMemo(() => {
    const dead: HealthTriageRow[] = [];
    const review: HealthTriageRow[] = [];
    const healthy: HealthTriageRow[] = [];
    const deadIds = new Set<string>();

    for (const link of links) {
      const normalized = normalizeUrlForComparison(link.url);
      const scanItem = urlResults[normalized];
      if (!scanItem) continue;
      const collectionName =
        collectionNameById.get(link.collectionId) ?? 'Unknown';

      if (scanItem.status === 'dead') {
        deadIds.add(link.id);
        dead.push({ link, collectionName, reason: scanItem.reason });
      } else if (scanItem.status === 'needs_review') {
        review.push({ link, collectionName, reason: scanItem.reason });
      } else {
        healthy.push({
          link,
          collectionName,
          reason: scanItem.httpStatus ? `${scanItem.httpStatus} OK` : 'OK',
        });
      }
    }

    const linkById = new Map(links.map((l) => [l.id, l]));
    const clutter: HealthTriageRow[] = [];
    for (const finding of clutterFindings) {
      if (deadIds.has(finding.linkId)) continue;
      const link = linkById.get(finding.linkId);
      if (!link) continue;
      clutter.push({
        link,
        collectionName: collectionNameById.get(link.collectionId) ?? 'Unknown',
        reason: finding.reason,
      });
    }

    return {
      deadRows: dead,
      reviewRows: review,
      clutterRows: clutter,
      healthyRows: healthy,
    };
  }, [links, urlResults, clutterFindings, collectionNameById]);

  const handleExportBackup = async () => {
    const snapshot = await stashRepo.getSnapshot();
    const bundle = buildExportBundle(snapshot);
    const filename = formatBackupFilename();
    triggerFileDownload(filename, `${JSON.stringify(bundle, null, 2)}\n`);
    toast.success(`Exported backup: ${filename}`);
  };

  const handleToggleItem = (linkId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(linkId)) {
        next.delete(linkId);
      } else {
        next.add(linkId);
      }
      return next;
    });
  };

  const handleSelectAll = (ids: readonly string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  };

  const handleSelectNone = (ids: readonly string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  };

  const handleRemoveSelected = async () => {
    if (removing || selectedIds.size === 0) return;
    setRemoving(true);
    try {
      const removed = await stashRepo.deleteLinks(Array.from(selectedIds));
      if (removed.length === 0) return;

      const removedSet = new Set(removed.map((l) => l.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of removedSet) next.delete(id);
        return next;
      });
      playDelete();
      setDidCleanup(true);

      const count = removed.length;
      toast(`Removed ${count} link${count === 1 ? '' : 's'}`, {
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: () => {
            void stashRepo.restoreLinks(removed).then((restored) => {
              if (restored.length > 0) {
                toast.success(
                  `Restored ${restored.length} link${restored.length === 1 ? '' : 's'}`,
                );
              }
            });
          },
        },
      });
    } finally {
      setRemoving(false);
    }
  };

  const totalFindings =
    deadRows.length + reviewRows.length + clutterRows.length;
  const scannedTotal = deadRows.length + reviewRows.length + healthyRows.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeHealthCheck();
      }}
    >
      <DialogContent className="flex max-h-[88vh] w-[min(95vw,780px)] flex-col overflow-hidden p-0">
        <div className="shrink-0 border-b border-border px-5 pt-5 pb-4">
          <DialogHeader className="mb-3">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-accent" />
              <DialogTitle>Library Health Check</DialogTitle>
            </div>
            <DialogDescription>
              On-demand local scan for broken links, parked or expired domains,
              root redirects, cross-collection duplicates, and clutter.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {scanning ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={cancelScan}
                  className="gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel Scan
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={links.length === 0}
                  onClick={startScan}
                  className="gap-1.5"
                >
                  <ScanSearch className="h-3.5 w-3.5" />
                  {hasScanned ? 'Re-scan Library' : 'Scan Library'} (
                  {links.length})
                </Button>
              )}

              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleExportBackup()}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5 text-accent" />
                Export Backup First
              </Button>
            </div>

            {!hasPermission && !scanning ? (
              <span className="font-mono text-[10px] text-fg-muted">
                Requires opt-in site access to ping saved URLs
              </span>
            ) : null}
          </div>

          {scanning && progress ? (
            <div className="mt-3">
              <AiActivityPanel
                title={
                  progress.refiningAi
                    ? 'Checking borderline pages with Gemini Nano...'
                    : `Scanning library (${progress.scanned} / ${progress.total})...`
                }
                subtitle={
                  progress.refiningAi
                    ? 'Verifying suspicious HTTP 200 pages locally on-device'
                    : 'Checking HTTP status, redirects, and parked domains in batches of 5'
                }
                progress={
                  progress.refiningAi
                    ? null
                    : { current: progress.scanned, total: progress.total }
                }
                showElapsed
                onCancel={cancelScan}
              />
            </div>
          ) : null}

          {scanError ? (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-control border border-danger/45 bg-danger/10 px-3 py-2 text-xs text-danger"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="font-mono text-[11px] leading-relaxed">
                {scanError}
              </span>
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {!hasScanned && !scanning ? (
            <div className="rounded-card border border-border bg-canvas px-4 py-3 text-xs text-fg-muted">
              Click <strong className="text-fg">Scan Library</strong> to check
              all {links.length} saved links in batches of 5. Nothing is deleted
              automatically—you review every result and get an 8-second Undo
              after cleanup.
              {!hasPermission
                ? ' Chrome will ask for site access permission so Stash can check whether each URL is still live.'
                : ''}
            </div>
          ) : null}

          {hasScanned && wasCanceled ? (
            <div className="rounded-control border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Scan canceled early — showing partial results collected so far.
            </div>
          ) : null}

          {hasScanned && !scanning ? (
            <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-canvas px-3.5 py-2 font-mono text-[11px] text-fg-muted">
              <span className="text-fg">
                Scanned <strong>{scannedTotal}</strong>
              </span>
              <span>·</span>
              <span className="text-accent">{healthyRows.length} healthy</span>
              <span>·</span>
              <span className={deadRows.length > 0 ? 'text-danger' : undefined}>
                {deadRows.length} dead
              </span>
              <span>·</span>
              <span
                className={reviewRows.length > 0 ? 'text-amber-400' : undefined}
              >
                {reviewRows.length} review
              </span>
              <span>·</span>
              <span>{clutterRows.length} clutter</span>
            </div>
          ) : null}

          {hasScanned && !scanning && totalFindings === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-card border border-accent/35 bg-canvas px-6 py-10 text-center">
              <CheckCircle2 className="mb-2.5 h-8 w-8 text-accent" />
              <p className="text-sm font-semibold text-fg">
                Your library looks clean!
              </p>
              <p className="mt-1 text-xs text-fg-muted">
                No confirmed dead links, redirects, duplicates, or clutter were
                found across {links.length} saved links.
              </p>
            </div>
          ) : (
            <>
              <HealthGroupSection
                title="Confirmed Dead"
                description="404/410 responses, connection failures, parked/expired domains, and soft-404 pages. Pre-checked for quick cleanup."
                tone="danger"
                icon={<ShieldAlert className="h-3.5 w-3.5 text-danger" />}
                rows={deadRows}
                selectedIds={selectedIds}
                defaultExpanded
                onToggleItem={handleToggleItem}
                onSelectAll={handleSelectAll}
                onSelectNone={handleSelectNone}
              />

              <HealthGroupSection
                title="Needs a Quick Look"
                description="Bot-walls (403/429), auth gates (401), server errors, timeouts, or deep paths redirected to a homepage. Unchecked by default."
                tone="warning"
                icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                rows={reviewRows}
                selectedIds={selectedIds}
                defaultExpanded
                onToggleItem={handleToggleItem}
                onSelectAll={handleSelectAll}
                onSelectNone={handleSelectNone}
              />

              <HealthGroupSection
                title="Clutter & Duplicates"
                description="Cross-collection duplicate URLs, localhost/dev URLs, and stale search-engine query pages. Unchecked by default."
                tone="neutral"
                icon={<Layers className="h-3.5 w-3.5 text-fg-muted" />}
                rows={clutterRows}
                selectedIds={selectedIds}
                defaultExpanded={hasScanned || clutterRows.length > 0}
                onToggleItem={handleToggleItem}
                onSelectAll={handleSelectAll}
                onSelectNone={handleSelectNone}
              />

              {hasScanned && healthyRows.length > 0 ? (
                <HealthGroupSection
                  title="Healthy Links"
                  description="Responded cleanly (200 OK) with no soft-404, parked-domain, or root-redirect signals. Collapsed and unchecked by default."
                  tone="neutral"
                  icon={<CheckCircle2 className="h-3.5 w-3.5 text-accent" />}
                  rows={healthyRows}
                  selectedIds={selectedIds}
                  defaultExpanded={false}
                  onToggleItem={handleToggleItem}
                  onSelectAll={handleSelectAll}
                  onSelectNone={handleSelectNone}
                />
              ) : null}
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-panel px-5 py-3">
          <div className="flex items-center gap-2 font-mono text-[11px] text-fg-muted">
            <span>
              {selectedIds.size} selected
              {hasScanned ? ` · ${totalFindings} flagged` : ''}
            </span>
            {selectedIds.size > 0 ? (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-accent hover:underline cursor-pointer"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {(hasScanned || didCleanup) && !scanning ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={openReorganize}
                className="gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                Next: Smart Reorganize
                <ArrowRight className="h-3 w-3" />
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={closeHealthCheck}>
              Close
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={selectedIds.size === 0 || removing || scanning}
              onClick={() => void handleRemoveSelected()}
              className="gap-1.5"
            >
              {removing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {removing
                ? 'Removing...'
                : `Remove Selected (${selectedIds.size})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
