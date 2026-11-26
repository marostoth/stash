import { useEffect, useState } from 'react';
import {
  setFoleyMotionMode,
  setSoundEffectsEnabled,
  setSoundVolume,
} from '@/lib/audio/foley';
import { stashRepo } from '@/lib/storage/repo';
import {
  applyThemeToDocument,
  getAllThemes,
  resolveTheme,
} from '@/lib/themes/theme-engine';
import {
  type CategorizationRule,
  type Collection,
  createDefaultSpace,
  DEFAULT_SETTINGS,
  type LinkItem,
  type Space,
  type StashSettings,
  type ThemeDefinition,
} from '@/lib/types/stash';
import { useUiStore } from '@/store/ui-store';

let storagePersistRequested = false;

export interface StashDataState {
  loading: boolean;
  spaces: Space[];
  collections: Collection[];
  links: LinkItem[];
  rules: CategorizationRule[];
  settings: StashSettings;
  customThemes: ThemeDefinition[];
  allThemes: ThemeDefinition[];
  activeTheme: ThemeDefinition;
}

export function useStashData(): StashDataState {
  const [loading, setLoading] = useState(true);
  const [spaces, setSpaces] = useState<Space[]>(() => [createDefaultSpace()]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [settings, setSettings] = useState<StashSettings>(DEFAULT_SETTINGS);
  const [customThemes, setCustomThemes] = useState<ThemeDefinition[]>([]);

  useEffect(() => {
    let active = true;

    Promise.all([stashRepo.getSnapshot(), stashRepo.getActiveSpaceId()])
      .then(([snapshot, storedActiveSpaceId]) => {
        if (!active) return;
        setSpaces(snapshot.spaces);
        setCollections(snapshot.collections);
        setLinks(snapshot.links);
        setRules(snapshot.rules);
        setSettings(snapshot.settings);
        setCustomThemes(snapshot.customThemes);
        useUiStore.getState().setActiveSpaceId(storedActiveSpaceId, false);
        setLoading(false);
      })
      .catch((error: unknown) => {
        console.error('Stash: failed to load storage snapshot', error);
        if (active) setLoading(false);
      });

    const unwatchSpaces = stashRepo.watchSpaces((nextSpaces) => {
      setSpaces(nextSpaces);
      const currentActive = useUiStore.getState().activeSpaceId;
      if (
        nextSpaces.length > 0 &&
        !nextSpaces.some((s) => s.id === currentActive)
      ) {
        const fallback = nextSpaces[0];
        if (fallback) {
          useUiStore.getState().setActiveSpaceId(fallback.id, false);
        }
      }
    });
    const unwatchCollections = stashRepo.watchCollections(setCollections);
    const unwatchLinks = stashRepo.watchLinks(setLinks);
    const unwatchRules = stashRepo.watchRules(setRules);
    const unwatchSettings = stashRepo.watchSettings(setSettings);
    const unwatchThemes = stashRepo.watchCustomThemes(setCustomThemes);

    return () => {
      active = false;
      unwatchSpaces();
      unwatchCollections();
      unwatchLinks();
      unwatchRules();
      unwatchSettings();
      unwatchThemes();
    };
  }, []);

  const allThemes = getAllThemes(customThemes);
  const activeTheme = resolveTheme(settings.activeThemeId, customThemes);

  useEffect(() => {
    applyThemeToDocument(
      activeTheme,
      document.documentElement,
      settings.backdropOverride,
    );
  }, [activeTheme, settings.backdropOverride]);

  useEffect(() => {
    if (!storagePersistRequested) {
      storagePersistRequested = true;
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.storage?.persist === 'function'
      ) {
        void navigator.storage.persist().catch(() => undefined);
      }
    }

    if (typeof document === 'undefined') return;
    const syncVisibility = () => {
      if (document.hidden) {
        document.documentElement.dataset.pageHidden = 'true';
      } else {
        delete document.documentElement.dataset.pageHidden;
      }
    };
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      delete document.documentElement.dataset.pageHidden;
    };
  }, []);

  useEffect(() => {
    setSoundEffectsEnabled(settings.soundEffects);
    setSoundVolume(settings.soundVolume);
    setFoleyMotionMode(settings.motionMode);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.motion = settings.motionMode;
    }
  }, [settings.soundEffects, settings.soundVolume, settings.motionMode]);

  return {
    loading,
    spaces,
    collections,
    links,
    rules,
    settings,
    customThemes,
    allThemes,
    activeTheme,
  };
}
