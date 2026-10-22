export interface UnitOption {
  label: string;
  ucum: string;
  factor?: number; // relative to primary unit
}

export type BiomarkerCategory =
  | 'Complete Blood Count'
  | 'Metabolic Panel'
  | 'Liver Function'
  | 'Lipids'
  | 'Diabetes'
  | 'Thyroid'
  | 'Iron Studies'
  | 'Vitamins and Minerals'
  | 'Inflammation and Immunity'
  | 'Coagulation'
  | 'Cardiac'
  | 'Hormones'
  | 'Tumor Markers'
  | 'Pancreas and Digestion'
  | 'Urine'
  | 'Blood Gas'
  | 'Other';

/** Sex a reference range applies to; FHIR administrative gender values. */
export type BiomarkerSex = 'male' | 'female';

/**
 * A reference range for part of the population, in the primary unit. Ages
 * are whole years: `minAge` inclusive, `maxAge` exclusive. Without `low` and
 * `high` it records that no single range applies (e.g. hormones that follow
 * the menstrual cycle).
 */
export interface DemographicRange {
  sex?: BiomarkerSex;
  minAge?: number;
  maxAge?: number;
  low?: number;
  high?: number;
}

/**
 * How the app works a biomarker out from other results in the same report
 * with a standard formula. Whenever a report has the inputs, the calculated
 * value replaces any recorded one; a recorded value without its inputs is
 * still shown.
 */
export interface BiomarkerCalculation {
  /**
   * The results it needs, each with the unit it is converted to. A list of
   * ids takes the first the report has, e.g. direct LDL before calculated.
   */
  inputs: { id: string | string[]; unit: string }[];
  /** The formula, as shown on the biomarker page. */
  formula: string;
  /** Works the value out, in the primary unit, from the inputs' values in the order given. */
  calculate: (values: number[]) => number;
}

export interface BiomarkerDefinition {
  id: string;
  name: string;
  aliases: string[];
  /** Absent for calculated biomarkers that LOINC has no code for. */
  loinc?: string;
  category: BiomarkerCategory;
  primaryUnit: string;
  ucumCode: string;
  units: UnitOption[];
  /** The adult range used when no `demographicRanges` entry applies. */
  referenceRange?: {
    low?: number;
    high?: number;
    text?: string;
  };
  /** Ranges by sex and age, most specific first; the first match applies. */
  demographicRanges?: DemographicRange[];
  /** Explains what else a range depends on, shown on the biomarker page. */
  rangeNote?: string;
  description: string;
  education: BiomarkerEducation;
  calculation?: BiomarkerCalculation;
}

export interface BiomarkerEducation {
  about: string;
  whyItMatters: string;
  whatItMayAffect: string;
  whatMayBeRelatedToAChange: string;
}

export const EMPTY_BIOMARKER_EDUCATION: BiomarkerEducation = {
  about: '',
  whyItMatters: '',
  whatItMayAffect: '',
  whatMayBeRelatedToAChange: '',
};
