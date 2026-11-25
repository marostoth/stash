import { BookmarkPlus, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { QuickStashCollectionPicker } from '@/components/sidepanel/quick-stash-collection-picker';
import { QuickStashProductPanel } from '@/components/sidepanel/quick-stash-product-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuickStashProduct } from '@/hooks/use-quick-stash-product';
import { playDrop, playError } from '@/lib/audio/foley';
import { categorizeLink } from '@/lib/categorizer/categorizer';
import { matchFromLibraryMemory } from '@/lib/categorizer/library-matcher';
import {
  acquireWarmNanoSession,
  type NanoCategorizerSession,
  releaseWarmNanoSession,
} from '@/lib/categorizer/nano-engine';
import { evaluateTier1Rules } from '@/lib/categorizer/rules-engine';
import type { CategorizationSuggestion } from '@/lib/categorizer/types';
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
import { extractDomain, getMonogram, parseTagsInput } from '@/lib/utils/url';

interface QuickStashCardProps {
  activeTab: OpenTabInfo | null;
  loadingTab: boolean;
  loadingData: boolean;
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
  const [tagsEditedByUser, setTagsEditedByUser] = useState(false);
  const [suggestion, setSuggestion] = useState<CategorizationSuggestion | null>(
    null,
  );
  const [categorizing, setCategorizing] = useState(false);
  const [enrichingTags, setEnrichingTags] = useState(false);
  const [saving, setSaving] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [creatingName, setCreatingName] = useState<string | null>(null);

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

  // Keep latest library state in refs so background storage updates do not abort/restart Nano
  const latestDataRef = useRef({
    rules,
    collections,
    links,
    spaces,
    orderedCollections,
  });
  latestDataRef.current = {
    rules,
    collections,
    links,
    spaces,
    orderedCollections,
  };

  const tabUrl = activeTab?.url ?? '';
  const tabTitle = activeTab?.title ?? '';

  // Run instant Tier 1 / Tier 1.5 matching on frame 0, then optional Nano enrichment
  useEffect(() => {
    setFaviconFailed(false);
    setNote('');
    setTagsRaw('');
    setTagsEditedByUser(false);
    setSuggestion(null);
    setCategorizing(false);
    setEnrichingTags(false);
    userPickedCollectionRef.current = false;
    userEditedNoteRef.current = false;
    userEditedTagsRef.current = false;

    if (!tabUrl || loadingData) return;

    const {
      rules: curRules,
      collections: curCols,
      links: curLinks,
      spaces: curSpaces,
      orderedCollections: curOrdered,
    } = latestDataRef.current;

    const target = { url: tabUrl, title: tabTitle };
    const validIds = new Set(curCols.map((c) => c.id));

    // Tier 1 rules: instant 0ms short-circuit (no Nano needed)
    const instantRule = evaluateTier1Rules(target, curRules, validIds);
    if (instantRule) {
      setSuggestion(instantRule);
      if (instantRule.collectionId) {
        setSelectedCollectionId(instantRule.collectionId);
      }
      if (instantRule.tags.length > 0) {
        setTagsRaw(instantRule.tags.join(', '));
      }
      return;
    }

    // Tier 1.5 Library Memory: lock collection immediately in 0ms
    const instantLibrary = matchFromLibraryMemory(target, curCols, curLinks);
    if (instantLibrary) {
      setSelectedCollectionId(instantLibrary.collectionId);
      setSuggestion({
        source: 'library',
        collectionId: instantLibrary.collectionId,
        matchedLibraryReason: instantLibrary.reason,
        tags: [],
      });
      if (!settings.enableOnDeviceAi) return;
      setEnrichingTags(true);
    } else {
      if (!settings.enableOnDeviceAi) {
        if (curOrdered[0]) setSelectedCollectionId(curOrdered[0].id);
        return;
      }
      setCategorizing(true);
    }

    const controller = new AbortController();

    const runSuggestion = async () => {
      let warmSession: NanoCategorizerSession | null = null;
      try {
        warmSession = await acquireWarmNanoSession(controller.signal);
        if (controller.signal.aborted) return;
        const result = await categorizeLink(target, {
          rules: curRules,
          collections: curCols,
          links: curLinks,
          spaces: curSpaces,
          enableOnDeviceAi: settings.enableOnDeviceAi,
          enrichLibraryMatchWithNano: true,
          nanoSession: warmSession,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setSuggestion(result);
        if (!userPickedCollectionRef.current) {
          if (result.collectionId) {
            setSelectedCollectionId(result.collectionId);
          } else if (curOrdered[0]) {
            setSelectedCollectionId(curOrdered[0].id);
          }
        }
        if (result.tags.length > 0 && !userEditedTagsRef.current) {
          setTagsRaw(result.tags.join(', '));
        }
        if (result.summaryNote && !userEditedNoteRef.current) {
          setNote(result.summaryNote);
        }
      } finally {
        releaseWarmNanoSession(warmSession);
        if (!controller.signal.aborted) {
          setCategorizing(false);
          setEnrichingTags(false);
        }
      }
    };

    void runSuggestion();

    return () => {
      controller.abort();
    };
  }, [tabUrl, tabTitle, loadingData, settings.enableOnDeviceAi]);

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
    const created = await stashRepo.createCollection({ name: trimmed });
    setSelectedCollectionId(created.id);
    setCreatingName(null);
    toast.success(`Created "${created.name}"`);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeTab || saving) return;

    let targetId = selectedCollectionId;
    if (!targetId) {
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
        playDrop(settings.soundEffects);
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
        ...(product.productMeta ? { product: product.productMeta } : {}),
        ...(shouldLockTags ? { tagsLocked: true } : {}),
        faviconUrl: activeTab.favIconUrl,
      });

      if (!result.ok) {
        playError(settings.soundEffects);
        toast.info('Already in this collection');
        return;
      }

      playDrop(settings.soundEffects);
      toast.success('Tab stashed');
      setNote('');
      setTagsRaw('');
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

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="relative space-y-3 overflow-hidden rounded-card border border-border bg-panel p-3.5 shadow-sm"
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
          <span>Close tab after saving</span>
        </label>

        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={saving || (alreadyInSelected && !product.productMeta)}
          className="gap-1.5"
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          {alreadyInSelected
            ? product.productMeta
              ? 'Save Product'
              : 'Saved'
            : 'Stash Tab'}
        </Button>
      </div>
    </form>
  );
}
