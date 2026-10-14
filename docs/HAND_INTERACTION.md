# Hand contact controller

Enable the checkbox before starting the camera. Pinch the rendered frame with
the thumb and index, middle, ring or little finger for about 80 ms, then move or
rotate the hand. Add a second contacting hand to manipulate the rigid model
together. To transfer, keep the receiving hand pinched and open the donor hand.
Bring it near the face/crown and open both grips to remount. Releasing elsewhere
returns to the prior mounted endpoint; gravity/collisions are not implemented.

```ts
const session = createVirtualTryOn({
  container,
  glassesUrl: '/glasses.glb',
  handInteraction: {}, // optional modelAssetPath for self-hosting
  onInteractionChange(state) {
    label.textContent = `${state.feedback} / grips: ${state.grippingHands} / nearby fingertips: ${state.contactFingers}`;
    // Reduced transient UI state only; do not save interaction histories.
  },
});
await session.start(); // explicit user camera action
session.setPlacement('head'); // button/keyboard alternative
session.setPlacement('face');
session.stop(); // releases tracks/worker and resets holding/mount state
```

## Grasp and movement

- Acquisition uses actual GLB ray intersections and a 1.4 cm bounding-volume proximity margin, covering bridge, rims and hinges. All ten fingertip locations are considered. Each thumb can pinch against any of its four fingers, with finite/articulated-chain guards, palm-normalized thresholds 0.45 to acquire and 0.70 to release, and an 80 ms dwell.
- The current object-to-hand contact offset is preserved at acquisition, including when the head moves during dwell. Palm orientation drives single-hand rotation; the selected thumb/finger midpoint drives translation. The object's scale stays fixed and its pose is independent of subsequent head movement. Re-seating another contacting finger rebases at the current pose rather than jumping.
- Initial depth is calibrated to the acquired contact. Relative depth follows palm-size change including normalized landmark Z; this is monocular approximation, not measured absolute hand distance. Camera FOV, landmark error and hand proportions still affect accuracy.
- Two transient palm identities use geometric/velocity assignment with handedness as a soft hint. Observation reorder, duplicate/flipped labels and visible crossing are handled; coincident palms or long total occlusion remain ambiguous. Remote replacements get a new identity. Large discontinuous jumps are rejected rather than stealing ownership.
- A second hand joins only after contact/dwell. Two contact anchors drive rigid midpoint translation and line rotation, with bounded palm twist and fixed model scale. Separation cannot stretch the frame; exact independent contact forces/friction are not reconstructed. Coincident/abruptly inverted pairs retain a valid prior pose. Continuous deliberate turns beyond 180° are supported.
- If either acquired owner releases or disappears, the remaining owner retains the object. Donor→receiver transitions rebase at the current pose/depth; a distant hand cannot take over. Both directions are supported. Complete hand loss still cancels after 450 ms. `grippingHands` is 0/1/2; `contactFingers` is the current 0–10 proximity count, not a measured force or persistent hand identity.
- A brief palm-induced face obstruction during acquisition is tolerated; after acquisition the object can stay held and follow the hand with the face absent. Missing active hand for 450 ms cancels holding. Stop, disposal, recovery and asset replacement cancel interaction. No held object is left frozen after hand loss.
- Release within 6 cm with an aligned orientation remounts to the nearer eligible target. Both accepted mounts and cancelled returns settle over 200 ms toward the current mount rather than teleporting. Crown proportions and tilt are generic approximations. Face loss clears mount targets; a held object can continue, but mounting requires face reacquisition.

## Occlusion

Each hand owns persistent joint/bone instances and a palm triangle mesh that
writes depth only. Both hands can cover the virtual frame, including contact-
gated first touch while still mounted. Every one of the 21 joints/five finger
chains is projected at that hand's contact depth and chosen contact landmark Z,
with approximately 1.8–4.2 mm finger radius. Calibrated projection respects fx.
Invalid/lost samples clear each slot; stop/disposal clears both. These volumes
are not pixel segmentation or calibrated hand surfaces and may over/under-mask.
Head masks remain independent. Temple fading/bending is disabled while carried;
hair segmentation is suspended while held/crown placed. Actual ears are not
segmented.

## Worker, latency and privacy

