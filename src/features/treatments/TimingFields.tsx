import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FormField, FormTextInput } from '@/src/components/FormField';
import { NativeSelect } from '@/src/components/NativeSelect';
import { NativeTimePicker } from '@/src/components/NativeTimePicker';
import type { NativeSelectOption } from '@/src/components/NativeSelect.types';
import {
  chooseTimeOfDay,
  getCourseUnitOptions,
  getPeriodUnitOptions,
  getTimeOfDayChoice,
  getWhenOptions,
  type TimingDraft,
} from './regimen';

/** Timing fields shown only once added from a `+` menu. */
export type OptionalTimingField = 'frequencyMax' | 'when' | 'bounds';

interface TimingFieldsProps {
  value: TimingDraft;
  onChange: (value: TimingDraft) => void;
  /** Prefix for field ids, test IDs and names. */
  idPrefix: string;
  /** Which optional fields are on screen. */
  shown: Record<OptionalTimingField, boolean>;
  /** Removes an optional field (and clears its value). */
  onHide: (field: OptionalTimingField) => void;
}

/**
 * How often, when and for how long something is taken (FHIR Timing.repeat):
 * min times (with an optional max) per period, time of day and course length.
 */
export function TimingFields({
  value,
  onChange,
  idPrefix,
  shown,
  onHide,
}: TimingFieldsProps) {
  const set = (field: keyof TimingDraft) => (text: string) =>
    onChange({ ...value, [field]: text });
  const id = (field: string, kind: 'input' | 'select') =>
    `${idPrefix}-${field}-${kind}`;
  const removable = (field: OptionalTimingField) => ({
    onRemove: () => onHide(field),
    removeTestID: `${idPrefix}-${field}-remove`,
  });

  const minTimes = (
    <FormField
      label="Min Times"
      nativeID={id('frequency', 'input')}
      required
      style={fieldRowStyles.cell}
    >
      <NumberInput
        id={id('frequency', 'input')}
        name={`${idPrefix}-frequency`}
        label="Min Times"
        placeholder="e.g. 2"
        integer
        value={value.frequency}
        onChangeText={set('frequency')}
      />
    </FormField>
  );
  const maxTimes = shown.frequencyMax && (
    <FormField
      label="Max Times"
      nativeID={id('frequencyMax', 'input')}
      style={fieldRowStyles.cell}
      {...removable('frequencyMax')}
    >
      <NumberInput
        id={id('frequencyMax', 'input')}
        name={`${idPrefix}-frequencyMax`}
        label="Max Times"
        placeholder="e.g. 3"
        integer
        value={value.frequencyMax}
        onChangeText={set('frequencyMax')}
      />
    </FormField>
  );
  const timeOfDay = (inRow: boolean) =>
    shown.when && (
      <FormField
        label="Time of Day"
        nativeID={id('when', 'select')}
        style={inRow && fieldRowStyles.cell}
        {...removable('when')}
      >
        <NativeSelect
          testID={id('when', 'select')}
          name={`${idPrefix}-when`}
          label="Time of Day"
          value={getTimeOfDayChoice(value)}
          options={getWhenOptions(value.when)}
          onChange={(choice) => onChange(chooseTimeOfDay(value, choice))}
        />
      </FormField>
    );
  // An exact clock time, chosen as "At a specific time".
  const times = value.timeOfDay?.split(',') || [];
  const time = shown.when && times.length > 0 && (
    <FormField label="Time" nativeID={id('timeOfDay', 'input')} required>
      <NativeTimePicker
        // The editor changes the first time; further stored times are kept.
        value={times[0]}
        onChange={(picked) =>
          onChange({
            ...value,
            timeOfDay: [picked, ...times.slice(1)].join(','),
          })
        }
        testID={id('timeOfDay', 'input')}
        id={id('timeOfDay', 'input')}
        name={`${idPrefix}-timeOfDay`}
      />
    </FormField>
  );

  return (
    <>
      {/* Time of day shares the row unless a max times takes the space. */}
      <View style={fieldRowStyles.row}>
        {minTimes}
        {maxTimes || timeOfDay(true)}
      </View>
      {maxTimes && timeOfDay(false)}
      {time}
      <View style={fieldRowStyles.row}>
        <FormField
          label="Every"
          nativeID={id('period', 'input')}
          required
          style={fieldRowStyles.cell}
        >
          <NumberInput
            id={id('period', 'input')}
            name={`${idPrefix}-period`}
            label="Every"
            placeholder="1"
            value={value.period}
            onChangeText={set('period')}
          />
        </FormField>
        <FormField
          label="Period"
          nativeID={id('periodUnit', 'select')}
          required
          style={fieldRowStyles.cell}
        >
          <NativeSelect
            testID={id('periodUnit', 'select')}
            name={`${idPrefix}-periodUnit`}
            label="Period"
            value={value.periodUnit}
            options={getPeriodUnitOptions(value.periodUnit)}
            onChange={set('periodUnit')}
          />
        </FormField>
      </View>
      {shown.bounds && (
        <FormField
          label="Course Length"
          nativeID={id('boundsValue', 'input')}
          {...removable('bounds')}
        >
          <ValueWithUnit
            input={
              <NumberInput
                id={id('boundsValue', 'input')}
                name={`${idPrefix}-boundsValue`}
                label="Course Length"
                placeholder="e.g. 7"
                value={value.boundsValue}
                onChangeText={set('boundsValue')}
              />
            }
            testID={id('boundsUnit', 'select')}
            name={`${idPrefix}-boundsUnit`}
            unitLabel="Course length unit"
            unit={value.boundsUnit}
            options={getCourseUnitOptions(value.boundsUnit)}
            onUnitChange={set('boundsUnit')}
          />
        </FormField>
      )}
    </>
  );
}

/** A number and its unit side by side under one field label. */
export function ValueWithUnit({
  input,
  testID,
  name,
  unitLabel,
  unit,
  options,
  onUnitChange,
}: {
  input: React.ReactNode;
  testID: string;
  name: string;
  unitLabel: string;
  unit: string;
  options: NativeSelectOption[];
  onUnitChange: (unit: string) => void;
}) {
  return (
    <View style={fieldRowStyles.row}>
      <View style={fieldRowStyles.cell}>{input}</View>
      <View style={fieldRowStyles.cell}>
        <NativeSelect
          testID={testID}
          name={name}
          label={unitLabel}
          value={unit}
          options={options}
          onChange={onUnitChange}
        />
      </View>
    </View>
  );
}

/** Numeric text input with a numeric keyboard. */
export function NumberInput({
  id,
  name,
  label,
  value,
  placeholder,
  integer = false,
  onChangeText,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  placeholder?: string;
  integer?: boolean;
  onChangeText: (text: string) => void;
}) {
  return (
    <FormTextInput
      id={id}
      nativeID={id}
      name={name}
      testID={id}
      accessibilityLabel={label}
      keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      inputMode={integer ? 'numeric' : 'decimal'}
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
    />
  );
}

/** Side-by-side form fields, shared with the dose fields. */
export const fieldRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  cell: {
    flex: 1,
    width: 'auto',
  },
});
