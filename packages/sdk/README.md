# VTO browser SDK

Framework-independent browser glasses try-on. Camera/face/hand processing stays on-device. TypeScript types and a self-contained MediaPipe worker are included.

## Install a local release candidate

```sh
pnpm add /absolute/path/vto-sdk-0.1.0.tgz
```

The package is not yet published to npm. `@vto` is the current workspace scope;
the final registry scope must be owned before publication. Original code is
licensed CPAL-1.0; see LICENSE and NOTICE included in this package.

```ts
import { createVirtualTryOn } from '@vto/sdk';
const tryOn = createVirtualTryOn({ container, glassesUrl: '/glasses.glb' });
// Give container an explicit size. Start from a user action:
await tryOn.start();
await tryOn.setGlasses('/another.glb');
tryOn.stop();
tryOn.dispose();
```

Use HTTPS or localhost, WebGL2, camera permissions, Workers and ImageBitmap.
Models/WASM download from pinned URLs unless self-hosted via options.
Generated GLBs embed fit; ordinary models need their own calibration. Keep
blob URLs alive until replacement/disposal and allow blob: in CSP connect-src.
`start()` requests audio:false. Stop/dispose releases camera tracks. Optional
hand interaction requires `handInteraction:{}`. Physical SKU/device accuracy
requires qualification. License notices are in dist/THIRD_PARTY_NOTICES.md.

The SDK displays a small Vito wordmark at the bottom-right of its camera host
after local video starts. It remains during tracker loading/search/tracking,
disappears when the camera stops/fails, and is removed by dispose(). It is
noninteractive, does not mirror with video and downloads no branding assets.
No branding disable option is provided. CPAL-1.0 Exhibit B defines attribution;
covered modifications remain subject to CPAL source/network obligations.
