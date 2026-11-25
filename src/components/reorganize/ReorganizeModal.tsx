import { Sparkles } from 'lucide-react';
import { CategoryCheckpoint } from '@/components/reorganize/CategoryCheckpoint';
import { PreviewPlanStep } from '@/components/reorganize/PreviewPlanStep';
import { ScopeStep } from '@/components/reorganize/ScopeStep';
import { AiActivityPanel } from '@/components/ui/ai-activity-panel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useReorganizeWorkflow,
  type WizardStep,
} from '@/hooks/use-reorganize-workflow';
import type { Collection, LinkItem, StashSettings } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

interface ReorganizeModalProps {
  collections: readonly Collection[];
  links: readonly LinkItem[];
  settings: StashSettings;
}

const STEP_LABELS: ReadonlyArray<{ id: WizardStep; label: string }> = [
  { id: 'scope', label: '1. Scope' },
  { id: 'checkpoint', label: '2. Categories' },
  { id: 'sorting', label: '3. Sorting' },
  { id: 'preview', label: '4. Preview' },
];

export function ReorganizeModal({
  collections,
  links,
  settings,
}: ReorganizeModalProps) {
  const wf = useReorganizeWorkflow(collections, links, settings);

  return (
    <Dialog
      open={wf.open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) wf.closeReorganize();
      }}
    >
      <DialogContent className="flex max-h-[88vh] w-[min(95vw,760px)] flex-col overflow-hidden">
        <DialogHeader className="mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <DialogTitle>Smart Reorganize (On-Device AI)</DialogTitle>
          </div>
          <DialogDescription>
            2-pass Gemini Nano workflow with a human category checkpoint, full
            preview, and 1-click Undo. Close at any time to run in the
            background.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="mb-4 flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border pb-3">
          {STEP_LABELS.map((item) => (
            <span
              key={item.id}
              className={cn(
                'rounded-pill border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide',
                wf.step === item.id
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-canvas text-fg-muted',
              )}
            >
              {item.label}
            </span>
          ))}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {wf.step === 'scope' ? (
            <ScopeStep
              collections={collections}
              linkCountByCollection={wf.linkCountByCollection}
              totalLinksCount={links.length}
              mode={wf.mode}
              selectedCollectionIds={wf.selectedCollectionIds}
              removeEmptySources={wf.removeEmptySources}
              keepExistingTargets={wf.keepExistingTargets}
              scopedLinksCount={wf.scopedLinks.length}
              scopedDomainsCount={wf.scopedDomainsCount}
              nanoReady={wf.nanoReady}
              proposing={wf.proposing}
              errorMessage={wf.errorMessage}
              onChangeMode={wf.setMode}
              onToggleCollection={(id) =>
                wf.setSelectedCollectionIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              onSelectAllCollections={() =>
                wf.setSelectedCollectionIds(
                  new Set(collections.map((c) => c.id)),
                )
              }
              onClearCollections={() => wf.setSelectedCollectionIds(new Set())}
              onToggleRemoveEmpty={() => wf.setRemoveEmptySources((v) => !v)}
              onToggleKeepExistingTargets={() =>
                wf.setKeepExistingTargets((v) => !v)
              }
              onExportBackup={() => void wf.handleExportBackup()}
              onPropose={() => void wf.runPass1()}
              onMinimizePropose={wf.closeReorganize}
              onCancelPropose={wf.cancelActiveRun}
            />
          ) : wf.step === 'checkpoint' ? (
            <CategoryCheckpoint
              categories={wf.categories}
              scopedLinksCount={wf.scopedLinks.length}
              regenerating={wf.proposing}
              errorMessage={wf.errorMessage}
              onUpdateCategory={(id, patch) =>
                wf.setCategories((prev) =>
                  prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
                )
              }
              onDeleteCategory={(id) =>
                wf.setCategories((prev) => prev.filter((c) => c.id !== id))
              }
              onAddCategory={() =>
                wf.setCategories((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), name: '', description: '' },
                ])
              }
              onRegenerate={() => void wf.runPass1()}
              onMinimizeRegenerate={wf.closeReorganize}
              onCancelRegenerate={wf.cancelActiveRun}
              onBack={() => wf.setStep('scope')}
              onStartSort={() => void wf.runPass2()}
            />
          ) : wf.step === 'sorting' ? (
            <div className="py-4">
              <AiActivityPanel
                title={`Sorting ${wf.sortProgress?.completed ?? 0} / ${wf.sortProgress?.total ?? wf.scopedLinks.length} links...`}
                subtitle={
                  wf.sortProgress?.currentTitle || 'Preparing Gemini Nano...'
                }
                progress={{
                  current: wf.sortProgress?.completed ?? 0,
                  total: wf.sortProgress?.total ?? wf.scopedLinks.length,
                }}
                showElapsed
                skeletonRows={4}
                onMinimize={wf.closeReorganize}
                cancelLabel="Cancel Sorting"
                onCancel={wf.cancelActiveRun}
              />
            </div>
          ) : (
            <PreviewPlanStep
              scopedLinks={wf.scopedLinks}
              assignments={wf.assignments}
              targetCategoryOptions={wf.targetCategoryOptions}
              summary={wf.previewPlan.summary}
              applying={wf.applying}
              onOverrideAssignment={(linkId, categoryName) =>
                wf.setAssignments((prev) => ({
                  ...prev,
                  [linkId]: categoryName,
                }))
              }
              onBackToCategories={() => wf.setStep('checkpoint')}
              onApply={() => void wf.handleApply()}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
