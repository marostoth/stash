import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { AiActivityPanel } from '@/components/ui/ai-activity-panel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select } from '@/components/ui/input';
import { TriageRowCard } from '@/components/workbench/triage-row-card';
import {
  TRIAGE_CREATE_CUSTOM_SENTINEL,
  TRIAGE_NEW_PREFIX,
  useTriageWorkflow,
} from '@/hooks/use-triage-workflow';
import type {
  CategorizationRule,
  Collection,
  LinkItem,
  StashSettings,
} from '@/lib/types/stash';

interface TriageModalProps {
  collections: readonly Collection[];
  links: readonly LinkItem[];
  rules: readonly CategorizationRule[];
  settings: StashSettings;
}

export function TriageModal({
  collections,
  links,
  rules,
  settings,
}: TriageModalProps) {
  const wf = useTriageWorkflow(collections, links, rules, settings);

  return (
    <Dialog
      open={wf.triageOpen && wf.triageCollectionId !== null}
      onOpenChange={(open) => {
        if (!open) wf.closeTriage();
      }}
    >
      <DialogContent className="flex max-h-[85vh] w-[min(94vw,740px)] flex-col overflow-hidden">
        <DialogHeader className="mb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            Auto-Categorize: {wf.sessionCollection?.name ?? 'Session'}
          </DialogTitle>
          <DialogDescription>
            Review suggested collections (including new category suggestions),
            override any or all links, then apply in one click. Close to keep
            analyzing in the background.
          </DialogDescription>
        </DialogHeader>

        {/* Bulk Override Bar */}
        {!wf.analyzing && wf.rows.length > 0 && (
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-control border border-border bg-canvas px-3 py-2">
            <span className="font-mono text-[11px] text-fg-muted">
              Override all ({wf.rows.length}):
            </span>
            <div className="flex flex-1 items-center justify-end gap-2">
              <Select
                aria-label="Override destination for all links"
                value={wf.bulkDestination}
                onChange={(e) => wf.setBulkDestination(e.target.value)}
                className="h-8 max-w-[230px] text-xs"
              >
                <option value="">Keep in session</option>
                {wf.destinationCollections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
                {wf.availableNewCategories.map((name) => (
                  <option key={name} value={`${TRIAGE_NEW_PREFIX}${name}`}>
                    + Create &ldquo;{name}&rdquo;
                  </option>
                ))}
              </Select>
              <Button
                variant="secondary"
                size="sm"
                onClick={wf.handleApplyBulkOverride}
                className="h-8 shrink-0 text-xs"
              >
                Apply to All
              </Button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {wf.analyzing ? (
            <div className="py-3">
              <AiActivityPanel
                title={`Categorizing ${wf.analyzeProgress?.current ?? 0} / ${wf.analyzeProgress?.total ?? wf.sessionLinks.length} links...`}
                subtitle={
                  wf.analyzeProgress?.title ||
                  'Checking local rules and on-device Gemini Nano...'
                }
                progress={
                  wf.analyzeProgress
                    ? {
                        current: wf.analyzeProgress.current,
                        total: wf.analyzeProgress.total,
                      }
                    : null
                }
                showElapsed
                skeletonRows={Math.min(4, Math.max(2, wf.sessionLinks.length))}
                onMinimize={wf.closeTriage}
                onCancel={wf.cancelAndClear}
              />
            </div>
          ) : wf.rows.length === 0 ? (
            <div className="py-10 text-center text-xs text-fg-muted">
              This session has no links to categorize.
            </div>
          ) : (
            wf.rows.map(({ link, suggestion, destination }) => (
              <TriageRowCard
                key={link.id}
                link={link}
                suggestion={suggestion}
                destination={destination}
                newPrefix={TRIAGE_NEW_PREFIX}
                createCustomSentinel={TRIAGE_CREATE_CUSTOM_SENTINEL}
                isCreatingCustom={wf.editingCustomRowId === link.id}
                customDraft={wf.customDraft}
                availableNewCategories={wf.availableNewCategories}
                destinationCollections={wf.destinationCollections}
                onChangeCustomDraft={wf.setCustomDraft}
                onCommitCustomCategory={() => wf.commitCustomCategory(link.id)}
                onCancelCustomCategory={() => wf.setEditingCustomRowId(null)}
                onChangeDestination={(value) =>
                  wf.handleChangeDestination(link.id, value)
                }
              />
            ))
          )}
        </div>

        <DialogFooter className="mt-4 shrink-0 flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-fg-muted select-none">
            <input
              type="checkbox"
              checked={wf.deleteEmptySession}
              onChange={(e) => wf.setDeleteEmptySession(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--stash-accent)] cursor-pointer"
            />
            <span>Remove session collection if emptied</span>
          </label>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={wf.cancelAndClear}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={wf.analyzing || wf.applying || wf.assignedCount === 0}
              onClick={() => void wf.handleAcceptAll()}
              className="gap-1.5"
            >
              {wf.applying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {wf.applying ? 'Applying...' : `Accept All (${wf.assignedCount})`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
