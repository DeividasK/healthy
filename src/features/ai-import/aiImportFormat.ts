import {
  describeAIOptions,
  isAbsent,
  matchAIOption,
  readAIDate,
  readAIReply,
  readText,
  type AIImportResult,
} from '@/src/utils/aiImport';
import {
  getConsultationAIFields,
  getConsultationAIRules,
  readConsultationFields,
  type ImportedConsultation,
} from '@/src/features/consultations/consultationAIImport';
import {
  getServiceRequestAIFields,
  getServiceRequestAIRules,
  readServiceRequestFields,
  type ImportedServiceRequest,
} from '@/src/features/service-requests/serviceRequestAIImport';
import {
  getTreatmentAIFields,
  getTreatmentAIRules,
  readTreatmentFields,
  type ImportedTreatment,
} from '@/src/features/treatments/treatmentAIImport';

/** Version marker the AI puts in its reply, so other JSON is not mistaken for it. */
export const AI_IMPORT_FORMAT_KEY = 'healthyImport';
export const AI_IMPORT_FORMAT_VERSION = 1;

export const CLINICAL_STATUS_OPTIONS = [
  { id: 'active', label: 'Active' },
  { id: 'recurrence', label: 'Recurrence' },
  { id: 'relapse', label: 'Relapse' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'remission', label: 'Remission' },
  { id: 'resolved', label: 'Resolved' },
] as const;

export const VERIFICATION_STATUS_OPTIONS = [
  { id: 'unconfirmed', label: 'Unconfirmed' },
  { id: 'provisional', label: 'Provisional' },
  { id: 'differential', label: 'Differential' },
  { id: 'confirmed', label: 'Confirmed' },
] as const;

export interface ImportedCondition {
  title: string;
  icd10: string | null;
  clinicalStatus: string;
  verificationStatus: string;
  onsetDate: string | null; // YYYY-MM-DD
  notes: string | null;
}

/** The records the import can propose. */
export type ProposalKind =
  'consultation' | 'condition' | 'serviceRequest' | 'treatment';

interface ProposalFields {
  /** Unique within the import: the AI's ref, or one made from the position. */
  ref: string;
  /** Where in the document the record came from, e.g. a section heading. */
  source: string | null;
  /** The consultation the record came from: diagnosed or ordered there. */
  consultationRef: string | null;
  /** Conditions it is for (service requests and treatments). */
  conditionRefs: string[];
}

export type ImportedProposal = ProposalFields &
  (
    | { kind: 'consultation'; data: ImportedConsultation }
    | { kind: 'condition'; data: ImportedCondition }
    | { kind: 'serviceRequest'; data: ImportedServiceRequest }
    | { kind: 'treatment'; data: ImportedTreatment }
  );

export interface ImportedRecords {
  /** The AI's one-sentence summary of the document, if given. */
  summary: string | null;
  proposals: ImportedProposal[];
}

const KIND_NAMES: Record<ProposalKind, string> = {
  consultation: 'consultation',
  condition: 'condition',
  serviceRequest: 'service request',
  treatment: 'treatment',
};

/** Fields every record shares, ahead of its own. */
const LINK_FIELDS = `    "ref": "A short id you choose, e.g. visit1",
    "source": "Where the document shows it, e.g. a section heading",`;

const indent = (fields: string) =>
  fields
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');

/**
 * Instructions the user gives their own AI assistant with any health
 * document, so it proposes every record the document holds in the format
 * `parseAIImportReply` reads, linked to each other.
 */
