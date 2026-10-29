import { formatDisplayDate, formatLocalDate } from '@/src/utils/dateUtils';

/** How far back the shared records go. */
export const SHARE_PERIODS = [
  { id: '1y', label: 'Last year', days: 365 },
  { id: '3y', label: 'Last 3 years', days: 3 * 365 },
  { id: 'all', label: 'All time', days: Infinity },
] as const;

export type SharePeriodId = (typeof SHARE_PERIODS)[number]['id'];

const STATUS_WORDS: Record<string, string> = {
  inRange: 'In range',
  outOfRange: 'Out of range',
  sufficient: 'In range, not optimal',
  optimal: 'Optimal',
};

/** The app's status word for a zone or range status. */
export const statusWord = (status?: string) =>
  status ? (STATUS_WORDS[status] ?? status) : '';

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
    `My health records, shared from the Healthy app on ${formatDisplayDate(formatLocalDate(new Date()))}.`,
    '',
  ];
}

/** Several kinds of records as text for an AI. */
export function overviewShareText({
  sections,
}: {
  /** A section with `columns` has table rows as its lines. */
  sections: { title: string; lines: string[]; columns?: string[] }[];
}): string {
  return [
    ...header('My health records'),
    ...sections.flatMap(({ title, lines, columns }) => [
      `## ${title}`,
      '',
      ...(columns
        ? [
            `| ${columns.join(' | ')} |`,
            `| ${columns.map(() => '---').join(' | ')} |`,
          ]
        : []),
      ...lines,
      '',
    ]),
  ]
    .join('\n')
    .trimEnd();
}
