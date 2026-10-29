import type { MedicationRequest } from 'fhir/r5';
import {
  describeAIOptions,
  isAbsent,
  matchAIOption,
  normalizeTime,
  parseAIValue,
  readAIDate,
  readAIReply,
  readText,
  type AIImportResult,
} from '@/src/utils/aiImport';
import {
  OFFERED_WHEN,
  getAmountUnitOptions,
  getCourseUnitOptions,
  getPeriodUnitOptions,
  getRouteOptions,
  getWhenLabel,
  validateQuantity,
  validateRegimen,
  type DoseDraft,
  type QuantityDraft,
  type RegimenDraft,
} from './regimen';
import {
  getTreatmentIntentOptions,
  getTreatmentStatusOptions,
} from './treatmentLabels';

/** Version marker the AI puts in its reply, so other JSON is not mistaken for it. */
export const TREATMENT_AI_FORMAT_KEY = 'healthyTreatment';
export const TREATMENT_AI_FORMAT_VERSION = 1;

const INTENT_OPTIONS = getTreatmentIntentOptions('plan');
const STATUS_OPTIONS = getTreatmentStatusOptions('active');
const AMOUNT_UNIT_OPTIONS = getAmountUnitOptions();
const ROUTE_OPTIONS = getRouteOptions();
const PERIOD_UNIT_OPTIONS = getPeriodUnitOptions();
const COURSE_UNIT_OPTIONS = getCourseUnitOptions();
const WHEN_OPTIONS = OFFERED_WHEN.map((code) => ({
  id: code,
  label: getWhenLabel(code),
}));

export interface ImportedTreatment {
  title: string;
  intent: MedicationRequest['intent'] | null;
  status: MedicationRequest['status'] | null;
  authoredDate: string | null; // YYYY-MM-DD
  requester: string | null;
  /** Structured doses; when given, `dosage` is null. */
  regimen: RegimenDraft | null;
  /** Dosage instructions as text, for dosing a regimen can't describe. */
  dosage: string | null;
  dispenseQuantity: QuantityDraft | null;
  reason: string | null;
  notes: string | null;
}

/**
 * Reads a time of day: a part of the day (e.g. "MORN" or "Morning") or a
 * 24-hour time. Null when absent or invalid, adding a problem to `errors`.
 */
export function readAITimeOfDay(
  value: unknown,
  errors: string[]
): { when: string; time: string } | null {
  if (isAbsent(value)) return null;
  const when = matchAIOption(value, WHEN_OPTIONS);
  if (when) return { when: when.id, time: '' };
  const time = typeof value === 'string' ? normalizeTime(value) : null;
  if (time) return { when: '', time };
  errors.push(
    `The time of day must be one of: ${WHEN_OPTIONS.map(({ label }) => label).join(', ')}, or a time such as 07:30.`
  );
  return null;
}

/** Amount units match their code or name, singular or plural (e.g. "tablet"). */
function matchAmountUnit(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const clean = (text: string) =>
    text
      .trim()
      .toLowerCase()
      .replace(/[[\]{}]/g, '')
      .replace(/s$/, '');
  return AMOUNT_UNIT_OPTIONS.find(
    ({ id, label }) =>
      clean(id) === clean(value) || clean(label) === clean(value)
  );
}

/** A treatment reply's fields, one per line, as the AI's format shows them. */
export function getTreatmentAIFields(): string {
  return `  "name": "Medication name and strength",
  "intent": "order",
  "status": "active",
  "date": "YYYY-MM-DD",
  "requester": "Name of the doctor who prescribed it",
  "regimen": [
    {
      "doses": [
        { "amount": 1, "unit": "tablet", "route": "Oral", "times": 1, "every": 1, "everyUnit": "d", "timeOfDay": "MORN", "courseLength": 7, "courseUnit": "d", "instructions": "Take with food" }
      ]
    }
  ],
  "dosage": "Dosage instructions as text",
  "quantity": { "value": 30, "unit": "tablet" },
  "reason": "Why it was prescribed",
  "notes": "Anything else worth keeping"`;
}

