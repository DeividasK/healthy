import { formatDisplayDate } from '@/src/utils/dateUtils';

/** What the user asks their AI, put above the records. */
export const SHARE_QUESTIONS = [
  {
    id: 'explain',
    label: 'Explain my results',
    text: 'Explain these results in plain language. What stands out, and what might it mean?',
  },
  {
    id: 'doctor',
    label: 'What to ask my doctor',
    text: 'Help me prepare for my next doctor visit: what should I ask about these records?',
  },
  {
    id: 'trends',
    label: 'Spot trends',
    text: 'Look for trends and changes over time in these records, and say which ones matter most.',
  },
  { id: 'none', label: 'No question', text: '' },
] as const;

export type ShareQuestionId = (typeof SHARE_QUESTIONS)[number]['id'];

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

function header(title: string, question: ShareQuestionId) {
  const ask = SHARE_QUESTIONS.find(({ id }) => id === question)!.text;
  return [
    `# ${title}`,
    '',
    ...(ask ? [ask, ''] : []),
    `Shared from Healthy on ${formatDisplayDate(new Date().toISOString())}. Ranges are the ones my lab gave or I set myself. I'm not sharing my name.`,
    '',
  ];
}

/** One biomarker's history as text for an AI. */
export function biomarkerShareText({
  name,
  measurements,
  conditions,
  period,
  question,
}: {
  name: string;
  measurements: ShareMeasurement[];
  conditions: string[];
  period: SharePeriodId;
  question: ShareQuestionId;
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
    ...header(`My ${name} results`, question),
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
  question,
}: {
  sections: OverviewSection[];
  question: ShareQuestionId;
}): string {
  return [
    ...header('My health records', question),
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
