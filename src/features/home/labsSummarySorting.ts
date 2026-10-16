import type { Observation } from 'fhir/r5';
import { getObservationReferenceRange } from '@/src/features/lab-results/biomarkerMeasurements';

export const SUMMARY_SORT_OPTIONS = [
  { id: 'deviation', label: 'Largest deviations' },
  { id: 'lowest', label: 'Lowest' },
  { id: 'highest', label: 'Highest' },
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
] as const;
export type SummarySort = (typeof SUMMARY_SORT_OPTIONS)[number]['id'];

type SortableBiomarker = {
  name: string;
  observation: Observation;
  time: number;
};

/** Signed percentage deviation from the unit-aligned reference interval midpoint. */
function signedDeviation(observation: Observation) {
  const value = observation.valueQuantity?.value;
  const range = getObservationReferenceRange(observation);
  if (
    value === undefined ||
    !Number.isFinite(value) ||
    range?.low === undefined ||
    range.high === undefined
  )
    return undefined;
  const midpoint = (range.low + range.high) / 2;
  // A midpoint requires both bounds, and zero cannot be a percentage denominator.
  if (!Number.isFinite(midpoint) || midpoint === 0) return undefined;
  return ((value - midpoint) / Math.abs(midpoint)) * 100;
}

/** Ranks a copied list, leaving chart data untouched and unrankable results last. */
export function sortSummaryBiomarkers<T extends SortableBiomarker>(
  biomarkers: T[],
  sort: SummarySort
): T[] {
  const ranked = biomarkers.map((biomarker) => {
    const deviation = signedDeviation(biomarker.observation);
    return {
      biomarker,
      rank:
        sort === 'newest' || sort === 'oldest'
          ? biomarker.time
          : sort === 'deviation' && deviation !== undefined
            ? Math.abs(deviation)
            : deviation,
    };
  });
  const descending =
    sort === 'deviation' || sort === 'highest' || sort === 'newest';
  return ranked
    .sort((a, b) => {
      const aValid = a.rank !== undefined && Number.isFinite(a.rank);
      const bValid = b.rank !== undefined && Number.isFinite(b.rank);
      if (aValid !== bValid) return aValid ? -1 : 1;
      if (aValid && bValid && a.rank !== b.rank)
        return descending ? b.rank! - a.rank! : a.rank! - b.rank!;
      return a.biomarker.name.localeCompare(b.biomarker.name);
    })
    .map(({ biomarker }) => biomarker);
}
