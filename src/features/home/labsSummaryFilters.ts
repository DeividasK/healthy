import { SUMMARY_SORT_OPTIONS, type SummarySort } from './labsSummarySorting';

export const PERIODS = [
  { id: 'all', label: 'All time', months: 0 },
  { id: '6', label: '6 months', months: 6 },
  { id: '12', label: '1 year', months: 12 },
  { id: '24', label: '2 years', months: 24 },
];

export const isPeriod = (id: unknown) =>
  PERIODS.some((option) => option.id === id);

export const periodMonths = (id: string) =>
  PERIODS.find((option) => option.id === id)?.months ?? 0;

/** Calendar-month cutoff, clamped for months with fewer days. */
export function periodCutoff(months: number) {
  if (!months) return -Infinity;
  const cutoff = new Date();
  const day = cutoff.getDate();
  cutoff.setDate(1);
  cutoff.setMonth(cutoff.getMonth() - months);
  const lastDay = new Date(
    cutoff.getFullYear(),
    cutoff.getMonth() + 1,
    0
  ).getDate();
  cutoff.setDate(Math.min(day, lastDay));
  cutoff.setHours(0, 0, 0, 0);
  return cutoff.getTime();
}

export type LabsSummaryFilters = { period: string; sort: SummarySort };

export const DEFAULT_LABS_SUMMARY_FILTERS: LabsSummaryFilters = {
  period: 'all',
  sort: 'deviation',
};

/** Saved filters, each choice falling back to its default once retired. */
export function parseLabsSummaryFilters(
  saved: unknown
): LabsSummaryFilters | null {
  if (!saved || typeof saved !== 'object') return null;
  const { period, sort } = saved as Partial<Record<string, unknown>>;
  return {
    period: isPeriod(period)
      ? (period as string)
      : DEFAULT_LABS_SUMMARY_FILTERS.period,
    sort:
      SUMMARY_SORT_OPTIONS.find(({ id }) => id === sort)?.id ??
      DEFAULT_LABS_SUMMARY_FILTERS.sort,
  };
}

export const hasLabsSummaryFilters = ({ period, sort }: LabsSummaryFilters) =>
  period !== DEFAULT_LABS_SUMMARY_FILTERS.period ||
  sort !== DEFAULT_LABS_SUMMARY_FILTERS.sort;
