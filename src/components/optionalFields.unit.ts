import { test, expect } from '@playwright/test';
import {
  addOptionalField,
  hiddenOptionalFields,
  initOptionalFields,
  loadOptionalFields,
  removeOptionalField,
  setOptionalField,
  type OptionalFieldSpecs,
} from './optionalFields';

interface Fields {
  time: string | null;
  severity: string | undefined;
  conditions: string[];
  instructions: string;
  regimen: string[];
  notes: string;
}

const specs = (
  overrides: Partial<OptionalFieldSpecs<Fields>> = {}
): OptionalFieldSpecs<Fields> => ({
  time: { empty: null, added: () => '09:30' },
  severity: { empty: undefined, added: (value) => value || 'mild' },
  conditions: { empty: [], available: false },
  instructions: { empty: '', excludes: ['regimen'] },
  regimen: { empty: [], added: () => ['dose'], excludes: ['instructions'] },
  notes: { empty: '' },
  ...overrides,
});

test('fields start shown only with a value, and the menu offers the rest in order', () => {
  const fields = specs({
    severity: { empty: undefined, initial: 'severe' },
    // Stored text kept hidden beside a regimen it was saved with.
    instructions: {
      empty: '',
      initial: 'Twice daily',
      shown: false,
      excludes: ['regimen'],
    },
    regimen: { empty: [], initial: ['dose'], excludes: ['instructions'] },
  });
  const state = initOptionalFields(fields);
  expect(state.values).toEqual({
    time: null,
    severity: 'severe',
    conditions: [],
    instructions: 'Twice daily',
    regimen: ['dose'],
    notes: '',
  });
  expect(state.shown).toEqual({
    time: false,
    severity: true,
    conditions: false,
    instructions: false,
    regimen: true,
    notes: false,
  });
  // Unavailable and excluded fields stay out of the menu.
  expect(hiddenOptionalFields(state, fields)).toEqual(['time', 'notes']);
  expect(
    hiddenOptionalFields(
      state,
      specs({
        ...fields,
        conditions: { empty: [], available: true },
      })
    )
  ).toEqual(['time', 'conditions', 'notes']);
});

test('adding, editing and removing a field round-trips it through the menu', () => {
  const fields = specs();
  let state = initOptionalFields(fields);
  expect(hiddenOptionalFields(state, fields)).toEqual([
    'time',
    'severity',
    'instructions',
    'regimen',
    'notes',
  ]);

  // Added fields start with their added value, or keep the one they have.
  state = addOptionalField(state, fields, 'time');
  state = addOptionalField(state, fields, 'notes');
  state = setOptionalField(state, 'severity', 'moderate');
  state = addOptionalField(state, fields, 'severity');
  state = addOptionalField(state, fields, 'regimen');
  expect(state.values).toMatchObject({
    time: '09:30',
    notes: '',
    severity: 'moderate',
    regimen: ['dose'],
  });
  // The regimen shuts out text instructions; nothing else is left to add.
  expect(hiddenOptionalFields(state, fields)).toEqual([]);

  state = setOptionalField(state, 'notes', 'Seen by nurse');
  state = removeOptionalField(state, fields, 'notes');
  state = removeOptionalField(state, fields, 'regimen');
  expect(state.values).toMatchObject({ notes: '', regimen: [] });
  expect(hiddenOptionalFields(state, fields)).toEqual([
    'instructions',
    'regimen',
    'notes',
  ]);
  // A re-added field starts empty again rather than restoring old text.
  state = addOptionalField(state, fields, 'notes');
  expect(state.values.notes).toBe('');
  expect(state.shown.notes).toBe(true);
});

test('values loaded after opening show fields that have a value', () => {
  const fields = specs();
  let state = addOptionalField(initOptionalFields(fields), fields, 'time');
  state = loadOptionalFields(state, fields, {
    time: null,
    notes: 'Fasting',
    conditions: ['asthma'],
  });
  expect(state.shown).toMatchObject({
    time: false,
    notes: true,
    conditions: true,
  });
  expect(state.values).toMatchObject({
    time: null,
    notes: 'Fasting',
    conditions: ['asthma'],
  });
});
