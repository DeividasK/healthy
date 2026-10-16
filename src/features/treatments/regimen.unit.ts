import { test, expect } from '@playwright/test';
import type { Dosage, MedicationRequest } from 'fhir/r5';
import {
  applyRegimen,
  createDoseDraft,
  formatRegimenLines,
  getRegimenDraft,
  hideDoseField,
  isDoseFieldShown,
  showDoseField,
  validateRegimen,
  type DoseDraft,
  type RegimenDraft,
} from './regimen';

const request = (dosageInstruction: Dosage[]): MedicationRequest => ({
  resourceType: 'MedicationRequest',
  status: 'active',
  intent: 'order',
  subject: { reference: 'Patient/p1' },
  medication: { concept: { text: 'Prednisolone' } },
  dosageInstruction,
});

const dose = (values: Partial<DoseDraft> = {}): DoseDraft => ({
  ...createDoseDraft(),
  ...values,
  timing: { ...createDoseDraft().timing, ...values.timing },
});

const splitThenMaintenance: RegimenDraft = {
  phases: [
    {
      doses: [
        dose({
          amount: '2',
          route: '26643006',
          timing: {
            ...createDoseDraft().timing,
            frequency: '1',
            when: 'MORN',
            boundsValue: '7',
          },
        }),
        dose({
          amount: '1',
          route: '26643006',
          timing: {
            ...createDoseDraft().timing,
            frequency: '1',
            when: 'EVE',
            boundsValue: '7',
          },
        }),
      ],
    },
    {
      doses: [
        dose({
          amount: '1',
          timing: {
            ...createDoseDraft().timing,
            frequency: '1',
            frequencyMax: '2',
          },
        }),
      ],
    },
  ],
};

test('writes split doses and sequential phases as FHIR R5 Dosage', () => {
  const dosages = applyRegimen([], splitThenMaintenance);
  expect(dosages.map((dosage) => dosage.sequence)).toEqual([1, 1, 2]);
  expect(dosages[0]).toEqual({
    sequence: 1,
    doseAndRate: [
      {
        doseQuantity: {
          value: 2,
          unit: 'tablet',
          system: 'http://unitsofmeasure.org',
          code: '{tablet}',
        },
      },
    ],
    timing: {
      repeat: {
        frequency: 1,
        period: 1,
        periodUnit: 'd',
        when: ['MORN'],
        boundsDuration: {
          value: 7,
          unit: 'days',
          system: 'http://unitsofmeasure.org',
          code: 'd',
        },
      },
    },
    route: {
      coding: [
        { system: 'http://snomed.info/sct', code: '26643006', display: 'Oral' },
      ],
      text: 'Oral',
    },
  });
  expect(dosages[2].timing?.repeat).toEqual({
    frequency: 1,
    frequencyMax: 2,
    period: 1,
    periodUnit: 'd',
  });
  expect(dosages.some((dosage) => 'text' in dosage)).toBe(false);

  expect(formatRegimenLines(request(dosages))).toEqual([
    'Phase 1: 2 tablets oral in the morning, for 7 days',
    'Phase 1: 1 tablet oral in the evening, for 7 days',
    'Phase 2: 1 tablet, 1–2 times a day',
  ]);
});

test('round-trips a regimen through the draft without changes', () => {
  const dosages = applyRegimen([], splitThenMaintenance);
  const draft = getRegimenDraft(request(dosages));
  expect(draft.phases.map((phase) => phase.doses.length)).toEqual([2, 1]);
  expect(applyRegimen(dosages, draft)).toEqual(dosages);
});

