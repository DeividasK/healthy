# Releasing Healthy

Healthy has two branches with different jobs:

| Branch    | What it is for                                | What it publishes                                                    |
| --------- | --------------------------------------------- | -------------------------------------------------------------------- |
| `main`    | development; every pull request merges here   | nothing                                                              |
| `release` | what users get; it only moves when we release | GitHub Release, GitHub Pages, Play **internal testing** (as a draft) |

`release` only ever fast-forwards to a commit already on `main`, except for
hotfixes (below), so it never drifts from `main`.

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

2. **Ship it** by fast-forwarding `release` to that commit on `main`:

   ```bash
   git fetch origin && git push origin origin/main:release
   ```

   The push is refused if `release` is not behind `main`; see hotfixes.

3. **Watch it go out.** The push to `release` runs:
   - GitHub Actions **Release** ([`release.yml`](../.github/workflows/release.yml)):
     checks the release notes, creates the `v2026.10.0` GitHub Release from
     `.changes/2026.10.0.md`, then deploys the web app to GitHub Pages.
   - EAS Workflow **Android release**
     ([`android-release.yml`](../.eas/workflows/android-release.yml)): checks
     the release notes, builds a production AAB and submits it to Play
     internal testing as a draft.

   Both refuse a push whose version (in `app.json`) has no
   `.changes/<version>.md`, or that still has fragments in
   `.changes/unreleased/`.

4. **Roll it out.** Play Console → **Test and release → Testing → Internal
   testing**: open the draft, paste the GitHub Release notes into "Release
   notes", then **Start rollout**.

## Hotfixes

A fix that can't wait for what's on `main`:

1. Branch from `release`, fix it and add a fragment as usual.
2. Run `pnpm release:prepare` on that branch, commit, and merge a pull
   request into `release`.
3. Merge `release` back into `main` with a pull request using **Create a
   merge commit** (never squash), so `main` contains `release` again and the
   next release can fast-forward. Resolve any `CHANGELOG.md` or version
   conflicts in favour of `release`, then run `pnpm changie merge`.

## One-time setup

- Create the `release` branch from `main`:
  `git push origin origin/main:release`.
- Settings → Environments → **production** → Deployment branches: allow
  `release` (it previously deployed from `main`).
- Settings → General → Pull Requests: keep **Allow merge commits** enabled for
  hotfix merge-backs.
- Optionally protect `release` (no force pushes, no deletion) but allow the
  maintainers who ship to push to it.
