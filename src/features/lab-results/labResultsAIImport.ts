import {
  findBiomarkerByName,
  hasLoincCode,
  RECORDABLE_BIOMARKERS,
  type RecordableBiomarker,
  type UnitOption,
} from '@/src/data/biomarkers';
import {
  customTestBiomarker,
  customTestCode,
} from '@/src/data/biomarkers/customTests';
import {
  parseResultValue,
  type ResultComparator,
} from './biomarkerMeasurements';
import {
  countPerLitreExponent,
  unitKind,
  type LoincLabTests,
} from '@/src/data/loinc';
import {
  isAbsent,
  parseAIValue,
  readAIDate,
  readAIReply,
  readAITime,
  readText,
  type AIImportResult,
} from '@/src/utils/aiImport';
import { isWrittenLimit } from './biomarkerRanges';

/** Version marker the AI puts in its reply, so other JSON is not mistaken for it. */
export const LAB_RESULTS_AI_FORMAT_KEY = 'healthyLabResults';
export const LAB_RESULTS_AI_FORMAT_VERSION = 1;
/** Test id the AI gives a test that has no LOINC code, kept as the user's own test. */
export const OWN_TEST_ID = 'own';

export interface ImportedLabResultItem {
  marker: RecordableBiomarker;
  /** The value as the form's input shows it. */
  value: string;
  /** Set when the report gives only a bound, e.g. "<" for "< 20". */
  comparator?: ResultComparator;
  unit: UnitOption;
  /** The range printed with the result, in its unit, as written. */
  low?: string;
  high?: string;
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
 * reads. Lists every test the app supports with its accepted units, and
 * the user's own tests so the AI reuses their names.
 */
export function buildLabResultsAIInstructions(
  ownTests: RecordableBiomarker[] = []
): string {
  const tests = RECORDABLE_BIOMARKERS.map((marker) => {
    const names = [marker.name, ...marker.aliases].join(', ');
    const units = marker.units.map((unit) => unit.label).join(', ');
    return `- ${marker.id}: ${names}. Units: ${units}`;
  }).join('\n');
  const ownTestList = ownTests.length
    ? `

My own tests, already in the app. For the same test, use "${OWN_TEST_ID}" with exactly this name:
${ownTests.map((test) => `- ${test.name}. Unit: ${test.primaryUnit}`).join('\n')}`
    : '';

  return `I want to add the results of my lab report to my health app. Read the lab report I'm sharing with you and convert it into the format below.

Reply with exactly one JSON code block in this format:

\`\`\`json
{
  "${LAB_RESULTS_AI_FORMAT_KEY}": ${LAB_RESULTS_AI_FORMAT_VERSION},
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "serviceProvider": "Name of the laboratory",
  "results": [
    { "test": "test id from the list below", "value": 0, "unit": "unit from the list below", "low": "0.0", "high": "0.0" }
  ]
}
\`\`\`

Rules:
- "date" is the day the sample was collected. If the report doesn't show it, use the report date.
- "time" is the 24-hour time the sample was collected. Leave "time" out if the report doesn't show it.
- "serviceProvider" is the laboratory or clinic that did the tests. Leave it out if the report doesn't show it.
- Add one entry to "results" for each test in the report with a numeric value. For a test in the list below, use its test id. For any other test, use its LOINC code as the test id (e.g. "2093-3") and copy its unit as reported. LOINC has separate codes for each kind of unit, so use the code for the unit the report gives: mass, like mg/dL, or amount of substance, like mmol/L.
- "value" is a number with a dot as the decimal separator. Copy it exactly as reported, including a minus sign: don't round or convert it.
- If the report gives a result only as a bound, like < 20.00 or > 90, write "value" as text with the sign, e.g. "<20.00" or ">90".
- For a test in the list below, "unit" must be one of the units listed for it. Units written differently can mean the same unit: 10^9/L, x10E9/L and G/L are 10*9/L; 10^3/µL, K/µL and thou/µL are 10*3/uL; 10^12/L and T/L are 10*12/L; 10^6/µL and M/µL are 10*6/uL.
- For a test that has no LOINC code, like NAD+ or telomere length, use "${OWN_TEST_ID}" as the test id, add "name" with the test's name as reported, and copy its unit as reported.
- Leave out tests in the list whose unit doesn't match one listed for them, and other tests whose LOINC code you aren't sure of. List the tests you leave out in a short note before the code block.
- "low" and "high" are the limits of the reference range printed with the result, in the same unit. Write them as text, exactly as printed, keeping zeros like "5.0". For a range like "< 5" give only "high", for "> 60" only "low". Leave them out if the report prints no range for the test.
- Don't add flags, comments or any other fields.

Tests and units:
${tests}${ownTestList}`;
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
      (marker) => marker.id === clean || hasLoincCode(marker, clean)
    ) ?? findBiomarkerByName(test, RECORDABLE_BIOMARKERS)
  );
}

