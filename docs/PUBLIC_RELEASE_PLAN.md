# Public repository and package preparation

Updated 14 October 2026. Repository: https://github.com/dhafinjulda/vito.
Public repository and source push confirmed. Initial main commit
`76684a19ec7cd064694535ed9e3ae6894742c210`; corrected source
`b37e102ee382c301a78d206ba4f15022a6e5de54` passed complete Ubuntu CI.
No npm publication.

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

## Remote CI evidence

[Run 38526776394](https://github.com/dhafinjulda/vito/actions/runs/38526776394)
completed successfully: frozen pnpm install, build, typecheck, tests, both pack
commands and artifact upload. Clean Ubuntu revealed missing root Three.js and
direct example types that the local environment had masked; both are corrected.
Git push initially lacked workflow OAuth scope; the connected GitHub integration
created CI, and its commit was merged before pushing source. No permissions
were disabled or CI stages skipped to obtain this successful result.

## npm scope / publication

Owner reported `npm whoami` as **dhafin-julda** on 14 October. Selected account
scope: **@dhafin-julda**, using @dhafin-julda/sdk and
@dhafin-julda/asset-generator. The Vito brand and repository URL are unchanged.
Package names, example imports/workspace dependencies, filters and current
readmes use this scope; historical evidence retains its original package names.
Both packages now have private:false and public publishConfig so they can be
published when requested. Root/examples remain private. No actual npm publish
has been performed; interactive authentication/2FA and registry version checks
still apply to a real release. Previous @vito candidates were not adopted.

## Local package workflow

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm --dir packages/sdk pack --pack-destination ../../.benchmarks/packages
pnpm --dir packages/asset-generator pack --pack-destination ../../.benchmarks/packages
# In a separate consumer project:
pnpm add /absolute/path/dhafin-julda-sdk-0.1.0.tgz /absolute/path/dhafin-julda-asset-generator-0.1.0.tgz
```

From the repository root, inspect the npm candidates without publication:

```sh
npm publish ./packages/sdk --access public --dry-run
npm publish ./packages/asset-generator --access public --dry-run
```
