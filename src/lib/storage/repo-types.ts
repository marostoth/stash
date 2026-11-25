import type { OpenTabInfo } from '@/lib/tabs/session-filter';
import type {
  CategorizationRule,
  Collection,
  LinkItem,
  StashSettings,
  TabGroupColor,
  ThemeDefinition,
} from '@/lib/types/stash';

export interface CreateCollectionInput {
  name: string;
  description?: string;
  color?: TabGroupColor;
  icon?: string;
  isSession?: boolean;
}

export interface UpdateCollectionInput {
  name?: string;
  description?: string;
  color?: TabGroupColor;
  icon?: string;
  collapsed?: boolean;
  order?: number;
}

export interface AddLinkInput {
  collectionId: string;
  url: string;
  title?: string;
  note?: string;
  tags?: string[];
  tagsLocked?: boolean;
  faviconUrl?: string;
}

export interface UpdateLinkInput {
  collectionId?: string;
  url?: string;
  title?: string;
  note?: string;
  tags?: string[];
  tagsLocked?: boolean;
  faviconUrl?: string;
  order?: number;
}

export type AddLinkResult =
  | { ok: true; link: LinkItem }
  | { ok: false; reason: 'duplicate'; existingLink: LinkItem };

export type UpdateLinkResult =
  | { ok: true; link: LinkItem }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'duplicate'; existingLink: LinkItem };

export type MoveLinkResult =
  | { ok: true; link: LinkItem }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'duplicate'; existingLink: LinkItem };

export interface SaveSessionResult {
  collection: Collection;
  links: LinkItem[];
  savedTabs: OpenTabInfo[];
  closableTabs: OpenTabInfo[];
}

export interface StashSnapshot {
  collections: Collection[];
  links: LinkItem[];
  rules: CategorizationRule[];
  settings: StashSettings;
  customThemes: ThemeDefinition[];
}

export function buildStarterCollections(timestamp: string): Collection[] {
  return [
    {
      id: crypto.randomUUID(),
      name: 'Reading',
      description: 'Articles, essays, and deep dives to read later',
      color: 'cyan',
      order: 0,
      collapsed: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: crypto.randomUUID(),
      name: 'Tools',
      description: 'Everyday utilities, references, and docs',
      color: 'green',
      order: 1,
      collapsed: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: crypto.randomUUID(),
      name: 'Inspiration',
      description: 'Ideas, design references, and projects worth revisiting',
      color: 'purple',
      order: 2,
      collapsed: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
}
