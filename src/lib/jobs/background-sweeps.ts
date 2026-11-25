import { toast } from 'sonner';
import { playSessionFreeze, playTagPop } from '@/lib/audio/foley';
import {
  checkNanoAvailability,
  downloadNanoModel,
} from '@/lib/categorizer/nano-engine';
import type { NanoAvailabilityStatus } from '@/lib/categorizer/types';
import { pickIconsForCollections } from '@/lib/icons/aiIconPicker';
import { stashRepo } from '@/lib/storage/repo';
import { runBatchAutoTagSweep } from '@/lib/tagging/auto-tagger';
import type { Collection, LinkItem } from '@/lib/types/stash';
import { useBackgroundJobsStore } from '@/store/background-jobs-store';
import { useUiStore } from '@/store/ui-store';

let autoIconAbort: AbortController | null = null;
let autoTagAbort: AbortController | null = null;
let nanoDownloadRunning = false;

export async function startAutoIconSweep(
  collections: readonly Collection[],
  links: readonly LinkItem[],
): Promise<void> {
  const store = useBackgroundJobsStore.getState();
  if (autoIconAbort) return;

  if (store.hasActiveNanoJob('auto-icon')) {
    toast.info('Another on-device AI task is already running.');
    return;
  }

  const missing = collections.filter((c) => !c.icon);
  if (missing.length === 0) {
    toast.info('Every collection already has an icon.');
    return;
  }

  const controller = new AbortController();
  autoIconAbort = controller;

  const sampleTitlesByCol = new Map<string, string[]>();
  for (const link of links) {
    const list = sampleTitlesByCol.get(link.collectionId);
    if (list) {
      if (list.length < 5) list.push(link.title);
    } else {
      sampleTitlesByCol.set(link.collectionId, [link.title]);
    }
  }

  const items = missing.map((col) => ({
    id: col.id,
    title: col.name,
    sampleLinkTitles: sampleTitlesByCol.get(col.id),
  }));

  const cancel = () => controller.abort();
  const reopen = () => useUiStore.getState().openSettings();

  store.upsertJob({
    id: 'auto-icon',
    title: 'Auto-Icon Collections',
    detail: `0 / ${items.length} · ${items[0]?.title ?? 'Starting...'}`,
    status: 'running',
    progress: { current: 0, total: items.length },
    usesNano: true,
    reopenLabel: 'Settings',
    onReopen: reopen,
    onCancel: cancel,
  });

  let applied = 0;

  try {
    await pickIconsForCollections(items, {
      signal: controller.signal,
      onProgress: (p) => {
        useBackgroundJobsStore.getState().upsertJob({
          id: 'auto-icon',
          title: 'Auto-Icon Collections',
          detail: `${p.completed} / ${p.total} · ${p.currentTitle}`,
          status: 'running',
          progress: { current: p.completed, total: p.total },
          usesNano: true,
          reopenLabel: 'Settings',
          onReopen: reopen,
          onCancel: cancel,
        });
      },
      onItemPicked: async (id, icon) => {
        const latest = await stashRepo.getCollections();
        const current = latest.find((c) => c.id === id);
        if (!current || current.icon) return;
        await stashRepo.updateCollection(id, { icon });
        applied += 1;
      },
    });

    if (controller.signal.aborted) {
      toast.info(
        applied > 0
          ? `Stopped early — assigned ${applied} collection ${applied === 1 ? 'icon' : 'icons'}.`
          : 'Canceled icon assignment.',
      );
    } else if (applied > 0) {
      const settings = await stashRepo.getSettings();
      playSessionFreeze(settings.soundEffects, settings.motionMode);
      toast.success(
        `Assigned AI icons to ${applied} ${applied === 1 ? 'collection' : 'collections'}`,
      );
    } else {
      toast.info('No new collection icons were assigned.');
    }
  } finally {
    autoIconAbort = null;
    useBackgroundJobsStore.getState().removeJob('auto-icon');
  }
}

