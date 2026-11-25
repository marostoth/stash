export const PREVIEW_HOST_ORIGINS: string[] = ['https://*/*', 'http://*/*'];

export interface PermissionRequestResult {
  granted: boolean;
  error?: string;
}

export async function hasVisualPreviewPermission(): Promise<boolean> {
  if (typeof browser === 'undefined' || !browser.permissions?.contains) {
    return false;
  }
  try {
    return await browser.permissions.contains({
      origins: PREVIEW_HOST_ORIGINS,
    });
  } catch (error: unknown) {
    console.warn('Stash: failed to check visual preview permissions', error);
    return false;
  }
}

function describeLoadedManifest(): string {
  try {
    const manifest = browser.runtime?.getManifest?.() as
      | {
          version?: string;
          optional_host_permissions?: string[];
        }
      | undefined;
    if (!manifest) return '';
    const version = manifest.version ?? 'unknown';
    const hosts = manifest.optional_host_permissions?.join(', ') || 'none';
    return ` (manifest v${version}, optional_host_permissions: ${hosts})`;
  } catch {
    return '';
  }
}

/**
 * Must ONLY be called synchronously as the first statement inside an explicit
 * user click handler (Settings toggle) so Chrome preserves the user gesture.
 */
export function requestVisualPreviewPermission(): Promise<PermissionRequestResult> {
  if (typeof browser === 'undefined' || !browser.permissions?.request) {
    return Promise.resolve({
      granted: false,
      error: 'Chrome permissions API is unavailable in this view.',
    });
  }
  try {
    return browser.permissions
      .request({
        origins: PREVIEW_HOST_ORIGINS,
      })
      .then((granted) => ({ granted: Boolean(granted) }))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('Stash: visual preview permission request failed', error);
        return {
          granted: false,
          error: `${message}${describeLoadedManifest()}`,
        };
      });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Stash: visual preview permission request threw', error);
    return Promise.resolve({
      granted: false,
      error: `${message}${describeLoadedManifest()}`,
    });
  }
}
