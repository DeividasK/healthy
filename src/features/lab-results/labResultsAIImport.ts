import {
  BIOMARKERS,
  findBiomarkerByName,
  type BiomarkerDefinition,
  type UnitOption,
} from '@/src/data/biomarkers';
import { formatLocalDate } from '@/src/utils/dateUtils';

/** Version marker the AI puts in its reply, so other JSON is not mistaken for it. */
export const LAB_RESULTS_AI_FORMAT_KEY = 'healthyLabResults';
export const LAB_RESULTS_AI_FORMAT_VERSION = 1;

export interface ImportedLabResultItem {
  marker: BiomarkerDefinition;
  /** The value as the form's input shows it. */
  value: string;
  unit: UnitOption;
}

export interface ImportedLabResults {
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM
  serviceProvider: string | null;
  results: ImportedLabResultItem[];
}

export type LabResultsAIParseResult =
  { ok: true; data: ImportedLabResults } | { ok: false; errors: string[] };

/**
 * Instructions the user gives their own AI assistant together with a lab
 * report, so it replies with results in the format `parseLabResultsAIReply`
 * reads. Lists every test the app supports with its accepted units.
 */
export function buildLabResultsAIInstructions(): string {
  const tests = BIOMARKERS.map((marker) => {
    const names = [marker.name, ...marker.aliases].join(', ');
    const units = marker.units.map((unit) => unit.label).join(', ');
    return `- ${marker.id}: ${names}. Units: ${units}`;
  }).join('\n');

  return `I want to add the results of my lab report to my health app. Read the lab report I'm sharing with you and convert it into the format below.

Reply with exactly one JSON code block in this format:

\`\`\`json
{
  "${LAB_RESULTS_AI_FORMAT_KEY}": ${LAB_RESULTS_AI_FORMAT_VERSION},
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "serviceProvider": "Name of the laboratory",
  "results": [
    { "test": "test id from the list below", "value": 0, "unit": "unit from the list below" }
  ]
}
\`\`\`

Rules:
- "date" is the day the sample was collected. If the report doesn't show it, use the report date.
- "time" is the 24-hour time the sample was collected. Leave "time" out if the report doesn't show it.
- "serviceProvider" is the laboratory or clinic that did the tests. Leave it out if the report doesn't show it.
- Add one entry to "results" for each test in the report that is in the list below, using its test id.
- "value" is a number with a dot as the decimal separator. Copy it exactly as reported: don't round or convert it.
- "unit" must be one of the units listed for that test. Units written differently can mean the same unit: 10^9/L, x10E9/L and G/L are 10*9/L; 10^3/µL, K/µL and thou/µL are 10*3/uL; 10^12/L and T/L are 10*12/L; 10^6/µL and M/µL are 10*6/uL.
- Leave out tests that aren't in the list or whose unit doesn't match one listed for it, and list them in a short note before the code block.
- Don't add reference ranges, flags, comments or any other fields.

Tests and units:
${tests}`;
}

/** Lowercases a unit and writes powers of ten and micro the way the catalog does. */
function normalizeUnit(unit: string): string {
  return unit
    .trim()
    .toLowerCase()
    .replace(/[µμ]/g, 'u')
    .replace(/\s+/g, '')
    .replace(/^[x×]/, '')
    .replace(/\^/g, '*');
}

/** Finds a catalog test by its id, LOINC code, name or alias. */
function findMarker(test: string): BiomarkerDefinition | undefined {
  const clean = test.trim().toLowerCase();
  return (
    BIOMARKERS.find(
      (marker) => marker.id === clean || marker.loinc === clean
    ) ?? findBiomarkerByName(test)
  );
}

/** Takes the JSON out of an AI reply: a fenced code block, else the outermost braces. */
function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1].includes('{')) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : null;
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
function normalizeTime(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [h, m] = [Number(match[1]), Number(match[2])];
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${match[2]}`;
}

/** Reads a number, or a numeric string with a dot or comma decimal separator. */
function parseValue(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return undefined;
  const clean = value.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(clean) ? Number(clean) : undefined;
}

/**
 * Reads lab results from an AI reply written to `buildLabResultsAIInstructions`.
 * Returns every problem found, so the user can fix the reply in one go.
 */
export function parseLabResultsAIReply(
  text: string,
  today: Date = new Date()
): LabResultsAIParseResult {
  const json = extractJson(text);
  if (!json)
    return {
      ok: false,
      errors: ["The pasted text doesn't contain lab results in JSON format."],
    };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      ok: false,
      errors: [
        "The lab results couldn't be read. Paste the AI's whole reply, including the code block.",
      ],
    };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return {
      ok: false,
      errors: ["The pasted text doesn't contain lab results in JSON format."],
    };

  const reply = parsed as Record<string, unknown>;
  const errors: string[] = [];

  const date = typeof reply.date === 'string' ? reply.date.trim() : '';
  if (!isValidDate(date))
    errors.push('The date is missing or not in YYYY-MM-DD format.');
  else if (date > formatLocalDate(today))
    errors.push('The date is in the future.');

  let time: string | null = null;
  if (reply.time !== undefined && reply.time !== null && reply.time !== '') {
    time = typeof reply.time === 'string' ? normalizeTime(reply.time) : null;
    if (!time) errors.push('The time is not in HH:MM format.');
  }

  let serviceProvider: string | null = null;
  if (typeof reply.serviceProvider === 'string')
    serviceProvider = reply.serviceProvider.trim() || null;

  const results: ImportedLabResultItem[] = [];
  if (!Array.isArray(reply.results) || reply.results.length === 0) {
    errors.push('No test results were found.');
  } else {
    const seen = new Set<string>();
    reply.results.forEach((entry, index) => {
      const item = (entry ?? {}) as Record<string, unknown>;
      const label =
        typeof item.test === 'string' && item.test.trim()
          ? item.test.trim()
          : `Result ${index + 1}`;
      const marker =
        typeof item.test === 'string' ? findMarker(item.test) : undefined;
      if (!marker) {
        errors.push(`"${label}" is not a supported test.`);
        return;
      }
      if (seen.has(marker.id)) {
        errors.push(`${marker.name} is listed more than once.`);
        return;
      }
      seen.add(marker.id);

      const value = parseValue(item.value);
      if (value === undefined || !Number.isFinite(value) || value < 0) {
        errors.push(`${marker.name} has no valid value.`);
        return;
      }

      const unitText = typeof item.unit === 'string' ? item.unit : '';
      const unit = marker.units.find(
        (option) =>
          normalizeUnit(option.label) === normalizeUnit(unitText) ||
          normalizeUnit(option.ucum) === normalizeUnit(unitText)
      );
      if (!unit) {
        errors.push(
          `${marker.name} has an unsupported unit "${unitText}". Supported units: ${marker.units.map((option) => option.label).join(', ')}.`
        );
        return;
      }

      results.push({ marker, value: String(value), unit });
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: { date, time, serviceProvider, results } };
}
