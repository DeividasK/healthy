import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  CalendarRange,
  Layers,
  Clock,
  MapPin,
  Repeat2,
  Route,
  ScrollText,
  Tablets,
  Weight,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import type { AddOptionItem } from '@/src/components/AddOptionsModal';
import { useFieldRevealContext } from '@/src/components/FieldReveal';
import { FormField } from '@/src/components/FormField';
import { NativeSelect } from '@/src/components/NativeSelect';
import { PlusCircleButton } from '@/src/components/PlusCircleButton';
import { COLORS } from '@/src/theme/colors';
import { fieldRowStyles, NumberInput, TimingFields } from './TimingFields';
import {
  createDoseDraft,
  getAmountUnitOptions,
  getRouteOptions,
  hideDoseField,
  isDoseFieldShown,
  showDoseField,
  type DoseDraft,
  type OptionalDoseField,
  type RegimenDraft,
} from './regimen';

interface DosageEditorProps {
  value: RegimenDraft;
  onChange: (value: RegimenDraft) => void;
  /** Removes the whole regimen field. */
  onRemove: () => void;
  removeTestID?: string;
  /** Opens the centered menu of fields that can be added. */
  onShowOptions: (options: AddOptionItem[]) => void;
}

const OPTIONAL_FIELDS: {
  id: OptionalDoseField;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: 'amountMax', label: 'Max Amount', icon: Weight },
  { id: 'frequencyMax', label: 'Max Times', icon: Repeat2 },
  { id: 'when', label: 'Time of Day', icon: Clock },
  { id: 'route', label: 'Route', icon: Route },
  { id: 'bounds', label: 'Course Length', icon: CalendarRange },
  { id: 'site', label: 'Body Site', icon: MapPin },
  { id: 'patientInstruction', label: 'Patient Instructions', icon: ScrollText },
];

const menuIcon = (Icon: LucideIcon) => (
  <Icon size={20} color={COLORS.light.primary} style={{ marginRight: 12 }} />
);

/**
 * Structured regimen: sequential phases, each with one or more doses taken
 * together (e.g. 2 tablets in the morning and 1 in the evening). The `+` next
 * to a phase adds a dose or the next phase; the `+` next to a dose adds its
 * optional fields.
 */
