import type { Patient } from 'fhir/r5';
import type {
  BiomarkerDefinition,
  BiomarkerSex,
  DemographicRange,
} from '@/src/data/biomarkers';
import { getAgeInYears } from '@/src/utils/dateUtils';

/** What reference ranges depend on: the patient's sex and date of birth. */
export interface RangeDemographics {
  /** Unset when the profile has no gender, or one ranges cannot use. */
  sex?: BiomarkerSex;
  birthDate?: string;
}

export type MissingDemographic = 'sex' | 'age';

export interface ResolvedReferenceRange {
  low?: number;
  high?: number;
  /** The sex- or age-specific range that applied; unset for the general one. */
  rule?: DemographicRange;
  /** What the marker's ranges vary by. */
  variesBy: MissingDemographic[];
  /** What it varies by that the profile does not say, or not for this date. */
  missing: MissingDemographic[];
}

/** The profile's sex and date of birth as ranges use them. */
export function getRangeDemographics(
  patient: Patient | null | undefined
): RangeDemographics {
  const sex =
    patient?.gender === 'male' || patient?.gender === 'female'
      ? patient.gender
      : undefined;
  return { sex, birthDate: patient?.birthDate || undefined };
}

/** Age in whole years on a test's date, or unset without a date of birth. */
export function getAgeOn(
  demographics: RangeDemographics,
  date?: string
): number | undefined {
  if (!demographics.birthDate) return undefined;
  const on = date ? new Date(date.slice(0, 10) + 'T12:00:00') : new Date();
  return getAgeInYears(
    demographics.birthDate,
    Number.isNaN(on.getTime()) ? new Date() : on
  );
}

function appliesTo(
  rule: DemographicRange,
  sex: BiomarkerSex | undefined,
  age: number | undefined
) {
  if (rule.sex && rule.sex !== sex) return false;
  if (rule.minAge !== undefined || rule.maxAge !== undefined) {
    if (age === undefined) return false;
    if (rule.minAge !== undefined && age < rule.minAge) return false;
    if (rule.maxAge !== undefined && age >= rule.maxAge) return false;
  }
  return true;
}

/**
 * The marker's reference range for the patient on a test's date, in its
 * primary unit: the first sex- and age-specific range that applies, else the
 * general one.
 */
export function resolveReferenceRange(
  marker: BiomarkerDefinition,
  demographics: RangeDemographics = {},
  date?: string
): ResolvedReferenceRange {
  const rules = marker.demographicRanges ?? [];
  const variesBy: MissingDemographic[] = [];
  if (rules.some((rule) => rule.sex)) variesBy.push('sex');
  if (
    rules.some((rule) => rule.minAge !== undefined || rule.maxAge !== undefined)
  )
    variesBy.push('age');
  const age = getAgeOn(demographics, date);
  const missing = variesBy.filter((by) =>
    by === 'sex' ? !demographics.sex : age === undefined
  );
  const rule = rules.find((candidate) =>
    appliesTo(candidate, demographics.sex, age)
  );
  const { low, high } = rule ?? marker.referenceRange ?? {};
  return { low, high, rule, variesBy, missing };
}

const SEX_GROUP: Record<BiomarkerSex, string> = {
  male: 'men',
  female: 'women',
};

/** Who a sex- and age-specific range is for, e.g. "women aged 45 to 54". */
export function describeRangeGroup(rule: DemographicRange): string {
  const who = rule.sex ? SEX_GROUP[rule.sex] : 'adults';
  const { minAge, maxAge } = rule;
  if (minAge !== undefined && maxAge !== undefined)
    return `${who} aged ${minAge} to ${maxAge - 1}`;
  if (minAge !== undefined) return `${who} aged ${minAge} and over`;
  if (maxAge !== undefined) return `${who} under ${maxAge}`;
  return who;
}

const listVaries = (variesBy: MissingDemographic[]) =>
  variesBy.length === 2 ? 'sex and age' : variesBy[0];

/**
 * Explains which range a biomarker page shows and why: who it is for, or
 * what the profile would need to say to show a personal one.
 */
export function explainReferenceRange(
  marker: BiomarkerDefinition,
  resolved: ResolvedReferenceRange
): string {
  const parts: string[] = [];
  const hasRange = resolved.low !== undefined || resolved.high !== undefined;
  if (resolved.variesBy.length === 0) {
    parts.push(
      hasRange
        ? `The range for ${marker.name} is the same for adults of any sex and age.`
        : `${marker.name} has no single typical range.`
    );
  } else {
    parts.push(
      `Typical ${marker.name} levels differ by ${listVaries(resolved.variesBy)}.`
    );
    if (resolved.rule)
      parts.push(
        hasRange
          ? `This range is for ${describeRangeGroup(resolved.rule)}.`
          : `No single range applies to ${describeRangeGroup(resolved.rule)}.`
      );
    else if (resolved.missing.length > 0)
      parts.push(
        `Your profile doesn’t have your ${resolved.missing
          .map((missing) => (missing === 'sex' ? 'gender' : 'date of birth'))
          .join(
            ' or '
          )}, so ${hasRange ? 'a general adult range is shown' : 'no range is shown'}.`
      );
    else if (hasRange) parts.push('This is the general adult range.');
  }
  if (marker.rangeNote) parts.push(marker.rangeNote);
  if (hasRange)
    parts.push(
      'Laboratories set their own ranges, so yours may differ a little.'
    );
  return parts.join(' ');
}
