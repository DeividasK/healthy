export type BiomarkerCategory =
  | 'CBC & Hematology'
  | 'Lipids & Cardiovascular'
  | 'Metabolic & Renal'
  | 'Electrolytes & Minerals'
  | 'Liver & Enzymes'
  | 'Thyroid & Endocrine'
  | 'Hormones & Reproductive'
  | 'Vitamins & Nutrition'
  | 'Iron & Anemia'
  | 'Inflammation & Immunology'
  | 'Coagulation'
  | 'Trace Elements & Heavy Metals';

export type BiomarkerStatus = 'normal' | 'low' | 'high' | 'critical' | 'unknown';

export interface ReferenceInterval {
  min: number;
  max: number;
  text?: string;
}

export interface BiomarkerDefinition {
  loinc: string;
  canonicalKey: string;
  name: string;
  aliases: string[];
  category: BiomarkerCategory;
  primaryUnit: string;
  siUnit: string;
  conventionalUnit: string;
  conversionFactor: number; // conventional * factor = SI (or custom formula)
  referenceIntervals: {
    conventional: ReferenceInterval;
    si: ReferenceInterval;
  };
  description: string;
}

export interface BiomarkerResult {
  id: string;
  loinc?: string;
  canonicalKey: string;
  name: string;
  category: BiomarkerCategory | string;
  value?: number;
  unit: string;
  referenceMin?: number;
  referenceMax?: number;
  status: BiomarkerStatus;
  notes?: string;
}

export interface LabReport {
  id: string;
  testDate: string; // ISO YYYY-MM-DD
  labName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  version?: number;
  markers: BiomarkerResult[];
}