export function buildAIImportInstructions(): string {
  return `I want to add the records in a health document to my health app. Read the document I'm sharing with you (for example a visit summary, a discharge letter, a referral or a prescription) and convert what it records into the format below. I'll check each record before it is added.

Reply with exactly one JSON code block in this format:

\`\`\`json
{
  "${AI_IMPORT_FORMAT_KEY}": ${AI_IMPORT_FORMAT_VERSION},
  "summary": "One sentence on what the document holds",
  "records": [
    {
      "type": "consultation",
${LINK_FIELDS}
${indent(getConsultationAIFields({ withDiagnoses: false }))}
    },
    {
      "type": "condition",
${LINK_FIELDS}
      "consultation": "visit1",
      "name": "Diagnosis name",
      "icd10": "ICD-10 code",
      "status": "active",
      "verification": "confirmed",
      "onset": "YYYY-MM-DD",
      "notes": "Anything else worth keeping"
    },
    {
      "type": "serviceRequest",
${LINK_FIELDS}
      "consultation": "visit1",
      "conditions": ["dx1"],
${indent(getServiceRequestAIFields())}
    },
    {
      "type": "treatment",
${LINK_FIELDS}
      "consultation": "visit1",
      "conditions": ["dx1"],
${indent(getTreatmentAIFields())}
    }
  ]
}
\`\`\`

Rules:
- Add one record for each consultation, diagnosis, service request (a test, scan, procedure, therapy or referral a doctor ordered or recommended) and treatment (a medication or supplement) the document records. Leave out record types the document doesn't have.
- Give every record a "ref" that is unique in the reply, and in "source" name where the document shows it, for example "3.11. Treatment plan".
- Link records with their refs: "consultation" is the visit a diagnosis was made at or a service or treatment was ordered at, and "conditions" lists the diagnoses a service or treatment is for. Only use refs of records in the reply.
- "summary" says in one sentence what the document holds, in my language.

Consultation fields:
${getConsultationAIRules({ withDiagnoses: false })}

Condition fields:
- "name" is the diagnosis as the document words it. Add "icd10" only when the document shows its ICD-10 code.
- "status" is one of: ${describeAIOptions(CLINICAL_STATUS_OPTIONS)}.
- "verification" is one of: ${describeAIOptions(VERIFICATION_STATUS_OPTIONS)}. Use "provisional" for a suspected diagnosis.
- "onset" is the day it started, if the document shows it.

Service request fields:
${getServiceRequestAIRules()}

Treatment fields:
${getTreatmentAIRules()}

- Numbers use a dot as the decimal separator.
- Keep the document's language for names and text.
- Leave out any field the document doesn't show. Don't add any other fields.`;
}

function readConditionFields(
  reply: Record<string, unknown>,
  today: Date
): AIImportResult<ImportedCondition> {
  const errors: string[] = [];
  const title = readText(reply.name);
  if (!title) errors.push('The diagnosis name is missing.');
  const readOption = (
    field: string,
    options: readonly { id: string; label: string }[],
    fallback: string
  ) => {
    if (isAbsent(reply[field])) return fallback;
    const option = matchAIOption(reply[field], options);
    if (!option)
      errors.push(
        `The ${field} must be one of: ${options.map(({ label }) => label).join(', ')}.`
      );
    return option?.id ?? fallback;
  };
  const clinicalStatus = readOption(
    'status',
    CLINICAL_STATUS_OPTIONS,
    'active'
  );
  const verificationStatus = readOption(
    'verification',
    VERIFICATION_STATUS_OPTIONS,
    'unconfirmed'
  );
  const onsetDate = readAIDate(reply.onset, errors, {
    label: 'The onset date',
    required: false,
    today,
  });
  if (errors.length > 0 || !title) return { ok: false, errors };
  return {
    ok: true,
    data: {
      title,
      icd10: readText(reply.icd10),
      clinicalStatus,
      verificationStatus,
      onsetDate,
      notes: readText(reply.notes),
    },
  };
}

const KINDS: Record<string, ProposalKind> = {
  consultation: 'consultation',
  condition: 'condition',
  diagnosis: 'condition',
  servicerequest: 'serviceRequest',
  treatment: 'treatment',
};

const readKind = (value: unknown): ProposalKind | undefined =>
  typeof value === 'string'
    ? KINDS[value.replace(/[\s_-]/g, '').toLowerCase()]
    : undefined;

