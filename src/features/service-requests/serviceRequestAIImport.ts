import type { ServiceRequest } from 'fhir/r5';
import {
  describeAIOptions,
  isAbsent,
  matchAIOption,
  parseAIValue,
  readAIDate,
  readAIReply,
  readText,
  type AIImportResult,
} from '@/src/utils/aiImport';
import {
  OFFERED_WHEN,
  SPECIFIC_TIME,
  getCourseUnitOptions,
  getWhenLabel,
} from '@/src/features/treatments/regimen';
import {
  SERVICE_REQUEST_CATEGORIES,
  getServiceRequestIntentOptions,
  getServiceRequestStatusOptions,
} from './serviceRequestLabels';
import {
  parseScheduleDraft,
  type ScheduleDraft,
} from './serviceRequestSchedule';
import { readAITimeOfDay } from '@/src/features/treatments/treatmentAIImport';

/** Version marker the AI puts in its reply, so other JSON is not mistaken for it. */
export const SERVICE_REQUEST_AI_FORMAT_KEY = 'healthyServiceRequest';
export const SERVICE_REQUEST_AI_FORMAT_VERSION = 1;

const CATEGORY_OPTIONS = SERVICE_REQUEST_CATEGORIES.map(({ code, label }) => ({
  id: code,
  label,
}));
const INTENT_OPTIONS = getServiceRequestIntentOptions('plan');
const STATUS_OPTIONS = getServiceRequestStatusOptions('unknown');
const UNIT_OPTIONS = getCourseUnitOptions();

export interface ImportedServiceRequest {
  title: string;
  /** Category option id (a SNOMED code), or null when not given. */
  category: string | null;
  intent: ServiceRequest['intent'] | null;
  status: ServiceRequest['status'] | null;
  authoredDate: string | null; // YYYY-MM-DD
  plannedDate: string | null; // YYYY-MM-DD
  /** How it repeats, with '' for details not given. */
  schedule: ScheduleDraft | null;
  requester: string | null;
  instructions: string | null;
  reason: string | null;
  notes: string | null;
}

/**
 * Instructions the user gives their own AI assistant together with a referral
 * or order, so it replies in the format `parseServiceRequestAIReply` reads.
 */
export function buildServiceRequestAIInstructions(): string {
  return `I want to add a service request (a test, scan, procedure or referral a doctor ordered or recommended) to my health app. Read the document I'm sharing with you (for example a referral, an order or a visit summary) and convert it into the format below.

Reply with exactly one JSON code block in this format:

\`\`\`json
{
  "${SERVICE_REQUEST_AI_FORMAT_KEY}": ${SERVICE_REQUEST_AI_FORMAT_VERSION},
  "service": "Name of the requested service",
  "category": "Imaging",
  "intent": "order",
  "status": "active",
  "date": "YYYY-MM-DD",
  "plannedDate": "YYYY-MM-DD",
  "repeats": { "every": 4, "upToEvery": 6, "unit": "wk", "sessions": 3, "minutes": 30, "timeOfDay": "MORN" },
  "requester": "Name of the doctor who requested it",
  "instructions": "Instructions for the patient",
  "reason": "Why it was requested",
  "notes": "Anything else worth keeping"
}
\`\`\`

Rules:
- "service" names what was requested, for example "Abdominal ultrasound" or "Physiotherapy".
- "category" is one of: ${CATEGORY_OPTIONS.map(({ label }) => `"${label}"`).join(', ')}.
- "intent" is one of: ${describeAIOptions(INTENT_OPTIONS)}. Use "order" when a doctor ordered or referred it and "plan" when it was only recommended.
- "status" is one of: ${describeAIOptions(STATUS_OPTIONS)}.
- "date" is the day it was requested.
- "plannedDate" is the day it is booked for, if it happens once.
- "repeats" is only for a service that repeats, for example 3 sessions every 4 to 6 weeks; leave out "plannedDate" then. "every" is how often it repeats, "upToEvery" the longest interval when a range is given, and "unit" one of: ${describeAIOptions(UNIT_OPTIONS)}. "sessions" is how many times in total, "minutes" how long each time takes, and "timeOfDay" one of: ${describeAIOptions(OFFERED_WHEN.map((code) => ({ id: code, label: getWhenLabel(code) })))}, or a 24-hour time such as "07:30".
- "reason" is a short reason, for example a symptom or condition.
- If the document requests several services, convert only the one I ask for, or else the first one, and list the others in a short note before the code block.
- Numbers use a dot as the decimal separator.
- Keep the document's language for names and text.
- Leave out any field the document doesn't show. Don't add any other fields.`;
}

