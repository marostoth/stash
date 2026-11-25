import { useEffect, useState } from 'react';
import { stashRepo } from '@/lib/storage/repo';
import {
  applyThemeToDocument,
  getAllThemes,
  resolveTheme,
} from '@/lib/themes/theme-engine';
import {
  type CategorizationRule,
  type Collection,
  DEFAULT_SETTINGS,
  type LinkItem,
  type StashSettings,
  type ThemeDefinition,
} from '@/lib/types/stash';

export interface StashDataState {
  loading: boolean;
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
  const [collections, setCollections] = useState<Collection[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [settings, setSettings] = useState<StashSettings>(DEFAULT_SETTINGS);
  const [customThemes, setCustomThemes] = useState<ThemeDefinition[]>([]);

  useEffect(() => {
    let active = true;

    stashRepo
      .getSnapshot()
      .then((snapshot) => {
        if (!active) return;
        setCollections(snapshot.collections);
        setLinks(snapshot.links);
        setRules(snapshot.rules);
        setSettings(snapshot.settings);
        setCustomThemes(snapshot.customThemes);
        setLoading(false);
      })
      .catch((error: unknown) => {
        console.error('Stash: failed to load storage snapshot', error);
        if (active) setLoading(false);
      });

    const unwatchCollections = stashRepo.watchCollections(setCollections);
    const unwatchLinks = stashRepo.watchLinks(setLinks);
    const unwatchRules = stashRepo.watchRules(setRules);
    const unwatchSettings = stashRepo.watchSettings(setSettings);
    const unwatchThemes = stashRepo.watchCustomThemes(setCustomThemes);

    return () => {
      active = false;
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
    applyThemeToDocument(activeTheme);
  }, [activeTheme]);

  return {
    loading,
    collections,
    links,
    rules,
    settings,
    customThemes,
    allThemes,
    activeTheme,
  };
}