/** The rules for a treatment's fields, shared with the combined import. */
export function getTreatmentAIRules(): string {
  return `- "name" is the medication's name with its strength and form, for example "Amoxicillin 500 mg capsules".
- "intent" is one of: ${describeAIOptions(INTENT_OPTIONS)}. Use "order" for a prescription and "plan" for a recommendation.
- "status" is one of: ${describeAIOptions(STATUS_OPTIONS)}.
- "date" is the day it was prescribed or recommended.
- "regimen" describes how to take it: one entry per phase, in order (for example a starting dose, then a higher one). A phase's "doses" are taken alongside each other; add one dose for each time of day when the amount or time differs, for example 1 tablet in the morning and 2 in the evening.
- In a dose, "amount" is how much each time ("amountMax" the most, when a range is given) and "unit" one of: ${AMOUNT_UNIT_OPTIONS.map(({ label }) => `"${label}"`).join(', ')}. "route" is one of: ${ROUTE_OPTIONS.map(({ label }) => `"${label}"`).join(', ')}.
- "times" is how many times it is taken ("timesMax" the most, when a range is given) every "every" "everyUnit", where "everyUnit" is one of: ${describeAIOptions(PERIOD_UNIT_OPTIONS)}. Twice a day is "times": 2, "every": 1, "everyUnit": "d".
- "timeOfDay" is one of: ${describeAIOptions(WHEN_OPTIONS)}, or a 24-hour time such as "07:30".
- "courseLength" is how long the phase lasts, in "courseUnit": one of ${describeAIOptions(COURSE_UNIT_OPTIONS)}. Leave both out when it is taken until further notice.
- "site" is where on the body it is applied, and "instructions" any instructions for that dose, for example "Take with food".
- Give "dosage" as text only when the dosing can't be described as a regimen, and leave out "regimen" then.
- "quantity" is how much is dispensed, with a unit from the dose units.`;
}

/**
 * Instructions the user gives their own AI assistant together with a
 * prescription or treatment plan, so it replies in the format
 * `parseTreatmentAIReply` reads.
 */
export function buildTreatmentAIInstructions(): string {
  return `I want to add a treatment (a medication or supplement) to my health app. Read the document I'm sharing with you (for example a prescription, a medication label or a visit summary) and convert it into the format below.

Reply with exactly one JSON code block in this format:

\`\`\`json
{
  "${TREATMENT_AI_FORMAT_KEY}": ${TREATMENT_AI_FORMAT_VERSION},
${getTreatmentAIFields()}
}
\`\`\`

Rules:
${getTreatmentAIRules()}
- If the document has several treatments, convert only the one I ask for, or else the first one, and list the others in a short note before the code block.
- Numbers use a dot as the decimal separator.
- Keep the document's language for names and text.
- Leave out any field the document doesn't show. Don't add any other fields.`;
}

/**
 * Reads a treatment from an AI reply written to `buildTreatmentAIInstructions`.
 * Returns every problem found, so the user can fix the reply in one go.
 */
export function parseTreatmentAIReply(
  text: string,
  today: Date = new Date()
): AIImportResult<ImportedTreatment> {
  const read = readAIReply(text, 'a treatment');
  if (!read.ok) return read;
  return readTreatmentFields(read.reply, today);
}

