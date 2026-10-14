# Final camera and device acceptance

## Latest local continuity check — 12 October 2026

The user's localhost camera reached sustained tracking with hand control disabled, then with the hand runtime active after the user confirmed facing the camera. Manual **Sambungkan ulang** returned to tracking and counters kept increasing; Stop returned to idle. Only transient status/runtime counters were inspected. No camera image, coordinate, pose or gesture history was recorded. This checks continuity and lifecycle, not visual alignment, real grasp, anatomy/occlusion or mobile performance. The earlier one-frame disappearance was reproduced as incompatible cached development worker code; hashed runtime delivery and protocol validation correct that delivery path.

This checklist is for the final hands-on qualification after code and synthetic checks. Record only device/browser versions and aggregate pass/fail notes. Do not save screenshots, recordings, landmarks, poses, or face-derived measurements.

## Current evidence

The 13 October optimization build passed 120 unit tests, public-SDK synthetic visibility checks in direct/interpolated/predicted modes, three-asset GPU coherence checks and native-worker continuity/recovery. A final frozen-build 10-minute native face/hand blank-stream soak passed with 13,555 completions, no restart and stopped tracks/terminated worker/removed elements at disposal. This is continuity/resource-counter evidence, not recognition, heap or real-device acceptance. Keep the earlier live continuity result separate from this build's acceptance.

## Optimization A/B on each device

Start with `/` (direct presentation, adaptive quality off). Compare `/?presentation=predicted` and `/?presentation=interpolated` separately before combining either with `&adaptiveQuality=1`. Restart the session for each configuration. Check bridge attachment and mask/contact alignment during slow movement, fast turns, stops, reversal, pitch and distance changes; compare stationary jitter and visible lag as well as smoothness. Interpolation adds up to 50 ms delay and failed the analytic alignment gate. Prediction has a 30 ms media-mapped horizon and synthetic gates; real stepped video may behave differently. Default promotion requires a passing live A/B, not synthetic percentages.

For adaptive quality, note changes to reported input width and DPR, then test small faces farther away, thin rims/lenses, crop/mirror and reacquisition. For hands, distinguish absence/idle packets from active grasp response. Watch cold model initialization separately: the shared worker can briefly block on native compilation; the bounded initialization deadline prevents a spurious 3-second recovery but does not guarantee uninterrupted face results. Record only local runtime durations/counts, configuration and qualitative pass/fail; no face-derived histories, imagery or coordinates.

| Target | Status | Evidence / limit |
|---|---|---|
| Desktop Chromium | Partial pass | Local camera acquisition, tracking, switching assets, and stop cleanup passed in an earlier smoke. The latest production chunk-split and GPU smoke used no camera. Full profile/distance acceptance is still pending. |
| iOS Safari | Not tested | Physical device required. |
| Android Chrome device 1 | Not tested | Physical device required. |
| Android Chrome device 2 | Not tested | Physical device required. |

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
9. With the Network panel filtered to Fetch/XHR/WS and media, allow only expected same-origin app/model assets and the pinned MediaPipe WASM/model downloads (or their same-origin equivalents). Confirm no request body, URL, or beacon contains image data or face-derived values. Camera frames must remain in the local video → worker path.
10. Repeat in bright, dim, and backlit rooms. Note tracking loss, jitter, visible mask leaks, frame drops, thermal slowdown, WebGL errors, and whether stopping releases the camera promptly.

## Record only aggregate results

For hand grasp, enable **Aktifkan kontrol tangan lokal** before start. Confirm glasses first appear on the face while hand availability is still loading; then wait for hand-ready feedback. First check buttons, then pinch at the bridge/rim/hinge briefly, carry sideways and rotate your wrist, approach/retreat, and bring the frame near face/crown before opening the pinch to remount. Move the head separately while holding; the object must follow the hand. Briefly obscure the face with the palm: the held object should remain; missing the active hand for over 450 ms must cancel safely. Check ordinary waving/remote pinches do not grab and the second hand does not take over silently. Verify the hand-seen/near-frame/held feedback and approximate fingers covering the frame without excessive masking. Repeat during stop/restart, dim light, slow inference and on each device. Hand model downloads are permitted runtime traffic; frames/hand landmarks remain local. Hand depth and finger masks are approximate; hair segmentation and physical collisions remain absent. Record only qualitative pass/fail notes, never images, raw hand landmarks or gesture/pose histories.

For each device, note browser/OS version, approximate device class, camera resolution reported by the browser, each step's pass/fail, and short qualitative observations. Do not record the displayed yaw/distance history or any face-derived data. A device is not accepted from build/test evidence alone; a fail or untested row remains open in `IMPLEMENTATION_PLAN.md`.
