import { formatLocalDate } from './dateUtils';

/**
 * Reading replies from the user's own AI assistant: the user copies a form's
 * instructions to it with a document, then pastes back its JSON reply.
 */

export type AIImportResult<T> =
  { ok: true; data: T } | { ok: false; errors: string[] };

/** Takes the JSON out of an AI reply: a fenced code block, else the outermost braces. */
function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1].includes('{')) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : null;
}

/**
 * Reads the JSON object in an AI reply, or the problem to show the user.
 * `subject` names what the reply holds, e.g. "lab results" or "a treatment".
 */
export function readAIReply(
  text: string,
  subject: string
):
  | { ok: true; reply: Record<string, unknown> }
  | { ok: false; errors: string[] } {
  const notFound = {
    ok: false as const,
    errors: [`The pasted text doesn't contain ${subject} in JSON format.`],
  };
  const json = extractJson(text);
  if (!json) return notFound;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      ok: false,
      errors: [
        "The reply couldn't be read. Paste the AI's whole reply, including the code block.",
      ],
    };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return notFound;
  return { ok: true, reply: parsed as Record<string, unknown> };
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

/** Accepts "8:05" or "08:05"; returns HH:MM or null. */
export function normalizeTime(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [h, m] = [Number(match[1]), Number(match[2])];
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${match[2]}`;
}

/** Reads a number, or a numeric string with a dot or comma decimal separator. */
export function parseAIValue(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return undefined;
  const clean = value.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(clean) ? Number(clean) : undefined;
}

/** Whether a reply field was left out (missing, null or blank). */
export const isAbsent = (value: unknown) =>
  value === undefined || value === null || value === '';

/** A trimmed text field, or null when it is absent or not text. */
export const readText = (value: unknown): string | null =>
  typeof value === 'string' ? value.trim() || null : null;

/** Finds the option whose id or label matches the text, ignoring case. */
export function matchAIOption<T extends { id: string; label: string }>(
  text: unknown,
  options: readonly T[]
): T | undefined {
  if (typeof text !== 'string') return undefined;
  const clean = text.trim().toLowerCase();
  return options.find(
    ({ id, label }) =>
      id.toLowerCase() === clean || label.toLowerCase() === clean
  );
}

/** Lists options for the instructions, e.g. `"plan" (Recommendation)`. */
export const describeAIOptions = (
  options: readonly { id: string; label: string }[]
) => options.map(({ id, label }) => `"${id}" (${label})`).join(', ');

/**
 * Reads a YYYY-MM-DD date field, adding a problem to `errors` when it is
 * invalid. `label` names it in problems, e.g. "The planned date".
 */
export function readAIDate(
  value: unknown,
  errors: string[],
  {
    label = 'The date',
    required = true,
    allowFuture = false,
    today = new Date(),
  }: {
    label?: string;
    required?: boolean;
    allowFuture?: boolean;
    today?: Date;
  } = {}
): string | null {
  if (!required && isAbsent(value)) return null;
  const date = typeof value === 'string' ? value.trim() : '';
  if (!isValidDate(date)) {
    errors.push(
      required
        ? `${label} is missing or not in YYYY-MM-DD format.`
        : `${label} is not in YYYY-MM-DD format.`
    );
    return null;
  }
  if (!allowFuture && date > formatLocalDate(today)) {
    errors.push(`${label} is in the future.`);
    return null;
  }
  return date;
}

/** Reads an optional HH:MM time field, adding a problem to `errors` when it is invalid. */
export function readAITime(value: unknown, errors: string[]): string | null {
  if (isAbsent(value)) return null;
  const time = typeof value === 'string' ? normalizeTime(value) : null;
  if (!time) errors.push('The time is not in HH:MM format.');
  return time;
}
