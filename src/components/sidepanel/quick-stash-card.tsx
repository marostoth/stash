import { BookmarkPlus, Check, Compass, Loader2, Star } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { LinkFavicon } from '@/components/LinkFavicon';
import { QuickStashChips } from '@/components/sidepanel/quick-stash-chips';
import { QuickStashCollectionPicker } from '@/components/sidepanel/quick-stash-collection-picker';
import { Button } from '@/components/ui/button';
import { parseSpaceInboxValue } from '@/components/ui/space-grouped-collection-options';
import { useQuickStashCategorizer } from '@/hooks/use-quick-stash-categorizer';
import { useQuickStashProduct } from '@/hooks/use-quick-stash-product';
import {
  playDrop,
  playError,
  playTagPop,
  playUncheck,
} from '@/lib/audio/foley';
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
import { extractDomain, parseTagsInput } from '@/lib/utils/url';

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
  const [noteOpen, setNoteOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justStamped, setJustStamped] = useState(false);
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
      setNote('');
      setTagsRaw('');
      setStarOnSave(false);
      setTagsEditedByUser(false);
      setNoteOpen(false);
      setTagsOpen(false);
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
    userPickedCollectionRef.current = true;
    setSelectedCollectionId(created.id);
    setCreatingName(null);
    playDrop(settings.soundEffects, settings.motionMode);
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
            ...(product.existingStashedLink.product?.orderQty &&
            !product.productMeta.orderQty
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
      setNoteOpen(false);
      setTagsOpen(false);

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

  // Slim single-line status strip (~32px) for loading or chrome:// / New Tab pages
  if (loadingTab) {
    return (
      <div className="flex h-6 items-center gap-2 font-mono text-[11px] text-fg-muted">
        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-accent" />
        <span className="truncate">Detecting active tab...</span>
      </div>
    );
  }

  if (!activeTab) {
    return (
      <div className="flex h-6 items-center gap-2 text-[11px] text-fg-muted">
        <Compass className="h-3.5 w-3.5 shrink-0 opacity-70" />
        <span className="truncate">
          Browse any website to quick-stash it here
        </span>
      </div>
    );
  }

  const domain = extractDomain(activeTab.url);
  const parsedTags = parseTagsInput(tagsRaw);
  const aiWorking = categorizing || enrichingTags;
  const tactile = isTactileMotion(settings.motionMode);
  const stampMotion =
    justStamped && tactile && settings.fxAmbientWaves !== false;
  const isAlreadyStashedAnywhere = Boolean(product.existingStashedLink);

  return (
    <motion.form
      onSubmit={(e) => void handleSubmit(e)}
      animate={
        stampMotion
          ? { y: [0, 5, -1.5, 0], scale: [1, 0.985, 1.004, 1] }
          : { y: 0, scale: 1 }
      }
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative space-y-2.5 overflow-hidden rounded-card border border-border bg-[var(--stash-panel)] p-3 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--stash-text)_6%,transparent)] transition-colors',
        stampMotion && 'border-accent/80 stash-stamp-flash',
      )}
    >
      {/* Top shimmer bar while On-Device AI is matching or tagging */}
      {aiWorking && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden bg-border/40"
        >
          <div className="stash-indeterminate-bar h-full" />
        </div>
      )}

      {/* Sleek Hero Row + Top-Right Star Toggle */}
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-control border border-hairline bg-canvas shadow-[inset_0_1px_2px_color-mix(in_srgb,var(--stash-canvas)_50%,transparent)]">
          <LinkFavicon
            url={activeTab.url}
            faviconUrl={activeTab.favIconUrl}
            size="md"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-xs font-semibold leading-snug text-fg">
            {product.titleOverride.trim() || activeTab.title}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="truncate font-mono text-[10px] text-fg-muted">
              {domain}
            </span>
            {isAlreadyStashedAnywhere && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-pill border border-accent/35 bg-accent/10 px-1.5 py-0.25 font-mono text-[9px] font-medium text-accent">
                <Check className="h-2.5 w-2.5" />
                Already stashed
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-pressed={starOnSave}
          aria-label={starOnSave ? 'Unstar link on save' : 'Star link on save'}
          title={
            starOnSave ? 'Will save as Starred' : 'Star this link when saving'
          }
          onClick={() => {
            const next = !starOnSave;
            setStarOnSave(next);
            if (next) playTagPop(settings.soundEffects, settings.motionMode);
            else playUncheck(settings.soundEffects);
          }}
          className={cn(
            'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-control border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
            starOnSave
              ? 'border-accent/55 bg-accent/15 text-accent'
              : 'border-hairline bg-[var(--stash-card)]/70 text-fg-muted hover:border-border hover:bg-card-hover hover:text-accent',
          )}
        >
          <Star
            className={cn(
              'h-3.5 w-3.5',
              starOnSave && 'fill-accent text-accent',
            )}
          />
        </button>
      </div>

      {/* Custom Radix Collection Picker */}
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

      {/* Progressive-Disclosure Summary Chip Bar & Drawers */}
      <QuickStashChips
        note={note}
        onChangeNote={(next) => {
          userEditedNoteRef.current = true;
          setNote(next);
        }}
        tagsRaw={tagsRaw}
        parsedTags={parsedTags}
        onChangeTagsRaw={(next) => {
          userEditedTagsRef.current = true;
          setTagsRaw(next);
          setTagsEditedByUser(true);
        }}
        onRemoveTag={(tagToRemove) => {
          userEditedTagsRef.current = true;
          setTagsEditedByUser(true);
          const nextTags = parsedTags.filter((t) => t !== tagToRemove);
          setTagsRaw(nextTags.join(', '));
        }}
        aiWorking={aiWorking}
        noteOpen={noteOpen}
        onToggleNoteOpen={() => setNoteOpen((prev) => !prev)}
        tagsOpen={tagsOpen}
        onToggleTagsOpen={() => setTagsOpen((prev) => !prev)}
        productOpen={product.productOpen}
        onToggleProductOpen={() => product.setProductOpen((prev) => !prev)}
        productMeta={product.productMeta}
        productDraft={product.productDraft}
        onChangeProductDraft={product.setProductDraft}
        isAlreadyStashed={isAlreadyStashedAnywhere}
        extractingProduct={product.extractingProduct}
        extractNotice={product.extractNotice}
        onExtractProduct={product.handleExtractProduct}
        defaultCurrency={defaultCurrency}
        motionMode={settings.motionMode}
      />

      {/* Compact Footer — Sole High-Contrast Primary CTA */}
      <div className="flex items-center justify-between gap-2 border-t border-hairline pt-2">
        <label className="flex min-w-0 cursor-pointer items-center gap-1.5 text-[11px] text-fg-muted select-none transition-colors hover:text-fg">
          <input
            type="checkbox"
            checked={settings.closeTabOnQuickStash}
            onChange={() =>
              void stashRepo.updateSettings({
                closeTabOnQuickStash: !settings.closeTabOnQuickStash,
              })
            }
            className="h-3.5 w-3.5 shrink-0 accent-[var(--stash-accent)] cursor-pointer"
          />
          <span className="truncate">Close tab</span>
        </label>

        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={saving || (alreadyInSelected && !product.productMeta)}
          title={
            alreadyInSelected
              ? product.productMeta
                ? 'Update saved product details'
                : 'Already saved in selected collection'
              : 'Stash active tab (Alt+Shift+D)'
          }
          className="h-8 shrink-0 gap-1.5 px-3"
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
