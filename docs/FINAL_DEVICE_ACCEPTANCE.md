# Final camera and device acceptance

Checklist reconciled 14 October 2026 (Asia/Jakarta). Qualification remains open;
this documentation update adds no device results. Run it against a frozen current
build and record SDK/worker/asset identity, options and exact browser/OS versions.
The [shopper roadmap](SHOPPER_EXPERIENCE_ROADMAP.md) defines next priorities and
proposed timing targets; [first iteration tickets](SHOPPER_FIRST_SPRINT.md)
define how to establish the baseline.

## Latest local continuity check — 12 October 2026

The user's localhost camera reached sustained tracking with hand control disabled, then with the hand runtime active after the user confirmed facing the camera. Manual **Sambungkan ulang** returned to tracking and counters kept increasing; Stop returned to idle. Only transient status/runtime counters were inspected. No camera image, coordinate, pose or gesture history was recorded. This checks continuity and lifecycle, not visual alignment, real grasp, anatomy/occlusion or mobile performance. The earlier one-frame disappearance was reproduced as incompatible cached development worker code; hashed runtime delivery and protocol validation correct that delivery path.

This checklist is for the final hands-on qualification after code and synthetic checks. Record only device/browser versions and aggregate pass/fail notes. Do not save screenshots, recordings, landmarks, poses, or face-derived measurements.

## Current evidence

The earlier M7 optimization build recorded 120 unit tests and a frozen ten-minute
native face/hand blank-stream soak with 13,555 completions and no restart. Later
M9–M12 records add default policies, continuity, two-hand interaction and generated
asset integration; M12 records 370 tests (262 SDK + 108 generator) plus synthetic
browser/GPU/Studio checks. See [implementation evidence](../IMPLEMENTATION_PLAN.md)
and its linked feature plans for exact builds and scopes. These are historical
results, not checks rerun for this checklist update. Blank streams and synthetic
fixtures do not accept recognized-face visual fit, real grasp, mobile thermal
behavior or a physical retail SKU. Keep the earlier live continuity result
separate from the current candidate's acceptance.

## Optimization A/B on each device

Start with `/`: current public defaults are auto presentation, adaptive quality
on, camera/lens compositing on and guarded automatic hair for eligible devices and
semantic assets; hands require opt-in. Record the resolved feature/fallback state.
Use `/?presentation=direct&adaptiveQuality=0` for an explicit direct/non-adaptive
comparison, and `/?presentation=direct&adaptiveQuality=0&compositing=0&hairOcclusion=0`
for a lower-cost comparison. Compare predicted and interpolated modes separately,
then isolate optional feature costs; restart for each configuration. Check bridge
attachment and mask/contact alignment during slow movement, fast turns, stops,
reversal, pitch and distance changes. Compare jitter, lag and unwanted disappearance
as well as smoothness. Interpolation can add up to 50 ms and failed an earlier
analytic alignment gate; prediction is bounded to 30 ms and guarded by auto mode.
Implemented defaults still require recognized-face/device qualification.

For adaptive quality, note input width and DPR, then test small faces farther away,
thin rims/lenses, crop/mirror and reacquisition. For hands, distinguish idle packets
from active grasp response. Split permission waiting, asset/runtime preparation,
native compilation, tracker readiness and first usable overlay; cold/warm and
optional-model costs are separate scenarios. Current graphs prewarm before live
dispatch; this can increase startup time. Bounded initialization does not guarantee
fast first fit or qualify shared-worker stalls on a device. Record only permitted
local runtime duration/count aggregates, configuration and qualitative pass/fail;
no face-derived histories, imagery or coordinates.

| Target | Status | Evidence / limit |
|---|---|---|
| Desktop Chromium | Earlier partial pass; current candidate open | Local camera acquisition, tracking, switching assets and stop passed in an earlier smoke. Current defaults, quantified runtime and full visual/profile/distance acceptance still require a frozen-candidate run. |
| iOS Safari | Not tested | Physical device required. |
| Midrange Android Chrome | Not tested | Physical device required; record exact model/browser/OS. |
| Higher-end Android Chrome | Not tested | Physical device required; record exact model/browser/OS. |

