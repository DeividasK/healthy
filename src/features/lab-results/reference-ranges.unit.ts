import { test, expect } from '@playwright/test';
import { getBiomarker } from '@/src/data/biomarkers';
import {
  describeRangeGroup,
  explainReferenceRange,
  getRangeDemographics,
  resolveReferenceRange,
} from './referenceRanges';
import { getMissingDemographics } from './biomarkerMeasurements';

const marker = (code: string) => getBiomarker(code)!;

test('reads sex and date of birth from the profile', () => {
  expect(
    getRangeDemographics({
      resourceType: 'Patient',
      gender: 'female',
      birthDate: '1980-05-01',
    })
  ).toEqual({ sex: 'female', birthDate: '1980-05-01' });
  for (const gender of ['other', 'unknown', undefined] as const)
    expect(
      getRangeDemographics({ resourceType: 'Patient', gender }).sex
    ).toBeUndefined();
});

test('picks the range for sex and for age on the test date', () => {
  const ferritin = marker('2276-4');
  expect(resolveReferenceRange(ferritin, { sex: 'female' })).toMatchObject({
    low: 11,
    high: 307,
    rule: { sex: 'female' },
    variesBy: ['sex'],
    missing: [],
  });
  expect(resolveReferenceRange(ferritin)).toMatchObject({
    low: 11,
    high: 336,
    rule: undefined,
    missing: ['sex'],
  });

  // Born 1970-06-15: 49 before the birthday in 2020, 50 from it.
  const esr = marker('30341-2');
  const woman = { sex: 'female' as const, birthDate: '1970-06-15' };
  expect(resolveReferenceRange(esr, woman, '2020-06-14').high).toBe(20);
  expect(resolveReferenceRange(esr, woman, '2020-06-15').high).toBe(30);
  expect(resolveReferenceRange(esr, { sex: 'female' })).toMatchObject({
    high: 30,
    missing: ['age'],
  });
});

test('shows no range where none applies until the profile says who it is for', () => {
  const testosterone = marker('2986-8');
  expect(resolveReferenceRange(testosterone)).toMatchObject({
    low: undefined,
    high: undefined,
    missing: ['sex'],
  });
  expect(resolveReferenceRange(testosterone, { sex: 'male' })).toMatchObject({
    low: 264,
    high: 916,
  });
  // Cycle-dependent hormones have no single range for women.
  expect(
    resolveReferenceRange(marker('2243-4'), { sex: 'female' })
  ).toMatchObject({
    low: undefined,
    high: undefined,
    rule: { sex: 'female' },
  });
});

test('describes who a range is for and what the profile is missing', () => {
  expect(describeRangeGroup({ sex: 'female', minAge: 45, maxAge: 55 })).toBe(
    'women aged 45 to 54'
  );
  expect(describeRangeGroup({ minAge: 75 })).toBe('adults aged 75 and over');
  expect(describeRangeGroup({ sex: 'male', maxAge: 50 })).toBe('men under 50');

  const ferritin = marker('2276-4');
  expect(
    explainReferenceRange(
      ferritin,
      resolveReferenceRange(ferritin, { sex: 'male' })
    )
  ).toBe(
    'Typical Ferritin levels differ by sex. This range is for men. Laboratories set their own ranges, so yours may differ a little.'
  );
  expect(explainReferenceRange(ferritin, resolveReferenceRange(ferritin))).toBe(
    'Typical Ferritin levels differ by sex. Your profile doesn’t have your gender, so a general adult range is shown. Laboratories set their own ranges, so yours may differ a little.'
  );
  const glucose = marker('2345-7');
  expect(explainReferenceRange(glucose, resolveReferenceRange(glucose))).toBe(
    'The range for Glucose is the same for adults of any sex and age. Laboratories set their own ranges, so yours may differ a little.'
  );
});

test('lists what the profile lacks for results without a laboratory range', () => {
  const observation = (code: string, extra = {}) => ({
    resourceType: 'Observation' as const,
    status: 'final' as const,
    code: { coding: [{ system: 'http://loinc.org', code }] },
    effectiveDateTime: '2026-10-01',
    ...extra,
  });
  expect(
    getMissingDemographics(
      [observation('2345-7'), observation('30341-2'), observation('2276-4')],
      {}
    )
  ).toEqual(['sex', 'age']);
  expect(
    getMissingDemographics(
      [
        observation('2276-4', {
          referenceRange: [{ low: { value: 20 }, high: { value: 200 } }],
        }),
      ],
      {}
    )
  ).toEqual([]);
});
