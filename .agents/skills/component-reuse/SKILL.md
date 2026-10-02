---
name: component-reuse
description: Guidelines and procedure for identifying, auditing, and reusing existing components before creating new ones, extracting reusable components instead of copy-pasting styles, and confirming new components in plans.
---

# Component Reuse & Planning Guidelines

When planning or implementing UI features in this codebase:

1. **Audit Existing Components**:
   - Inspect `src/components/`, `app/`, and existing views to identify components, pickers, buttons, pills, modals, and style patterns that can be reused directly or adapted.
2. **Never Copy-Paste Styles Across Files**:
   - If styles are only used in a single place/file, they can remain written in that place.
   - When styles or UI elements need to be reused in more than one place, **extract a separate reusable component** instead of duplicating style objects across different files.
3. **Collocate View-Specific Components**:
   - Components that belong to a single view or feature (e.g. `HealthCaseForm`, `LabResultForm`) **MUST** be collocated in their feature folder inside `src/features/<feature>/`.
   - Do NOT place subcomponents or non-route files inside `app/` (which is strictly for thin route definitions).
   - ONLY components that are used across multiple distinct views/domains should live in the shared `src/components/` folder.
4. **Form Field Accessibility & Attributes**:
   - All form field elements (`<TextInput>`, `<input>`, `<select>`, `<textarea>`) **MUST** have an `id` (or `nativeID`) and `name` attribute to prevent browser warnings and ensure accessibility and testability.
5. **Suggest Reused & Extracted Components in Plans**:
   - In any implementation plan, explicitly dedicate a section listing existing components to be reused, as well as any reusable components being extracted to avoid style duplication.
6. **Confirm New Components in Plans**:
   - Always explicitly list and confirm in the plan if any new components need to be created, providing justification for why existing components cannot be reused.
