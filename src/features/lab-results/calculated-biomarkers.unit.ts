import { test, expect } from '@playwright/test';
import type { Observation } from 'fhir/r5';
import {
  getCalculatedObservations,
  isCalculatedObservation,
  withCalculatedObservations,
} from './calculatedBiomarkers';

const result = (
  id: string,
  code: string,
  value: number,
  unit: string
): Observation => ({
  resourceType: 'Observation',
  id,
  status: 'final',
  code: { coding: [{ system: 'http://loinc.org', code }] },
  effectiveDateTime: '2026-06-01',
  valueQuantity: { value, unit, code: unit },
});
const report = (...observations: Observation[]) => ({
  report: {
    resourceType: 'DiagnosticReport' as const,
    id: 'report',
    status: 'final' as const,
    code: { text: 'Lab report' },
  },
  observations,
});
/** The calculated observation of one biomarker, by its catalog name. */
const calculated = (name: string, ...observations: Observation[]) =>
  getCalculatedObservations(report(...observations)).find(
    ({ code }) => code.text === name
  );

const AIP = 'Atherogenic Index of Plasma (AIP)';

test('works out the atherogenic index from triglycerides and HDL', () => {
  const aip = calculated(
    AIP,
    result('tg', '2571-8', 1, 'mmol/L'),
    result('hdl', '2085-9', 2.14, 'mmol/L')
  )!;
  expect(aip).toMatchObject({
    id: 'report-aip',
    code: { text: AIP },
    effectiveDateTime: '2026-06-01',
    valueQuantity: { value: -0.33, unit: 'index', code: '{index}' },
    derivedFrom: [
      { reference: 'Observation/tg' },
      { reference: 'Observation/hdl' },
    ],
  });
  expect(aip.code.coding).toBeUndefined();
  expect(isCalculatedObservation(aip)).toBe(true);
});

test('converts results in mg/dL to mmol/L first', () => {
  const aip = calculated(
    AIP,
    result('tg', '2571-8', 150, 'mg/dL'),
    result('hdl', '2085-9', 40, 'mg/dL')
  )!;
  expect(aip.valueQuantity?.value).toBe(0.21);
});

test('works out standard values with their codes, in the inputs’ unit', () => {
  const lipids = [
    result('tc', '2093-3', 5.2, 'mmol/L'),
    result('hdl', '2085-9', 1.3, 'mmol/L'),
  ];
  // A difference keeps the inputs' unit; a ratio has none.
  expect(calculated('Non-HDL Cholesterol', ...lipids)).toMatchObject({
    code: {
      coding: [{ system: 'http://loinc.org', code: '43396-1' }],
    },
    valueQuantity: { value: 3.9, unit: 'mmol/L' },
  });
  expect(
    calculated('Cholesterol/HDL Ratio', ...lipids)?.valueQuantity
  ).toMatchObject({ value: 4, unit: 'ratio' });
  expect(
    calculated(
      'Free Androgen Index (FAI)',
      result('tt', '2986-8', 20, 'nmol/L'),
      result('shbg', '13967-5', 40, 'nmol/L')
    )?.valueQuantity
  ).toMatchObject({ value: 50, unit: '%' });
  // Direct LDL is used before calculated LDL.
  expect(
    calculated(
      'LDL/HDL Ratio',
      result('ldl-calc', '13457-7', 100, 'mg/dL'),
      result('ldl-direct', '18262-6', 120, 'mg/dL'),
      result('hdl', '2085-9', 40, 'mg/dL')
    )
  ).toMatchObject({
    valueQuantity: { value: 3 },
    derivedFrom: [
      { reference: 'Observation/ldl-direct' },
      { reference: 'Observation/hdl' },
    ],
  });
});

test('a calculated value replaces a recorded one, which shows without its inputs', () => {
  const recordedRatio = result('ratio', '9830-1', 9, '{ratio}');
  const [withInputs] = withCalculatedObservations([
    report(
      result('tc', '2093-3', 200, 'mg/dL'),
      result('hdl', '2085-9', 50, 'mg/dL'),
      recordedRatio
    ),
  ]);
  const ratios = withInputs.observations.filter(
    ({ code }) => code.coding?.[0]?.code === '9830-1'
  );
  expect(ratios).toHaveLength(1);
  expect(ratios[0]).toMatchObject({
    valueQuantity: { value: 4 },
    derivedFrom: expect.any(Array),
  });

  const [withoutInputs] = withCalculatedObservations([report(recordedRatio)]);
  expect(withoutInputs.observations).toEqual([recordedRatio]);
  expect(isCalculatedObservation(recordedRatio)).toBe(false);
});

test('needs every input and a finite value', () => {
  expect(
    getCalculatedObservations(report(result('tg', '2571-8', 1, 'mmol/L')))
  ).toEqual([]);
  expect(
    getCalculatedObservations(
      report(
        result('tg', '2571-8', 1, 'mmol/L'),
        result('hdl', '2085-9', 0, 'mmol/L')
      )
    )
  ).toEqual([]);
});