The existing camera and worker share one transferred ImageBitmap. Face results are posted immediately after face inference, before hand inference. Hand results are separate; `frame-done` closes the bitmap and releases backpressure. Hand inference cadence adapts from 50 to 250 ms based on runtime cost. A single slow pass cannot disable hands. After at least eight consecutive live calls above 100 ms, an EWMA above 100 ms and at least three seconds of pressure, hands become unavailable for that session. Adaptive cadence must first reach its 250 ms bound. This safety fallback also applies when quality adaptation is disabled; warmup is excluded. Local health reports `hand-budget` or `hand-failure`, and button placement remains available. A synchronous native call cannot be preempted; the fallback prevents continued optional overload rather than guaranteeing a frame rate.

Camera dimension changes clear the current grip, face prediction and hair mask. Results must match the latest submitted capture and its source geometry revision; old landscape results cannot be fitted onto a portrait preview. Recognition resumes with a fresh decoded frame using the same camera and worker.

Face results older than 1,000 ms are rejected; the mounted overlay expires after 750 ms without an accepted visible face result. These independent limits avoid permanent invisibility at 250 ms or flicker at 500 ms inference cadence while bounding frozen poses. Real no-face/invisible results still hide immediately. This tolerance does not establish real-time performance. Hand results retain a stricter 450 ms freshness limit. The 3-second whole-frame watchdog and bounded worker recovery remain.

M9 prepares requested graphs during explicit camera startup, before dispatching live frames. The face graph warms first, then opted-in hands and eligible hair. Warmup uses a discarded blank ImageBitmap at the tracking input dimensions. Optional creation is bounded to eight seconds; each warmup stage has a non-renewable 12-second SDK deadline. Failure after face initialization retries once with face-only CPU, preserving the acquired camera. No additional camera/audio request occurs. Hands become a controller only after a visible face mount and intentional contact/dwell; prewarming does not grab an invisible object.

The SDK and diagnostic load content-addressed worker assets; the SDK validates protocol 7. Input normally uses a transient maximum-width-640 canvas. Default adaptive quality permits 480 only with sufficient visible 2D eye support and restores 640 for small/profile/lost faces. Capture watchdog and decoded-frame-gated backup pump are independent of inference. Recovery uses CPU and suppresses optional graphs for the current session. Local health exposes bounded timing/counts and fallback reasons without face/hand coordinates.

Grip filters use elapsed time and clear stale/duplicate/reversed sessions. Default adaptive quality schedules absent-hand checks at 100 ms and active checks from 50 ms, adjusted for measured cost. Face inference is always first; synchronous hand work cannot be preempted. Startup compilation precedes live frames rather than suspending an already-visible fit. Face freshness and 750 ms silence expiry remain unchanged. Live hand accuracy/depth/occlusion and device budgets still require qualification; a standard controller is not calibrated physical grasping.

All frames, face/hand landmarks, held poses and interaction state stay transient on device. Stop clears mask sample data and holding state. The hand model is remote/version-pinned and not vendored or included in the face CacheStorage allowlist; offline hand availability is not guaranteed. Verify exact redistribution terms before bundling/self-hosting.

References: [MediaPipe Hand Landmarker Web guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js), [official model example](https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/tasks/hand-landmarker.ts). No upstream gesture-controller code copied.

## Evidence and limits

`docs/evidence/free-hand-grip-gpu.json` records real GLB/contact/controller/WebGL checks with synthetic inputs: both demo frames at 30/100 cm acquired without jumping, moved laterally, rotated, stayed held through face loss, and retained some visible frame while finger masks removed pixels. Controller/session/worker tests cover contact, movement, identity, release, face/hand loss, cadence and one-bitmap completion. The emitted worker initialized both actual models and processed a blank frame using separate face/hand/completion messages; no camera was requested. MediaPipe emitted four native warnings and one INFO line at console error level; no uncaught page exception.

This is stronger interaction code with synthetic acceptance, not verified real-hand product acceptance. Live grasp reliability, anatomical finger/hair masking, absolute depth, collision/physics, mobile latency and asset-specific crown fit remain open. The example reports hand seen/not seen, pinch acquisition and holding state so a real-device failure is observable.

The visibility regression uses `scripts/browser-visibility-regression.js` through Playwright CLI at the Vanilla dev server. It feeds synthetic canonical results through a real local worker and canvas video stream into the built public SDK, then checks actual WebGL alpha pixels. Evidence is in `docs/evidence/glasses-visibility-regression.json`; no physical camera is used.

`docs/evidence/tracking-continuity-regression.json` additionally records sustained actual-worker results/completions, deliberately induced CPU recovery, and qualitative live-camera checks. With the user facing the camera, the hand-enabled session maintained face tracking, manual reconnect restored tracking, and Stop returned to idle. No camera images or coordinate/pose histories were recorded. This accepts the continuity repair only; intentional real-hand grasp/rotation/occlusion still needs user/device review.
