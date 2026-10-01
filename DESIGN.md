---
name: Healthy
colors:
  surface: '#f9faf6'
  surface-dim: '#dadad7'
  surface-bright: '#f9faf6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f0'
  surface-container: '#eeeeeb'
  surface-container-high: '#e8e8e5'
  surface-container-highest: '#e2e3df'
  on-surface: '#1a1c1a'
  on-surface-variant: '#414844'
  inverse-surface: '#2f312f'
  inverse-on-surface: '#f1f1ee'
  outline: '#717973'
  outline-variant: '#c1c8c2'
  surface-tint: '#3f6653'
  primary: '#3d6450'
  on-primary: '#ffffff'
  primary-container: '#557d68'
  on-primary-container: '#f5fff7'
  inverse-primary: '#a6d0b8'
  secondary: '#4e644e'
  on-secondary: '#ffffff'
  secondary-container: '#d1e9cd'
  on-secondary-container: '#546a54'
  tertiary: '#7f4f4f'
  on-tertiary: '#ffffff'
  tertiary-container: '#9a6767'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c1ecd3'
  primary-fixed-dim: '#a6d0b8'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#274e3c'
  secondary-fixed: '#d1e9cd'
  secondary-fixed-dim: '#b5cdb2'
  on-secondary-fixed: '#0c200f'
  on-secondary-fixed-variant: '#374c38'
  tertiary-fixed: '#ffdad9'
  tertiary-fixed-dim: '#f5b7b7'
  on-tertiary-fixed: '#331112'
  on-tertiary-fixed-variant: '#663b3b'
  background: '#f9faf6'
  on-background: '#1a1c1a'
  surface-variant: '#e2e3df'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 3.5rem
    fontWeight: '700'
    lineHeight: 4rem
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 2.25rem
    fontWeight: '700'
    lineHeight: 2.75rem
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.75rem
    fontWeight: '700'
    lineHeight: 2.25rem
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Manrope
    fontSize: 1.125rem
    fontWeight: '400'
    lineHeight: 1.75rem
  body-md:
    fontFamily: Manrope
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
  body-sm:
    fontFamily: Manrope
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.375rem
  telemetry-metric:
    fontFamily: JetBrains Mono
    fontSize: 1.75rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.02em
  telemetry-unit:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: 1rem
    letterSpacing: 0.05em
  label-md:
    fontFamily: Manrope
    fontSize: 0.875rem
    fontWeight: '600'
    lineHeight: 1.25rem
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Manrope
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.02em
  code-pill:
    fontFamily: JetBrains Mono
    fontSize: 0.7rem
    fontWeight: '500'
    lineHeight: 0.9rem
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-desktop: 1.75rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 3rem
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.25rem
  space-2xl: 3.5rem
---

## Brand & Style

This design system establishes an atmosphere of clinical authority merged with deep personal empathy. Built for a local-first, privacy-uncompromising personal health telemetry platform, the interface balances medical-grade precision with the serene calm required when confronting sensitive physiological data.

The design movement combines **Minimalism** with subtle **Tactile Precision**: crisp hairline boundaries, immaculate mathematical grids, soft luminescent accents for biomarkers, and purposeful information density. It intentionally rejects cold, sterile corporate healthcare tropes and frenetic gamification. Instead, it projects the quiet reassurance of an encrypted vault and the clarity of a boutique diagnostic dashboard. Interactions are grounded, swift, and deliberate, evoking reassurance, complete agency, and sovereign trust.

## Colors

The palette is engineered around clean clinical legibility, emotional stability, and quick cognitive triage:

- **Primary (`#5A826D`)**: Anchors primary workflows, verification states, and clinical telemetry highlights. Reflects biological equilibrium, vital breath, and medical expertise.
- **Secondary (`#90A78E`)**: Governs lab diagnostic data, continuous vitals (heart rate, SpO2, sleep stages), and secondary pathways.
- **Neutrals (`#F8FAFC`, `#FFFFFF`, `#64748B`, `#0F172A`)**: Provide deep atmospheric contrast with pure white card surfaces layered over a micro-slate base, ensuring long-session readability without ocular fatigue.
- **Clinical Telemetry Accents**:
  - `alert-rose` (`#F43F5E`): Out-of-range critical markers, urgent clinical alerts, and negative trending indicators.
  - `alert-amber` (`#F59E0B`): Borderline lab intervals, medication timing warnings, and caution prompts.
  - `privacy-green` (`#10B981`): Hardware-level encryption status, zero-cloud badges, and secure storage telemetry.

## Typography

The typographic hierarchy divides cognitive labor into three clear channels:

1. **Plus Jakarta Sans (Headlines & Display)**: Provides architectural stability, human warmth, and modern structure. Its open counters and geometric balance avoid the aggressive corporate rigidity of legacy EHR software while maintaining authority.
2. **Manrope (Body & Core Interface)**: Chosen for its superior legibility in dense content, high x-height, and neutral character. It powers longitudinal history logs, symptom journals, and consultation notes.
3. **JetBrains Mono (Data & Telemetry)**: Applied purposefully to clinical values, units (mg/dL, bpm, mm Hg), timeline timestamps, and privacy hashes. The monospaced cadence enforces tabular alignment across time series cards and emphasizes verifiable calculation.

## Layout & Spacing

This design system uses a strict **8-point hybrid layout scale** configured across a fluid, responsive 12-column grid structure (4 columns on mobile, 8 on tablet, 12 on desktop) with an enforced maximum display width of 1440px to retain analytical readability.

