import { BookmarkPlus, Check, Loader2, Star } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { QuickStashCollectionPicker } from '@/components/sidepanel/quick-stash-collection-picker';
import { QuickStashProductPanel } from '@/components/sidepanel/quick-stash-product-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseSpaceInboxValue } from '@/components/ui/space-grouped-collection-options';
import { useQuickStashCategorizer } from '@/hooks/use-quick-stash-categorizer';
import { useQuickStashProduct } from '@/hooks/use-quick-stash-product';
import { playDrop, playError } from '@/lib/audio/foley';
import { isTactileMotion } from '@/lib/motion/presets';
import { stashRepo } from '@/lib/storage/repo';
import type { OpenTabInfo } from '@/lib/tabs/session-filter';
import { closeTabs } from '@/lib/tabs/tab-actions';
import { triggerAutoTagSingleLink } from '@/lib/tagging/trigger-auto-tag';
import type {
  CategorizationRule,
  Collection,
  LinkItem,
  Space,
  StashSettings,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { extractDomain, getMonogram, parseTagsInput } from '@/lib/utils/url';

interface QuickStashCardProps {
  activeTab: OpenTabInfo | null;
  loadingTab: boolean;
  loadingData: boolean;
  activeSpaceId?: string;
  spaces: readonly Space[];
  collections: readonly Collection[];
  links: readonly LinkItem[];
  rules: readonly CategorizationRule[];
  settings: StashSettings;
}

export function QuickStashCard({
  activeTab,
  loadingTab,
  loadingData,
  activeSpaceId,
  spaces,
  collections,
  links,
  rules,
  settings,
}: QuickStashCardProps) {
  const defaultCurrency = settings.defaultCurrency ?? 'GBP';
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [note, setNote] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [starOnSave, setStarOnSave] = useState(false);
  const [tagsEditedByUser, setTagsEditedByUser] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justStamped, setJustStamped] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [creatingName, setCreatingName] = useState<string | null>(null);
  const stampTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (stampTimerRef.current) clearTimeout(stampTimerRef.current);
    };
  }, []);

  const triggerStampFeedback = () => {
    if (stampTimerRef.current) clearTimeout(stampTimerRef.current);
    setJustStamped(true);
    stampTimerRef.current = setTimeout(() => {
      setJustStamped(false);
      stampTimerRef.current = null;
    }, 1050);
  };

  const userPickedCollectionRef = useRef(false);
  const userEditedNoteRef = useRef(false);
  const userEditedTagsRef = useRef(false);

  const product = useQuickStashProduct({
    activeTab,
    links,
    enableOnDeviceAi: settings.enableOnDeviceAi,
    defaultCurrency,
  });

  const orderedCollections = useMemo(() => {
    const regular = collections.filter((c) => !c.isSession);
    const sessions = collections.filter((c) => c.isSession);
    return [...regular, ...sessions];
  }, [collections]);

  const { suggestion, categorizing, enrichingTags } = useQuickStashCategorizer({
    tabUrl: activeTab?.url ?? '',
    tabTitle: activeTab?.title ?? '',
    loadingData,
    enableOnDeviceAi: settings.enableOnDeviceAi,
    rules,
    collections,
    orderedCollections,
    links,
    spaces,
    onResetTab: () => {
      setFaviconFailed(false);
      setNote('');
      setTagsRaw('');
      setStarOnSave(false);
      setTagsEditedByUser(false);
      userPickedCollectionRef.current = false;
      userEditedNoteRef.current = false;
      userEditedTagsRef.current = false;
    },
    onSelectCollection: setSelectedCollectionId,
    onFillNote: setNote,
    onFillTags: setTagsRaw,
    hasUserPickedCollection: () => userPickedCollectionRef.current,
    hasUserEditedNote: () => userEditedNoteRef.current,
    hasUserEditedTags: () => userEditedTagsRef.current,
  });

  // Keep a valid default selection if collections arrive after mount
  useEffect(() => {
    if (
      !selectedCollectionId &&
      orderedCollections[0] &&
      !suggestion?.collectionId
    ) {
      setSelectedCollectionId(orderedCollections[0].id);
    }
  }, [orderedCollections, selectedCollectionId, suggestion]);

  const alreadyInSelected = useMemo(() => {
    if (!activeTab || !selectedCollectionId) return false;
    if (parseSpaceInboxValue(selectedCollectionId)) return false;
    return Boolean(
      stashRepo.findDuplicateInList(
        links,
        selectedCollectionId,
        product.canonicalUrl,
      ) ??
        stashRepo.findDuplicateInList(
          links,
          selectedCollectionId,
          activeTab.url,
        ),
    );
  }, [activeTab, links, product.canonicalUrl, selectedCollectionId]);

  const handleCreateQuickCollection = async (nameToCreate: string) => {
    const trimmed = nameToCreate.trim();
    if (!trimmed) return;
    const created = await stashRepo.createCollection({
      name: trimmed,
      ...(activeSpaceId ? { spaceId: activeSpaceId } : {}),
    });
    setSelectedCollectionId(created.id);
    setCreatingName(null);
    toast.success(`Created "${created.name}"`);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeTab || saving) return;

    let targetId = selectedCollectionId;
    const targetSpaceForInbox = parseSpaceInboxValue(targetId);
    if (targetSpaceForInbox) {
      const inbox = await stashRepo.getOrCreateSpaceInbox(targetSpaceForInbox);
      targetId = inbox.id;
      setSelectedCollectionId(targetId);
    } else if (!targetId) {
      const created = await stashRepo.createCollection({ name: 'Saved Links' });
      targetId = created.id;
      setSelectedCollectionId(targetId);
    }

    setSaving(true);
    try {
      const submittedTags = parseTagsInput(tagsRaw);

      if (
        alreadyInSelected &&
        product.existingStashedLink &&
        product.productMeta
      ) {
        await stashRepo.updateLink(product.existingStashedLink.id, {
          ...(product.titleOverride.trim()
            ? { title: product.titleOverride.trim() }
            : {}),
          product: {
            ...product.productMeta,
            ...(product.existingStashedLink.product?.orderQty
              ? { orderQty: product.existingStashedLink.product.orderQty }
              : {}),
          },
        });
        playDrop(settings.soundEffects, settings.motionMode);
        triggerStampFeedback();
        toast.success('Updated product info');
        return;
      }

      const shouldLockTags = tagsEditedByUser || submittedTags.length > 0;
      const result = await stashRepo.addLink({
        collectionId: targetId,
        url: product.canonicalUrl || activeTab.url,
        title: product.titleOverride.trim() || activeTab.title,
        note,
        tags: submittedTags,
        ...(starOnSave ? { starred: true } : {}),
        ...(product.productMeta ? { product: product.productMeta } : {}),
        ...(shouldLockTags ? { tagsLocked: true } : {}),
        faviconUrl: activeTab.favIconUrl,
      });

      if (!result.ok) {
        playError(settings.soundEffects);
        toast.info('Already in this collection');
        return;
      }

      playDrop(settings.soundEffects, settings.motionMode);
      triggerStampFeedback();
      toast.success('Tab stashed');
      setNote('');
      setTagsRaw('');
      setStarOnSave(false);
      setTagsEditedByUser(false);

      if (!shouldLockTags && submittedTags.length === 0) {
        void triggerAutoTagSingleLink(result.link.id);
      }

      if (settings.closeTabOnQuickStash) {
        await closeTabs([activeTab.id]);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loadingTab) {
    return (
      <div className="rounded-card border border-border bg-panel p-3.5 text-center font-mono text-[11px] text-fg-muted">
        Detecting active tab...
      </div>
    );
  }

  if (!activeTab) {
    return (
      <div className="rounded-card border border-dashed border-border bg-panel p-3.5 text-center text-xs text-fg-muted">
        Navigate to any website to quick-stash it from the Side Panel.
      </div>
    );
  }

  const domain = extractDomain(activeTab.url);
  const monogram = getMonogram(activeTab.title, activeTab.url);
  const showFavicon = Boolean(activeTab.favIconUrl) && !faviconFailed;
  const parsedTags = parseTagsInput(tagsRaw);

  const aiWorking = categorizing || enrichingTags;
  const tactile = isTactileMotion(settings.motionMode);
  const stampMotion =
    justStamped && tactile && settings.fxAmbientWaves !== false;

  return (
    <motion.form
      onSubmit={(e) => void handleSubmit(e)}
      animate={
        stampMotion
          ? { y: [0, 6, -1.5, 0], scale: [1, 0.982, 1.005, 1] }
          : { y: 0, scale: 1 }
      }
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative space-y-3 overflow-hidden rounded-card border border-border bg-panel p-3.5 shadow-sm transition-colors',
        stampMotion && 'border-accent/80 stash-stamp-flash',
      )}
    >
      {/* Top animated progress bar while On-Device AI is matching or tagging */}
      {aiWorking && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden bg-border/40"
        >
          <div className="stash-indeterminate-bar h-full" />
        </div>
      )}

      {/* Active Tab Identity */}
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-control border border-border bg-canvas font-mono text-xs font-semibold text-accent">
          {showFavicon ? (
            <img
              src={activeTab.favIconUrl}
              alt=""
              width={16}
              height={16}
              onError={() => setFaviconFailed(true)}
              className="h-4 w-4 object-contain"
            />
          ) : (
            <span aria-hidden="true">{monogram}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-xs font-semibold leading-snug text-fg">
            {activeTab.title}
          </div>
          <div className="mt-0.5 truncate font-mono text-[10px] text-fg-muted">
            {domain}
          </div>
        </div>
      </div>

      {/* Suggested Collection Picker */}
      <QuickStashCollectionPicker
        spaces={spaces}
        orderedCollections={orderedCollections}
        selectedCollectionId={selectedCollectionId}
        onSelectCollection={(colId) => {
          userPickedCollectionRef.current = true;
          setSelectedCollectionId(colId);
        }}
        categorizing={categorizing}
        enrichingTags={enrichingTags}
        suggestion={suggestion}
        creatingName={creatingName}
        onChangeCreatingName={setCreatingName}
        onCreateCollection={(name) => void handleCreateQuickCollection(name)}
      />

      {/* 1-Line Note & Tags */}
      <div className="space-y-2">
        <div className="relative">
          <Input
            value={note}
            onChange={(e) => {
              userEditedNoteRef.current = true;
              setNote(e.target.value);
            }}
            placeholder={
              aiWorking && !note
                ? 'AI writing summary note...'
                : 'Why I saved this... (optional)'
            }
            aria-label="Why I saved this"
            className="h-8 pr-7 text-xs"
          />
          {aiWorking && !note && (
            <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-accent/70" />
          )}
        </div>
        <div className="relative">
          <Input
            value={tagsRaw}
            onChange={(e) => {
              userEditedTagsRef.current = true;
              setTagsRaw(e.target.value);
              setTagsEditedByUser(true);
            }}
            placeholder={
              aiWorking && !tagsRaw
                ? 'AI generating tags...'
                : 'Tags: docs, hardware...'
            }
            aria-label="Tags"
            className="h-8 pr-7 font-mono text-[11px]"
          />
          {aiWorking && !tagsRaw && (
            <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-accent/70" />
          )}
        </div>
        {parsedTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {parsedTags.map((tag) => (
              <span
                key={tag}
                className="rounded-pill border border-border bg-canvas px-2 py-0.5 font-mono text-[10px] text-fg-muted"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 2-Stage Product Capture + Manual Fallback */}
      <QuickStashProductPanel
        isAlreadyStashed={Boolean(product.existingStashedLink)}
        extracting={product.extractingProduct}
        notice={product.extractNotice}
        expanded={product.productOpen}
        draft={product.productDraft}
        onExtract={product.handleExtractProduct}
        onToggleExpanded={() => product.setProductOpen((prev) => !prev)}
        onChangeDraft={product.setProductDraft}
      />

      {/* Confirm Footer */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-fg-muted select-none hover:text-fg">
            <input
              type="checkbox"
              checked={settings.closeTabOnQuickStash}
              onChange={() =>
                void stashRepo.updateSettings({
                  closeTabOnQuickStash: !settings.closeTabOnQuickStash,
                })
              }
              className="h-3.5 w-3.5 accent-[var(--stash-accent)] cursor-pointer"
            />
            <span>Close tab</span>
          </label>
          <button
            type="button"
            aria-pressed={starOnSave}
            onClick={() => setStarOnSave((prev) => !prev)}
            title={
              starOnSave ? 'Will save as Starred' : 'Star this link when saving'
            }
            className={cn(
              'inline-flex h-6 items-center gap-1 rounded-pill border px-2 text-[10px] font-medium transition-colors cursor-pointer',
              starOnSave
                ? 'border-accent/60 bg-accent/15 text-accent'
                : 'border-border bg-canvas/70 text-fg-muted hover:border-accent/40 hover:text-fg',
            )}
          >
            <Star
              className={cn('h-3 w-3', starOnSave && 'fill-accent text-accent')}
            />
            <span>Star</span>
          </button>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={saving || (alreadyInSelected && !product.productMeta)}
          className="gap-1.5"
        >
          <AnimatePresence mode="wait" initial={false}>
            {justStamped ? (
              <motion.span
                key="stamped"
                initial={tactile ? { scale: 0.55, opacity: 0 } : false}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 560,
                  damping: 22,
                }}
                className="inline-flex items-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Stashed!</span>
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                initial={false}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-1.5"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                <span>
                  {alreadyInSelected
                    ? product.productMeta
                      ? 'Save Product'
                      : 'Saved'
                    : 'Stash Tab'}
                </span>
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </motion.form>
  );
}
