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
  /**
   * LOINC codes for results in units of another kind than `loinc`'s, by UCUM
   * code. LOINC codes mass and amount of substance separately: glucose in
   * mg/dL is 2345-7 but in mmol/L 14749-6. They convert into each other, so
   * the app shows them as one test and records each under its own code.
   */
  unitLoinc?: Record<string, string>;
  category: BiomarkerCategory;
  primaryUnit: string;
  ucumCode: string;
  units: UnitOption[];
  description: string;
  education: BiomarkerEducation;
  calculation?: BiomarkerCalculation;
}

export interface BiomarkerEducation {
  about: string;
  whatItMayAffect: string;
  whatMayBeRelatedToAChange: string;
}

export const EMPTY_BIOMARKER_EDUCATION: BiomarkerEducation = {
  about: '',
  whatItMayAffect: '',
  whatMayBeRelatedToAChange: '',
};
