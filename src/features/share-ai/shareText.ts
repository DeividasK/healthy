import { formatDisplayDate, formatLocalDate } from '@/src/utils/dateUtils';

/** How far back the shared records go. */
export const SHARE_PERIODS = [
  { id: '1y', label: 'Last year', days: 365 },
  { id: '3y', label: 'Last 3 years', days: 3 * 365 },
  { id: 'all', label: 'All time', days: Infinity },
] as const;

export type SharePeriodId = (typeof SHARE_PERIODS)[number]['id'];

export interface ShareMeasurement {
  date: string;
  value: number;
  unit?: string;
  range?: { low?: number; high?: number };
  /** Status as the app shows it, e.g. "In range". */
  status?: string;
}

const STATUS_WORDS: Record<string, string> = {
  inRange: 'In range',
  outOfRange: 'Out of range',
  sufficient: 'In range, not optimal',
  optimal: 'Optimal',
};

/** The app's status word for a zone or range status. */
export const statusWord = (status?: string) =>
  status ? (STATUS_WORDS[status] ?? status) : '';

const formatRange = (range?: { low?: number; high?: number }) => {
  if (!range) return '';
  if (range.low !== undefined && range.high !== undefined)
    return `${range.low} to ${range.high}`;
  if (range.low !== undefined) return `above ${range.low}`;
  if (range.high !== undefined) return `below ${range.high}`;
  return '';
};

/** Whether a date falls inside the chosen period, counted back from `now`. */
export function inPeriod(date: string | undefined, period: SharePeriodId) {
  const days = SHARE_PERIODS.find(({ id }) => id === period)!.days;
  if (!Number.isFinite(days) || !date) return true;
  return Date.parse(date) >= Date.now() - days * 864e5;
}

function header(title: string) {
  return [
    `# ${title}`,
    '',
    `My health records, shared from the Healthy app on ${formatDisplayDate(formatLocalDate(new Date()))}. Ranges are the ones my lab gave or I set myself.`,
    '',
  ];
}

/** One biomarker's history as text for an AI. */
export function biomarkerShareText({
  name,
  measurements,
  conditions,
  period,
}: {
  name: string;
  measurements: ShareMeasurement[];
  conditions: string[];
  period: SharePeriodId;
}): string {
  const rows = measurements
    .filter(({ date }) => inPeriod(date, period))
    .slice()
    .reverse()
    .map(
      (m) =>
        `| ${formatDisplayDate(m.date)} | ${m.value}${m.unit ? ` ${m.unit}` : ''} | ${formatRange(m.range)} | ${statusWord(m.status)} |`
    );
  return [
    ...header(`My ${name} results`),
    '| Date | Result | Range | Status |',
    '| --- | --- | --- | --- |',
    ...rows,
    ...(conditions.length
      ? ['', `Conditions linked to these results: ${conditions.join(', ')}.`]
      : []),
  ].join('\n');
}

export interface OverviewSection {
  id: 'conditions' | 'biomarkers' | 'treatments';
  title: string;
  lines: string[];
}

/** Several kinds of records as text for an AI. */
export function overviewShareText({
  sections,
}: {
  sections: { title: string; lines: string[] }[];
}): string {
  return [
    ...header('My health records'),
    ...sections.flatMap(({ title, lines }) => [
      `## ${title}`,
      '',
      ...lines,
      '',
    ]),
  ]
    .join('\n')
    .trimEnd();
}

/** Rough size in AI tokens, about four characters each. */
export const estimateTokens = (text: string) =>
  Math.max(1, Math.round(text.length / 4));