export function DosageEditor({
  value,
  onChange,
  onRemove,
  removeTestID,
  onShowOptions,
}: DosageEditorProps) {
  const reveal = useFieldRevealContext();
  const { phases } = value;
  const setPhases = (next: RegimenDraft['phases']) => {
    if (next.length) onChange({ phases: next });
    else onRemove();
  };
  const setDose = (phaseIndex: number, doseIndex: number, dose: DoseDraft) =>
    setPhases(
      phases.map((phase, p) =>
        p === phaseIndex
          ? {
              doses: phase.doses.map((current, d) =>
                d === doseIndex ? dose : current
              ),
            }
          : phase
      )
    );
  const removeDose = (phaseIndex: number, doseIndex: number) =>
    setPhases(
      phases
        .map((phase, p) =>
          p === phaseIndex
            ? { doses: phase.doses.filter((_, d) => d !== doseIndex) }
            : phase
        )
        .filter((phase) => phase.doses.length)
    );
  // A field added from a menu scrolls into view and takes focus.
  const added = (update: () => void) => () => {
    reveal?.expectField();
    update();
  };
  const fieldOptions = (
    phaseIndex: number,
    doseIndex: number
  ): AddOptionItem[] => {
    const dose = phases[phaseIndex].doses[doseIndex];
    return OPTIONAL_FIELDS.filter(({ id }) => !isDoseFieldShown(dose, id)).map(
      ({ id, label, icon }) => ({
        id,
        label,
        icon: menuIcon(icon),
        testID: `treatment-regimen-option-${id}`,
        onPress: added(() =>
          setDose(phaseIndex, doseIndex, showDoseField(dose, id))
        ),
      })
    );
  };
  const anotherDose = (phaseIndex: number): AddOptionItem => ({
    id: 'dose',
    label: 'Another Dose',
    icon: menuIcon(Tablets),
    testID: 'treatment-regimen-option-dose',
    onPress: added(() =>
      setPhases(
        phases.map((phase, p) =>
          p === phaseIndex
            ? { doses: [...phase.doses, createDoseDraft()] }
            : phase
        )
      )
    ),
  });

  const nextPhase = (phaseIndex: number): AddOptionItem => ({
    id: 'phase',
    label: 'Next Phase',
    icon: menuIcon(Layers),
    testID: 'treatment-regimen-option-phase',
    onPress: added(() =>
      setPhases([
        ...phases.slice(0, phaseIndex + 1),
        { doses: [createDoseDraft()] },
        ...phases.slice(phaseIndex + 1),
      ])
    ),
  });

  return (
    <FormField
      label="Regimen"
      onRemove={onRemove}
      removeTestID={removeTestID}
      testID="treatment-regimen-field"
    >
      {phases.map((phase, phaseIndex) => {
        const phaseNumber = phaseIndex + 1;
        return (
          <View
            key={phaseIndex}
            style={styles.phase}
            testID={`treatment-regimen-phase-${phaseNumber}`}
          >
            <SectionHeader
              title={`Phase ${phaseNumber}`}
              titleStyle={styles.phaseTitle}
              idPrefix={`treatment-regimen-p${phaseNumber}`}
              onAdd={() =>
                onShowOptions([anotherDose(phaseIndex), nextPhase(phaseIndex)])
              }
              onRemove={
                phases.length > 1
                  ? () => setPhases(phases.filter((_, p) => p !== phaseIndex))
                  : undefined
              }
            />
            {phase.doses.map((dose, doseIndex) => {
              const idPrefix = `treatment-regimen-p${phaseNumber}-d${doseIndex + 1}`;
              return (
                <View key={doseIndex} style={styles.dose} testID={idPrefix}>
                  <SectionHeader
                    title={`Dose ${doseIndex + 1}`}
                    titleStyle={styles.doseTitle}
                    idPrefix={idPrefix}
                    onAdd={() =>
                      onShowOptions(fieldOptions(phaseIndex, doseIndex))
                    }
                    // A phase's only dose goes with the phase.
                    onRemove={
                      phase.doses.length > 1
                        ? () => removeDose(phaseIndex, doseIndex)
                        : undefined
                    }
                  />
                  <DoseFields
                    dose={dose}
                    idPrefix={idPrefix}
                    onChange={(next) => setDose(phaseIndex, doseIndex, next)}
                  />
                </View>
              );
            })}
          </View>
        );
      })}
    </FormField>
  );
}

