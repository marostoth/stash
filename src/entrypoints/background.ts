import { registerContextMenuAndCommands } from '@/lib/background/context-menu-handler';
import { registerOmniboxHandler } from '@/lib/background/omnibox-handler';
import { registerHealthScanPortListener } from '@/lib/health/scanner';
import { FETCH_OG_PREVIEW_MESSAGE } from '@/lib/previews/preview-client';
import {
  fetchAndCacheOgPreview,
  scheduleTabScreenshotCapture,
} from '@/lib/previews/worker-capture';

export default defineBackground(() => {
  registerHealthScanPortListener();
  registerOmniboxHandler();
  registerContextMenuAndCommands();

  if (browser.sidePanel?.setPanelBehavior) {
    browser.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error: unknown) => {
        console.warn('Stash: failed to set sidePanel behavior', error);
      });
  }

  if (browser.tabs?.onActivated) {
    browser.tabs.onActivated.addListener((activeInfo) => {
      scheduleTabScreenshotCapture(activeInfo.tabId);
    });
  }

  if (browser.tabs?.onUpdated) {
    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.active) {
        scheduleTabScreenshotCapture(tabId);
      }
    });
  }

  if (browser.runtime?.onMessage) {
    browser.runtime.onMessage.addListener(
      (message: unknown, _sender, sendResponse) => {
        if (
          message &&
          typeof message === 'object' &&
          (message as { type?: unknown }).type === FETCH_OG_PREVIEW_MESSAGE &&
          typeof (message as { url?: unknown }).url === 'string'
        ) {
          const url = (message as { url: string }).url;
          void fetchAndCacheOgPreview(url)
            .then((entry) => sendResponse({ ok: Boolean(entry) }))
            .catch(() => sendResponse({ ok: false }));
          return true;
        }
        return undefined;
      },
    );
  }
});
