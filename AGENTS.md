# Repository guidance

## Product direction
- The JavaScript/TypeScript browser SDK is the product. `examples/vanilla` is a reference integration, not the product shell.
- Keep the SDK framework-agnostic. Core SDK code must not import React or another UI framework.
- Camera frames and face-derived data stay on-device. Never add uploads, remote telemetry, or persistence of frames, landmarks, poses, or snapshots.
- Asset generation is an optional SDK module. Asset Studio is an example application built on that optional module.
- Do not publish packages to npm unless the user explicitly requests it.

## Engineering
- Use TypeScript, MediaPipe Face Landmarker in a Web Worker, Three.js, and GLB assets for the browser glasses path.
- Keep public APIs small and typed; document lifecycle and cleanup requirements.
- Keep asset recipes/interpreters in the optional generator. Core only reads a bounded, versioned GLB fit contract; explicit asset overrides win.
- Description/LLM output is a design proposal. Validate it before generating, preserve explicitly requested values, and never promote estimated dimensions to measured/supplier provenance.
- Generated GLBs must preserve semantic lens/temple names, shared baked metre coordinates, connected geometry and a bridge pivot. Dispose generated preview/export resources and caller-owned blob URLs.
- Treat device/browser compatibility, camera permissions, model downloads, and WebGL as runtime capabilities. Do not claim real-device acceptance from desktop builds.
- Update `IMPLEMENTATION_PLAN.md` whenever decisions, milestone status, acceptance evidence, or blockers change.
- No tests are required by default, but when a task explicitly requests verification, run relevant checks and record actual results in the plan.

## Privacy and assets
- Camera access begins only after an explicit `start()` call and always requests `audio: false`.
- Stop every acquired media track on stop, failure, page hide, and disposal.
- Hand interaction is opt-in and shares the existing local camera/worker. Hand landmarks and gesture histories also stay transient and on-device.
- Do not commit real-person test frames or landmarks. Synthetic fixtures are preferred.
- Track licenses for bundled models and GLB assets before distribution.
