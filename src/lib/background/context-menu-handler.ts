import { isSafeHttpUrl } from '@/lib/background/omnibox-handler';
import { evaluateTier1Rules } from '@/lib/categorizer/rules-engine';
import { stashRepo } from '@/lib/storage/repo';
import { extractDomain } from '@/lib/utils/url';

const MENU_STASH_LINK = 'stash-this-link';
const MENU_OPEN_SIDEPANEL = 'open-stash-sidepanel';
const COMMAND_OPEN_SIDEPANEL = 'open-stash-sidepanel';
const COMMAND_QUICK_STASH = 'quick-stash-active-tab';

const BADGE_SAVED_COLOR = '#00D68F';
const BADGE_DUP_COLOR = '#94A3B8';
const BADGE_FLASH_MS = 2000;

function flashActionBadge(text: string, color: string, tabId?: number): void {
  const actionApi = browser.action;
  if (!actionApi?.setBadgeText) return;

  const target = typeof tabId === 'number' ? { tabId } : {};
  void actionApi
    .setBadgeBackgroundColor?.({ ...target, color })
    .catch(() => undefined);
  void actionApi.setBadgeText({ ...target, text }).catch(() => undefined);

  setTimeout(() => {
    void actionApi.setBadgeText({ ...target, text: '' }).catch(() => undefined);
  }, BADGE_FLASH_MS);
}

/**
 * Opens Chrome Side Panel synchronously so the originating user gesture
 * (context menu click or command shortcut) never expires across an `await`.
 */
function openSidePanelSync(windowId: number | undefined): void {
  if (typeof windowId !== 'number') return;
  const openFn = browser.sidePanel?.open;
  if (!openFn) return;
  void openFn({ windowId }).catch((error: unknown) => {
    console.warn('Stash: failed to open Side Panel', error);
  });
}

async function resolveQuickStashTarget(
  url: string,
  title: string,
): Promise<{ collectionId: string; tags: string[] }> {
  const [collections, rules] = await Promise.all([
    stashRepo.getCollections(),
    stashRepo.getRules(),
  ]);

  const nonSession = collections.filter((col) => !col.isSession);
  const validIds = new Set(nonSession.map((col) => col.id));

  const ruleHit = evaluateTier1Rules({ url, title }, rules, validIds);
  if (ruleHit?.collectionId) {
    return {
      collectionId: ruleHit.collectionId,
      tags: ruleHit.tags,
    };
  }

  const inbox = nonSession.find(
    (col) => col.name.trim().toLowerCase() === 'inbox',
  );
  if (inbox) {
    return { collectionId: inbox.id, tags: [] };
  }

  const first = nonSession[0] ?? collections[0];
  if (first) {
    return { collectionId: first.id, tags: [] };
  }

  const created = await stashRepo.createCollection({
    name: 'Quick Stash',
    icon: 'bookmark',
  });
  return { collectionId: created.id, tags: [] };
}

async function quickStashUrl(input: {
  url: string;
  title?: string;
  faviconUrl?: string;
  tabId?: number;
}): Promise<void> {
  if (!isSafeHttpUrl(input.url)) return;

  const cleanTitle = input.title?.trim() || extractDomain(input.url);
  const target = await resolveQuickStashTarget(input.url, cleanTitle);

  const result = await stashRepo.addLink({
    collectionId: target.collectionId,
    url: input.url,
    title: cleanTitle,
    tags: target.tags,
    faviconUrl: input.faviconUrl,
  });

  if (result.ok) {
    flashActionBadge('✓', BADGE_SAVED_COLOR, input.tabId);
  } else {
    flashActionBadge('•', BADGE_DUP_COLOR, input.tabId);
  }
}

function setupContextMenus(): void {
  if (!browser.contextMenus) return;

  const createItems = () => {
    browser.contextMenus.create(
      {
        id: MENU_STASH_LINK,
        title: 'Stash this link',
        contexts: ['link'],
      },
      () => {
        void browser.runtime?.lastError;
      },
    );
    browser.contextMenus.create(
      {
        id: MENU_OPEN_SIDEPANEL,
        title: 'Open Stash Side Panel',
        contexts: ['page'],
      },
      () => {
        void browser.runtime?.lastError;
      },
    );
  };

  void browser.contextMenus
    .removeAll()
    .then(createItems)
    .catch(() => {
      createItems();
    });
}

export function registerContextMenuAndCommands(): void {
  if (typeof browser === 'undefined') return;

  if (browser.runtime?.onInstalled) {
    browser.runtime.onInstalled.addListener(() => {
      setupContextMenus();
    });
  }

  if (browser.runtime?.onStartup) {
    browser.runtime.onStartup.addListener(() => {
      setupContextMenus();
    });
  }

  if (browser.contextMenus?.onClicked) {
    browser.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === MENU_OPEN_SIDEPANEL) {
        // Call synchronously before any await to preserve Chrome user gesture
        openSidePanelSync(tab?.windowId);
        return;
      }

      if (
        info.menuItemId === MENU_STASH_LINK &&
        typeof info.linkUrl === 'string'
      ) {
        void quickStashUrl({
          url: info.linkUrl,
          title: info.selectionText?.trim() || extractDomain(info.linkUrl),
          tabId: tab?.id,
        });
      }
    });
  }

  if (browser.commands?.onCommand) {
    browser.commands.onCommand.addListener((command, tab) => {
      if (command === COMMAND_OPEN_SIDEPANEL) {
        // Call synchronously before any await to preserve Chrome user gesture
        openSidePanelSync(tab?.windowId);
        return;
      }

      if (command === COMMAND_QUICK_STASH) {
        if (tab?.url) {
          void quickStashUrl({
            url: tab.url,
            title: tab.title,
            faviconUrl: tab.favIconUrl,
            tabId: tab.id,
          });
          return;
        }

        void browser.tabs
          ?.query?.({ active: true, currentWindow: true })
          .then(([activeTab]) => {
            if (!activeTab?.url) return;
            return quickStashUrl({
              url: activeTab.url,
              title: activeTab.title,
              faviconUrl: activeTab.favIconUrl,
              tabId: activeTab.id,
            });
          });
      }
    });
  }
}