- **Mobile (<640px)**: 4 columns, 16px outer margin, 16px gutter. Telemetry displays reflow from horizontal pairs into stacked vertical streams. Critical metrics remain fixed at thumb-reach level.
- **Tablet (640px–1024px)**: 8 columns, 32px outer margin, 20px gutter. Accommodates dual-pane layouts (interactive biomarker trend graphs alongside historical event markers).
- **Desktop (>1024px)**: 12 columns, 48px outer margin, 28px gutter. Enables an asymmetric dashboard matrix: an anchor sidebar for local data vault status, a wide canvas for high-density vital telemetry charts, and a contextual right-hand clinical insights drawer.

## Elevation & Depth

Visual hierarchy relies on **crisp tonal layering and low-contrast borders** rather than loud drop shadows. Surfaces must communicate security, physical containment, and clinical order.

- **Layer 0 (Canvas Base)**: `#F8FAFC` — A cool, soft slate that removes pure white glare.
- **Layer 1 (Card & Module Surface)**: `#FFFFFF` — Enclosed in a 1px crisp perimeter border of `rgba(15, 23, 42, 0.06)`. Accompanied by an ultra-subtle ambient shadow: `0 1px 3px rgba(15, 23, 42, 0.04), 0 6px 16px rgba(15, 23, 42, 0.02)`.
- **Layer 2 (Hover & Active States)**: Subtle lift using `0 4px 12px rgba(90, 130, 109, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)` combined with an active primary border tint of `rgba(90, 130, 109, 0.3)`.
- **Layer 3 (Overlays, Drawers & Diagnostic Modals)**: Elevated using a solid `#FFFFFF` surface, framed with a 1px border `rgba(15, 23, 42, 0.1)`, backed by an atmospheric backdrop-filter blur (`8px blur` over `rgba(15, 23, 42, 0.25)`).
- **Security Emblems & Local-Vault Badges**: Receive an inset micro-shadow `inset 0 1px 2px rgba(0, 0, 0, 0.05)` to signal structural permanence and hardware isolation.

## Shapes

The design system implements **Level 2 (Rounded)** curvature. This geometry balances clinical discipline with approachable human software design:

- **Standard Elements (0.5rem / 8px)**: Input fields, table rows, segmented switch tracks, and status chips.
- **Card Containers (`rounded-lg` / 1rem / 16px)**: Telemetry modules, lab result cards, and vitals trend widgets.
- **Drawers & Floating Diagnostic Surfaces (`rounded-xl` / 1.5rem / 24px)**: Consultation summaries, filter modals, and medication schedules.
- **Telemetry Indicators & Badges (Full Pill / 9999px)**: Privacy status markers, local encryption indicators, and unit tags.

## Components

### Buttons
- **Primary**: Solid Sage Green (`#5A826D`), white text, 8px radius, height 40px (desktop) / 44px (mobile), medium tracking. Hover transitions to `#4B6D5A` with subtle micro-scale (0.995).
- **Secondary (Clinical Outline)**: Pure white background, 1px border in `#CBD5E1`, text in `#0F172A`. Hover transitions border to `#5A826D` with `#F2F6F3` background tint.
- **Tertiary (Insight/AI Action)**: Tinted neutral background (`rgba(90, 130, 109, 0.08)`), text `#5A826D`, zero border, reinforced with a subtle spark icon.

### Form Inputs & Selectors
- Background `#FFFFFF`, 1px border `#E2E8F0`, 8px radius, horizontal padding 14px, vertical 10px. 
- Focus state activates an immediate `#5A826D` border with a 3px ring in `rgba(90, 130, 109, 0.15)`.
- Numeric metric fields (e.g., blood glucose, systolic/diastolic) enforce `JetBrains Mono` at 1.125rem with fixed trailing units pinned to the right margin.

### Telemetry Cards & Lab Visualizers
- Pure white container, 16px radius, 20px internal padding.
- Card Header: Category indicator in uppercase `JetBrains Mono` (0.7rem), metric title in `Plus Jakarta Sans` (1rem, bold), paired with a local synchronization icon.
- Metric Body: Prominent primary readout (e.g., "118/78") in `JetBrains Mono` (1.75rem), accompanied by an embedded status pill (`Normal`, `Elevated`, `Attention`) tinted with matching semantic tones.
- Sparkline baseline uses 2px vector paths with a gradient fill descending to zero opacity.

### Privacy & Vault Badges
- Continuous reassurance component indicating local-only SQLite/indexedDB persistence.
- Small pill shape, background `rgba(16, 185, 129, 0.1)`, 1px border `rgba(16, 185, 129, 0.25)`, text in `#047857`.
- Houses a lock icon and micro-label: `100% LOCAL-FIRST • ENCRYPTED`.

### Checkboxes, Radios & Switches
- 8-point geometric check squares with 4px inner radius.
- Unchecked: 1.5px border `#94A3B8`.
- Checked: Solid `#5A826D` fill with crisp white vector tick.
- Metric toggles (e.g., showing/hiding systolic vs diastolic traces) use pill toggles with a distinct sliding white circular thumb on a `#5A826D` or `#E2E8F0` track.

### Biomarker Reference Range Sliders
- Visual linear scale showing standard deviation / clinical reference brackets.
- A horizontal rail with subtle tinted background zones (Green = Optimal, Yellow = Borderline, Coral = High).
- A distinct vertical diamond marker pinpointing the user's latest recorded test result with numeric label pinned directly above.