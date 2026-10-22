/**
 * Biomarker catalog: the tests lab results can record, with their LOINC
 * codes, UCUM units and typical reference ranges.
 */
import { CBC_MARKERS } from './cbc';
import { COMMON_BIOMARKERS } from './common';
import type { BiomarkerDefinition } from './types';

export * from './types';

export const GENERAL_LAB_REPORT_LOINC = '11502-2'; // Laboratory report

export const BIOMARKERS: BiomarkerDefinition[] = [
  ...CBC_MARKERS,
  ...COMMON_BIOMARKERS,
];

/**
 * A biomarker results can record: one with a LOINC code. Calculated ones
 * with a code are recorded for reports that lack their inputs.
 */
export type RecordableBiomarker = BiomarkerDefinition & { loinc: string };

export const RECORDABLE_BIOMARKERS = BIOMARKERS.filter(
  (marker): marker is RecordableBiomarker => Boolean(marker.loinc)
);

/** Route id of a biomarker's page: its LOINC code, else its catalog id. */
export function getBiomarkerKey(marker: BiomarkerDefinition): string {
  return marker.loinc ?? marker.id;
}

/**
 * Searches recordable biomarkers by name, alias, or LOINC code.
 */
export function searchBiomarkers(query: string): RecordableBiomarker[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return RECORDABLE_BIOMARKERS;

  return RECORDABLE_BIOMARKERS.filter((marker) => {
    if (marker.name.toLowerCase().includes(clean)) return true;
    if (marker.loinc.includes(clean)) return true;
    return marker.aliases.some((alias) => alias.toLowerCase().includes(clean));
  });
}

/**
 * Finds a biomarker by its canonical key or LOINC code.
 */
export function getBiomarker(
  idOrLoinc: string
): BiomarkerDefinition | undefined {
  return BIOMARKERS.find((m) => m.id === idOrLoinc || m.loinc === idOrLoinc);
}

const matchesName = (marker: BiomarkerDefinition, name: string) =>
  marker.name.toLowerCase() === name ||
  marker.aliases.some((alias) => alias.toLowerCase() === name);

/**
 * Finds a biomarker by the name a report or AI gives it: its name or an
 * alias, ignoring case; else that name without a bracketed part (e.g.
 * "Thyroid-stimulating hormone (TSH)"), or the bracketed abbreviation.
 */
export function findBiomarkerByName<T extends BiomarkerDefinition>(
  name: string,
  markers: T[] = BIOMARKERS as T[]
): T | undefined {
  const clean = name.trim().toLowerCase();
  const exact = markers.find((marker) => matchesName(marker, clean));
  if (exact) return exact;
  const bracketed = clean.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (!bracketed) return undefined;
  return (
    markers.find((marker) => matchesName(marker, bracketed[1])) ??
    markers.find((marker) => matchesName(marker, bracketed[2]))
  );
}
