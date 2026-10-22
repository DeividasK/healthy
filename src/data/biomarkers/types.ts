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

export interface BiomarkerDefinition {
  id: string;
  name: string;
  aliases: string[];
  loinc: string;
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
