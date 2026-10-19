import React from 'react';
import type { AddOptionItem } from '@/src/components/AddOptionsModal';
import { FormField } from '@/src/components/FormField';
import { DosageEditor } from './DosageEditor';
import type { RegimenDraft } from './regimen';

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
