# Releasing Healthy

Healthy has two branches with different jobs:

| Branch    | What it is for                                | What it publishes                                                    |
| --------- | --------------------------------------------- | -------------------------------------------------------------------- |
| `main`    | development; every pull request merges here   | nothing                                                              |
| `release` | what users get; it only moves when we release | GitHub Release, GitHub Pages, Play **internal testing** (as a draft) |

`release` only ever fast-forwards to a commit already on `main`, except for
hotfixes (below), so it never drifts from `main`.

## Changelog

Every branch that changes what users get adds a fragment to
[`.changes/`](../.changes/README.md). CI (`pnpm changelog:check`) fails a
branch that changes the app (`app/`, `src/`, `assets/`, `public/`,
`plugins/`, `patches/`, `app.json`, ...) without one, unless a commit message
on the branch has a `Changelog: none` trailer. Tests don't count as app
changes.

Preparing a release compiles the fragments into a new section of
[`CHANGELOG.md`](../CHANGELOG.md), grouped as Added, Changed, Fixed, Removed
and Security, and deletes them. That section becomes the GitHub Release's
notes and Play's "What's new".

## Cutting a release

1. **Prepare it on a branch from `main`:**

   ```bash
   git fetch origin && git switch -c release-v1.1.0 origin/main
   pnpm release:prepare minor   # or patch / major
   ```

   This bumps `version` in `app.json` (Android's versionName) and
   `package.json`, adds the `CHANGELOG.md` section and deletes the fragments.
   Read the section, polish the wording if needed, then commit
   (`Release v1.1.0`), push and merge a pull request into `main`.

2. **Ship it** by fast-forwarding `release` to that commit on `main`:

   ```bash
   git fetch origin && git push origin origin/main:release
   ```

   The push is refused if `release` is not behind `main`; see hotfixes.

3. **Watch it go out.** The push to `release` runs:
   - GitHub Actions **Release** ([`release.yml`](../.github/workflows/release.yml)):
     checks the release notes, creates the `v1.1.0` GitHub Release with the
     `CHANGELOG.md` section, then deploys the web app to GitHub Pages.
   - EAS Workflow **Android release**
     ([`android-release.yml`](../.eas/workflows/android-release.yml)): checks
     the release notes, builds a production AAB and submits it to Play
     internal testing as a draft.

   Both refuse a push whose version has no `CHANGELOG.md` section, or that
   still has fragments in `.changes/` (`pnpm release:verify`).

4. **Roll it out.** Play Console → **Test and release → Testing → Internal
   testing**: open the draft, paste the GitHub Release notes into "Release
   notes", then **Start rollout**.

`pnpm release:notes [version]` prints a version's section (default: the
version in `app.json`).

## Hotfixes

A fix that can't wait for what's on `main`:

1. Branch from `release`, fix it and add a fragment as usual.
2. Run `pnpm release:prepare patch` on that branch, commit, and merge a pull
   request into `release`.
3. Merge `release` back into `main` with a pull request using **Create a
   merge commit** (never squash), so `main` contains `release` again and the
   next release can fast-forward. Resolve any `CHANGELOG.md` or version
   conflicts in favour of `release`.

## One-time setup

- Create the `release` branch from `main`:
  `git push origin origin/main:release`.
- Settings → Environments → **production** → Deployment branches: allow
  `release` (it previously deployed from `main`).
- Settings → General → Pull Requests: keep **Allow merge commits** enabled for
  hotfix merge-backs.
- Optionally protect `release` (no force pushes, no deletion) but allow the
  maintainers who ship to push to it.
