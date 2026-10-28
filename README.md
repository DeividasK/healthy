# ❤️ Healthy

[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/DeividasK/healthy/badge)](https://scorecard.dev/viewer/?uri=github.com/DeividasK/healthy)

A privacy-first, 100% local-first cross-platform (Web, iOS, Android) application designed to help individuals record, track, and understand their health over time.

## Design Principles

**Your Data 🛡️:** Encrypted and stored strictly on-device, structured with international clinical standards (HL7 FHIR, LOINC, UCUM) for lifetime portability, with optional zero-knowledge remote backup.

**Your AI 🤖:** Run unlimited insights with on-device models or the AI subscriptions you already pay for, keeping your health intelligence free and accessible.

**Your Control 🔐:** You decide what to share - selectively export or redact specific panels and metrics instead of exposing entire histories.

---

## 🎯 Project Core Specifications & Requirements

- **Platforms**: Web, iOS, Android using **Expo SDK 57 (React Native 0.86, React 19, TypeScript)**.
- **Package Manager**: **`pnpm`** (configured with `.npmrc` -> `node-linker=hoisted` for Metro compatibility).
- **Privacy & Storage**: 100% local-first (SQLite on native iOS/Android, IndexedDB on web). Medical data never leaves the user's device.
- **Biomarker Catalog & Standards**:
  - Catalog of **223 clinical blood biomarkers** curated from official **LOINC** (Logical Observation Identifiers Names and Codes) and **UCUM** international clinical chemistry standards.
  - **31,000+ more LOINC lab tests**: every active numeric LOINC lab test outside the catalog can be recorded with its LOINC name and units (no reference ranges). The list loads only when a search or AI import needs it. `pnpm loinc:update` refreshes it from the LOINC download API, checking for a new release at most once a day and verifying its MD5 hash. This material contains content from LOINC (http://loinc.org); see [`src/data/loinc/LOINC_short_license.txt`](src/data/loinc/LOINC_short_license.txt).
  - **Smart Autocomplete**: Allows users to search by clinical name (e.g. _Hemoglobin A1c_) or common abbreviations / aliases (_"a1c"_, _"wbc"_, _"tsh"_, _"ldl"_, _"crp"_).
  - Selecting a biomarker auto-populates category, default unit, and physiological reference intervals (Min/Max).
  - **Dual-Unit Support**: Seamless toggle and mathematical conversion between **SI units** (`mmol/L`, `µmol/L`) and **Conventional US units** (`mg/dL`, `g/dL`), with synchronized reference ranges.
  - **Dynamic Live Flagging**: Live Normal, Low and High status as values are entered, shown with the word and a range line so it never relies on colour alone.
- **Design System**: Fully responsive mobile-first UI styled with NativeWind and Tailwind CSS.

## 🚀 Running the App

Run locally using `pnpm`:

```bash
pnpm start          # Start Expo dev server
pnpm run web        # Run in browser
pnpm run ios        # Run on iOS Simulator
pnpm run android    # Run on Android Emulator
```

### Quality & Diagnostics

```bash
npx tsc --noEmit    # TypeScript typecheck (0 errors)
npx expo-doctor     # Expo dependency and SDK validation (21/21 checks passed)
```