export async function startAutoTagSweep(collectionId?: string): Promise<void> {
  const store = useBackgroundJobsStore.getState();
  if (autoTagAbort) return;

  if (store.hasActiveNanoJob('auto-tag')) {
    toast.info('Another on-device AI task is already running.');
    return;
  }

  const controller = new AbortController();
  autoTagAbort = controller;

  const cancel = () => controller.abort();
  const reopen = collectionId
    ? undefined
    : () => useUiStore.getState().openSettings();

  store.upsertJob({
    id: 'auto-tag',
    title: collectionId ? 'Auto-Tagging Collection' : 'Auto-Tag All Untagged',
    detail: 'Preparing on-device AI...',
    status: 'running',
    progress: null,
    usesNano: true,
    scopeId: collectionId,
    reopenLabel: reopen ? 'Settings' : undefined,
    onReopen: reopen,
    onCancel: cancel,
  });

  try {
    const initialSettings = await stashRepo.getSettings();
    const { addTaggingLink, removeTaggingLink } = useUiStore.getState();
    const result = await runBatchAutoTagSweep({
      collectionId,
      signal: controller.signal,
      onProgress: (p) => {
        useBackgroundJobsStore.getState().upsertJob({
          id: 'auto-tag',
          title: collectionId
            ? 'Auto-Tagging Collection'
            : 'Auto-Tag All Untagged',
          detail: `${p.current} / ${p.total} · ${p.tagged} tagged`,
          status: 'running',
          progress: { current: p.current, total: p.total },
          usesNano: true,
          scopeId: collectionId,
          reopenLabel: reopen ? 'Settings' : undefined,
          onReopen: reopen,
          onCancel: cancel,
        });
      },
      onLinkStart: (id) => addTaggingLink(id),
      onLinkEnd: (id, tags) => {
        removeTaggingLink(id);
        if (tags && tags.length > 0) {
          playTagPop(initialSettings.soundEffects, initialSettings.motionMode);
        }
      },
    });

    if (result.status === 'unavailable') {
      toast.info(
        'On-device Gemini Nano is unavailable in this browser right now.',
      );
      return;
    }

    if (result.status === 'canceled') {
      toast.info(
        result.tagged > 0
          ? `Auto-Tag canceled (${result.tagged} link${result.tagged === 1 ? '' : 's'} tagged)`
          : 'Auto-Tag canceled',
      );
      return;
    }

    if (result.tagged > 0) {
      const latestSettings = await stashRepo.getSettings();
      playSessionFreeze(latestSettings.soundEffects, latestSettings.motionMode);
      toast.success(
        `Auto-tagged ${result.tagged} of ${result.total} link${result.total === 1 ? '' : 's'}`,
      );
    } else {
      toast.info('No new tags were added.');
    }
  } finally {
    autoTagAbort = null;
    useBackgroundJobsStore.getState().removeJob('auto-tag');
  }
}

export async function startNanoModelDownload(
  onStatusRefreshed?: (status: NanoAvailabilityStatus) => void,
): Promise<void> {
  if (nanoDownloadRunning) return;
  nanoDownloadRunning = true;

  const reopen = () => useUiStore.getState().openSettings();
  const updateProgress = (pct: number) => {
    useBackgroundJobsStore.getState().upsertJob({
      id: 'nano-download',
      title: 'Downloading Gemini Nano',
      detail: `${pct}% complete`,
      status: 'running',
      progress: { current: pct, total: 100 },
      reopenLabel: 'Settings',
      onReopen: reopen,
    });
  };

  updateProgress(0);
  try {
    const ok = await downloadNanoModel((pct) => updateProgress(pct));
    const refreshed = await checkNanoAvailability();
    onStatusRefreshed?.(refreshed);
    if (ok) {
      await stashRepo.updateSettings({ enableOnDeviceAi: true });
      toast.success('On-device Gemini Nano model is ready');
    } else {
      toast.error(
        'Could not enable On-Device AI. Falling back cleanly to Tier 1 rules.',
      );
    }
  } finally {
    nanoDownloadRunning = false;
    useBackgroundJobsStore.getState().removeJob('nano-download');
  }
}
