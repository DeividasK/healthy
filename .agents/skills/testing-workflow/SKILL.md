---
name: testing-workflow
description: >-
  Guidelines for authoring, updating, and running verification, linting, typechecks, visual tests (Chromatic), and E2E tests based on the nature of the change.
---

# Testing and Verification Workflow

Follow these rules when designing, updating, and executing test suites:

## Always Required

- **Typecheck**: `pnpm tsc --noEmit`
- **Lint**: `pnpm expo lint`
- **E2E & Console Health**: `pnpm test:e2e` (runs Playwright suite against the Expo web dev server with automatic console error and warning assertions)
- **Formatting**: `pnpm format:check` (or `pnpm format`)

## End-to-End Tests (`pnpm test:e2e`)

- **Mandatory for New Views & Flows**: You **MUST** write E2E tests for new views and user flows.
- **Collocation**: E2E tests for a view **MUST** be collocated next to the view inside `src/features/<feature>/` and named accordingly (e.g. `src/features/<feature>/<name>.e2e.ts`).
- **Succinct & Maintainable**: Tests **MUST** be updated if possible to keep testing succinct (avoid duplicate test cases when existing tests can be updated or expanded).
- **Plan Disclosure**: The implementation plan **MUST** describe new E2E tests that will be written.
- **When to Run**: Run when modifying user flows, interactions, or data persistence. Do not re-run for comment/type-only changes.
- **Targeted Test Execution (`--only-changed`)**: When re-running tests during development or iterating on fixes, utilize `pnpm exec playwright test --only-changed` (or `pnpm exec playwright test --only-changed=main`) to selectively execute only the tests affected by the changed files instead of the entire test suite. Specific test file paths can also be supplied directly (e.g. `pnpm playwright test src/features/<feature>/<name>.e2e.ts`).

## Keeping the E2E Suite Fast

The suite is CPU-bound and its tests pack evenly across workers, so its run time is roughly the CPU every test costs divided by the cores. Booting the app (parsing the dev bundle, starting SQLite, running migrations) costs about 3.5 CPU-seconds, more than most tests themselves, so the suite avoids booting.

- **Shared app**: each worker boots the app once. Before every test, the `page` fixture resets it in place (`resetForTest` in `src/features/testing/testBridge.ts`): it unmounts the app, clears the database, storage and sync vault, drops temporary triggers and remounts on `/profile/new`, as a fresh page would. Write tests that start from that state.
- **Seed, don't click, unless the UI is under test**: use `seedTestPatient`, `seedTestResources` and the other seed helpers. `seedTestPatient` on a fresh or reset app goes straight to Home.
- **Navigate in-app**: open screens with `openRoute(page, path)` and `reopenRoute(page)`, not `page.goto`/`page.reload`. A test that loads the page again discards the shared app, and the next test pays for a boot. Reload only when loading or restarting is the behaviour under test (migrations, persistence, sync on start), and say so in a comment.
- **Opt out only when needed**: `test.use({ freshApp: true })` or the `@fresh-app` tag give a page of its own. Use them only for tests about loading the app, other tabs, or legacy database schemas.
- **Fake clock**: the shared app already runs on Playwright's fake clock, with time flowing normally. `page.clock.install()`, `runFor` and `fastForward` (e.g. to skip a delete countdown) cost nothing. `setFixedTime`, `pauseAt` and `setSystemTime` discard the shared app; prefer them in visual tests.
- **Injected failures**: temporary triggers (`CREATE TEMP TRIGGER`) are dropped by the reset. Changing the schema discards the shared app.
- **Second devices**: `openSecondDevice` reuses a spare app per worker. Open its first screen with `openRoute` or `bootstrapApp`, not `goto`, and always `close()` it.
- **One journey per feature lifecycle**: extend the feature's add journey (add, view, edit, delete) with a `test.step` per stage instead of adding a test that seeds the same record again. Keep separate tests for distinct scenarios: keyboard, motion, failure rollback, FHIR preservation, links.
- **Test shared components once**: behaviour owned by a shared component or hook (`useOptionalFields`, `LinkedResourcesField`, the delete countdown) has one deep test. Form tests only check what the form maps to FHIR.
- **Wait for state, never for time**: wait for the element or value the next step depends on, e.g. a saved title, an "Up to date" label, or a mock having received the start-up request. No sleeps or timeout waits.
- **Load-sensitive patterns**: under full parallel load, screens briefly overlap during transitions (scope locators with `.filter({ visible: true })`), start-up work lands late (wait for it before counting requests), and short strings match random ciphertext (check for structured plaintext such as `'"family":"Doe"'`).
- **Measure before optimizing**: run `PLAYWRIGHT_JSON_OUTPUT_NAME=<file> pnpm test:e2e --reporter=json,dot` and sum test durations; the `Bootstrap app and SQLite` and `Reset app` steps show where boots and resets happen. Local runs use one worker per core; CI keeps 75%.

## Visual Tests (`pnpm test:visual`)

- **Mandatory for New Views**: You **MUST** write visual tests for new views.
- **Collocation**: Visual tests for a view **MUST** be collocated next to the view inside `src/features/<feature>/` and named accordingly (e.g. `src/features/<feature>/<name>.visual.ts`).
- **No Redundancy**: You **MUST NOT** write a new test if an existing visual test already covers the changes or new additions.
- **Plan Disclosure**: You **MUST** call out in implementation plans new visual tests that will be added, or the ones you expect to be affected if none will be added.
- **When to Run**: ONLY run if you update or alter the UI (screens, components, styles, themes). Do NOT re-run visual tests for non-visual changes (e.g. typing comments, types, config files that don't alter CSS).
- **No Assertions / Expectations**: Visual tests **MUST NOT** contain assertions (`expect(...)`). They should strictly navigate, seed or set up UI state, and call `takeSnapshot()`. All functional assertions belong in E2E tests (`*.e2e.ts`).

## Persistent Chrome and Animation Coverage

- Wait for destination-specific readiness after navigation, such as its loaded title or form field and active action. The shared header stays mounted and cannot establish that the destination finished loading.
- Capture settled UI states in visual tests using reduced motion, as configured for the `visual` project. Cover meaningful variants in existing collocated tests when possible.
- When a transition has a demonstrated continuity bug, use E2E coverage with normal motion: sample frames around the interaction and check observable invariants such as constant height, intermediate scale or opacity, and element continuity. Settled screenshots alone cannot detect flicker or abrupt removal; avoid transition snapshots unless explicitly requested.
- For disappearing overlays, wait for the outgoing menu to become hidden before interacting with or auditing the destination. Prefer role-scoped locators when an exiting menu repeats a screen's heading text.
- Run E2E and visual suites sequentially while they share the same dev-server port and output directory. Parallelize workers within a suite instead of starting competing suites.

## Version Control & Git Guidelines

- **NEVER run `git commit` or `git push` on the user's behalf.**
- Leave changes uncommitted in the working tree after verifying them. Let the user inspect and commit/push themselves.
