import {
  findBiomarkerByName,
  RECORDABLE_BIOMARKERS,
  type RecordableBiomarker,
  type UnitOption,
} from '@/src/data/biomarkers';
import {
  parseAIValue,
  readAIDate,
  readAIReply,
  readAITime,
  readText,
  type AIImportResult,
} from '@/src/utils/aiImport';

/** Version marker the AI puts in its reply, so other JSON is not mistaken for it. */
export const LAB_RESULTS_AI_FORMAT_KEY = 'healthyLabResults';
export const LAB_RESULTS_AI_FORMAT_VERSION = 1;

export interface ImportedLabResultItem {
  marker: RecordableBiomarker;
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

export type LabResultsAIParseResult = AIImportResult<ImportedLabResults>;

/**
 * Instructions the user gives their own AI assistant together with a lab
 * report, so it replies with results in the format `parseLabResultsAIReply`
 * reads. Lists every test the app supports with its accepted units.
 */
export function buildLabResultsAIInstructions(): string {
  const tests = RECORDABLE_BIOMARKERS.map((marker) => {
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

/** Finds a recordable catalog test by its id, LOINC code, name or alias. */
function findMarker(test: string): RecordableBiomarker | undefined {
  const clean = test.trim().toLowerCase();
  return (
    RECORDABLE_BIOMARKERS.find(
      (marker) => marker.id === clean || marker.loinc === clean
    ) ?? findBiomarkerByName(test, RECORDABLE_BIOMARKERS)
  );
}

/**
 * Reads lab results from an AI reply written to `buildLabResultsAIInstructions`.
 * Returns every problem found, so the user can fix the reply in one go.
 */
export function parseLabResultsAIReply(
  text: string,
  today: Date = new Date()
): LabResultsAIParseResult {
  const read = readAIReply(text, 'lab results');
  if (!read.ok) return read;
  const { reply } = read;
  const errors: string[] = [];

  const date = readAIDate(reply.date, errors, { today }) ?? '';
  const time = readAITime(reply.time, errors);

  const serviceProvider = readText(reply.serviceProvider);

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

      const value = parseAIValue(item.value);
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
