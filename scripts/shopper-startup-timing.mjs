/** Local timing utility for a single benchmark attempt. No camera/pose inputs. */
export class ShopperStartupTiming {
  #marks = new Map();
  #last = -Infinity;
  mark(stage, now) {
    const stages = ['entry', 'camera-request', 'camera-settled', 'asset-ready', 'tracker-ready', 'first-usable'];
    if (!stages.includes(stage) || !Number.isFinite(now) || now < this.#last || this.#marks.has(stage)) throw new Error('Invalid, repeated or non-monotonic startup mark');
    if (stage !== 'entry' && !this.#marks.has('entry')) throw new Error('Entry must precede all marks');
    if (stage === 'camera-settled' && !this.#marks.has('camera-request')) throw new Error('Camera request missing');
    if (stage === 'first-usable' && (!this.#marks.has('camera-settled') || !this.#marks.has('tracker-ready') || !this.#marks.has('asset-ready'))) throw new Error('Usable presentation requires camera, asset and tracker readiness');
    this.#marks.set(stage, now); this.#last = now;
  }
  snapshot() {
    const elapsed = (from, to) => this.#marks.has(from) && this.#marks.has(to) ? this.#marks.get(to) - this.#marks.get(from) : null;
    const wallMs = elapsed('entry', 'first-usable');
    const cameraPendingMs = elapsed('camera-request', 'camera-settled');
    return {
      wallMs, cameraPendingMs,
      softwareControlledMs: wallMs !== null && cameraPendingMs !== null ? wallMs - cameraPendingMs : null,
      assetReadyMs: elapsed('entry', 'asset-ready'),
      trackerReadyMs: elapsed('entry', 'tracker-ready'),
      afterCameraMs: elapsed('camera-settled', 'first-usable'),
      complete: wallMs !== null && cameraPendingMs !== null,
    };
  }
  reset() { this.#marks.clear(); this.#last = -Infinity; }
}
