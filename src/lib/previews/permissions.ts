export const PREVIEW_HOST_ORIGINS: string[] = ['https://*/*', 'http://*/*'];

export async function hasVisualPreviewPermission(): Promise<boolean> {
  if (typeof browser === 'undefined' || !browser.permissions?.contains) {
    return false;
  }
  try {
    return await browser.permissions.contains({
      origins: PREVIEW_HOST_ORIGINS,
    });
  } catch {
    return false;
  }
}

/**
 * Must ONLY be called inside an explicit user click handler (Settings toggle).
 */
export async function requestVisualPreviewPermission(): Promise<boolean> {
  if (typeof browser === 'undefined' || !browser.permissions?.request) {
    return false;
  }
  try {
    return await browser.permissions.request({
      origins: PREVIEW_HOST_ORIGINS,
    });
  } catch {
    return false;
  }
}
