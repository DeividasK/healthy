This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Node Version Management

Node version is managed via `fnm` and automatically loaded across shells via `~/.zshenv` to match `package.json` (`devEngines.runtime.version`, e.g. `22.23.2`).

## Commands

This project uses `pnpm`. Use `pnpm` and `pnpm dlx` for package execution:

```bash
pnpm expo install <package>  # ALWAYS use instead of pnpm add — resolves SDK-compatible versions
pnpm expo start              # start the dev server
pnpm expo lint               # lint
pnpm tsc --noEmit            # typecheck
pnpm format:check            # check formatting
pnpm test:e2e                # E2E functional tests
pnpm test:visual             # visual regression tests (Chromatic)
pnpm dlx expo-doctor         # diagnose dependency and config issues
pnpm expo install --fix      # fix incompatible package versions
```

### Verification Guidelines

- **Always run**: `pnpm tsc --noEmit`, `pnpm expo lint`, and `pnpm test:web-dev` before declaring any task done. Never declare completion when `pnpm web` or dev server is broken.
- **Visual Tests (`pnpm test:visual`)**:
  - You **MUST** write visual tests for new views.
  - Visual tests for that view **MUST** be collocated next to the view inside `src/features/<feature>/` and named accordingly (e.g. `src/features/<feature>/<view-name>.visual.ts`).
  - You **MUST NOT** write a new test if an existing visual test covers the changes/new additions.
  - You **MUST** call out new visual tests that will be added or ones that you expect to be affected if none will be added.
  - ONLY run if you update or alter the UI (screens, components, styles, themes). Do NOT re-run visual tests for non-visual changes (e.g. typing comments, types, config files that don't alter CSS).
- **E2E Tests (`pnpm test:e2e`)**:
  - You **MUST** write E2E tests for new views and user flows.
  - E2E tests for that view **MUST** be collocated next to the view inside `src/features/<feature>/` and named accordingly (e.g. `src/features/<feature>/<view-name>.e2e.ts`).
  - Tests **MUST** be updated if possible to keep testing succinct.
  - Implementation plans **MUST** describe new E2E tests that will be written.
  - Run when modifying user flows, interactions, or data persistence. Do not re-run for comment/type-only changes.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `app/` — keep files in `app/` strictly as thin wrappers that import and render views from `src/features/`.
- Views, view-specific subcomponents, and their tests live in `src/features/<feature>/`. Do NOT put non-route code, subcomponents, or tests inside `app/` (Expo Router scans `app/` for routes, and Metro will crawl test dependencies like Playwright if placed there).
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `pnpm dlx eas-cli <command>`; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `pnpm expo run:ios|android` locally, or `pnpm dlx eas-cli build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
- **Component Reuse**: Always prioritize reusing existing UI components (e.g. pickers, buttons, pills, modals) before creating new ones. In implementation plans, explicitly audit and suggest existing components to be reused beforehand. Never copy-paste styles across files: if styles are only used in one place, they can be written in that place, but when they need to be reused, extract a separate reusable component.
- **Component & Test Collocation**: Views, view-specific components (e.g. `ConditionForm`, `LabResultForm`), and their E2E and visual tests **MUST** be collocated in feature folders inside `src/features/<feature>/` (e.g. `src/features/conditions/`). ONLY components that are genuinely shared across multiple features live in `src/components/`. The `app/` directory is strictly reserved for thin route definitions.
- **Form Field Attributes**: All form fields (`<TextInput>`, `<input>`, `<select>`, `<textarea>`) **MUST** have an `id` (or `nativeID`) and `name` attribute to prevent browser/accessibility warnings and ensure proper autofill and test targeting.
- **New Component Confirmation**: Always explicitly list and confirm in the plan if any new components need to be created, justifying why an existing component cannot be reused.
- **Database Migrations & Breaking Changes**: All database changes must have migrations, and migrations must be highlighted in the plan. You MUST explicitly highlight any breaking changes (or explicitly confirm that changes are non-breaking/additive).