/** Reads a treatment's fields from a reply object, e.g. one record of a combined import. */
export function readTreatmentFields(
  reply: Record<string, unknown>,
  today: Date = new Date()
): AIImportResult<ImportedTreatment> {
  const errors: string[] = [];

  const title = readText(reply.name);
  if (!title) errors.push('The treatment name is missing.');

  const readOption = (
    field: string,
    options: readonly { id: string; label: string }[]
  ): string | null => {
    if (isAbsent(reply[field])) return null;
    const option = matchAIOption(reply[field], options);
    if (!option)
      errors.push(
        `The ${field} must be one of: ${options.map(({ label }) => label).join(', ')}.`
      );
    return option?.id ?? null;
  };
  const intent = readOption('intent', INTENT_OPTIONS);
  const status = readOption('status', STATUS_OPTIONS);
  const authoredDate = readAIDate(reply.date, errors, {
    required: false,
    today,
  });

  /** A number field as the form's text, or '' when absent. */
  const numberText = (value: unknown, label: string) => {
    if (isAbsent(value)) return '';
    const number = parseAIValue(value);
    if (number === undefined) errors.push(`${label} must be a number.`);
    return number === undefined ? '' : String(number);
  };

  let regimen: RegimenDraft | null = null;
  const errorsBeforeRegimen = errors.length;
  if (!isAbsent(reply.regimen)) {
    if (!Array.isArray(reply.regimen) || reply.regimen.length === 0)
      errors.push('The regimen must be a list of phases.');
    else {
      const multiplePhases = reply.regimen.length > 1;
      regimen = {
        phases: reply.regimen.map((phase, phaseIndex) => {
          const doses = (phase as Record<string, unknown> | null)?.doses;
          const phaseName = multiplePhases ? `Phase ${phaseIndex + 1}` : '';
          if (!Array.isArray(doses) || doses.length === 0) {
            errors.push(`${phaseName || 'The regimen'} has no doses.`);
            return { doses: [] };
          }
          return {
            doses: doses.map((entry, doseIndex): DoseDraft => {
              const dose = (entry ?? {}) as Record<string, unknown>;
              const name = [
                phaseName,
                doses.length > 1 ? `dose ${doseIndex + 1}` : '',
              ]
                .filter(Boolean)
                .join(', ');
              const prefix = name
                ? `${name[0].toUpperCase()}${name.slice(1)}: `
                : '';
              const pick = (
                field: string,
                label: string,
                options: readonly { id: string; label: string }[],
                fallback = ''
              ) => {
                if (isAbsent(dose[field])) return fallback;
                const option = matchAIOption(dose[field], options);
                if (!option)
                  errors.push(
                    `${prefix}"${dose[field]}" is not a supported ${label}.`
                  );
                return option?.id ?? fallback;
              };
              const unit = matchAmountUnit(dose.unit);
              if (!isAbsent(dose.unit) && !unit)
                errors.push(`${prefix}"${dose.unit}" is not a supported unit.`);
              const timeOfDay = readAITimeOfDay(dose.timeOfDay, errors);
              return {
                amount: numberText(dose.amount, `${prefix}Amount`),
                amountMax: numberText(dose.amountMax, `${prefix}Max amount`),
                unit: unit?.id ?? AMOUNT_UNIT_OPTIONS[0].id,
                route: pick('route', 'route', ROUTE_OPTIONS),
                timing: {
                  frequency: numberText(dose.times, `${prefix}Times`),
                  frequencyMax: numberText(dose.timesMax, `${prefix}Max times`),
                  period: numberText(dose.every, `${prefix}Every`) || '1',
                  periodUnit: pick(
                    'everyUnit',
                    'period',
                    PERIOD_UNIT_OPTIONS,
                    'd'
                  ),
                  when: timeOfDay?.when ?? '',
                  timeOfDay: timeOfDay?.time ?? '',
                  boundsValue: numberText(
                    dose.courseLength,
                    `${prefix}Course length`
                  ),
                  boundsUnit: pick(
                    'courseUnit',
                    'course length unit',
                    COURSE_UNIT_OPTIONS,
                    'd'
                  ),
                },
                site: readText(dose.site) ?? '',
                patientInstruction: readText(dose.instructions) ?? '',
              };
            }),
          };
        }),
      };
      // The form's own checks, once each dose's fields could be read.
      const problem =
        errors.length === errorsBeforeRegimen && validateRegimen(regimen);
      if (problem) errors.push(`${problem}.`);
    }
  }

  let dispenseQuantity: QuantityDraft | null = null;
  if (!isAbsent(reply.quantity)) {
    const quantity = (
      typeof reply.quantity === 'object' ? reply.quantity : {}
    ) as Record<string, unknown>;
    const unit = matchAmountUnit(quantity.unit);
    if (!unit)
      errors.push(
        isAbsent(quantity.unit)
          ? 'The quantity has no unit.'
          : `"${quantity.unit}" is not a supported quantity unit.`
      );
    dispenseQuantity = {
      value: numberText(quantity.value, 'The quantity'),
      unit: unit?.id ?? '',
    };
    const problem =
      validateQuantity(dispenseQuantity, 'The quantity') ||
      (!dispenseQuantity.value && 'The quantity has no value');
    if (unit && problem) errors.push(`${problem}.`);
  }

  if (errors.length > 0 || !title) return { ok: false, errors };
  return {
    ok: true,
    data: {
      title,
      intent: intent as MedicationRequest['intent'] | null,
      status: status as MedicationRequest['status'] | null,
      authoredDate,
      requester: readText(reply.requester),
      regimen,
      // A regimen describes the dosing; text is only for what it can't.
      dosage: regimen ? null : readText(reply.dosage),
      dispenseQuantity,
      reason: readText(reply.reason),
      notes: readText(reply.notes),
    },
  };
}
