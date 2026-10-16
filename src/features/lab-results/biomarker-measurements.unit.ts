import { test, expect } from '@playwright/test';
import type { Observation } from 'fhir/r5';
import { CBC_MARKERS } from '@/src/data/cbcMarkers';
import {
  assertCBCObservation,
  convertBiomarkerValue,
  getObservationReferenceRange,
  getObservationStatus,
  isSupportedCBCObservation,
} from './biomarkerMeasurements';

const hemoglobin = CBC_MARKERS.find((marker) => marker.loinc === '718-7')!;
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
  expect(() => assertCBCObservation(observation())).not.toThrow();
  expect(() =>
    assertCBCObservation(
      observation({ valueQuantity: { value: 15, unit: 'g/dL' } })
    )
  ).not.toThrow();
  const invalid: [Observation, string][] = [
    [
      observation({ code: { text: 'Unknown Marker' } }),
      'is not in the CBC catalog',
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
    expect(() => assertCBCObservation(value)).toThrow(message);
    expect(isSupportedCBCObservation(value)).toBe(false);
  }
});

test('uses unit-aligned catalog ranges and gives laboratory bounds precedence', () => {
  expect(getObservationReferenceRange(observation())).toEqual({
    low: 135,
    high: 175,
  });
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
    [134, 'Low'],
    [135, 'Normal'],
    [175, 'Normal'],
    [176, 'High'],
  ] as const) {
    expect(
      getObservationStatus(
        observation({ valueQuantity: { value, code: 'g/L' } })
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
