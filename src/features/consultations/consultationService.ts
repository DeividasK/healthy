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
import { createNarrativeDiv } from '@/src/utils/fhirUtils';

export interface ConsultationInput {
  id?: string;
  patientId?: string;
  conditionId?: string | null;
  date: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
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
  const trimmedDoctor = input.doctorName?.trim() || undefined;
  const trimmedServiceType = input.serviceType?.trim() || undefined;
  const trimmedNotes = input.notes?.trim() || undefined;
  const patientId = input.patientId || 'patient-default';
  const conditionId = input.conditionId || null;
  const now = new Date().toISOString();

  const encounter: Encounter = {
    resourceType: 'Encounter',
    id: consId,
    meta: {
      lastUpdated: now,
    },
    status: (input.status as any) || 'completed',
    class: [
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
      reference: `Patient/${patientId}`,
      display: 'Self',
    },
    actualPeriod: {
      start: input.date,
    },
    type: [
      {
        text: trimmedTitle,
      },
    ],
    serviceType: trimmedServiceType
      ? [
          {
            concept: {
              text: trimmedServiceType,
            },
          },
        ]
      : undefined,
    participant: trimmedDoctor
      ? [
          {
            actor: {
              display: trimmedDoctor,
            },
          },
        ]
      : undefined,
    reason: conditionId
      ? [
          {
            value: [
              {
                reference: {
                  reference: `Condition/${conditionId}`,
                },
              },
            ],
          },
        ]
      : undefined,
    diagnosis: conditionId
      ? [
          {
            condition: [
              {
                reference: {
                  reference: `Condition/${conditionId}`,
                },
              },
            ],
          },
        ]
      : undefined,
    text: trimmedNotes
      ? {
          status: 'generated',
          div: createNarrativeDiv(trimmedNotes),
        }
      : undefined,
  };

  await insertConsultationRecord(encounter, patientId, conditionId);
  return encounter;
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
  id: string
): Promise<Encounter | null> {
  return await fetchConsultationById(id);
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
