import { test, expect } from '@playwright/test';
import type { Observation } from 'fhir/r5';
import { getObservationStatus } from './biomarkerMeasurements';
import { getCalculatedObservations } from './calculatedBiomarkers';

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

test('works out the atherogenic index from triglycerides and HDL', () => {
  const [aip] = getCalculatedObservations(
    report(
      result('tg', '2571-8', 1, 'mmol/L'),
      result('hdl', '2085-9', 2.14, 'mmol/L')
    )
  );
  expect(aip).toMatchObject({
    id: 'report-aip',
    code: { text: 'Atherogenic Index of Plasma (AIP)' },
    effectiveDateTime: '2026-06-01',
    valueQuantity: { value: -0.33, unit: 'index', code: '{index}' },
    derivedFrom: [
      { reference: 'Observation/tg' },
      { reference: 'Observation/hdl' },
    ],
  });
  expect(getObservationStatus(aip)).toBe('Normal');
});

test('converts results in mg/dL to mmol/L first', () => {
  const [aip] = getCalculatedObservations(
    report(
      result('tg', '2571-8', 150, 'mg/dL'),
      result('hdl', '2085-9', 40, 'mg/dL')
    )
  );
  expect(aip.valueQuantity?.value).toBe(0.21);
  expect(getObservationStatus(aip)).toBe('High');
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
