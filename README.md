# ❤️ Healthy

A local-first personal health record app for web, iOS, and Android. Keep your health history in one place, connect related records, and track treatments over time. Core features work without an account; Google Drive sync is optional.

[Open the web app](https://deividask.github.io/healthy/) · [Changelog](CHANGELOG.md) · [Privacy policy](public/privacy.html)

## Features

- **Profiles:** Keep separate health records for yourself and other people you care for.
- **Connected health history:** Record conditions, consultations, treatments, service requests, and lab results, with links between related records and a condition timeline.
- **Treatment tracking:** Define prescribed dosages, record the regimen you actually follow, track periods of use, and log doses in a daily journal. Group treatments into bundles to log them together.
- **Lab results:** Record lab results using a biomarker catalog with LOINC codes and UCUM units. Search by name or alias, convert supported units, compare values with reference ranges, and review trends over time.
- **Backup and restore:** Export local records across all profiles to a ZIP archive and restore them from a file.
- **Optional encrypted sync:** Sync selected profiles between devices through your own Google Drive, using a 24-word recovery phrase to unlock data on another device.

## Your data

Records are stored locally in SQLite through `expo-sqlite` on every platform, including the web. Clinical records use **HL7 FHIR R5** resources as their source of truth, with relational projections for queries. Lab measurements use **LOINC** and **UCUM** terminology.

Healthy has no application backend, advertising, analytics, or tracking. Health records leave your device only when you export them or enable sync.

Google Drive sync encrypts records on your device before uploading them to a hidden app-only folder. The vault uses AES-256-GCM encryption and a randomly generated key represented by your recovery phrase. Google can see file metadata, but cannot read the encrypted contents. Keep the phrase safe: it is required to recover synced data on a new device.

**Local storage and ZIP exports are not encrypted by Healthy.** Protect your device and backup files accordingly. Browser storage can be cleared, so keep a backup or enable sync before relying on it as your only copy.

See the [FHIR data model](docs/fhir-data-model.md) and [sync architecture](docs/adr/0001-local-first-sync.md) for details.

## Getting started

### Prerequisites

- Node.js **22.23.2**, as specified in `package.json`.
- pnpm **12.8.2**, as specified in the `packageManager` field.
- For native development: Android Studio and an emulator or connected Android device; or macOS, Xcode, and an iOS simulator or device.

### Install and run

```bash
git clone https://github.com/DeividasK/healthy.git
cd healthy
pnpm install
pnpm start
```

Press `w` in the Expo terminal to open the web app. You can also start directly in the browser:

```bash
pnpm expo start --web
```

For native development builds:

```bash
pnpm android    # Build and run on Android
pnpm ios        # Build and run on iOS (requires macOS)
```

The app includes native modules such as Google Sign-In, so use a development build for native development. Native `android/` and `ios/` projects are generated from the Expo configuration and are not maintained by hand.

### Optional Google Drive configuration

Local record keeping and file backups do not require Google credentials. To develop Google Drive sync, configure a Google OAuth client and set its web client ID in `.env.local`:

```dotenv
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Enable the Google Drive API and configure the OAuth consent screen for basic profile access and the `drive.appdata` scope. For web sign-in, register your development or deployed origin as an authorized JavaScript origin. Native sign-in also requires platform OAuth configuration matching the app's bundle/package identity and signing credentials; setting the web client ID alone is not sufficient.

This client ID is public configuration, not a client secret. Restart the dev server after changing it. Playwright supplies a synthetic client ID and mocks Drive requests for sync tests.

## Development

The app uses **Expo SDK 57**, **React Native 0.86**, **React 19**, **TypeScript**, **Expo Router**, and **NativeWind/Tailwind CSS**.

| Path                    | Purpose                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `app/`                  | Thin Expo Router route wrappers                             |
| `src/features/`         | Feature views, services, repositories, and collocated tests |
| `src/components/`       | Shared UI components                                        |
| `src/database/`         | SQLite setup and versioned migrations                       |
| `src/data/`             | Biomarker catalog                                           |
| `src/features/sync/`    | Encrypted sync engine and vault                             |
| `src/features/testing/` | Shared test fixtures, seed helpers, and mocks               |
| `public/`               | Static assets and privacy policy                            |
| `docs/`                 | Data model, architecture decisions, and release guides      |

### Checks and tests

```bash
pnpm tsc --noEmit           # Typecheck
pnpm expo lint             # Lint
pnpm format:check          # Check formatting
pnpm test:unit             # Pure-function tests
pnpm test:e2e              # Chromium functional tests
pnpm test:e2e:smoke        # Smoke tests
pnpm test:e2e:mobile       # Mobile Chrome functional tests
pnpm test:visual           # Visual captures for Chromatic
pnpm dlx expo-doctor       # Expo dependency and configuration diagnostics
```

Before running browser tests for the first time, install Chromium:

```bash
pnpm exec playwright install --with-deps chromium
```

Playwright starts the Expo web dev server on port **8089** automatically. Functional (`*.e2e.ts`), visual (`*.visual.ts`), and unit (`*.unit.ts`) tests live alongside their features. Run functional and visual suites sequentially because they share the server port and output directory. Publishing visual captures with `pnpm chromatic:publish` requires a Chromatic project token.

### Production web build

```bash
pnpm build:web     # Export to dist/
pnpm web:dist      # Build and serve locally on port 8081
pnpm build:pages   # Export for the /healthy GitHub Pages path
```

## Contributing and releases

Read [AGENTS.md](AGENTS.md) for project conventions. Keep routes thin, collocate feature code and tests, and preserve FHIR R5 resource fields when editing records.

User-facing app changes use changie fragments (`pnpm changelog:new`). The `main` branch is for development; pushes to `release` publish GitHub Releases, the web app, and Android builds to Play internal testing as drafts. See [Releasing Healthy](docs/releasing.md) and the [Android release guide](docs/android-release.md) for the full workflow.
