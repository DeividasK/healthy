import {
  EMPTY_BIOMARKER_EDUCATION,
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
  loinc: string;
  /** The first unit is the primary one, in which `range` is given. */
  units: UnitOption[];
  range?: { low?: number; high?: number };
  description: string;
}

function rangeText(
  { low, high }: { low?: number; high?: number },
  unit: string
): string {
  if (low !== undefined && high !== undefined)
    return `${low} - ${high} ${unit}`;
  return high !== undefined ? `< ${high} ${unit}` : `> ${low} ${unit}`;
}

/** Builds catalog definitions for one category from compact entries. */
export function defineBiomarkers(
  category: BiomarkerCategory,
  entries: BiomarkerEntry[]
): BiomarkerDefinition[] {
  return entries.map(
    ({ id, name, aliases = [], loinc, units, range, description }) => ({
      id,
      name,
      aliases,
      loinc,
      category,
      primaryUnit: units[0].label,
      ucumCode: units[0].ucum,
      units,
      ...(range && {
        referenceRange: { ...range, text: rangeText(range, units[0].label) },
      }),
      description,
      education: { ...EMPTY_BIOMARKER_EDUCATION },
    })
  );
}
