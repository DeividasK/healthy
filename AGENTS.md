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

- **Always run**: `pnpm tsc --noEmit`, `pnpm expo lint`, and `pnpm test:e2e` before declaring any task done. Never declare completion when `pnpm web` or dev server is broken.
- **Visual Tests (`pnpm test:visual`)**:
  - You **MUST** write visual tests for new views.
  - Visual tests for that view **MUST** be collocated next to the view inside `src/features/<feature>/` and named accordingly (e.g. `src/features/<feature>/<view-name>.visual.ts`).
  - You **MUST NOT** write a new test if an existing visual test covers the changes/new additions.
  - You **MUST** call out new visual tests that will be added or ones that you expect to be affected if none will be added.
  - ONLY run if you update or alter the UI (screens, components, styles, themes). Do NOT re-run visual tests for non-visual changes (e.g. typing comments, types, config files that don't alter CSS).
  - Visual tests **MUST NOT** contain assertions (`expect(...)`). They should strictly navigate, prepare UI state, and call `takeSnapshot()`. All functional assertions belong in E2E tests (`*.e2e.ts`).
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
- **Native Dropdowns by Default**: Use native dropdown/select controls for fields that choose from a defined set of values: browser `<select>` on web and platform-native selection controls on iOS/Android. Use the same control type for equivalent fields. Do not replace these with custom modals, autocomplete or free-text inputs unless the user explicitly requests and documents that exception. Reuse existing native picker components where applicable.
- **Related Resources on View Pages**: When a view page shows resources related to the one being viewed (e.g. associated conditions, originating or linked consultations, treatments), render each group with the shared `ResourceSection` and `ResourceRow` components (`src/components/ResourceSection.tsx`) (the homepage lists conditions, consultations and treatments the same way, without cards): an icon and heading, then full-width rows with the resource title, a meta line (date, practitioner, status) and a chevron that opens the resource. Do not use cards, label/value rows or bespoke list styles for related resources. Leave out a related-resource section entirely when it has no resources: no empty headings and no "none yet" placeholder text (`ResourceSection` renders nothing without rows). Use each resource type's standard icon (`FolderPlus` for conditions, `Stethoscope` for consultations, `Pill` for treatments).
- **Resource Links in Edit Forms**: Every resource's edit form MUST let the user establish and remove links to each related resource type, using `useLinkFields` and `LinkedResourcesField` (`src/components/`): one `+` menu option and one field per related type, with a native select on each link when it can be recorded in more than one way (e.g. a condition as a consultation's reason for visit or diagnosis). View pages never link or unlink: their `+` only starts creation forms for new related resources, and docks have no separate link button. When you add a resource type, add its link fields to the edit form of every resource it relates to, and theirs to its own.
- **Resource Meta Lines**: A resource's row (`ResourceRow`) and its view-page heading (`ResourceViewLayout` `meta`) MUST show the same meta line, built by one shared function per resource type (e.g. `getConditionMeta`, `getConsultationMeta`, `getTreatmentMeta`) and rendered with `ResourceMetaLine`. Every meta item has its concept icon, and items are always ordered: date, status, specialist (if any), then resource-specific fields (e.g. service type, intent), then association counts on rows. Fields shown in the meta line are not repeated as label/value rows on the view page.
- **Relevant Icons**: Always give a relevant `lucide-react-native` icon to `+` menu options, related-resource section headings and metadata items, and reuse the same icon for the same concept everywhere. Never fall back to a generic icon (e.g. `FileText`) when a relevant one exists. Current mapping: conditions `FolderPlus`, consultations `Stethoscope`, treatments `Pill`, specialists and requesters `User`, service providers (organizations) `Hospital`, dosage `Tablets`, reasons `MessageSquareText`, notes `FileText`, dates `Calendar`, times `Clock`, status `CircleDot`, treatment intent `Target`, terminology codes `Hash`, severity and service type `Activity`, body site `MapPin`, verification `BadgeCheck`, category `Tag`, recovery phrase `KeyRound`. Extend this mapping when you add a concept.
- **Multi-line Text on View Pages**: Render every multi-line text field (notes, dosage instructions and any other text-area value) on a view page with the shared `ResourceTextSection` component (`src/components/ResourceTextSection.tsx`): a heading followed by plain body text. Never wrap such text in cards, borders or input-like boxes, and never give one text-area field a different treatment from the others.
- **Sync Change Capture**: Encrypted sync replicates clinical tables through SQLite triggers and a change log (`docs/adr/0001-local-first-sync.md`). Repositories never call sync code. When you add a FHIR resource table, add its capture triggers in a migration and register the type in `SYNC_RESOURCE_TYPES` and `RESOURCE_REGISTRY` (`src/features/sync/`); deletions then sync automatically. Never write clinical rows with capture suppressed outside the sync engine.
- **Form Field Attributes**: All form fields (`<TextInput>`, `<input>`, `<select>`, `<textarea>`) **MUST** have an `id` (or `nativeID`) and `name` attribute to prevent browser/accessibility warnings and ensure proper autofill and test targeting.
- **New Component Confirmation**: Always explicitly list and confirm in the plan if any new components need to be created, justifying why an existing component cannot be reused.
- **Database Migrations & Breaking Changes**: All database changes must have migrations, and migrations must be highlighted in the plan. You MUST explicitly highlight any breaking changes (or explicitly confirm that changes are non-breaking/additive).
- **Strict UI Scope**: Never add UI elements (badges, buttons, indicators, icons, labels, tags, etc.) that are not explicitly mentioned in the user request or approved implementation plan. Adhere strictly to the requested UI specifications and do not invent unsolicited visual elements.
- **Git Staging & File Management**: Never stage (`git add`), unstage (`git restore --staged`, `git reset`), commit (`git commit`), or push (`git push`) any git files or changes in the branch unless explicitly asked by the user. Leave all modified files unstaged for the user to review.

## FHIR database standard

All database structures MUST follow HL7 FHIR R5 (v5.0.0). Persist clinical records as standard FHIR R5 resources using `fhir/r5` types. Relational columns, indexes and relationship tables are projections of those resources, not independent clinical schemas. Use standard FHIR elements, cardinalities, choice types, terminology bindings and references; never introduce custom clinical properties into resource JSON. Preserve valid fields that an editing form does not expose. App settings, sync metadata and storage timestamps are application infrastructure, not clinical FHIR resources.

## Local implementation plans

- Store implementation plans only in the local `.agents/plans/` directory. Treat them as local working artifacts.
- Never stage, commit, force-add, or publish `.agents/plans/` files. The directory must remain ignored by Git.
- When implementation and its required verification are complete, delete the implemented plan from `.agents/plans/`. Retain unfinished plans and update any local plan index to remove stale links.
- Put durable architecture, migration and recovery documentation outside `.agents/plans/`; those documents may be committed under the normal Git authorization rules.
