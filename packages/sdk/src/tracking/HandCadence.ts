/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
/** Hands share the synchronous face worker. Cadence limits average occupancy;
 * sustained high latency also needs a safety fallback because a native hand
 * call cannot be preempted once it starts. Blank warmup is never observed. */
export class HandCadence {
  constructor(private readonly adaptive = true) {}
  private cost = 0;
  private lastSample: number | null = null;
  private lastDuration=0;
  private lastEvaluation = -Infinity;
  private active = false;
  private budget = 100;
  private pressureAt: number | null = null;
  private pressureSamples = 0;
  private exceeded = false;

  setActive(active: boolean): void { this.active = active; }
  get intervalMs(): number {
    return Math.max(this.active ? 50 : 100, this.adaptive ? this.budget : 0);
  }
  get budgetExceeded(): boolean { return this.exceeded; }

  /** Returns true only after repeated live calls exceed the face-priority
   * budget. This remains a runtime safety limit when adaptation is disabled. */
  observe(durationMs: number, timestampMs: number): boolean {
    if (this.exceeded) return true;
    if (!Number.isFinite(durationMs) || durationMs < 0 || !Number.isFinite(timestampMs)
      || this.lastSample !== null && timestampMs <= this.lastSample) return false;
    const gap = this.lastSample === null ? null : timestampMs - this.lastSample;
    // A suspended/background stream must not carry its pressure dwell forward.
    // A slow native call itself occupies the worker. Do not misclassify that
    // occupancy as a suspended stream and continually reset its safety dwell.
    if (gap !== null && gap > Math.max(1000,this.lastDuration+500)) {
      this.pressureAt = null; this.pressureSamples = 0;
      this.lastEvaluation = -Infinity; this.lastSample = null;
    }
    const alpha = this.lastSample === null ? 1 : 1 - Math.exp(-(timestampMs - this.lastSample) / 500);
    this.cost += (durationMs - this.cost) * alpha;
    this.lastSample = timestampMs;
    this.lastDuration=durationMs;
    if (this.adaptive && timestampMs - this.lastEvaluation >= 2000) {
      // Target one-third occupancy where the bounded interval allows it.
      this.budget = Math.max(50, Math.min(250, this.cost * 3));
      this.lastEvaluation = timestampMs;
    }
    if (durationMs > 100 && this.cost > 100 && (!this.adaptive || this.budget >= 250)) {
      this.pressureAt ??= timestampMs;
      this.pressureSamples++;
      this.exceeded = this.pressureSamples >= 8 && timestampMs - this.pressureAt >= 3000;
    } else {
      this.pressureAt = null; this.pressureSamples = 0;
    }
    return this.exceeded;
  }
}
