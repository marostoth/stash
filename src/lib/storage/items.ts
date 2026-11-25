import { storage } from '#imports';
import {
  type CategorizationRule,
  type Collection,
  DEFAULT_SETTINGS,
  type LinkItem,
  type StashSettings,
  type ThemeDefinition,
} from '@/lib/types/stash';

export const collectionsStorage = storage.defineItem<Collection[]>(
  'local:stash_collections',
  {
    version: 1,
    fallback: [],
  },
);

export const linksStorage = storage.defineItem<LinkItem[]>(
  'local:stash_links',
  {
    version: 1,
    fallback: [],
  },
);

export const rulesStorage = storage.defineItem<CategorizationRule[]>(
  'local:stash_rules',
  {
    version: 1,
    fallback: [],
  },
);

export const settingsStorage = storage.defineItem<StashSettings>(
  'local:stash_settings',
  {
    version: 1,
    fallback: DEFAULT_SETTINGS,
  },
);

export const customThemesStorage = storage.defineItem<ThemeDefinition[]>(
  'local:stash_custom_themes',
  {
    version: 1,
    fallback: [],
  },
);
