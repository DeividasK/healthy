# ❤️ Healthy

A privacy-first, 100% local-first cross-platform (Web, iOS, Android) application designed to help individuals record, track, and understand their health over time.

## Design Principles

**Your Data 🛡️:** Encrypted and stored strictly on-device, structured with international clinical standards (HL7 FHIR, LOINC, UCUM) for lifetime portability, with optional zero-knowledge remote backup.

**Your AI 🤖:** Run unlimited insights with on-device models or the AI subscriptions you already pay for, keeping your health intelligence free and accessible.

**Your Control 🔐:** You decide what to share - selectively export or redact specific panels and metrics instead of exposing entire histories.

---

## 🎯 Project Core Specifications & Requirements

- **Platforms**: Web, iOS, Android using **Expo SDK 57 (React Native 0.86, React 19, TypeScript)**.
- **Package Manager**: **`pnpm`** (configured with `.npmrc` -> `node-linker=hoisted` for Metro compatibility).
- **Privacy & Storage**: 100% local-first via `@react-native-async-storage/async-storage` (SQLite/AsyncStorage on mobile, IndexedDB/localStorage on web). Medical data never leaves the user's device.
- **Biomarker Catalog & Standards**:
  - Catalog of **223 clinical blood biomarkers** curated from official **LOINC** (Logical Observation Identifiers Names and Codes) and **UCUM** international clinical chemistry standards.
  - **Smart Autocomplete**: Allows users to search by clinical name (e.g. *Hemoglobin A1c*) or common abbreviations / aliases (*"a1c"*, *"wbc"*, *"tsh"*, *"ldl"*, *"crp"*).
  - Selecting a biomarker auto-populates category, default unit, and physiological reference intervals (Min/Max).
  - **Dual-Unit Support**: Seamless toggle and mathematical conversion between **SI units** (`mmol/L`, `µmol/L`) and **Conventional US units** (`mg/dL`, `g/dL`), with synchronized reference ranges.
  - **Dynamic Live Flagging**: Real-time visual status indicators (🟢 Normal, 🔵 Low, 🔴 High, 🚨 Critical) calculated live as values are entered.
- **Design System**: Fully responsive mobile-first UI with automatic **Dark Mode** and **Light Mode** support.

---

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
