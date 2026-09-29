# healthy — Cross-Platform Blood Lab Results Tracker

A privacy-first, 100% local-first cross-platform (Web, iOS, Android) application designed to help individuals record, track, and understand their blood lab results over time.

---

## 🎯 Project Core Specifications & Requirements

- **Platforms**: Web, iOS, Android using **Expo SDK 57 (React Native 0.86, React 19, TypeScript)**.
- **Package Manager**: **`pnpm`** (configured with `.npmrc` -> `node-linker=hoisted` for Metro compatibility).
- **Architecture**: **Zero third-party state libraries** (no Zustand, Redux, or MobX). Powered purely by native React primitives (`createContext`, `useReducer`, custom hooks) and local storage.
- **Privacy & Storage**: 100% local-first via `@react-native-async-storage/async-storage` (SQLite/AsyncStorage on mobile, IndexedDB/localStorage on web). Medical data never leaves the user's device.
- **Entry Method**: **Manual entry only** (no OCR, no pre-configured panels).
- **Biomarker Catalog & Standards**:
  - Catalog of **223 clinical blood biomarkers** curated from official **LOINC** (Logical Observation Identifiers Names and Codes) and **UCUM** international clinical chemistry standards.
  - **Smart Autocomplete**: Allows users to search by clinical name (e.g. *Hemoglobin A1c*) or common abbreviations / aliases (*"a1c"*, *"wbc"*, *"tsh"*, *"ldl"*, *"crp"*).
  - Selecting a biomarker auto-populates category, default unit, and physiological reference intervals (Min/Max).
  - **Dual-Unit Support**: Seamless toggle and mathematical conversion between **SI units** (`mmol/L`, `µmol/L`) and **Conventional US units** (`mg/dL`, `g/dL`), with synchronized reference ranges.
  - **Dynamic Live Flagging**: Real-time visual status indicators (🟢 Normal, 🔵 Low, 🔴 High, 🚨 Critical) calculated live as values are entered.
- **Design System**: Fully responsive mobile-first UI with automatic **Dark Mode** and **Light Mode** support.

---

## 🔬 Biomarker Categories (223 Markers Total)

1. **CBC & Hematology** (WBC, RBC, Hemoglobin, Hematocrit, Platelets, MCV, MCH, MCHC, RDW, Differential, Reticulocytes, ESR, etc.)
2. **Lipids & Cardiovascular** (Total Cholesterol, LDL, HDL, Triglycerides, Non-HDL, ApoB, ApoA1, Lp(a), hs-CRP, Homocysteine, etc.)
3. **Metabolic & Renal** (Fasting Glucose, HbA1c, Fasting Insulin, HOMA-IR, eGFR, Creatinine, BUN, BUN/Creatinine Ratio, Uric Acid, Cystatin C, etc.)
4. **Liver & Enzymes** (ALT, AST, ALP, GGT, Total Bilirubin, Direct Bilirubin, Albumin, Total Protein, LDH, etc.)
5. **Thyroid & Endocrine** (TSH, Free T4, Free T3, Total T4, Total T3, Reverse T3, Anti-TPO, Anti-Tg, PTH, etc.)
6. **Hormones & Reproductive** (Total Testosterone, Free Testosterone, SHBG, Estradiol, Progesterone, DHEA-S, Cortisol, LH, FSH, Prolactin, etc.)
7. **Vitamins & Nutrition** (Vitamin D 25-OH, Vitamin B12, Folate, Vitamin A, Vitamin C, Vitamin E, Vitamin B6, etc.)
8. **Iron & Anemia** (Serum Iron, Ferritin, TIBC, Transferrin Saturation, UIBC, Soluble Transferrin Receptor, Hepcidin, etc.)
9. **Inflammation & Immunology** (hs-CRP, ESR, Ferritin, Fibrinogen, ANA, Rheumatoid Factor, Immunoglobulins IgA/IgG/IgM, etc.)
10. **Electrolytes & Minerals** (Sodium, Potassium, Chloride, Bicarbonate / CO2, Calcium, Ionized Calcium, Magnesium, Phosphorus, etc.)
11. **Coagulation** (PT, INR, aPTT, D-Dimer, Fibrinogen, Antithrombin III, etc.)
12. **Trace Elements & Heavy Metals** (Zinc, Copper, Selenium, Lead, Mercury, Arsenic, Cadmium, Cobalt, Chromium, etc.)

---

## 🏗️ Architecture & Completed Implementation

1. **Scaffolded Expo Project**:
   - Initialized at `/Users/deividas/Documents/github/healthy` using Expo SDK 57 + TypeScript + Expo Router.
   - Configured `.npmrc` with `node-linker=hoisted` for seamless pnpm module resolution with Metro bundler.
   - Installed SDK-verified dependencies:
     - `@react-native-async-storage/async-storage` (v2.2.0, SDK 57 compatible)
     - `lucide-react-native`
     - `react-native-svg` (v15.15.4, peer dependency for Lucide)