/** Finds the unit a result is reported in among a test's units. */
function findUnit(marker: RecordableBiomarker, unitText: string) {
  return marker.units.find(
    (option) =>
      normalizeUnit(option.label) === normalizeUnit(unitText) ||
      normalizeUnit(option.ucum) === normalizeUnit(unitText)
  );
}

/**
 * The test's own unit for a count written another way, e.g. 10*3/uL for a
 * report's 10*9/L. The value is the same in both.
 */
function findSameCountUnit(marker: RecordableBiomarker, unitText: string) {
  const exponent = countPerLitreExponent(unitText);
  if (exponent === undefined) return undefined;
  return marker.units.find(
    (option) => countPerLitreExponent(option.ucum) === exponent
  );
}

/** A range limit as written, or undefined when absent; null when invalid. */
function readLimit(value: unknown): string | undefined | null {
  if (isAbsent(value)) return undefined;
  const text =
    typeof value === 'number'
      ? String(value)
      : typeof value === 'string'
        ? value.trim().replace(',', '.')
        : '';
  return isWrittenLimit(text) ? text : null;
}

/** The printed range of a result, or undefined (with an error) when invalid. */
function readRange(
  item: Record<string, unknown>,
  name: string,
  errors: string[]
): Pick<ImportedLabResultItem, 'low' | 'high'> | undefined {
  const low = readLimit(item.low);
  const high = readLimit(item.high);
  if (
    low === null ||
    high === null ||
    (low !== undefined && high !== undefined && Number(high) <= Number(low))
  ) {
    errors.push(`${name} has an invalid range.`);
    return undefined;
  }
  return {
    ...(low !== undefined && { low }),
    ...(high !== undefined && { high }),
  };
}

/**
 * Reads lab results from an AI reply written to `buildLabResultsAIInstructions`.
 * Tests outside the catalog are looked up by LOINC code in `loincTests`, and
 * keep the unit the report gives. Returns every problem found, so the user can
 * fix the reply in one go.
 */
export function parseLabResultsAIReply(
  text: string,
  today: Date = new Date(),
  loincTests?: LoincLabTests
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
      const unitText = typeof item.unit === 'string' ? item.unit : '';
      const reportedUnit = unitText.trim();
      const ownName = readText(item.name);
      const isOwnTest =
        typeof item.test === 'string' &&
        item.test.trim().toLowerCase() === OWN_TEST_ID;
      if (
        isOwnTest &&
        (!ownName || !customTestCode(ownName) || !reportedUnit)
      ) {
        errors.push(
          `${ownName ?? `Result ${index + 1}`} needs a name and a unit.`
        );
        return;
      }
      const catalogMarker =
        typeof item.test === 'string' && !isOwnTest
          ? findMarker(item.test)
          : undefined;
      const marker = isOwnTest
        ? customTestBiomarker(ownName!, reportedUnit)
        : (catalogMarker ??
          (typeof item.test === 'string'
            ? loincTests?.get(item.test)
            : undefined));
      if (!marker) {
        errors.push(`"${label}" is not a supported test.`);
        return;
      }
      if (seen.has(marker.id)) {
        errors.push(`${marker.name} is listed more than once.`);
        return;
      }
      seen.add(marker.id);

      // A result given only as a bound, e.g. "< 20.00", keeps its sign.
      const bounded =
        typeof item.value === 'string'
          ? parseResultValue(item.value)
          : undefined;
      const value = bounded?.value ?? parseAIValue(item.value);
      if (value === undefined || !Number.isFinite(value)) {
        errors.push(`${marker.name} has no valid value.`);
        return;
      }

      const unit =
        findUnit(marker, unitText) ??
        findSameCountUnit(marker, reportedUnit) ??
        // LOINC codes each kind of unit separately, so another test's
        // unit only fits if it measures the same kind of quantity.
        (!catalogMarker &&
        reportedUnit &&
        marker.units.some(
          (option) => unitKind(option.ucum) === unitKind(reportedUnit)
        )
          ? { label: reportedUnit, ucum: reportedUnit }
          : undefined);
      if (!unit) {
        errors.push(
          `${marker.name} has an unsupported unit "${unitText}". Supported units: ${marker.units.map((option) => option.label).join(', ')}.`
        );
        return;
      }

      const range = readRange(item, marker.name, errors);
      if (!range) return;

      results.push({
        marker: marker.units.includes(unit)
          ? marker
          : { ...marker, units: [...marker.units, unit] },
        value: String(value),
        ...(bounded?.comparator && { comparator: bounded.comparator }),
        unit,
        ...range,
      });
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: { date, time, serviceProvider, results } };
}
