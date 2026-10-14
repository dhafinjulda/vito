# Public repository and package preparation

Updated 14 October 2026. Repository: https://github.com/dhafinjulda/vito.
Public repository created; initial source push in progress. No npm publication.

## Adopted license

Owner approved CPAL-1.0 and copyright Dhafin Julda Riyanto on 14 October.
LICENSE preserves the standard Sections 1–15 and completes Exhibits A/B.
NOTICE and 118 original source headers identify the project. The attribution
phrase is Vito (styled as vito); no additional copyright line, image or URL is
required on the camera UI. Attribution applies to Larger Works within Section
14's limits; Section 15 imposes source obligations on network deployment of
covered code. Third-party Apache-2.0/MIT/CC0 licenses remain intact.

SDK and generator include LICENSE/NOTICE, CPAL-1.0 metadata, repository directory,
homepage, author and issue URL. A shared build script copies current notices.
The SDK displays attribution locally during camera sessions, with no disable
option. Consumers own their source/DOM; the mark is not a security boundary.

Primary license: https://opensource.org/license/cpal-1.0
Standard text source: https://github.com/spdx/license-list-data/blob/main/text/CPAL-1.0.txt

## Repository / packaging

- SDK is the product; generator optional; Vanilla and Studio are references.
- CI frozen install/build/typecheck/test/pack workflow has no npm publishing job.
- ESM entries, declarations, worker assets, readmes and upstream licenses are
  whitelisted in packages. prepack builds fresh distribution.
- Contributions and security guidance are present. Private portrait, credentials,
  env files, node_modules, dist and local tarballs are excluded from Git.
- Secret-pattern scan found no matching credential/private-key patterns in
  reviewed source. Evidence images reviewed are synthetic renderings/Studio UI;
  no real-person image or landmark fixture is included.
- Previous 13 October pack/install/import checks passed; 14 October workspace
  build/typecheck and both CPAL tarball builds exited0. LICENSE/NOTICE and worker
  presence checked; public Three.js type dependencies included. Logs are
  docs/evidence/github-public-*.txt. Physical-device acceptance is
  still open. No new live-camera acceptance is claimed by Git publication.

## Remaining registry gate

Candidate names: @vito/sdk and @vito/asset-generator. Anonymous registry checks
on 13 October returned404 for both; this does not establish scope availability
or ownership. Owner does not yet own @vito. Create an available npm account/org
scope before deciding registry names; local @vto names are retained meanwhile.
Packages remain private:true to prevent accidental publication. Root stays
private. No npm publish without a later explicit request.

## Local package workflow

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm --dir packages/sdk pack --pack-destination ../../.benchmarks/packages
pnpm --dir packages/asset-generator pack --pack-destination ../../.benchmarks/packages
# In a separate consumer project:
pnpm add /absolute/path/vto-sdk-0.1.0.tgz /absolute/path/vto-asset-generator-0.1.0.tgz
```
