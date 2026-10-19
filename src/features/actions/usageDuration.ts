import { formatDisplayDate, formatLocalDate } from '@/src/utils/dateUtils';

const DAY_MS = 86_400_000;

/** Inclusive calendar duration; UTC date arithmetic keeps DST out of day counts. */
export function formatUsageDuration(
  start: string,
  end = formatLocalDate(new Date())
): string {
  const from = new Date(`${start.slice(0, 10)}T00:00:00Z`);
  const through = new Date(`${end.slice(0, 10)}T00:00:00Z`);
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(through.getTime()) ||
    through < from
  )
    return '';
  const until = new Date(through.getTime() + DAY_MS);
  let months =
    (until.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    until.getUTCMonth() -
    from.getUTCMonth();
  const afterMonths = (count: number) => {
    const date = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + count, 1)
    );
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
    ).getUTCDate();
    date.setUTCDate(Math.min(from.getUTCDate(), lastDay));
    return date;
  };
  if (afterMonths(months) > until) months--;
  const days = Math.round(
    (until.getTime() - afterMonths(months).getTime()) / DAY_MS
  );
  const units: [number, string][] = [
    [Math.floor(months / 12), 'year'],
    [months % 12, 'month'],
    [days, 'day'],
  ];
  return units
    .filter(([value]) => value > 0)
    .map(([value, unit]) => `${value} ${unit}${value === 1 ? '' : 's'}`)
    .join(', ');
}

/** e.g. "Oct 13, 2026 – Oct 19, 2026", "Oct 20, 2026" or "Since Oct 25, 2026". */
export const formatUsagePeriod = (start: string, end?: string) =>
  !end
    ? `Since ${formatDisplayDate(start)}`
    : end === start
      ? formatDisplayDate(start)
      : `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`;
