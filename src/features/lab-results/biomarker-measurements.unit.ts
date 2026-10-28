import { test, expect } from '@playwright/test';
import type { Observation } from 'fhir/r5';
import { BIOMARKERS, getBiomarker } from '@/src/data/biomarkers';
import {
  assertCatalogObservation,
  convertBiomarkerValue,
  getObservationMarker,
  isSupportedObservation,
  roundConvertedValue,
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
  }
});

test('rounds converted range bounds to the precision they were written with', () => {
  expect(roundConvertedValue(0.69938, 1.7)).toBe(0.7);
  expect(roundConvertedValue(0.90508, 2.2)).toBe(0.91);
  expect(roundConvertedValue(2.586, 100)).toBe(2.6);
  expect(roundConvertedValue(3.3618, 130)).toBe(3.4);
  expect(roundConvertedValue(4.8762, 188.5)).toBe(4.876);
  expect(roundConvertedValue(135, 13.5)).toBe(135);
  expect(roundConvertedValue(150, 150)).toBe(150);
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

test('collapses low and high results into out of range', () => {
  expect(toRangeStatus('Low')).toBe('outOfRange');
  expect(toRangeStatus('High')).toBe('outOfRange');
  expect(toRangeStatus('Normal')).toBe('inRange');
  expect(toRangeStatus(undefined)).toBeUndefined();
});
