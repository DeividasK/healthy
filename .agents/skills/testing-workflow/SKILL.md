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

## Visual Tests (`pnpm test:visual`)

- **Mandatory for New Views**: You **MUST** write visual tests for new views.
- **Collocation**: Visual tests for a view **MUST** be collocated next to the view inside `src/features/<feature>/` and named accordingly (e.g. `src/features/<feature>/<name>.visual.ts`).
- **No Redundancy**: You **MUST NOT** write a new test if an existing visual test already covers the changes or new additions.
- **Plan Disclosure**: You **MUST** call out in implementation plans new visual tests that will be added, or the ones you expect to be affected if none will be added.
- **When to Run**: ONLY run if you update or alter the UI (screens, components, styles, themes). Do NOT re-run visual tests for non-visual changes (e.g. typing comments, types, config files that don't alter CSS).
- **No Assertions / Expectations**: Visual tests **MUST NOT** contain assertions (`expect(...)`). They should strictly navigate, seed or set up UI state, and call `takeSnapshot()`. All functional assertions belong in E2E tests (`*.e2e.ts`).

## Version Control & Git Guidelines

- **NEVER run `git commit` or `git push` on the user's behalf.**
- Leave changes uncommitted in the working tree after verifying them. Let the user inspect and commit/push themselves.
