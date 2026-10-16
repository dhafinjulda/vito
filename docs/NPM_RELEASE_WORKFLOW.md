# Automated npm releases

The GitHub Actions workflow `.github/workflows/publish-npm.yml` publishes one
package when a matching **stable GitHub Release is published**. Ordinary source
pushes and pull requests run CI only. No version is changed automatically.

| Package | Tag format | Current published version checked 16 October 2026 |
|---|---|---|
| vito-sdk | `vito-sdk-vX.Y.Z` | 0.1.1 |
| vito-asset-generator | `vito-asset-generator-vX.Y.Z` | 0.1.0 |

## One-time npm configuration

For each package, an npm maintainer must add a GitHub Actions trusted publisher
under package Settings → Trusted Publisher:

- Organization/user: `dhafinjulda`
- Repository: `vito`
- Workflow filename: `publish-npm.yml`
- Environment: leave empty (workflow declares no environment)
- Allow direct `npm publish` if the settings form offers allowed actions.

Settings: [vito-sdk](https://www.npmjs.com/package/vito-sdk/access),
[vito-asset-generator](https://www.npmjs.com/package/vito-asset-generator/access).
No repository NPM_TOKEN secret is required. The workflow requests a short-lived
OIDC token using id-token: write, uses a compatible npm 11 on Node 24 and publishes
with provenance. Repository metadata must continue to match dhafinjulda/vito.
See [npm trusted-publishing documentation](https://docs.npmjs.com/trusted-publishers/).

The local npm session returned E401 during setup, so npm account settings could
not be inspected or changed by this task. A pushed workflow alone does not prove
that the trusted-publisher relationship exists.

## Release a new version

1. Bump the chosen package's package.json to a new stable version, update release
   notes and lockfile if required, then merge passing changes. Example next SDK
   tag: `vito-sdk-v0.2.0` only after its version is actually 0.2.0.
2. Publish a GitHub Release with that exact tag pointing to the reviewed commit.
   SDK and generator releases are independent; no combined repository vX.Y.Z tag.
3. Actions validates tag/name/version/repository and checks the registry. Existing
   versions or network/registry failures block publication. It runs install,
   workspace build/typecheck/tests, then packs the built selected package.
4. The exact uploaded tarball is published with public access and provenance.
   Verify the workflow, npm version and package contents before announcing it.

Prerelease tags are intentionally rejected rather than updating npm latest with
an unintended prerelease. A registry version cannot be overwritten; fix a failed
publication with an unused version when necessary. Rerunning a job after a
successful publish will fail the existing-version guard. No GitHub release/tag or
npm publish is created merely by committing this workflow.
