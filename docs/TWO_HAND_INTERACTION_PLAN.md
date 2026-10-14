# M11 — Ten-finger contact and two-hand manipulation

13 October 2026. The browser SDK owns interaction. Vanilla remains a public-API
example. Hands stay opt-in and share the local camera/worker; no recordings,
landmark persistence, uploads or npm publication.

## Decisions and acceptance

| Feature | Implementation decision | Acceptance |
| --- | --- | --- |
| Ten fingers | Read all 21 joints per hand; thumb can grasp against index, middle, ring or little finger. Contacts use the actual current GLB. | Each finger pair on both hands can acquire; open waving/remote pinches cannot |
| Identity | Match up to two transient palm descriptors, rather than relying on observation order or handedness labels alone. | Reorder, duplicate labels, crossing, loss, stale and reset fixtures |
| Two-hand hold | Second hand joins after real contact and dwell. Rigid translation/rotation follows both anchors; model scale is fixed. | Join without jump, translate/rotate, separate without stretching, degenerate pair guard |
| Handoff | An already contacting receiving hand takes over when the donor releases or disappears; rebase the grip at the current object pose. | Bidirectional transfer without teleport, finger reseating, one-hand loss and distant hand rejection |
| Finger occlusion | Two bounded depth-only hand meshes, anchored at the selected contact depth/Z, reset independently. | Both hands hide appropriate frame pixels, malformed input/loss/cleanup, no geometry growth |
| Consumer | Public state reports grip/contact counts and handoff; Vanilla explains gestures and retains mount/reset controls. | Built public SDK interaction sequence and lifecycle; no automatic camera start |

This is a visual rigid-object controller from monocular landmarks. Absolute hand
depth, anatomical surface segmentation, collision forces, lens/frame flex and
temple folding are not measured by this camera pipeline. Physical realism and
cross-device gesture accuracy require final user/device review.

## Progress

- Code implementation complete. Face visibility, capture backpressure,
  optional budgets and stop/recovery behavior from M10 are retained.

### Implementation

- `sampleHandGrips` reads all 21 joints and offers four thumb/finger contacts per
  hand. Finite, finger-chain and palm-centre gates reject malformed/palm-only
  grabs. Thresholds .45/.70, 80 ms dwell and actual GLB ray/proximity remain.
- `HandIdentity` retains only two numeric palm descriptors/velocities for 450 ms;
  bounded assignment follows geometric motion, with labels a soft hint. It
  handles observation reorder and visible crossings without storing landmarks.
- A second contact joins after dwell, preserving the current object transform.
  `TwoHandGrip` uses rigid contact midpoint/line motion, fixed scale and bounded
  palm twist. Continuous turns beyond 180° work; collapsed/abruptly inverted
  pairs retain the prior valid pose. No stretching or force reconstruction.
- Releasing/loss of either acquired owner rebases the survivor at the current
  pose/depth. The receiving hand cannot steal a remote object. Finger reseating
  also rebases. Both hands can keep carrying through face loss; all-hands loss,
  stop, recovery, resize, asset change and disposal clear ownership.
- Two persistent hand occluders each contain 21 joints, 20 bone instances and
  palm triangles. Contact landmark Z/fx anchor the geometry; both slots clear
  independently. Contact-gated mounted first-touch also occludes. No hand
  segmentation or calibrated anatomical surface is claimed.
- Public callback adds `grippingHands: 0|1|2`, `contactFingers: 0..10` and
  `held-two-hands`/`handoff` feedback. No coordinates or persistent IDs. Vanilla
  explains eight thumb/finger combinations, joining and transferring; it uses
  the public SDK and still requires explicit camera start and hands opt-in.

### Actual checks

- `pnpm build`, four-workspace `pnpm typecheck`, `pnpm test`: exit 0.
  **233 SDK + 6 generator = 239 tests**. Three GLBs and offline policy/build
  verification pass; Three.js chunks >500 kB remain warnings.
- New suites: 10 hand identity, 10 grip math, 16 occluder and 15 two-hand
  controller cases, plus existing lifecycle/fitting/worker regressions.
- Frozen SDK `26ff1f6c86d8`, 125.58 kB / 36.16 kB gzip; worker remains
  `face-worker-CZkKssiX.js`/protocol 7, 179.52 kB. No new recognition model or
  camera stream. [Manifest](evidence/smoothness-two-hand-final-manifest.json).
- [Public SDK/GLB/GPU](evidence/two-hand-public.json): all eight thumb/finger
  combinations on both labels acquire and remain visible. Join and donor→
  receiver handoff preserve position/rotation (jump 0). Two-hand movement
  translates/rotates without changing scale. Both hand masks reduce visible
  pixels while preserving part of the frame; held object survives face loss,
  receiver continues moving, remount returns a visible model, camera acquisition
  1, restarts 0, error callbacks 0, track/element cleanup passes. Inputs are
  synthetic; prototype observation reads only synthetic scene transforms.
- [Visibility](evidence/two-hand-visibility.json): **64/64** cases across four
  motion modes, hands opt-in/off, delayed results/loss/reacquisition/expiry/stop.
  Synthetic recognition plus real GLB/video/WebGL, no physical camera.
- [Native](evidence/two-hand-native.json): actual Face/Hand/Hair graphs prewarm;
  **200 frame completions, 59 hand packets, zero restarts, one camera call**.
  Portrait/landscape transitions each complete 26/27 frames without restart;
  preview/mirror/track/element cleanup and zero HTTP writes/body pass. Startup
  19,472.2 ms in this run; no faster-startup or recognized-hand FPS claim. Blank
  video has no actual hand/face acquisition and deliberately skips hair masks.
- [Vanilla](evidence/two-hand-example.json) and
  [instructions](evidence/two-hand-instructions.json): default/calibration/
  recreate checks pass; two-hand/receiver instructions visible, no active camera.

### Failed runs and limits

- Initial legacy release fixture teleported a palm by .3 normalized x in one
  sample. New geometric identity intentionally rejects this discontinuity.
  The release fixture now supplies three intermediate motion samples while
  preserving its far-release/settle assertions. Separate tests retain remote-
  takeover rejection. This does not prove arbitrary fast real-hand motion.
- [Initial public failure](evidence/two-hand-public-initial-failure.json): the
  observation hook patched `WebGLRenderer.prototype.render`, while render is
  instance-owned. Switched to Object3D world-update observation; initial
  visibility/contact requirements remain.
- [Return-readback failure](evidence/two-hand-public-return-failure.json): all
  grasp/join/motion/occlusion/handoff checks passed, but remount pixels were read
  immediately after tracking status, before the next GPU draw. The same test
  now waits for a visible rendered return; it retains the >0 pixel assertion.
- Sandbox pnpm initially failed filesystem realpath; local auto-reviewed
  escalated verification succeeded. No npm publication or personal recordings.
- Monocular absolute depth, overlapping/occluded identity, skin-surface masking,
  friction/collisions/gravity, articulated temples, live hand accuracy and mobile
  performance remain unqualified. Final user/device camera review is required.
