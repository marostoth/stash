import { normalizeRawTabs, type OpenTabInfo } from '@/lib/tabs/session-filter';
import type { Collection, LinkItem } from '@/lib/types/stash';

export async function getCurrentWindowTabs(): Promise<OpenTabInfo[]> {
  if (typeof browser === 'undefined' || !browser.tabs?.query) {
    return [];
  }
  const tabs = await browser.tabs.query({ currentWindow: true });
  return normalizeRawTabs(tabs);
}

export async function switchToTab(tabId: number): Promise<void> {
  if (typeof browser === 'undefined' || !browser.tabs?.update) return;
  await browser.tabs.update(tabId, { active: true });
}

export async function closeTabs(tabIds: readonly number[]): Promise<void> {
  if (tabIds.length === 0) return;
  if (typeof browser === 'undefined' || !browser.tabs?.remove) return;
  await browser.tabs.remove([...tabIds]);
}

export async function wakeUpCollectionInTabGroup(
  collection: Collection,
  links: readonly LinkItem[],
): Promise<number> {
  if (links.length === 0) return 0;
  if (typeof browser === 'undefined' || !browser.tabs?.create) return 0;

  const createdIds: number[] = [];
  for (const link of links) {
    const created = await browser.tabs.create({
      url: link.url,
      active: false,
    });
    if (typeof created.id === 'number') {
      createdIds.push(created.id);
    }
  }

  if (createdIds.length === 0) return 0;

  const firstId = createdIds[0];
  if (firstId !== undefined && browser.tabs.group) {
    try {
      const groupId = await browser.tabs.group({
        tabIds: [firstId, ...createdIds.slice(1)],
      });
      if (browser.tabGroups?.update) {
        await browser.tabGroups.update(groupId, {
          title: collection.name,
          color: collection.color,
        });
      }
    } catch (error: unknown) {
      console.warn('Stash: failed to group woken tabs', error);
    }
  }

  return createdIds.length;
}

export async function wakeUpCollectionInNewWindow(
  links: readonly LinkItem[],
): Promise<number> {
  if (links.length === 0) return 0;
  if (typeof browser === 'undefined' || !browser.windows?.create) return 0;

  const urls = links.map((link) => link.url);
  await browser.windows.create({ url: urls, focused: true });
  return urls.length;
}
