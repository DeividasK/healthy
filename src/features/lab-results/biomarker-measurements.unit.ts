import { test, expect } from '@playwright/test';
import type { Observation } from 'fhir/r5';
import { BIOMARKERS, getBiomarker } from '@/src/data/biomarkers';
import {
  assertCatalogObservation,
  convertBiomarkerValue,
  getObservationMarker,
  getObservationReferenceRange,
  getObservationStatus,
  isSupportedObservation,
  toRangeStatus,
} from './biomarkerMeasurements';

const hemoglobin = BIOMARKERS.find((marker) => marker.loinc === '718-7')!;
const observation = (extra: Partial<Observation> = {}): Observation => ({
  resourceType: 'Observation',
  status: 'final',
  code: { coding: [{ system: 'http://loinc.org', code: '718-7' }] },
  valueQuantity: { value: 150, code: 'g/L', unit: 'g/L' },
  ...extra,
});

test('normalizes mixed units and rejects unsupported or non-finite conversions', () => {
  expect(convertBiomarkerValue(14.5, 'g/dL', 'g/L', hemoglobin)).toBe(145);
  expect(convertBiomarkerValue(150, 'g/L', 'g/dL', hemoglobin)).toBe(15);
  expect(convertBiomarkerValue(150, 'g/L', 'g/L', hemoglobin)).toBe(150);
  // Without floating point noise (100 * 0.02586 is 2.5860000000000003).
  expect(
    convertBiomarkerValue(100, 'mg/dL', 'mmol/L', getBiomarker('2093-3'))
  ).toBe(2.586);
  for (const [from, to] of [
    ['unknown', 'g/L'],
    ['g/L', 'unknown'],
    ['unknown', 'unknown'],
  ]) {
    expect(convertBiomarkerValue(150, from, to, hemoglobin)).toBeUndefined();
  }
  for (const value of [NaN, Infinity, -Infinity]) {
    expect(
      convertBiomarkerValue(value, 'g/L', 'g/L', hemoglobin)
    ).toBeUndefined();
    expect(
      getObservationStatus(
        observation({ valueQuantity: { value, code: 'g/L' } })
      )
    ).toBeUndefined();
  }
});

test('validates catalog identity, missing units, and mismatched labels/codes', () => {
  expect(() => assertCatalogObservation(observation())).not.toThrow();
  expect(() =>
    assertCatalogObservation(
      observation({ valueQuantity: { value: 15, unit: 'g/dL' } })
    )
  ).not.toThrow();
  const invalid: [Observation, string][] = [
    [
      observation({ code: { text: 'Unknown Marker' } }),
      'is not in the biomarker catalog',
    ],
    [
      observation({
        valueQuantity: { value: 150, code: 'g/l-typo', unit: 'g/l-typo' },
      }),
      'Unsupported unit',
    ],
    [observation({ valueQuantity: { value: 150 } }), 'Unsupported unit'],
    [
      observation({ valueQuantity: { value: 150, code: 'g/L', unit: 'g/dL' } }),
      'Mismatched unit',
    ],
  ];
  for (const [value, message] of invalid) {
    expect(() => assertCatalogObservation(value)).toThrow(message);
    expect(isSupportedObservation(value)).toBe(false);
  }
});

test('reads LOINC tests outside the catalog from the result itself', () => {
  const glucose = observation({
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '2339-0',
          display: 'Glucose [Mass/volume] in Blood',
        },
      ],
    },
    valueQuantity: { value: 92, unit: 'mg/dL', code: 'mg/dL' },
  });
  expect(getObservationMarker(glucose)).toMatchObject({
    id: '2339-0',
    loinc: '2339-0',
    name: 'Glucose [Mass/volume] in Blood',
    units: [{ label: 'mg/dL', ucum: 'mg/dL' }],
  });
  expect(isSupportedObservation(glucose)).toBe(true);
  // Not LOINC, not a LOINC code, or without a unit: not a test the app knows.
  for (const value of [
    observation({ code: { coding: [{ system: 'urn:x', code: '2339-0' }] } }),
    observation({
      code: { coding: [{ system: 'http://loinc.org', code: 'custom' }] },
    }),
    observation({
      code: { coding: [{ system: 'http://loinc.org', code: '2339-0' }] },
      valueQuantity: { value: 92 },
    }),
  ])
    expect(isSupportedObservation(value)).toBe(false);
});

