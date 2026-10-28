import { test, expect } from '@playwright/test';
import type { Observation } from 'fhir/r5';
import type { DiagnosticReportRecord } from '@/src/database/types';
import { getBiomarker } from '@/src/data/biomarkers';
import {
  buildBiomarkerRanges,
  formatLimits,
  getObservationRange,
  getObservationStatus,
  rangeHistory,
  rangeInUnit,
  rangeOn,
  reportedRangeEntry,
  type BiomarkerRangeEntry,
} from './biomarkerRanges';

const HEMOGLOBIN = '718-7';
const marker = getBiomarker(HEMOGLOBIN)!;
const hemoglobin = (
  date: string,
  value: number,
  extra: Partial<Observation> = {}
): Observation => ({
  resourceType: 'Observation',
  status: 'final',
  code: { coding: [{ system: 'http://loinc.org', code: HEMOGLOBIN }] },
  effectiveDateTime: date,
  valueQuantity: { value, code: 'g/L', unit: 'g/L' },
  ...extra,
});
const printed = (low?: number, high?: number, code = 'g/L') => ({
  referenceRange: [
    {
      ...(low !== undefined && { low: { value: low, code } }),
      ...(high !== undefined && { high: { value: high, code } }),
    },
  ],
});
const report = (
  id: string,
  ...observations: Observation[]
): DiagnosticReportRecord =>
  ({
    report: {
      resourceType: 'DiagnosticReport',
      id,
      status: 'final',
      code: { text: 'Lab report' },
    },
    observations,
  }) as unknown as DiagnosticReportRecord;
const userRange = (
  since: string,
  limits: Partial<BiomarkerRangeEntry>
): BiomarkerRangeEntry => ({
  unit: 'g/L',
  since,
  source: 'user',
  ...limits,
});

test('reads a printed range in the result unit, rejecting unusable ones', () => {
  const laboratory = hemoglobin('2026-01-10', 150, printed(14, 14.9, 'g/dL'));
  expect(getObservationRange(laboratory)).toMatchObject({
    low: 140,
    high: 149,
  });
  expect(getObservationStatus(laboratory)).toBe('High');
  for (const high of [140, 139])
    expect(
      getObservationRange(hemoglobin('2026-01-10', 150, printed(140, high)))
    ).toBeUndefined();
  expect(
    getObservationRange(hemoglobin('2026-01-10', 150, printed(1, 2, 'unknown')))
  ).toBeUndefined();
});

test('supports one-sided ranges without inventing a missing bound', () => {
  const lowOnly = hemoglobin('2026-01-10', 150, printed(160));
  expect(getObservationRange(lowOnly)).toMatchObject({
    low: 160,
    high: undefined,
  });
  expect(getObservationStatus(lowOnly)).toBe('Low');
  const highOnly = hemoglobin('2026-01-10', 150, printed(undefined, 140));
  expect(getObservationStatus(highOnly)).toBe('High');
  expect(formatLimits('3.5', '5.1')).toBe('3.5–5.1');
  expect(formatLimits(undefined, '30')).toBe('below 30');
  expect(formatLimits('60')).toBe('above 60');
});

test('has no range without one, falling back to the laboratory flag', () => {
  expect(getObservationRange(hemoglobin('2026-01-10', 150))).toBeUndefined();
  expect(getObservationStatus(hemoglobin('2026-01-10', 150))).toBeUndefined();
  for (const [code, status] of [
    ['L', 'Low'],
    ['LL', 'Low'],
    ['N', 'Normal'],
    ['H', 'High'],
    ['HH', 'High'],
  ] as const)
    expect(
      getObservationStatus(
        hemoglobin('2026-01-10', 150, {
          interpretation: [{ coding: [{ code }] }],
        })
      )
    ).toBe(status);
  // The range decides over a flag the laboratory gave.
  expect(
    getObservationStatus(
      hemoglobin('2026-01-10', 150, {
        ...printed(130, 170),
        interpretation: [{ coding: [{ code: 'H' }] }],
      })
    )
  ).toBe('Normal');
});

