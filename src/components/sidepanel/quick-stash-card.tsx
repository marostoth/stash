import { BookmarkPlus, Check, Plus, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { playDrop, playError } from '@/lib/audio/foley';
import { categorizeLink } from '@/lib/categorizer/categorizer';
import {
  acquireWarmNanoSession,
  type NanoCategorizerSession,
  releaseWarmNanoSession,
} from '@/lib/categorizer/nano-engine';
import type { CategorizationSuggestion } from '@/lib/categorizer/types';
import { stashRepo } from '@/lib/storage/repo';
import type { OpenTabInfo } from '@/lib/tabs/session-filter';
import { closeTabs } from '@/lib/tabs/tab-actions';
import { triggerAutoTagSingleLink } from '@/lib/tagging/trigger-auto-tag';
import {
  type CategorizationRule,
  type Collection,
  type LinkItem,
  type StashSettings,
  TAB_GROUP_COLOR_SWATCH,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { extractDomain, getMonogram, parseTagsInput } from '@/lib/utils/url';

interface QuickStashCardProps {
  activeTab: OpenTabInfo | null;
  loadingTab: boolean;
  collections: readonly Collection[];
  links: readonly LinkItem[];
  rules: readonly CategorizationRule[];
  settings: StashSettings;
}

export function QuickStashCard({
  activeTab,
  loadingTab,
  collections,
  links,
  rules,
  settings,
}: QuickStashCardProps) {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [note, setNote] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [tagsEditedByUser, setTagsEditedByUser] = useState(false);
  const [suggestion, setSuggestion] = useState<CategorizationSuggestion | null>(
    null,
  );
  const [categorizing, setCategorizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [creatingName, setCreatingName] = useState<string | null>(null);

  const orderedCollections = useMemo(() => {
    const regular = collections.filter((c) => !c.isSession);
    const sessions = collections.filter((c) => c.isSession);
    return [...regular, ...sessions];
  }, [collections]);

  // Run 2-tier auto-categorizer whenever the active tab or rules change
  useEffect(() => {
    setFaviconFailed(false);
    setNote('');
    setTagsRaw('');
    setTagsEditedByUser(false);
    setSuggestion(null);

    if (!activeTab) return;

    let cancelled = false;
    setCategorizing(true);

    const runSuggestion = async () => {
      let warmSession: NanoCategorizerSession | null = null;
      try {
        if (settings.enableOnDeviceAi) {
          warmSession = await acquireWarmNanoSession();
        }
        if (cancelled) return;
        const result = await categorizeLink(
          { url: activeTab.url, title: activeTab.title },
          {
            rules,
            collections,
            enableOnDeviceAi: settings.enableOnDeviceAi,
            nanoSession: warmSession,
          },
        );
        if (cancelled) return;
        setSuggestion(result);
        if (result.collectionId) {
          setSelectedCollectionId(result.collectionId);
        } else if (orderedCollections[0]) {
          setSelectedCollectionId(orderedCollections[0].id);
        }
        if (result.tags.length > 0) {
          setTagsRaw(result.tags.join(', '));
        }
        if (result.summaryNote) {
          setNote(result.summaryNote);
        }
      } finally {
        releaseWarmNanoSession(warmSession);
        if (!cancelled) setCategorizing(false);
      }
    };

    void runSuggestion();

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    rules,
    collections,
    orderedCollections,
    settings.enableOnDeviceAi,
  ]);

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
      stashRepo.findDuplicateInList(links, selectedCollectionId, activeTab.url),
    );
  }, [activeTab, links, selectedCollectionId]);

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
      const shouldLockTags = tagsEditedByUser || submittedTags.length > 0;
      const result = await stashRepo.addLink({
        collectionId: targetId,
        url: activeTab.url,
        title: activeTab.title,
        note,
        tags: submittedTags,
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

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-3 rounded-card border border-border bg-panel p-3.5 shadow-sm"
    >
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

      {/* Suggested Collection Pills */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">
            Collection
          </span>
          {categorizing ? (
            <span className="font-mono text-[10px] text-fg-muted">
              Matching...
            </span>
          ) : suggestion && suggestion.source !== 'none' ? (
            <span className="inline-flex items-center gap-1 rounded-pill border border-accent/35 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">
              <Sparkles className="h-2.5 w-2.5" />
              {suggestion.source === 'rule'
                ? suggestion.matchedRuleName || 'Rule match'
                : 'On-Device AI'}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {orderedCollections.map((col) => {
            const isSelected = col.id === selectedCollectionId;
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => setSelectedCollectionId(col.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                  isSelected
                    ? 'border-accent bg-accent/15 text-fg ring-1 ring-accent/40'
                    : 'border-border bg-canvas text-fg-muted hover:border-fg-muted/40 hover:text-fg',
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: TAB_GROUP_COLOR_SWATCH[col.color],
                  }}
                />
                <span className="max-w-[130px] truncate">{col.name}</span>
                {isSelected && <Check className="h-3 w-3 text-accent" />}
              </button>
            );
          })}

          {suggestion?.suggestedNewCollection && (
            <button
              type="button"
              onClick={() =>
                void handleCreateQuickCollection(
                  suggestion.suggestedNewCollection ?? '',
                )
              }
              className="inline-flex items-center gap-1 rounded-pill border border-dashed border-accent/60 bg-accent/10 px-2.5 py-1 text-[11px] text-accent hover:bg-accent/20 cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              Create "{suggestion.suggestedNewCollection}"
            </button>
          )}

          {creatingName === null ? (
            <button
              type="button"
              onClick={() => setCreatingName('')}
              className="inline-flex items-center gap-1 rounded-pill border border-dashed border-border px-2 py-1 text-[11px] text-fg-muted hover:border-accent/50 hover:text-fg cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              New
            </button>
          ) : (
            <div className="flex w-full items-center gap-1 pt-1">
              <Input
                value={creatingName}
                onChange={(e) => setCreatingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleCreateQuickCollection(creatingName);
                  } else if (e.key === 'Escape') {
                    setCreatingName(null);
                  }
                }}
                placeholder="New collection name..."
                className="h-7 text-xs"
                autoFocus
              />
              <Button
                variant="secondary"
                size="sm"
                className="h-7 px-2"
                onClick={() => void handleCreateQuickCollection(creatingName)}
              >
                Add
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 1-Line Note & Tags */}
      <div className="space-y-2">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why I saved this... (optional)"
          aria-label="Why I saved this"
          className="h-8 text-xs"
        />
        <Input
          value={tagsRaw}
          onChange={(e) => {
            setTagsRaw(e.target.value);
            setTagsEditedByUser(true);
          }}
          placeholder="Tags: docs, hardware..."
          aria-label="Tags"
          className="h-8 font-mono text-[11px]"
        />
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
          disabled={saving || alreadyInSelected}
          className="gap-1.5"
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          {alreadyInSelected ? 'Saved' : 'Stash Tab'}
        </Button>
      </div>
    </form>
  );
}