test('keeps data the editor does not show when editing a dose', () => {
  const stored: Dosage[] = [
    { text: 'Old note', additionalInstruction: [{ text: 'With food' }] },
    {
      sequence: 3,
      extension: [{ url: 'urn:example', valueString: 'kept' }],
      maxDosePerPeriod: [
        { numerator: { value: 4 }, denominator: { value: 1, unit: 'd' } },
      ],
      doseAndRate: [
        {
          type: { text: 'ordered' },
          doseQuantity: { value: 10, unit: 'milligram', code: 'mg' },
        },
        { rateQuantity: { value: 1, unit: 'mL/h' } },
      ],
      timing: {
        code: { text: 'BID' },
        repeat: { timeOfDay: ['08:00:00'], when: ['MORN', 'EVE'] },
      },
    },
  ];
  const draft = getRegimenDraft(request(stored));
  expect(draft.phases).toHaveLength(1);
  const [first] = draft.phases[0].doses;
  expect(first).toMatchObject({ sourceIndex: 1, amount: '10', unit: 'mg' });
  expect(first.timing.when).toBe('MORN,EVE');

  first.amount = '20';
  const [textOnly, edited] = applyRegimen(stored, draft);
  expect(textOnly).toBe(stored[0]);
  expect(edited).toEqual({
    ...stored[1],
    sequence: 1,
    doseAndRate: [
      {
        type: { text: 'ordered' },
        doseQuantity: { value: 20, unit: 'milligram', code: 'mg' },
      },
      { rateQuantity: { value: 1, unit: 'mL/h' } },
    ],
  });
});

test('stored doses with only unshown timing still validate', () => {
  const stored: Dosage[] = [{ timing: { code: { text: 'BID' } } }];
  const draft = getRegimenDraft(request(stored));
  expect(validateRegimen(draft)).toBeNull();
  expect(applyRegimen(stored, draft)).toEqual([{ ...stored[0], sequence: 1 }]);
  expect(formatRegimenLines(request(stored))).toEqual(['BID']);
});

test('removing the regimen keeps text-only entries and stored text', () => {
  const stored: Dosage[] = [
    { text: 'Take as directed', timing: { repeat: { when: ['MORN'] } } },
    { sequence: 2, doseAndRate: [{ doseQuantity: { value: 1 } }] },
  ];
  expect(applyRegimen(stored, null)).toEqual([{ text: 'Take as directed' }]);
});

test('requires amount and times, and rejects invalid ranges', () => {
  // A valid dose, varied one field at a time.
  const base = createDoseDraft();
  const timing = { ...base.timing, frequency: '2' };
  const invalid = (values: Partial<DoseDraft>) =>
    validateRegimen({
      phases: [{ doses: [{ ...base, amount: '1', timing, ...values }] }],
    });

  expect(invalid({})).toBeNull();
  expect(invalid({ amount: '' })).toBe('Enter a min amount');
  expect(invalid({ amount: '0' })).toBe('Min amount must be a positive number');
  expect(invalid({ amount: '2', amountMax: '1' })).toBe(
    'Max amount must be more than min amount'
  );
  expect(invalid({ timing: { ...timing, frequency: '' } })).toBe(
    'Enter min times'
  );
  expect(invalid({ timing: { ...timing, frequency: '1.5' } })).toBe(
    'Min times must be a whole number'
  );
  expect(
    invalid({ timing: { ...timing, frequency: '3', frequencyMax: '2' } })
  ).toBe('Max times must be more than min times');
  expect(invalid({ timing: { ...timing, period: '0' } })).toBe(
    'Every must be a positive number'
  );
  expect(invalid({ timing: { ...timing, boundsValue: '-1' } })).toBe(
    'Course length must be a positive number'
  );
  expect(
    validateRegimen({
      phases: [
        { doses: [{ ...base, amount: '1', timing }] },
        { doses: [base] },
      ],
    })
  ).toBe('Phase 2: Enter a min amount');
  expect(validateRegimen(splitThenMaintenance)).toBeNull();
});

test('optional fields show when added or filled and clear when removed', () => {
  const base = createDoseDraft();
  expect(isDoseFieldShown(base, 'route')).toBe(false);
  const withRoute = showDoseField(base, 'route');
  expect(withRoute.route).toBe('26643006');
  expect(isDoseFieldShown(withRoute, 'route')).toBe(true);
  const withBounds = showDoseField(withRoute, 'bounds');
  expect(isDoseFieldShown(withBounds, 'bounds')).toBe(true);
  expect(withBounds.timing.boundsValue).toBe('');
  const cleared = hideDoseField(withBounds, 'route');
  expect(cleared.route).toBe('');
  expect(isDoseFieldShown(cleared, 'route')).toBe(false);
  expect(isDoseFieldShown(cleared, 'bounds')).toBe(true);
  // Stored values show their fields without being added.
  expect(
    isDoseFieldShown(
      { ...base, timing: { ...base.timing, when: 'EVE' } },
      'when'
    )
  ).toBe(true);
});
