# Releasing Healthy

Merge a prepared release into `main` to deploy Healthy. GitHub Actions then
publishes its `v<version>` [GitHub Release](https://github.com/DeividasK/healthy/releases).
Other merges and pushing a tag alone publish nothing. Publishing a stable GitHub
Release by hand also deploys its tagged commit, which must already be on `main`.

GitHub Actions deploys that commit to GitHub Pages and advances the internal
`release` branch to the same commit. The branch's push webhook starts the existing
EAS Android build and submission pipeline. Never advance `release` by hand.

## Versions

Versions are dates: `YYYY.M.N`, the year and month of the release and a
counter that starts at 0 each month (`2026.10.0`, then `2026.10.1` for a
hotfix or a second release that month, then `2026.11.0`).
`pnpm release:prepare` works out the next one. There is no zero-padding, and
no day, because iOS allows at most three integers and the same day can see a
release and a hotfix; the full date is in `CHANGELOG.md` and on the GitHub
Release. The Android version code is separate and kept by EAS.

## Changelog

Changes are recorded as fragments with [changie](https://changie.dev), so
branches never edit the same file. Every branch that changes what users get
adds one:

```bash
pnpm changelog:new
# or, without prompts (agents):
pnpm changie new --interactive=false --kind Fixed --body "Journal days load faster."
```

This writes `.changes/unreleased/<Kind>-<timestamp>.yaml`. The kind is
`Added`, `Changed`, `Fixed`, `Removed` or `Security`; the body is one entry
written for the people using the app: what they can now do or what works
better, not how it was built (no issue numbers, file names or internal
terms). A branch with several changes adds one fragment per change.

CI fails a branch that changes the app (`app/`, `src/`, `assets/`, `public/`,
`plugins/`, `patches/`, `app.json`, ...) without a fragment, unless a commit
message on the branch has a `Changelog: none` trailer. Tests don't count as
app changes; refactors, tooling and dependency bumps users would not notice
need no fragment.

Preparing a release batches the fragments into `.changes/<version>.md`, the
GitHub Release's notes, and regenerates [`CHANGELOG.md`](../CHANGELOG.md)
from those files and `.changes/header.tpl.md`
([`.changie.yaml`](../.changie.yaml)). Never edit `CHANGELOG.md` directly;
edit `.changes/<version>.md` and run `pnpm changie merge`.

## Cutting a release

1. **Prepare it on a branch from `main`:**

   ```bash
   git fetch origin && git switch -c release-2026.10.0 origin/main
   pnpm release:prepare
   ```

   This works out the next version, writes `.changes/<version>.md` from the
   fragments and deletes them, regenerates `CHANGELOG.md`, and sets the
   version in `app.json` (Android's versionName) and `package.json`. Read the
   notes, polish the wording in `.changes/<version>.md` if needed (then
   `pnpm changie merge`), then commit
   (`Release v2026.10.0`), push and merge a pull request into `main`.

2. **Merging publishes it.** A push to `main` that changes `CHANGELOG.md` with
   a version that has no `v<version>` tag yet starts GitHub Actions
   **Release**, which creates the `v2026.10.0` tag and GitHub Release on the
   merged commit with the notes from `.changes/2026.10.0.md`.

   To release a commit by hand instead (for example after a failed run), open
   **Releases → Draft a new release**, create the tag `v2026.10.0` targeting
   the prepared commit on `main`, set the title to `v2026.10.0`, paste the
   notes from `.changes/2026.10.0.md` (without its first heading) and click
   **Publish release**. Drafts and prereleases do not deploy.

3. **Watch it go out.** GitHub Actions **Release**
   ([`release.yml`](../.github/workflows/release.yml)):
   - Checks that the tag matches both app versions, its commit is on `main`,
     its release notes exist, no fragments remain, and `release` can
     fast-forward to it. Older releases cannot move deployments backwards.
   - Advances the internal `release` branch, starting EAS Workflow
     **Android release**
     ([`android-release.yml`](../.eas/workflows/android-release.yml)) to build
     a production AAB and submit it to Play internal testing as a draft.
   - Builds the tagged web app and deploys it to GitHub Pages under `/app`,
     next to the landing page in `site/`
     ([`pages.yml`](../.github/workflows/pages.yml)). Landing page changes
     deploy on their own when merged, with the app rebuilt from the latest
     release.

   EAS also verifies that the release notes exist and no fragments remain.
   The GitHub Actions token advances the internal branch; no Expo token is
   needed in GitHub because EAS receives the branch's GitHub App webhook.

4. **Roll it out.** Play Console → **Test and release → Testing → Internal
   testing**: open the draft, paste the GitHub Release notes into "Release
   notes", then **Start rollout**.

## Hotfixes

Merge the fix into `main`, add its changelog fragment, and prepare the next
version as above. Merging it deploys it. Every released
commit stays on `main`, and the internal `release` branch always fast-forwards.

## One-time setup

- Keep the internal `release` branch: EAS listens for its push webhook.
- Settings → Environments → **production** → Deployment branches and tags:
  allow the `main` branch and release tags matching `v*` (or allow all
  branches and tags).
- Keep the Expo GitHub App connected so it receives pushes to `release`.
- The Release workflow needs `contents: write` to fast-forward `release`.
  If protecting that branch, allow GitHub Actions to advance it, and keep
  force pushes and deletion disabled.