## Per-device steps

Run from the deployed HTTPS URL or localhost. Keep the browser Network panel open for the privacy check.

1. Load the page without pressing **Mulai kamera**. Confirm the browser has not requested camera permission and the privacy note is visible.
2. Deny camera permission once, confirm the page reports a recoverable error and no camera stream remains attached. Reset permission, then grant access and start again.
3. Confirm the video is live, microphone permission is never requested, and the status changes from searching to tracking when the face is centered in ordinary indoor light.
4. Look straight ahead, then turn left and right about 45° and toward profile (about 80°) for a few seconds. Also gradually look up to inspect the underside, look down to inspect the top, and combine a moderate turn with upward tilt. Check that pitch/yaw update, valid tracked tilt does not abruptly hide the glasses, the bridge remains aligned, the far temple/rear hook goes behind the head, and the near temple remains visible. Return to center and check reacquisition without persistent drift. Synthetic pitch acceptance does not establish live recognition at extreme angles.
5. Move slowly closer and farther away. Confirm the displayed estimated distance changes in the expected direction and the projected glasses get smaller as the face moves away. The estimate is model-based, not a calibrated ruler measurement.
6. Check the readout while centered, turning, and moving: `Jarak`, `Yaw`, and `Pitch` should update only while a valid face fit is available and hide when tracking is lost.
7. Switch each bundled frame during tracking, adjust size/height/depth, and reset. Confirm controls recover after an asset load and a failed/slow load does not freeze stop or page navigation.
8. Press stop and start again. Confirm the overlay clears, status returns to idle, the camera indicator turns off, and the second start works. Also test browser background/foreground and page navigation; hidden/pagehide must stop the stream.
9. Inspect **All** Network requests, including script/image/Other/beacon categories,
   and WebSocket messages transiently against an explicit app/GLB/runtime URL and
   origin allowlist. Permit only expected application assets and pinned model/WASM
   downloads or their configured self-hosted equivalents. Confirm no unexpected
   telemetry and no image or face-derived data in bodies, URLs, messages or
   beacons. Camera frames remain in the local video → worker path. Do not export
   live HAR/network traces that could preserve personal data.
10. Repeat in bright, dim, and backlit rooms. Note tracking loss, jitter, visible mask leaks, frame drops, thermal slowdown, WebGL errors, and whether stopping releases the camera promptly.
11. Continue a recognized-face session for ten minutes, make 20 asset swaps and
    repeat 10 start/stop cycles. Check permitted runtime aggregates and bounded
    resource counts separately from qualitative fit/thermal observations.
12. Complete start/stop/select/retry with hands disabled, keyboard and available
    screen-reader controls. Check touch, focus, 200% zoom and portrait/landscape.
    When M18 comparison exists, include live two-choice selection without snapshots.

## Record only aggregate results

For hand grasp, enable **Aktifkan kontrol tangan lokal** before start. Measure the
additional graph-prewarm/first-fit cost, then wait for tracking and hand-ready
feedback. First check buttons, then pinch at the bridge/rim/hinge, carry sideways
and rotate, approach/retreat, and release near face/crown to remount. Move the head
separately while holding. Brief palm-over-face occlusion should preserve the held
object; active-hand loss beyond 450 ms cancels safely. Check remote pinches/waving
do not grab. Test every thumb/finger pair, a second contacting hand, rigid two-hand
movement and explicit no-jump transfer by keeping the receiving grip and opening
the donor. Verify feedback and both approximate masks without excessive hiding.
Repeat stop/restart, dim light and slow inference. Models are permitted resource
downloads; frames/landmarks stay local. Hand depth, hair masks and anatomical
head/ear geometry remain approximations; physical collisions are not implemented.
Record qualitative pass/fail only, never imagery, raw landmarks or gesture/pose
histories.

For each device, note browser/OS version, approximate device class, camera resolution reported by the browser, each step's pass/fail, and short qualitative observations. Do not record the displayed yaw/distance history or any face-derived data. A device is not accepted from build/test evidence alone; a fail or untested row remains open in `IMPLEMENTATION_PLAN.md`.
