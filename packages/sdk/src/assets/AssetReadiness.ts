type AssetRequest =
  | { state: 'pending' }
  | { state: 'ready' }
  | { state: 'failed'; error: unknown };

/** Follows the latest requested GLB while preserving an already installed model.
 * Superseded renderer loads resolve without installing, so only the current
 * request may establish readiness. This helper retains no asset or camera data. */
export class AssetReadiness {
  private current: AssetRequest | null = null;
  private installed = false;
  private readonly changed = new Set<() => void>();

  track(load: Promise<void>): Promise<void> {
    const request: AssetRequest = { state: 'pending' };
    this.current = request;
    this.notify();
    // Observe both outcomes even if no start() is waiting. The caller still
    // receives the original rejection from setGlasses().
    void load.then(() => {
      if (this.current !== request) return;
      this.installed = true;
      this.current = { state: 'ready' };
      this.notify();
    }, error => {
      if (this.current !== request) return;
      this.current = { state: 'failed', error };
      this.notify();
    });
    return load;
  }

  async wait(signal?: AbortSignal): Promise<void> {
    for (;;) {
      if (signal?.aborted) throw this.abortReason(signal);
      const request = this.current;
      if (!request) throw new Error('A glasses asset has not been requested.');
      if (request.state === 'ready' || (request.state === 'failed' && this.installed)) return;
      if (request.state === 'failed') throw request.error;
      // Wake on replacement too: an obsolete download may never settle.
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          this.changed.delete(onChange);
          signal?.removeEventListener('abort', onAbort);
        };
        const onChange = () => { cleanup(); resolve(); };
        const onAbort = () => { cleanup(); reject(this.abortReason(signal!)); };
        this.changed.add(onChange);
        signal?.addEventListener('abort', onAbort, { once: true });
        if (signal?.aborted) onAbort();
      });
    }
  }

  private notify(): void {
    const waiting = [...this.changed];
    this.changed.clear();
    for (const resolve of waiting) resolve();
  }

  private abortReason(signal: AbortSignal): unknown {
    return signal.reason ?? new DOMException('Asset readiness wait was cancelled.', 'AbortError');
  }
}
