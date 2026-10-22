/**
 * Biomarker catalog: the tests lab results can record, with their LOINC
 * codes, UCUM units and typical reference ranges.
 */
import { CBC_MARKERS } from './cbc';
import { COMMON_BIOMARKERS } from './common';
import type { BiomarkerDefinition } from './types';

export * from './types';
export { CBC_MARKERS };

export const CBC_PANEL_LOINC = '58410-2'; // Complete blood count (hemogram) panel - Blood by Automated count
export const GENERAL_LAB_REPORT_LOINC = '11502-2'; // Laboratory report

export const BIOMARKERS: BiomarkerDefinition[] = [
  ...CBC_MARKERS,
  ...COMMON_BIOMARKERS,
];

/**
 * Searches biomarkers by name, alias, or LOINC code.
 */
export function searchBiomarkers(query: string): BiomarkerDefinition[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return BIOMARKERS;

  return BIOMARKERS.filter((marker) => {
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
