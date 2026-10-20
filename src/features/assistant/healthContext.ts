import type { Observation } from 'fhir/r5';
import type { ResourceMeta } from '@/src/components/ResourceSection';
import { getAllConditions } from '@/src/features/conditions/conditionService';
import { getConditionMeta } from '@/src/features/conditions/ConditionRelatedRow';
import { getAllConsultations } from '@/src/features/consultations/consultationService';
import { getConsultationMeta } from '@/src/features/consultations/ConsultationRelatedRow';
import { getAllReports } from '@/src/features/lab-results/diagnosticReportService';
import {
  getLabResultMeta,
  getLabResultTitle,
} from '@/src/features/lab-results/labResultMeta';
import { getPatient } from '@/src/features/profile/patientService';
import { getPatientDisplayName } from '@/src/features/profile/patientNames';
import { getAllServiceRequests } from '@/src/features/service-requests/serviceRequestService';
import { getServiceRequestMeta } from '@/src/features/service-requests/ServiceRequestRelatedRow';
import { getAllTreatments } from '@/src/features/treatments/treatmentService';
import { getTreatmentMeta } from '@/src/features/treatments/TreatmentRelatedRow';
import {
  getConditionNotes,
  getConditionTitle,
  getConsultationNotes,
  getConsultationTitle,
  getServiceRequestTitle,
  getTreatmentInstructions,
  getTreatmentReason,
  getTreatmentTitle,
} from '@/src/utils/fhirUtils';
import { clip, fitSections } from './assistantText';

/**
 * About 1,500 tokens of records, leaving room in the model's 4,096-token
 * context window for the instructions and a short conversation.
 */
const MAX_RECORD_CHARS = 6000;
const MAX_NOTE_CHARS = 200;

const byDateDesc =
  <T>(date: (item: T) => string | undefined) =>
  (a: T, b: T) =>
    (date(b) ?? '').localeCompare(date(a) ?? '');

/** One record as a list line: title, the meta line shown in the app, then details. */
function recordLine(
  title: string,
  meta: ResourceMeta[],
  details: (string | null | undefined)[] = []
) {
  const parts = [
    meta.map((item) => item.text).join(', '),
    ...details.filter(Boolean),
  ].filter(Boolean);
  return `- ${title}${parts.length ? ` (${parts.join('; ')})` : ''}`;
}

function observationText(observation: Observation) {
  const name = observation.code?.text || observation.code?.coding?.[0]?.display;
  const quantity = observation.valueQuantity;
  const value = quantity
    ? `${quantity.value} ${quantity.unit ?? ''}`.trim()
    : observation.valueString || observation.valueCodeableConcept?.text;
  if (!name || value === undefined) return null;
  const range = observation.referenceRange?.[0];
  const rangeText =
    range?.low?.value !== undefined || range?.high?.value !== undefined
      ? ` [range ${range?.low?.value ?? ''}–${range?.high?.value ?? ''}]`
      : '';
  const flag = observation.interpretation?.[0]?.coding?.[0]?.display;
  return `${name} ${value}${rangeText}${flag ? ` ${flag}` : ''}`;
}

/** The active profile's records as compact text for the model's instructions. */
export async function buildHealthContext(patientId: string): Promise<string> {
  const [patient, conditions, treatments, consultations, reports, requests] =
    await Promise.all([
      getPatient(patientId),
      getAllConditions(patientId),
      getAllTreatments(patientId),
      getAllConsultations(patientId),
      getAllReports(patientId),
      getAllServiceRequests(patientId),
    ]);

  const about = [
    `Name: ${getPatientDisplayName(patient)}`,
    patient?.birthDate && `Born: ${patient.birthDate}`,
    patient?.gender && `Gender: ${patient.gender}`,
  ].filter((line): line is string => !!line);

  const records = fitSections(
    [
      {
        heading: 'Conditions:',
        lines: [...conditions]
          .sort(byDateDesc((item) => item.onsetDateTime))
          .map((condition) => {
            const notes = getConditionNotes(condition);
            return recordLine(
              getConditionTitle(condition),
              getConditionMeta(condition),
              [notes && `notes: ${clip(notes, MAX_NOTE_CHARS)}`]
            );
          }),
      },
      {
        heading: 'Treatments:',
        lines: [...treatments]
          .sort(byDateDesc((item) => item.authoredOn))
          // Current treatments first.
          .sort(
            (a, b) =>
              Number(b.status === 'active') - Number(a.status === 'active')
          )
          .map((treatment) => {
            const instructions = getTreatmentInstructions(treatment);
            const reason = getTreatmentReason(treatment);
            return recordLine(
              getTreatmentTitle(treatment),
              getTreatmentMeta(treatment),
              [
                instructions && `dosage: ${clip(instructions, MAX_NOTE_CHARS)}`,
                reason && `reason: ${clip(reason, MAX_NOTE_CHARS)}`,
              ]
            );
          }),
      },
      {
        heading: 'Consultations:',
        lines: [...consultations]
          .sort(
            byDateDesc(
              (item) => item.actualPeriod?.start || item.plannedStartDate
            )
          )
          .map((consultation) => {
            const notes = getConsultationNotes(consultation);
            return recordLine(
              getConsultationTitle(consultation),
              getConsultationMeta(consultation),
              [notes && `notes: ${clip(notes, MAX_NOTE_CHARS)}`]
            );
          }),
      },
      {
        heading: 'Lab results:',
        lines: [...reports]
          .sort(
            byDateDesc(
              ({ report }) =>
                report.effectiveDateTime || report.effectivePeriod?.start
            )
          )
          .map(({ report, observations }) => {
            const values = observations
              .map(observationText)
              .filter((text): text is string => !!text);
            return recordLine(
              getLabResultTitle(report),
              getLabResultMeta(report),
              [values.length ? values.join(', ') : null]
            );
          }),
      },
      {
        heading: 'Service requests (referrals and tests ordered):',
        lines: [...requests]
          .sort(byDateDesc((item) => item.authoredOn))
          .map((request) =>
            recordLine(
              getServiceRequestTitle(request),
              getServiceRequestMeta(request)
            )
          ),
      },
    ],
    MAX_RECORD_CHARS
  );

  return [about.join('\n'), records || 'No health records yet.'].join('\n\n');
}

/** Instructions for the model, followed by the user's records. */
export function buildSystemPrompt(healthContext: string, today: Date) {
  return [
    "You are the assistant in Healthy, a personal health records app. You run on the user's own device and answer questions about their health records, which are listed below.",
    "Use only these records for facts about the user. If the answer is not in them, say so. Keep answers short and in plain language. You are not a doctor: don't diagnose or prescribe, and suggest asking a healthcare professional before medical decisions.",
    `Today is ${today.toDateString()}.`,
    healthContext,
    // Qwen3's switch for answering without a reasoning phase.
    '/no_think',
  ].join('\n\n');
}