test('keeps an entry only where the range changed, however it is written', () => {
  const history = rangeHistory(
    [
      {
        low: '130',
        high: '170',
        unit: 'g/L',
        since: '2026-01-10',
        source: 'report',
      },
      {
        low: '13',
        high: '17.0',
        unit: 'g/dL',
        since: '2026-03-10',
        source: 'report',
      },
      {
        low: '130',
        high: '165',
        unit: 'g/L',
        since: '2026-05-10',
        source: 'report',
      },
    ],
    marker
  );
  expect(history.map(({ since }) => since)).toEqual([
    '2026-01-10',
    '2026-05-10',
  ]);
  expect(rangeOn(history, '2025-12-01')).toBe(history[0]);
  expect(rangeOn(history, '2026-04-01T08:00:00Z')).toBe(history[0]);
  expect(rangeOn(history, '2026-05-10')).toBe(history[1]);
});

test("lets the user's range replace reports from its day on", () => {
  const history = rangeHistory([
    {
      low: '130',
      high: '170',
      unit: 'g/L',
      since: '2026-01-10',
      source: 'report',
    },
    userRange('2026-03-01', { low: '135', high: '165' }),
    {
      low: '120',
      high: '160',
      unit: 'g/L',
      since: '2026-03-01',
      source: 'report',
    },
    {
      low: '125',
      high: '175',
      unit: 'g/L',
      since: '2026-06-01',
      source: 'report',
    },
  ]);
  expect(history.map(({ source, since }) => `${source} ${since}`)).toEqual([
    'report 2026-01-10',
    'user 2026-03-01',
  ]);
});

test('keeps the decimals of a printed range from its text', () => {
  const withText = (text: string, low?: number, high?: number) => {
    const { referenceRange } = printed(low, high);
    return hemoglobin('2026-01-01', 140, {
      referenceRange: [{ ...referenceRange[0], text }],
    });
  };
  const limits = (observation: Observation) => {
    const entry = reportedRangeEntry(observation, '2026-01-01');
    return [entry?.low, entry?.high];
  };
  expect(limits(withText('130.0–170.0', 130, 170))).toEqual(['130.0', '170.0']);
  expect(limits(withText('below 170.0', undefined, 170))).toEqual([
    undefined,
    '170.0',
  ]);
  expect(limits(withText('above 130.0', 130))).toEqual(['130.0', undefined]);
  // A limit the text doesn't match, or text that isn't a range, is left aside.
  expect(limits(withText('120.0–170.0', 130, 170))).toEqual(['130', '170.0']);
  expect(limits(withText('Adult men', 130, 170))).toEqual(['130', '170']);
});

test('shows limits as written, converting only into another unit', () => {
  const entry = userRange('2026-01-01', {
    low: '130',
    high: '170.0',
    optimalLow: '140',
  });
  expect(rangeInUnit(entry, 'g/L')).toBe(entry);
  expect(rangeInUnit(entry, 'g/dL', marker)).toMatchObject({
    low: '13',
    high: '17',
    optimalLow: '14',
    unit: 'g/dL',
  });
  expect(rangeInUnit(entry, 'unknown', marker)).toBeUndefined();
});

test('reads every result against the range in effect on its day', () => {
  const ranges = buildBiomarkerRanges(
    [
      report('first', hemoglobin('2026-01-10', 125, printed(130, 170))),
      // No printed range: the last one known still applies.
      report('second', hemoglobin('2026-02-10', 168)),
      report('third', hemoglobin('2026-04-10', 168, printed(120, 160))),
    ],
    {
      [HEMOGLOBIN]: [
        userRange('2026-03-01', {
          low: '13.5',
          high: '17',
          optimalLow: '14',
          optimalHigh: '15.5',
          unit: 'g/dL',
        }),
      ],
    }
  );
  expect(ranges[HEMOGLOBIN].map(({ since }) => since)).toEqual([
    '2026-01-10',
    '2026-03-01',
  ]);
  expect(getObservationStatus(hemoglobin('2026-01-10', 125), ranges)).toBe(
    'Low'
  );
  expect(getObservationStatus(hemoglobin('2026-02-10', 168), ranges)).toBe(
    'Normal'
  );
  // The user's range in g/dL, for a result in g/L, from the report printing 120–160.
  const april = hemoglobin('2026-04-10', 168, printed(120, 160));
  expect(getObservationRange(april, ranges)).toEqual({
    low: 135,
    high: 170,
    optimalLow: 140,
    optimalHigh: 155,
  });
  expect(getObservationStatus(april, ranges)).toBe('Normal');
});