2. **Type System ([`src/types/health.ts`](file:///Users/deividas/Documents/github/healthy/src/types/health.ts))**:
   - Strongly-typed models for `LabReport`, `BiomarkerResult`, `BiomarkerDefinition`, `BiomarkerCategory`, `BiomarkerStatus`, and `ReferenceInterval`.
3. **Unit & Status Utilities ([`src/utils/units.ts`](file:///Users/deividas/Documents/github/healthy/src/utils/units.ts))**:
   - `calculateBiomarkerStatus`: Real-time evaluation of low, normal, high, or critical thresholds.
   - `formatValue`: Clean numerical formatting.
   - `getStatusBadgeConfig`: Color, background, and label styling for status badges.
4. **Biomarker Catalog ([`src/data/biomarker-catalog.ts`](file:///Users/deividas/Documents/github/healthy/src/data/biomarker-catalog.ts))**:
   - 223 LOINC-mapped blood biomarkers with clinical categories, reference intervals, SI and Conventional units, and fuzzy search helpers (`searchBiomarkers`, `findBiomarkerByKey`).
5. **Local Storage Service ([`src/services/storage.ts`](file:///Users/deividas/Documents/github/healthy/src/services/storage.ts))**:
   - 100% offline, on-device persistence layer with `@react-native-async-storage/async-storage` (`getLabReports`, `saveLabReport`, `deleteLabReport`, `getLabReportById`).
6. **Native React State ([`src/context/LabReportsContext.tsx`](file:///Users/deividas/Documents/github/healthy/src/context/LabReportsContext.tsx))**:
   - Zero external state management libraries; powered by `createContext` and `useReducer`. Provides `reports`, `saveReport`, `deleteReport`, date sorting, and real-time aggregate statistics.
7. **Interactive Components**:
   - [`src/components/BiomarkerAutocomplete.tsx`](file:///Users/deividas/Documents/github/healthy/src/components/BiomarkerAutocomplete.tsx): Search dropdown across 223 biomarkers with LOINC & category tags.
   - [`src/components/BiomarkerRowInput.tsx`](file:///Users/deividas/Documents/github/healthy/src/components/BiomarkerRowInput.tsx): Editable biomarker row with dynamic live status flagging (Normal, Low, High) and Conventional ⇄ SI unit conversion.
8. **Screens & Routing (Expo Router)**:
   - [`app/(tabs)/index.tsx`](file:///Users/deividas/Documents/github/healthy/app/(tabs)/index.tsx): Home dashboard with hero "Add Blood Lab Results" action, summary statistics, and history cards.
   - [`app/(tabs)/two.tsx`](file:///Users/deividas/Documents/github/healthy/app/(tabs)/two.tsx): Biomarker catalog & reference directory with category filtering, search, and personal test history badges.
   - [`app/add-report.tsx`](file:///Users/deividas/Documents/github/healthy/app/add-report.tsx): Modal for adding and editing lab reports with live validation and summaries.
   - [`app/report/[id].tsx`](file:///Users/deividas/Documents/github/healthy/app/report/[id].tsx): Full report detail viewer with in-depth breakdown, editing, and deletion.
   - [`app/modal.tsx`](file:///Users/deividas/Documents/github/healthy/app/modal.tsx): About modal explaining on-device privacy, LOINC clinical standards, and medical disclaimers.

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

---

## 📁 Repository Directory Structure

```
healthy/
├── .npmrc                              # node-linker=hoisted (pnpm Metro compatibility)
├── app/
│   ├── _layout.tsx                     # Root AppProvider, theme, & modal stack
│   ├── (tabs)/
│   │   ├── _layout.tsx                 # Tabs layout (Reports, Biomarkers)
│   │   ├── index.tsx                   # Home Dashboard (Hero CTA, Recent Labs)
│   │   └── two.tsx                     # Biomarkers Directory & History
│   ├── add-report.tsx                  # Manual entry modal with autocomplete
│   ├── modal.tsx                       # About, privacy, & medical disclaimer modal
│   └── report/
│       └── [id].tsx                    # Detailed report view with edit/delete
├── src/
│   ├── types/
│   │   └── health.ts                   # LabReport, BiomarkerResult, BiomarkerDefinition
│   ├── utils/
│   │   └── units.ts                    # calculateBiomarkerStatus, formatting, badges
│   ├── data/
│   │   └── biomarker-catalog.ts        # The 223 LOINC biomarker dataset
│   ├── services/
│   │   └── storage.ts                  # AsyncStorage local persistence wrapper
│   ├── context/
│   │   └── LabReportsContext.tsx       # Native React Context + useReducer
│   └── components/
│       ├── BiomarkerAutocomplete.tsx   # Searchable dropdown for 220+ markers
│       └── BiomarkerRowInput.tsx       # Editable biomarker row with dynamic flagging
├── package.json
├── tsconfig.json
└── README.md
```