/** A phase or dose heading with its `+` (add fields) and remove buttons. */
function SectionHeader({
  title,
  titleStyle,
  idPrefix,
  onAdd,
  onRemove,
}: {
  title: string;
  titleStyle: object;
  idPrefix: string;
  onAdd: () => void;
  onRemove?: () => void;
}) {
  return (
    <View style={styles.header}>
      <Text style={titleStyle}>{title}</Text>
      <PlusCircleButton
        size={28}
        iconSize={16}
        onPress={onAdd}
        testID={`${idPrefix}-add`}
        accessibilityRole="button"
        accessibilityLabel={`Add to ${title.toLowerCase()}`}
      />
      {onRemove && (
        <TouchableOpacity
          onPress={onRemove}
          testID={`${idPrefix}-remove`}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${title.toLowerCase()}`}
          hitSlop={10}
          activeOpacity={0.7}
          style={styles.headerRemove}
        >
          <X size={16} color={COLORS.light.iconClear} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function DoseFields({
  dose,
  idPrefix,
  onChange,
}: {
  dose: DoseDraft;
  idPrefix: string;
  onChange: (dose: DoseDraft) => void;
}) {
  const shown = (field: OptionalDoseField) => isDoseFieldShown(dose, field);
  const hide = (field: OptionalDoseField) =>
    onChange(hideDoseField(dose, field));
  const set =
    (field: 'amount' | 'amountMax' | 'unit' | 'route') => (text: string) =>
      onChange({ ...dose, [field]: text });
  const id = (field: string, kind: 'input' | 'select') =>
    `${idPrefix}-${field}-${kind}`;
  const removable = (field: OptionalDoseField) => ({
    onRemove: () => hide(field),
    removeTestID: `${idPrefix}-${field}-remove`,
  });

  const minAmount = (
    <FormField
      label="Min Amount"
      nativeID={id('amount', 'input')}
      required
      style={fieldRowStyles.cell}
    >
      <NumberInput
        id={id('amount', 'input')}
        name={`${idPrefix}-amount`}
        label="Min Amount"
        placeholder="e.g. 2"
        value={dose.amount}
        onChangeText={set('amount')}
      />
    </FormField>
  );
  const unit = (inRow: boolean) => (
    <FormField
      label="Unit"
      nativeID={id('unit', 'select')}
      required
      style={inRow && fieldRowStyles.cell}
    >
      <NativeSelect
        testID={id('unit', 'select')}
        name={`${idPrefix}-unit`}
        label="Unit"
        value={dose.unit}
        options={getAmountUnitOptions(dose.unit)}
        onChange={set('unit')}
      />
    </FormField>
  );
  const textField = (
    field: 'site' | 'patientInstruction',
    label: string,
    placeholder: string
  ) =>
    shown(field) && (
      <FormField
        label={label}
        nativeID={id(field, 'input')}
        {...removable(field)}
        inputProps={{
          id: id(field, 'input'),
          nativeID: id(field, 'input'),
          name: `${idPrefix}-${field}`,
          testID: id(field, 'input'),
          accessibilityLabel: label,
          placeholder,
          value: dose[field],
          multiline: field === 'patientInstruction',
          numberOfLines: field === 'patientInstruction' ? 2 : 1,
          onChangeText: (text) => onChange({ ...dose, [field]: text }),
        }}
      />
    );

  return (
    <>
      {/* The unit shares the amount row unless a max amount takes it. */}
      {shown('amountMax') ? (
        <>
          <View style={fieldRowStyles.row}>
            {minAmount}
            <FormField
              label="Max Amount"
              nativeID={id('amountMax', 'input')}
              style={fieldRowStyles.cell}
              {...removable('amountMax')}
            >
              <NumberInput
                id={id('amountMax', 'input')}
                name={`${idPrefix}-amountMax`}
                label="Max Amount"
                placeholder="e.g. 3"
                value={dose.amountMax}
                onChangeText={set('amountMax')}
              />
            </FormField>
          </View>
          {unit(false)}
        </>
      ) : (
        <View style={fieldRowStyles.row}>
          {minAmount}
          {unit(true)}
        </View>
      )}
      <TimingFields
        value={dose.timing}
        idPrefix={idPrefix}
        shown={{
          frequencyMax: shown('frequencyMax'),
          when: shown('when'),
          bounds: shown('bounds'),
        }}
        onHide={hide}
        onChange={(timing) => onChange({ ...dose, timing })}
      />
      {shown('route') && (
        <FormField
          label="Route"
          nativeID={id('route', 'select')}
          {...removable('route')}
        >
          <NativeSelect
            testID={id('route', 'select')}
            name={`${idPrefix}-route`}
            label="Route"
            value={dose.route}
            options={getRouteOptions(dose.route)}
            onChange={set('route')}
          />
        </FormField>
      )}
      {textField('site', 'Body Site', 'e.g. Left arm')}
      {textField(
        'patientInstruction',
        'Patient Instructions',
        'e.g. Take with food'
      )}
    </>
  );
}

const styles = StyleSheet.create({
  phase: {
    borderTopWidth: 1,
    borderColor: COLORS.light.border,
    paddingTop: 16,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  headerRemove: {
    marginLeft: 'auto',
  },
  phaseTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  doseTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  dose: {
    borderLeftWidth: 2,
    borderColor: COLORS.light.divider,
    paddingLeft: 12,
    marginBottom: 8,
  },
});
