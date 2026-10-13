import * as Crypto from 'expo-crypto';
import type { Encounter } from 'fhir/r5';
import {
  insertConsultationRecord,
  fetchAllConsultationRecords,
  fetchConsultationsByConditionId,
  fetchConsultationById,
  deleteConsultationRecord,
  fetchDistinctDoctorNames,
  fetchDistinctServiceTypes,
} from './consultationsRepository';
import {
  createNarrativeDiv,
  withConsultationConditions,
  getConsultationConditionIds,
} from '@/src/utils/fhirUtils';

export interface ConsultationInput {
  id?: string;
  patientId?: string;
  conditionIds?: string[];
  date: string; // FHIR date or date-time with timezone offset
  title: string;
  doctorName?: string;
  serviceType?: string;
  notes?: string;
  status?: string; // 'completed' | 'planned'
}

/**
 * Builds and persists a FHIR Encounter (Consultation) record.
 */
export async function createOrUpdateConsultation(
  input: ConsultationInput
): Promise<Encounter> {
  const consId = input.id || `cons-${Crypto.randomUUID()}`;
  const trimmedTitle = input.title.trim();
  if (!trimmedTitle) throw new Error('Consultation title is required');
  const trimmedDoctor = input.doctorName?.trim() || undefined;
  const trimmedServiceType = input.serviceType?.trim() || undefined;
  const trimmedNotes = input.notes?.trim() || undefined;
  const patientId = input.patientId || 'patient-default';
  const existing = input.id ? await fetchConsultationById(input.id) : null;
  const conditionIds =
    input.conditionIds ??
    (existing ? getConsultationConditionIds(existing) : []);
  if (
    ![
      'planned',
      'in-progress',
      'on-hold',
      'discharged',
      'completed',
      'cancelled',
      'discontinued',
      'entered-in-error',
      'unknown',
    ].includes(input.status || existing?.status || 'completed')
  ) {
    throw new Error('Invalid Encounter status');
  }
  if (input.date.includes('T') && !/(Z|[+-]\d{2}:\d{2})$/.test(input.date)) {
    throw new Error('Encounter date-time requires a timezone offset');
  }
  const now = new Date().toISOString();

  const encounter: Encounter = {
    ...existing,
    resourceType: 'Encounter',
    id: consId,
    meta: {
      ...existing?.meta,
      lastUpdated: now,
    },
    status:
      (input.status as Encounter['status']) || existing?.status || 'completed',
    class: existing?.class || [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'AMB',
            display: 'ambulatory',
          },
        ],
      },
    ],
    subject: {
      ...existing?.subject,
      reference: `Patient/${patientId}`,
    },
    actualPeriod: {
      ...existing?.actualPeriod,
      start: input.date,
    },
    type: [
      {
        ...existing?.type?.[0],
        text: trimmedTitle,
      },
      ...(existing?.type?.slice(1) || []),
    ],
    serviceType: trimmedServiceType
      ? [
          {
            ...existing?.serviceType?.[0],
            concept: {
              ...existing?.serviceType?.[0]?.concept,
              text: trimmedServiceType,
            },
          },
          ...(existing?.serviceType?.slice(1) || []),
        ]
      : existing?.serviceType?.flatMap((value, index) => {
          if (index) return [value];
          const concept = { ...value.concept };
          delete concept.text;
          const updated = {
            ...value,
            concept: Object.keys(concept).length ? concept : undefined,
          };
          return updated.reference || updated.concept || updated.extension
            ? [updated]
            : [];
        }),
    participant: trimmedDoctor
      ? [
          {
            ...existing?.participant?.[0],
            actor: {
              ...existing?.participant?.[0]?.actor,
              display: trimmedDoctor,
            },
          },
          ...(existing?.participant?.slice(1) || []),
        ]
      : existing?.participant?.flatMap((value, index) => {
          if (index) return [value];
          const actor = { ...value.actor };
          delete actor.display;
          const updated = {
            ...value,
            actor: Object.keys(actor).length ? actor : undefined,
          };
          return updated.actor || updated.type?.length ? [updated] : [];
        }),
    text: trimmedNotes
      ? {
          ...existing?.text,
          status: existing?.text?.status || 'generated',
          div: createNarrativeDiv(trimmedNotes),
        }
      : undefined,
  };

  const result = withConsultationConditions(encounter, conditionIds);
  if (!result.serviceType?.length) delete result.serviceType;
  if (!result.participant?.length) delete result.participant;
  await insertConsultationRecord(result, patientId);
  return result;
}

/**
 * Fetches all Consultations, optionally filtered by patientId.
 */
export async function getAllConsultations(
  patientId?: string
): Promise<Encounter[]> {
  return await fetchAllConsultationRecords(patientId);
}

/**
 * Fetches all Consultations linked to a specific Condition.
 */
export async function getConsultationsByConditionId(
  conditionId: string
): Promise<Encounter[]> {
  return await fetchConsultationsByConditionId(conditionId);
}

/**
 * Fetches a single Consultation by ID.
 */
export async function getConsultationById(
  id: string,
  patientId?: string
): Promise<Encounter | null> {
  return await fetchConsultationById(id, patientId);
}

/**
 * Deletes a Consultation by ID.
 */
export async function deleteConsultation(id: string): Promise<void> {
  await deleteConsultationRecord(id);
}

/**
 * Retrieves all distinct previously used doctor names for autocomplete.
 */
export async function getDistinctDoctorNames(
  patientId?: string
): Promise<string[]> {
  return await fetchDistinctDoctorNames(patientId);
}

/**
 * Retrieves all distinct previously used service types / specialties for autocomplete.
 */
export async function getDistinctServiceTypes(
  patientId?: string
): Promise<string[]> {
  return await fetchDistinctServiceTypes(patientId);
}
