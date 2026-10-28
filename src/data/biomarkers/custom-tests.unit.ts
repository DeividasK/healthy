import { test, expect } from '@playwright/test';
import type { Observation } from 'fhir/r5';
import { getObservationMarker } from '@/src/features/lab-results/biomarkerMeasurements';
import {
  CUSTOM_TEST_SYSTEM,
  collectCustomTests,
  customTestCode,
  searchCustomTests,
} from './customTests';

const observation = (name: string, value: number, unit: string) =>
  ({
    resourceType: 'Observation',
    status: 'final',
    code: {
      coding: [
        {
          system: CUSTOM_TEST_SYSTEM,
          code: customTestCode(name),
          display: name,
        },
      ],
      text: name,
    },
    valueQuantity: { value, unit, code: unit },
  }) as Observation;

test('codes a test by its name, apart from LOINC codes', () => {
  expect(customTestCode(' NAD+ (whole blood) ')).toBe('x-nad-plus-whole-blood');
  expect(customTestCode('Telomere length')).toBe('x-telomere-length');
  // Names in any script keep their letters, so they don't collapse together.
  expect(customTestCode('Branduolėti eritrocitai')).toBe(
    'x-branduolėti-eritrocitai'
  );
  expect(customTestCode('Теломеры')).toBe('x-теломеры');
  expect(customTestCode(' % ')).toBe('');
});

test('reads an own test result with its name and reported unit', () => {
  const marker = getObservationMarker(observation('NAD+', 38.2, 'µM'));
  expect(marker).toMatchObject({
    id: 'x-nad-plus',
    name: 'NAD+',
    codeSystem: CUSTOM_TEST_SYSTEM,
    units: [{ label: 'µM', ucum: 'µM' }],
  });
});

test('collects own tests once each, with the unit of the latest result', () => {
  const tests = collectCustomTests([
    observation('NAD+', 38.2, 'µM'),
    observation('Telomere length', 6.8, 'kb'),
    observation('NAD+', 31.5, 'umol/L'),
  ]);
  expect(tests.map(({ name, primaryUnit }) => [name, primaryUnit])).toEqual([
    ['NAD+', 'µM'],
    ['Telomere length', 'kb'],
  ]);
  expect(searchCustomTests(tests, 'telo').map(({ name }) => name)).toEqual([
    'Telomere length',
  ]);
});
