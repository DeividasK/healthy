import { test, expect } from '@playwright/test';
import { RECORDABLE_BIOMARKERS } from '@/src/data/biomarkers';
import { loadLoincLabTests, ucumLabel } from '.';

test('finds LOINC tests by code and leaves the catalog to its own definitions', async () => {
  const tests = await loadLoincLabTests();
  expect(tests.get('2339-0')).toMatchObject({
    id: '2339-0',
    loinc: '2339-0',
    name: 'Glucose [Mass/volume] in Blood',
    category: 'Other',
    units: [{ label: 'mg/dL', ucum: 'mg/dL' }],
  });
  expect(tests.get('0000-0')).toBeUndefined();
  for (const marker of RECORDABLE_BIOMARKERS)
    expect(tests.get(marker.loinc)).toBeUndefined();
});

test('searches names word by word and codes by prefix, most common first', async () => {
  const tests = await loadLoincLabTests();
  const glucose = tests.search('glucose blood').map(({ loinc }) => loinc);
  expect(glucose[0]).toBe('2339-0');
  expect(glucose.length).toBeLessThanOrEqual(50);
  expect(tests.search('BLOOD Glucose', 5)).toHaveLength(5);
  expect(tests.search('2339-0').map(({ loinc }) => loinc)).toEqual(['2339-0']);
  expect(tests.search('  ')).toEqual([]);
});

test('writes UCUM units the way the catalog labels them', () => {
  expect(ucumLabel('mg/dL')).toBe('mg/dL');
  expect(ucumLabel('u[IU]/mL')).toBe('uIU/mL');
  expect(ucumLabel('mm[Hg]')).toBe('mmHg');
  expect(ucumLabel("[arb'U]/mL")).toBe('AU/mL');
  expect(ucumLabel('mL/min/{1.73_m2}')).toBe('mL/min/1.73m2');
  expect(ucumLabel('mg/g{creat}')).toBe('mg/g');
  expect(ucumLabel('{ratio}')).toBe('ratio');
});
