import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type BackgroundJob,
  isJobVisibleInTray,
  useBackgroundJobsStore,
} from '@/store/background-jobs-store';

describe('background-jobs-store', () => {
  beforeEach(() => {
    useBackgroundJobsStore.getState().resetForTests();
  });

  it('upserts, updates in place, cancels, and removes background jobs cleanly', () => {
    const cancelSpy = vi.fn();
    const store = useBackgroundJobsStore.getState();

    store.upsertJob({
      id: 'auto-icon',
      title: 'Auto-Icon Collections',
      detail: '0 / 5',
      status: 'running',
      progress: { current: 0, total: 5 },
      usesNano: true,
      onCancel: cancelSpy,
    });
    expect(useBackgroundJobsStore.getState().jobs).toHaveLength(1);

    // Updating same id replaces in place without duplicating
    store.upsertJob({
      id: 'auto-icon',
      title: 'Auto-Icon Collections',
      detail: '3 / 5',
      status: 'running',
      progress: { current: 3, total: 5 },
      usesNano: true,
      onCancel: cancelSpy,
    });
    expect(useBackgroundJobsStore.getState().jobs).toHaveLength(1);
    expect(useBackgroundJobsStore.getState().jobs[0]?.detail).toBe('3 / 5');

    // Cancel invokes onCancel
    store.cancelJob('auto-icon');
    expect(cancelSpy).toHaveBeenCalledTimes(1);

    // Ready job cancel removes the job from the tray
    store.upsertJob({
      id: 'health-check',
      title: 'Health Check ready',
      status: 'ready',
    });
    store.cancelJob('health-check');
    expect(
      useBackgroundJobsStore
        .getState()
        .jobs.some((j) => j.id === 'health-check'),
    ).toBe(false);
  });

  it('tracks active Gemini Nano concurrency and ignores ready or excluded jobs', () => {
    const store = useBackgroundJobsStore.getState();
    expect(store.hasActiveNanoJob()).toBe(false);

    store.upsertJob({
      id: 'health-check',
      title: 'Health Check',
      status: 'running',
      usesNano: false,
    });
    expect(store.hasActiveNanoJob()).toBe(false);

    store.upsertJob({
      id: 'reorganize',
      title: 'Smart Reorganize',
      status: 'running',
      usesNano: true,
    });
    expect(store.hasActiveNanoJob()).toBe(true);
    expect(store.hasActiveNanoJob('auto-icon')).toBe(true);
    expect(store.hasActiveNanoJob('reorganize')).toBe(false);

    // Once ready (waiting for review), Nano is free again
    store.upsertJob({
      id: 'reorganize',
      title: 'Smart Reorganize ready',
      status: 'ready',
      usesNano: true,
    });
    expect(store.hasActiveNanoJob('auto-icon')).toBe(false);
  });

  it('shows tray pills only when their owning modal is closed (except per-collection auto-tag)', () => {
    const allClosed = {
      settingsOpen: false,
      healthCheckOpen: false,
      reorganizeOpen: false,
      triageOpen: false,
    };

    const healthJob: BackgroundJob = {
      id: 'health-check',
      title: 'Health Check',
      status: 'running',
    };
    const reorgJob: BackgroundJob = {
      id: 'reorganize',
      title: 'Smart Reorganize',
      status: 'running',
    };
    const triageJob: BackgroundJob = {
      id: 'triage',
      title: 'Auto-Categorize',
      status: 'running',
    };
    const iconJob: BackgroundJob = {
      id: 'auto-icon',
      title: 'Auto-Icon',
      status: 'running',
    };
    const globalTagJob: BackgroundJob = {
      id: 'auto-tag',
      title: 'Auto-Tag All',
      status: 'running',
    };
    const scopedTagJob: BackgroundJob = {
      id: 'auto-tag',
      title: 'Auto-Tagging Collection',
      status: 'running',
      scopeId: 'col-1',
    };

    expect(isJobVisibleInTray(healthJob, allClosed)).toBe(true);
    expect(
      isJobVisibleInTray(healthJob, { ...allClosed, healthCheckOpen: true }),
    ).toBe(false);

    expect(
      isJobVisibleInTray(reorgJob, { ...allClosed, reorganizeOpen: true }),
    ).toBe(false);
    expect(
      isJobVisibleInTray(triageJob, { ...allClosed, triageOpen: true }),
    ).toBe(false);

    expect(
      isJobVisibleInTray(iconJob, { ...allClosed, settingsOpen: true }),
    ).toBe(false);
    expect(
      isJobVisibleInTray(globalTagJob, { ...allClosed, settingsOpen: true }),
    ).toBe(false);
    expect(
      isJobVisibleInTray(scopedTagJob, { ...allClosed, settingsOpen: true }),
    ).toBe(true);
  });
});