test('uses unit-aligned catalog ranges and gives laboratory bounds precedence', () => {
  // The general adult range, then the range for the patient's sex.
  expect(getObservationReferenceRange(observation())).toEqual({
    low: 116,
    high: 166,
  });
  expect(
    getObservationReferenceRange(observation(), undefined, { sex: 'male' })
  ).toEqual({ low: 132, high: 166 });
  expect(
    getObservationReferenceRange(observation(), undefined, { sex: 'female' })
  ).toEqual({ low: 116, high: 150 });
  const laboratory = observation({
    referenceRange: [
      {
        low: { value: 14, code: 'g/dL' },
        high: { value: 14.9, code: 'g/dL' },
      },
    ],
  });
  expect(getObservationReferenceRange(laboratory)).toEqual({
    low: 140,
    high: 149,
  });
  expect(getObservationStatus(laboratory)).toBe('High');
  for (const high of [140, 139]) {
    expect(
      getObservationReferenceRange(
        observation({
          referenceRange: [
            {
              low: { value: 140, code: 'g/L' },
              high: { value: high, code: 'g/L' },
            },
          ],
        })
      )
    ).toBeUndefined();
  }
  expect(
    getObservationReferenceRange(
      observation({
        referenceRange: [
          {
            low: { value: 1, code: 'unknown' },
            high: { value: 2, code: 'unknown' },
          },
        ],
      })
    )
  ).toBeUndefined();
});

test('classifies boundary values and honors explicit FHIR interpretations', () => {
  for (const [value, status] of [
    [131, 'Low'],
    [132, 'Normal'],
    [166, 'Normal'],
    [167, 'High'],
  ] as const) {
    expect(
      getObservationStatus(
        observation({ valueQuantity: { value, code: 'g/L' } }),
        undefined,
        { sex: 'male' }
      )
    ).toBe(status);
  }
  for (const [code, status] of [
    ['L', 'Low'],
    ['LL', 'Low'],
    ['N', 'Normal'],
    ['H', 'High'],
    ['HH', 'High'],
  ] as const) {
    expect(
      getObservationStatus(
        observation({ interpretation: [{ coding: [{ code }] }] })
      )
    ).toBe(status);
  }
  expect(
    getObservationStatus(
      observation({ interpretation: [{ coding: [{ code: 'unknown' }] }] })
    )
  ).toBe('Normal');
  expect(
    getObservationStatus(observation({ valueQuantity: { code: 'g/L' } }))
  ).toBeUndefined();
});

test('supports one-sided laboratory ranges without inventing a missing bound', () => {
  const lowOnly = observation({
    referenceRange: [{ low: { value: 160, code: 'g/L' } }],
  });
  expect(getObservationReferenceRange(lowOnly)).toEqual({
    low: 160,
    high: undefined,
  });
  expect(getObservationStatus(lowOnly)).toBe('Low');
  const highOnly = observation({
    referenceRange: [{ high: { value: 140, code: 'g/L' } }],
  });
  expect(getObservationReferenceRange(highOnly)).toEqual({
    low: undefined,
    high: 140,
  });
  expect(getObservationStatus(highOnly)).toBe('High');
});

test('collapses low and high results into out of range', () => {
  expect(toRangeStatus('Low')).toBe('outOfRange');
  expect(toRangeStatus('High')).toBe('outOfRange');
  expect(toRangeStatus('Normal')).toBe('inRange');
  expect(toRangeStatus(undefined)).toBeUndefined();
});
