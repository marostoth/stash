import { lazy, Suspense, useEffect, useState } from 'react';
import { StashErrorBoundary } from '@/components/ui/error-boundary';
import { CollectionModal } from '@/components/workbench/collection-modal';
import { LinkPreviewPopover } from '@/components/workbench/link-preview-popover';
import { QuickEditModal } from '@/components/workbench/quick-edit-modal';
import type {
  CategorizationRule,
  Collection,
  LinkItem,
  Space,
  StashSettings,
  ThemeDefinition,
} from '@/lib/types/stash';
import { useUiStore } from '@/store/ui-store';

const CHUNK_RELOAD_KEY = 'stash_chunk_reload_at';
const CHUNK_RELOAD_COOLDOWN_MS = 15_000;

function isStaleChunkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('loading chunk')
  );
}

/**
 * Wraps `React.lazy` so an already-open New Tab recovers cleanly after a
 * Chrome extension reload or Store auto-update invalidates old chunk hashes.
 */
function importWithChunkReload<T>(factory: () => Promise<T>): Promise<T> {
  return factory().catch((err: unknown) => {
    if (isStaleChunkError(err) && typeof window !== 'undefined') {
      try {
        const lastReload = Number(
          window.sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? '0',
        );
        if (
          !Number.isFinite(lastReload) ||
          Date.now() - lastReload > CHUNK_RELOAD_COOLDOWN_MS
        ) {
          window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
          window.location.reload();
          return new Promise<T>(() => undefined);
        }
      } catch {
        // Fall through to ErrorBoundary if sessionStorage is unavailable
      }
    }
    throw err;
  });
}

const SettingsModal = lazy(() =>
  importWithChunkReload(() =>
    import('@/components/settings/settings-modal').then((m) => ({
      default: m.SettingsModal,
    })),
  ),
);

const HealthCheckModal = lazy(() =>
  importWithChunkReload(() =>
    import('@/components/HealthCheckModal').then((m) => ({
      default: m.HealthCheckModal,
    })),
  ),
);

const ReorganizeModal = lazy(() =>
  importWithChunkReload(() =>
    import('@/components/reorganize/ReorganizeModal').then((m) => ({
      default: m.ReorganizeModal,
    })),
  ),
);

const TriageModal = lazy(() =>
  importWithChunkReload(() =>
    import('@/components/workbench/triage-modal').then((m) => ({
      default: m.TriageModal,
    })),
  ),
);

interface WorkbenchModalsProps {
  spaces: readonly Space[];
  collections: readonly Collection[];
  links: readonly LinkItem[];
  rules: readonly CategorizationRule[];
  settings: StashSettings;
  allThemes: readonly ThemeDefinition[];
  activeTheme: ThemeDefinition;
  activeSpace: Space | undefined;
  resolvedSpaceId: string;
  defaultCurrency: string;
}

/**
 * Hosts lightweight workbench dialogs eagerly and lazily loads heavy feature
 * modals (Settings, Health Check, Smart Reorganize, Auto-Categorize Triage)
 * on first open. Sticky mount latches keep minimized background jobs alive
 * once a modal has been opened.
 */
export function WorkbenchModals({
  spaces,
  collections,
  links,
  rules,
  settings,
  allThemes,
  activeTheme,
  activeSpace,
  resolvedSpaceId,
  defaultCurrency,
}: WorkbenchModalsProps) {
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const healthCheckOpen = useUiStore((s) => s.healthCheckOpen);
  const reorganizeOpen = useUiStore((s) => s.reorganizeOpen);
  const triageOpen = useUiStore((s) => s.triageOpen);

  const [mountedSettings, setMountedSettings] = useState(false);
  const [mountedHealthCheck, setMountedHealthCheck] = useState(false);
  const [mountedReorganize, setMountedReorganize] = useState(false);
  const [mountedTriage, setMountedTriage] = useState(false);

  useEffect(() => {
    if (settingsOpen) setMountedSettings(true);
  }, [settingsOpen]);

  useEffect(() => {
    if (healthCheckOpen) setMountedHealthCheck(true);
  }, [healthCheckOpen]);

  useEffect(() => {
    if (reorganizeOpen) setMountedReorganize(true);
  }, [reorganizeOpen]);

  useEffect(() => {
    if (triageOpen) setMountedTriage(true);
  }, [triageOpen]);

  return (
    <>
      <CollectionModal spaces={spaces} activeSpaceId={resolvedSpaceId} />
      <QuickEditModal
        collections={collections}
        spaces={spaces}
        defaultCurrency={defaultCurrency}
      />

      {mountedSettings && (
        <StashErrorBoundary
          scope="Settings"
          compact
          onReset={() => useUiStore.getState().closeSettings()}
        >
          <Suspense fallback={null}>
            <SettingsModal
              spaces={spaces}
              collections={collections}
              links={links}
              rules={rules}
              settings={settings}
              allThemes={allThemes}
              activeTheme={activeTheme}
            />
          </Suspense>
        </StashErrorBoundary>
      )}

      {mountedHealthCheck && (
        <Suspense fallback={null}>
          <HealthCheckModal collections={collections} links={links} />
        </Suspense>
      )}

      {mountedReorganize && (
        <Suspense fallback={null}>
          <ReorganizeModal
            collections={collections}
            links={links}
            settings={settings}
            activeSpace={activeSpace}
          />
        </Suspense>
      )}

      {mountedTriage && (
        <Suspense fallback={null}>
          <TriageModal
            spaces={spaces}
            collections={collections}
            links={links}
            rules={rules}
            settings={settings}
          />
        </Suspense>
      )}

      <LinkPreviewPopover
        hoverPreviews={settings.hoverPreviews}
        visualPreviewsEnabled={settings.visualPreviewsEnabled}
        motionMode={settings.motionMode}
      />
    </>
  );
}
