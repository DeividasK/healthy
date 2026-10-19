import React, { useState } from 'react';
import type { Dosage } from 'fhir/r5';
import { Repeat, Tablets, type LucideIcon } from 'lucide-react-native';
import {
  AddOptionsModal,
  type AddOptionItem,
} from '@/src/components/AddOptionsModal';
import { FormField } from '@/src/components/FormField';
import { COLORS } from '@/src/theme/colors';
import { DosageEditor } from './DosageEditor';
import {
  applyDosing,
  createDoseDraft,
  getRegimenDraft,
  hasRegimen,
  validateRegimen,
  type RegimenDraft,
} from './regimen';

/** How dosing is entered: free text or a structured regimen, never both. */
export type DosingKind = 'instructions' | 'regimen';

/**
 * The dosing input shared by the treatment form (the prescribed dosage) and
 * the usage form (the regimen followed): a "Dosage" text field or the
 * structured regimen editor. The regimen editor's centered menus open
 * through `onShowOptions`, rendered by the form outside its scroll view.
 */
export function DosingField({
  kind,
  instructions,
  onInstructionsChange,
  regimen,
  onRegimenChange,
  onRemove,
  onShowOptions,
  idPrefix,
  required = false,
}: {
  kind: DosingKind;
  instructions: string;
  onInstructionsChange: (text: string) => void;
  regimen: RegimenDraft;
  onRegimenChange: (regimen: RegimenDraft) => void;
  /** Removes the field, returning it to the form's `+` menu. */
  onRemove: () => void;
  onShowOptions: (options: AddOptionItem[]) => void;
  /** Prefix of the field's ids, e.g. "treatment". */
  idPrefix: string;
  required?: boolean;
}) {
  if (kind === 'regimen') {
    return (
      <DosageEditor
        value={regimen}
        onChange={onRegimenChange}
        onRemove={onRemove}
        removeTestID={`remove-${idPrefix}-regimen-button`}
        onShowOptions={onShowOptions}
        required={required}
      />
    );
  }
  const id = `${idPrefix}-instructions-input`;
  return (
    <FormField
      label="Dosage"
      nativeID={id}
      required={required}
      onRemove={onRemove}
      removeTestID={`remove-${idPrefix}-instructions-button`}
      inputProps={{
        id,
        nativeID: id,
        name: 'dosageInstructions',
        testID: id,
        accessibilityLabel: 'Dosage',
        value: instructions,
        onChangeText: onInstructionsChange,
        multiline: true,
        numberOfLines: 4,
      }}
    />
  );
}

/** Dosing a form's `+` menu can add, as in the treatment form. */
const DOSING_OPTIONS: { id: DosingKind; label: string; icon: LucideIcon }[] = [
  { id: 'instructions', label: 'Dosage', icon: Tablets },
  { id: 'regimen', label: 'Regimen', icon: Repeat },
];

/** A regimen draft as entered, ignoring which optional fields are open. */
const draftKey = (draft: RegimenDraft) =>
  JSON.stringify(draft, (key, value) =>
    key === 'shownFields' ? undefined : value
  );

/**
 * Dosing state for a form that edits `Dosage` entries with `DosingField`,
 * starting from `dosages` (or an empty regimen when they have no dosing):
 * free text or a structured regimen. Removing the field returns both to the
 * form's `+` menu. `toDosage` returns the edited entries, keeping data the
 * form does not show.
 */
export function useDosing(dosages: Dosage[], idPrefix: string) {
  const [stored] = useState(() =>
    getRegimenDraft({ dosageInstruction: dosages })
  );
  const storedText = hasRegimen(stored) ? '' : dosages[0]?.text || '';
  // Without any dosing yet, it opens on an empty regimen to fill in.
  const initialKind: DosingKind = storedText ? 'instructions' : 'regimen';
  const [initialDraft] = useState(() =>
    hasRegimen(stored) || storedText
      ? stored
      : { phases: [{ doses: [createDoseDraft()] }] }
  );
  const initialInstructions = storedText;
  const [kind, setKind] = useState<DosingKind | null>(initialKind);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [regimen, setRegimen] = useState<RegimenDraft>(initialDraft);
  // Fields a regimen phase or dose can add, shown in a centered menu.
  const [regimenOptions, setRegimenOptions] = useState<AddOptionItem[] | null>(
    null
  );

  return {
    kind,
    /** Values that count as changes, e.g. for `useHasChanges`. */
    values: { kind, instructions, regimen },
    /** `+` menu options while no dosing is shown. */
    menuOptions: (kind
      ? []
      : DOSING_OPTIONS.map(({ id, label, icon: Icon }) => ({
          id,
          label,
          testID: `menu-add-${idPrefix}-${id}`,
          icon: (
            <Icon
              size={20}
              color={COLORS.light.primary}
              style={{ marginRight: 12 }}
            />
          ),
          onPress: () => {
            if (id === 'regimen' && !hasRegimen(regimen))
              setRegimen({ phases: [{ doses: [createDoseDraft()] }] });
            setKind(id);
          },
        }))) as AddOptionItem[],
    /** Whether the dosing is as it started, compared as entered. */
    isUnchanged:
      kind === initialKind &&
      (kind === 'regimen'
        ? draftKey(regimen) === draftKey(initialDraft)
        : instructions.trim() === initialInstructions.trim()),
    /** An error while the dosing, which is required, is missing or invalid. */
    validate: () =>
      kind === 'regimen'
        ? validateRegimen(regimen)
        : kind && instructions.trim()
          ? null
          : 'Enter the dosage or regimen',
    /** The edited entries; empty once dosing is removed. */
    toDosage: (): Dosage[] =>
      kind
        ? applyDosing(
            dosages,
            kind === 'regimen' ? regimen : null,
            kind === 'instructions' ? instructions : null
          )
        : [],
    /** The required dosing field, or nothing once removed. */
    field: () =>
      kind ? (
        <DosingField
          kind={kind}
          instructions={instructions}
          onInstructionsChange={setInstructions}
          regimen={regimen}
          onRegimenChange={setRegimen}
          onRemove={() => setKind(null)}
          onShowOptions={setRegimenOptions}
          idPrefix={idPrefix}
          required
        />
      ) : null,
    /** The regimen editor's centered menu, rendered outside the scroll view. */
    modal: (
      <AddOptionsModal
        visible={Boolean(regimenOptions)}
        onClose={() => setRegimenOptions(null)}
        options={regimenOptions || []}
        overlayTestID="regimen-options-overlay"
        cardTestID="regimen-options-menu"
      />
    ),
  };
}