/** Reads an optional number field as the form's text, or '' when absent. */
function readNumberText(
  value: unknown,
  label: string,
  errors: string[]
): string {
  if (isAbsent(value)) return '';
  const number = parseAIValue(value);
  if (number === undefined) {
    errors.push(`${label} must be a number.`);
    return '';
  }
  return String(number);
}

/**
 * Reads a service request from an AI reply written to
 * `buildServiceRequestAIInstructions`. Returns every problem found, so the
 * user can fix the reply in one go.
 */
export function parseServiceRequestAIReply(
  text: string,
  today: Date = new Date()
): AIImportResult<ImportedServiceRequest> {
  const read = readAIReply(text, 'a service request');
  if (!read.ok) return read;
  const { reply } = read;
  const errors: string[] = [];

  const title = readText(reply.service);
  if (!title) errors.push('The service name is missing.');

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
  const category = readOption('category', CATEGORY_OPTIONS);
  const intent = readOption('intent', INTENT_OPTIONS);
  const status = readOption('status', STATUS_OPTIONS);

  const authoredDate = readAIDate(reply.date, errors, {
    required: false,
    today,
  });
  const plannedDate = readAIDate(reply.plannedDate, errors, {
    label: 'The planned date',
    required: false,
    allowFuture: true,
  });

  let schedule: ScheduleDraft | null = null;
  if (!isAbsent(reply.repeats)) {
    const repeats = (
      typeof reply.repeats === 'object' ? reply.repeats : {}
    ) as Record<string, unknown>;
    const unit = matchAIOption(repeats.unit, UNIT_OPTIONS);
    const timeOfDay = readAITimeOfDay(repeats.timeOfDay, errors);
    schedule = {
      period: readNumberText(repeats.every, 'Repeats every', errors),
      periodUnit: unit?.id ?? '',
      periodMax: readNumberText(repeats.upToEvery, 'Up to every', errors),
      count: readNumberText(repeats.sessions, 'Sessions', errors),
      duration: readNumberText(repeats.minutes, 'Minutes', errors),
      timeChoice: timeOfDay?.when || (timeOfDay ? SPECIFIC_TIME : ''),
      time: timeOfDay?.time || '08:00',
    };
    // The form's own checks, for the details the reply gives.
    const problem = parseScheduleDraft(schedule, {
      periodMax: Boolean(schedule.periodMax),
      count: Boolean(schedule.count),
      duration: Boolean(schedule.duration),
      timeOfDay: Boolean(schedule.timeChoice),
    });
    if (typeof problem === 'string') errors.push(`${problem}.`);
    if (plannedDate)
      errors.push('Give either a planned date or how it repeats, not both.');
  }

  if (errors.length > 0 || !title) return { ok: false, errors };
  return {
    ok: true,
    data: {
      title,
      category,
      intent: intent as ServiceRequest['intent'] | null,
      status: status as ServiceRequest['status'] | null,
      authoredDate,
      plannedDate,
      schedule,
      requester: readText(reply.requester),
      instructions: readText(reply.instructions),
      reason: readText(reply.reason),
      notes: readText(reply.notes),
    },
  };
}
