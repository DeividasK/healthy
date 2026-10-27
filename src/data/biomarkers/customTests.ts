import type { Observation } from 'fhir/r5';
import type { RecordableBiomarker } from './index';
import { EMPTY_BIOMARKER_EDUCATION } from './types';

/**
 * The user's own tests: markers neither the catalog nor LOINC codes, such
 * as blood NAD+ or telomere length. Results are coded in Healthy's own code
 * system, by a code made from the test's name.
 */
export const CUSTOM_TEST_SYSTEM =
  'https://usehealthy.app/fhir/CodeSystem/custom-test';

/** A stable code for a test name, e.g. "NAD+ (whole blood)" → "nad-plus-whole-blood". */
export function customTestCode(name: string): string {
  return (
    'x-' +
    name
      .trim()
      .toLowerCase()
      .replace(/\+/g, '-plus')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );
}

export function isCustomTestCode(code: string | undefined): boolean {
  return Boolean(code?.startsWith('x-'));
}

/** A recordable test of the user's own, with the one unit they record it in. */
export function customTestBiomarker(
  name: string,
  unit: string
): RecordableBiomarker {
  const code = customTestCode(name);
  return {
    id: code,
    name: name.trim(),
    aliases: [],
    loinc: code,
    codeSystem: CUSTOM_TEST_SYSTEM,
    category: 'Other',
    primaryUnit: unit,
    ucumCode: unit,
    units: [{ label: unit, ucum: unit }],
    description: name.trim(),
    education: { ...EMPTY_BIOMARKER_EDUCATION },
  };
}

/**
 * The user's own tests among their results, newest first, each with the
 * unit of its latest result.
 */
export function collectCustomTests(
  observations: Observation[]
): RecordableBiomarker[] {
  const tests = new Map<string, RecordableBiomarker>();
  for (const observation of observations) {
    const coding = observation.code.coding?.[0];
    const name = coding?.display || observation.code.text;
    const unit =
      observation.valueQuantity?.unit || observation.valueQuantity?.code;
    if (coding?.system !== CUSTOM_TEST_SYSTEM || !name || !unit) continue;
    const test = customTestBiomarker(name, unit);
    if (!tests.has(test.id)) tests.set(test.id, test);
  }
  return [...tests.values()];
}

/** Own tests whose name has every word of the query. */
export function searchCustomTests(
  tests: RecordableBiomarker[],
  query: string
): RecordableBiomarker[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return tests.filter((test) =>
    words.every((word) => test.name.toLowerCase().includes(word))
  );
}
