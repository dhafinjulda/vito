/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { describe, expect, it, vi } from 'vitest';
import { AssetReadiness } from '../src/assets/AssetReadiness';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('current asset readiness', () => {
  it('follows a replacement without waiting for a stalled obsolete download', async () => {
    const readiness = new AssetReadiness(), obsolete = deferred(), latest = deferred();
    readiness.track(obsolete.promise);
    const waiting = readiness.wait();
    readiness.track(latest.promise);
    latest.resolve();
    await expect(waiting).resolves.toBeUndefined();
    // Resolving later cannot replace the current readiness state.
    obsolete.resolve();
    await obsolete.promise;
    await expect(readiness.wait()).resolves.toBeUndefined();
  });

  it('does not finish startup when a superseded successful load settles first', async () => {
    const readiness = new AssetReadiness(), first = deferred(), latest = deferred(), completed = vi.fn();
    readiness.track(first.promise);
    const waiting = readiness.wait().then(completed);
    readiness.track(latest.promise);
    first.resolve();
    await first.promise;
    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    latest.resolve();
    await waiting;
    expect(completed).toHaveBeenCalledOnce();
  });

  it('preserves startup after a failed replacement while its caller still rejects', async () => {
    const readiness = new AssetReadiness();
    await readiness.track(Promise.resolve());
    const failure = new Error('SKU download failed');
    const result = readiness.track(Promise.reject(failure));
    await expect(result).rejects.toBe(failure);
    await expect(readiness.wait()).resolves.toBeUndefined();
    await expect(readiness.wait()).resolves.toBeUndefined();
  });

  it('fails startup on an initial failure and permits a later successful asset', async () => {
    const readiness = new AssetReadiness(), failure = new Error('Initial GLB missing');
    const result = readiness.track(Promise.reject(failure));
    await expect(result).rejects.toBe(failure);
    await expect(readiness.wait()).rejects.toBe(failure);
    await readiness.track(Promise.resolve());
    await expect(readiness.wait()).resolves.toBeUndefined();
  });

  it('never treats a superseded successful request as an installed model', async () => {
    const readiness = new AssetReadiness(), first = deferred(), latest = deferred();
    readiness.track(first.promise);
    readiness.track(latest.promise);
    first.resolve();
    await first.promise;
    const failure = new Error('Latest GLB failed');
    latest.reject(failure);
    await expect(latest.promise).rejects.toBe(failure);
    await expect(readiness.wait()).rejects.toBe(failure);
  });

  it('observes rejected obsolete loads and keeps the latest request authoritative', async () => {
    const readiness = new AssetReadiness(), obsolete = deferred(), latest = deferred();
    readiness.track(obsolete.promise);
    const waiting = readiness.wait();
    readiness.track(latest.promise);
    obsolete.reject(new Error('Obsolete asset failed'));
    // No caller awaits the obsolete request: the readiness observer handles it.
    await Promise.resolve();
    latest.resolve();
    await expect(waiting).resolves.toBeUndefined();
  });

  it('waits for a pending replacement even if an earlier model is available', async () => {
    const readiness = new AssetReadiness(), latest = deferred(), completed = vi.fn();
    await readiness.track(Promise.resolve());
    readiness.track(latest.promise);
    const waiting = readiness.wait().then(completed);
    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    latest.reject(new Error('Keep the previous model'));
    await waiting;
    expect(completed).toHaveBeenCalledOnce();
  });

  it('cancels a waiter promptly during a stalled load and removes its abort listener', async () => {
    const readiness = new AssetReadiness(), stalled = deferred(), controller = new AbortController();
    const add = vi.spyOn(controller.signal, 'addEventListener'), remove = vi.spyOn(controller.signal, 'removeEventListener');
    readiness.track(stalled.promise);
    const waiting = readiness.wait(controller.signal);
    expect(add).toHaveBeenCalledOnce();
    controller.abort();
    await expect(waiting).rejects.toBe(controller.signal.reason);
    expect(remove).toHaveBeenCalledOnce();
    expect(remove.mock.calls[0]![1]).toBe(add.mock.calls[0]![1]);
    // Cancellation does not cancel or erase the loader's eventual result.
    stalled.resolve();
    await stalled.promise;
    await expect(readiness.wait()).resolves.toBeUndefined();
  });

  it('keeps a valid waiter after another is cancelled and cleans listeners on every replacement/settle', async () => {
    const readiness = new AssetReadiness(), obsolete = deferred(), latest = deferred();
    readiness.track(obsolete.promise);
    const cancelled = new AbortController(), active = new AbortController();
    const add = vi.spyOn(active.signal, 'addEventListener'), remove = vi.spyOn(active.signal, 'removeEventListener');
    const oldWait = readiness.wait(cancelled.signal), activeWait = readiness.wait(active.signal);
    cancelled.abort();
    await expect(oldWait).rejects.toBe(cancelled.signal.reason);
    readiness.track(latest.promise);
    await Promise.resolve();
    latest.resolve();
    await expect(activeWait).resolves.toBeUndefined();
    expect(add).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledTimes(2);
    for (let index = 0; index < add.mock.calls.length; index++) {
      expect(remove.mock.calls[index]![1]).toBe(add.mock.calls[index]![1]);
    }
    // A later abort cannot change a completed readiness result.
    active.abort();
    await expect(readiness.wait()).resolves.toBeUndefined();
  });
});
