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

export interface BiomarkerDefinition {
  id: string;
  name: string;
  aliases: string[];
  loinc: string;
  category: BiomarkerCategory;
  primaryUnit: string;
  ucumCode: string;
  units: UnitOption[];
  referenceRange?: {
    low?: number;
    high?: number;
    text?: string;
  };
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
