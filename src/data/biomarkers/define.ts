import {
  EMPTY_BIOMARKER_EDUCATION,
  type BiomarkerCalculation,
  type BiomarkerCategory,
  type BiomarkerDefinition,
  type UnitOption,
} from './types';

/**
 * A unit option: its label, how many of it make one primary unit's worth
 * (`factor`), and its UCUM code when that differs from the label.
 */
export function u(label: string, factor = 1, ucum = label): UnitOption {
  return { label, ucum, factor };
}

export interface BiomarkerEntry {
  id: string;
  name: string;
  aliases?: string[];
  loinc?: string;
  unitLoinc?: Record<string, string>;
  /** The first unit is the primary one. */
  units: UnitOption[];
  description: string;
  calculation?: BiomarkerCalculation;
}

/** Builds catalog definitions for one category from compact entries. */
export function defineBiomarkers(
  category: BiomarkerCategory,
  entries: BiomarkerEntry[]
): BiomarkerDefinition[] {
  return entries.map(
    ({
      id,
      name,
      aliases = [],
      loinc,
      unitLoinc,
      units,
      description,
      calculation,
    }) => ({
      id,
      name,
      aliases,
      ...(loinc && { loinc }),
      ...(unitLoinc && { unitLoinc }),
      category,
      primaryUnit: units[0].label,
      ucumCode: units[0].ucum,
      units,
      description,
      education: { ...EMPTY_BIOMARKER_EDUCATION },
      ...(calculation && { calculation }),
    })
  );
}