/**
 * Reads the records an AI reply written to `buildAIImportInstructions`
 * proposes. Returns every problem found, so the user can fix the reply in
 * one go.
 */
export function parseAIImportReply(
  text: string,
  today: Date = new Date()
): AIImportResult<ImportedRecords> {
  const read = readAIReply(text, 'health records');
  if (!read.ok) return read;
  const { reply } = read;
  if (!Array.isArray(reply.records) || reply.records.length === 0)
    return { ok: false, errors: ['The reply has no records.'] };

  const errors: string[] = [];
  const proposals: ImportedProposal[] = [];
  const refs = new Map<string, ProposalKind>();
  const links: { index: number; consultation: unknown; conditions: unknown }[] =
    [];

  reply.records.forEach((entry, index) => {
    const record = (
      entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {}
    ) as Record<string, unknown>;
    const kind = readKind(record.type);
    const label = `Record ${index + 1}`;
    if (!kind) {
      errors.push(
        `${label}: the type must be consultation, condition, serviceRequest or treatment.`
      );
      return;
    }
    const named = `${label} (${KIND_NAMES[kind]})`;
    const result =
      kind === 'consultation'
        ? readConsultationFields(record, today)
        : kind === 'condition'
          ? readConditionFields(record, today)
          : kind === 'serviceRequest'
            ? readServiceRequestFields(record, today)
            : readTreatmentFields(record, today);
    if (!result.ok) {
      errors.push(...result.errors.map((error) => `${named}: ${error}`));
      return;
    }
    const ref = readText(record.ref) ?? `record-${index + 1}`;
    if (refs.has(ref)) {
      errors.push(`${named}: the ref "${ref}" is used by another record.`);
      return;
    }
    refs.set(ref, kind);
    links.push({
      index: proposals.length,
      consultation: record.consultation,
      conditions: record.conditions,
    });
    proposals.push({
      kind,
      data: result.data,
      ref,
      source: readText(record.source),
      consultationRef: null,
      conditionRefs: [],
    } as ImportedProposal);
    // Diagnoses given inside a consultation become its condition records.
    if (result.ok && kind === 'consultation') {
      const { diagnoses } = result.data as ImportedConsultation;
      diagnoses.forEach((diagnosis, at) => {
        let diagnosisRef = `${ref}-diagnosis-${at + 1}`;
        while (refs.has(diagnosisRef)) diagnosisRef += '-1';
        refs.set(diagnosisRef, 'condition');
        proposals.push({
          kind: 'condition',
          data: {
            title: diagnosis.title,
            icd10: diagnosis.terminology?.code ?? null,
            clinicalStatus: 'active',
            verificationStatus: 'unconfirmed',
            onsetDate: null,
            notes: null,
          },
          ref: diagnosisRef,
          source: readText(record.source),
          consultationRef: ref,
          conditionRefs: [],
        });
      });
      (result.data as ImportedConsultation).diagnoses = [];
    }
  });

  // Links are read once every ref is known, so records can come in any order.
  for (const { index, consultation, conditions } of links) {
    const proposal = proposals[index];
    const named = `The ${KIND_NAMES[proposal.kind]} "${proposal.data.title}"`;
    if (proposal.kind === 'consultation') continue;
    if (!isAbsent(consultation)) {
      const ref = readText(consultation);
      if (!ref || refs.get(ref) !== 'consultation')
        errors.push(
          `${named} links to "${String(consultation)}", which is not a consultation in the reply.`
        );
      else proposal.consultationRef = ref;
    }
    if (proposal.kind === 'condition' || isAbsent(conditions)) continue;
    const list = Array.isArray(conditions) ? conditions : [conditions];
    for (const item of list) {
      const ref = readText(item);
      if (!ref || refs.get(ref) !== 'condition')
        errors.push(
          `${named} links to "${String(item)}", which is not a condition in the reply.`
        );
      else if (!proposal.conditionRefs.includes(ref))
        proposal.conditionRefs.push(ref);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: { summary: readText(reply.summary), proposals } };
}
