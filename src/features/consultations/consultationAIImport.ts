import {
  readAIDate,
  readAIReply,
  readAITime,
  readText,
  type AIImportResult,
} from '@/src/utils/aiImport';
import type { ConsultationDiagnosisInput } from './consultationService';

/** Version marker the AI puts in its reply, so other JSON is not mistaken for it. */
export const CONSULTATION_AI_FORMAT_KEY = 'healthyConsultation';
export const CONSULTATION_AI_FORMAT_VERSION = 1;

export const ICD_10_SYSTEM = 'http://hl7.org/fhir/sid/icd-10';

const STATUSES = ['completed', 'planned'] as const;

export interface ImportedConsultation {
  title: string;
  status: (typeof STATUSES)[number];
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM
  specialist: string | null;
  serviceProvider: string | null;
  serviceType: string | null;
  diagnoses: ConsultationDiagnosisInput[];
  notes: string | null;
}

/**
 * A consultation reply's fields, one per line, as the AI's format shows them.
 * The combined import lists diagnoses as condition records instead.
 */
export function getConsultationAIFields({ withDiagnoses = true } = {}): string {
  return `  "title": "Short name of the visit",
  "status": "completed",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "specialist": "Name of the doctor",
  "serviceProvider": "Name of the clinic or hospital",
  "serviceType": "Medical specialty",${
    withDiagnoses
      ? `
  "diagnoses": [
    { "name": "Diagnosis name", "icd10": "ICD-10 code" }
  ],`
      : ''
  }
  "notes": "Summary of the visit"`;
}

/** The rules for a consultation's fields, shared with the combined import. */
export function getConsultationAIRules({ withDiagnoses = true } = {}): string {
  return `- "title" names the visit, for example "Cardiology follow-up" or "Annual checkup".
- "status" is "completed" for a visit that took place and "planned" for one that is booked for later.
- "date" is the day of the visit and "time" its 24-hour start time. Leave "time" out if the document doesn't show it.
- "specialist" is the doctor seen, "serviceProvider" the clinic or hospital, and "serviceType" the medical specialty, for example "Cardiology" or "General practice".${
    withDiagnoses
      ? `
- Add one entry to "diagnoses" for each diagnosis made at the visit. Add "icd10" only when the document shows the diagnosis's ICD-10 code.`
      : ''
  }
- "notes" summarizes the findings, advice and next steps in plain text.`;
}

/**
 * Instructions the user gives their own AI assistant together with a
 * consultation document (e.g. a visit summary or discharge letter), so it
 * replies in the format `parseConsultationAIReply` reads.
 */
export function buildConsultationAIInstructions(): string {
  return `I want to add a doctor's consultation to my health app. Read the document I'm sharing with you (for example a visit summary, a discharge letter or an appointment confirmation) and convert it into the format below.

Reply with exactly one JSON code block in this format:

\`\`\`json
{
  "${CONSULTATION_AI_FORMAT_KEY}": ${CONSULTATION_AI_FORMAT_VERSION},
${getConsultationAIFields()}
}
\`\`\`

Rules:
${getConsultationAIRules()}
- If the document covers several visits, convert only the one I ask for, or else the latest one, and list the others in a short note before the code block.
- Keep the document's language for names and text.
- Leave out any field the document doesn't show. Don't add any other fields.`;
}

/**
 * Reads a consultation from an AI reply written to
 * `buildConsultationAIInstructions`. Returns every problem found, so the user
 * can fix the reply in one go.
 */
export function parseConsultationAIReply(
  text: string,
  today: Date = new Date()
): AIImportResult<ImportedConsultation> {
  const read = readAIReply(text, 'a consultation');
  if (!read.ok) return read;
  return readConsultationFields(read.reply, today);
}

/** Reads a consultation's fields from a reply object, e.g. one record of a combined import. */
export function readConsultationFields(
  reply: Record<string, unknown>,
  today: Date = new Date()
): AIImportResult<ImportedConsultation> {
  const errors: string[] = [];

  const title = readText(reply.title);
  if (!title) errors.push('The consultation title is missing.');

  let status: ImportedConsultation['status'] = 'completed';
  if (reply.status !== undefined && reply.status !== null) {
    const found = STATUSES.find(
      (option) =>
        typeof reply.status === 'string' &&
        option === reply.status.trim().toLowerCase()
    );
    if (found) status = found;
    else errors.push('The status must be "completed" or "planned".');
  }

  // Planned visits are booked for a later day.
  const date = readAIDate(reply.date, errors, {
    today,
    allowFuture: status === 'planned',
  });
  const time = readAITime(reply.time, errors);

  const diagnoses: ConsultationDiagnosisInput[] = [];
  if (reply.diagnoses !== undefined && reply.diagnoses !== null) {
    if (!Array.isArray(reply.diagnoses))
      errors.push('The diagnoses must be a list.');
    else
      reply.diagnoses.forEach((entry, index) => {
        const item = (entry ?? {}) as Record<string, unknown>;
        const name = readText(item.name);
        if (!name) {
          errors.push(`Diagnosis ${index + 1} has no name.`);
          return;
        }
        const code = readText(item.icd10);
        diagnoses.push({
          title: name,
          terminology: code ? { system: ICD_10_SYSTEM, code } : {},
        });
      });
  }

  if (errors.length > 0 || !title || !date) return { ok: false, errors };
  return {
    ok: true,
    data: {
      title,
      status,
      date,
      time,
      specialist: readText(reply.specialist),
      serviceProvider: readText(reply.serviceProvider),
      serviceType: readText(reply.serviceType),
      diagnoses,
      notes: readText(reply.notes),
    },
  };
}
