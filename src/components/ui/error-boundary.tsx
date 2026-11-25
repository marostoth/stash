import { AlertTriangle, Download, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  exportPanicJsonBackup,
  type PanicExportOutcome,
} from '@/lib/import-export/panic-backup';

interface StashErrorBoundaryProps {
  children: ReactNode;
  scope?: string;
  compact?: boolean;
  onReset?: () => void;
}

interface StashErrorBoundaryState {
  error: Error | null;
  exporting: boolean;
  exportOutcome: PanicExportOutcome | null;
}

/**
 * Resilient React Error Boundary that keeps user libraries recoverable even if
 * a UI tree crashes, offering a direct raw-storage JSON panic backup download.
 */
export class StashErrorBoundary extends Component<
  StashErrorBoundaryProps,
  StashErrorBoundaryState
> {
  override state: StashErrorBoundaryState = {
    error: null,
    exporting: false,
    exportOutcome: null,
  };

  static getDerivedStateFromError(
    error: Error,
  ): Partial<StashErrorBoundaryState> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      `[Stash ErrorBoundary${this.props.scope ? `:${this.props.scope}` : ''}]`,
      error,
      info.componentStack,
    );
  }

  private handleReload = (): void => {
    if (this.props.onReset) {
      this.setState({ error: null, exportOutcome: null });
      this.props.onReset();
      return;
    }
    window.location.reload();
  };

  private handlePanicExport = async (): Promise<void> => {
    if (this.state.exporting) return;
    this.setState({ exporting: true, exportOutcome: null });
    const outcome = await exportPanicJsonBackup();
    this.setState({ exporting: false, exportOutcome: outcome });
  };

  override render(): ReactNode {
    const { error, exporting, exportOutcome } = this.state;
    if (!error) {
      return this.props.children;
    }

    const { compact = false, scope, onReset } = this.props;
    const errorMessage = error.message?.trim() || 'Unexpected rendering error.';

    return (
      <div
        role="alert"
        className={
          compact
            ? 'flex min-h-[260px] w-full items-center justify-center bg-canvas p-4 text-fg'
            : 'flex min-h-screen w-full items-center justify-center bg-canvas p-6 text-fg'
        }
      >
        <div className="w-full max-w-md rounded-card border border-border bg-panel p-5 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-danger/40 bg-danger/10 text-danger">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold text-fg">
                {scope
                  ? `${scope} hit an unexpected error`
                  : 'Stash hit an unexpected error'}
              </h1>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                Your saved spaces, collections, and links are still safely
                stored in local browser storage. Reload to recover, or export a
                JSON backup directly from storage right now.
              </p>
            </div>
          </div>

          <details className="mt-3.5 rounded-control border border-border bg-canvas/70 px-3 py-2 text-[11px] text-fg-muted">
            <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-fg-muted hover:text-fg select-none">
              Technical details
            </summary>
            <p className="mt-2 break-words font-mono text-[11px] text-danger">
              {error.name}: {errorMessage}
            </p>
          </details>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex h-8 items-center gap-1.5 rounded-control bg-accent px-3 text-xs font-medium text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {onReset ? 'Close & Recover' : 'Reload Stash'}
            </button>

            <button
              type="button"
              onClick={() => void this.handlePanicExport()}
              disabled={exporting}
              className="inline-flex h-8 items-center gap-1.5 rounded-control border border-border bg-card px-3 text-xs font-medium text-fg transition-colors hover:border-accent/50 hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-accent" />
              {exporting ? 'Exporting...' : 'Export JSON Backup'}
            </button>
          </div>

          {exportOutcome ? (
            <p
              className={
                exportOutcome.ok
                  ? 'mt-3 font-mono text-[11px] text-accent'
                  : 'mt-3 font-mono text-[11px] text-danger'
              }
            >
              {exportOutcome.ok
                ? `Saved ${exportOutcome.filename} (${exportOutcome.collectionCount} collections, ${exportOutcome.linkCount} links).`
                : `Export failed: ${exportOutcome.error}`}
            </p>
          ) : null}
        </div>
      </div>
    );
  }
}
