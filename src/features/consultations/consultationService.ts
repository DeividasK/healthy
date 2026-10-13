import { getDb } from '@/src/database/db';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import { clearPendingConsultationDeletions } from '@/src/services/syncDeletions';
import {
  createOrUpdateCondition,
  type ConditionInput,
} from '@/src/features/conditions/conditionService';
import * as Crypto from 'expo-crypto';
import type { Encounter, CodeableReference, Composition } from 'fhir/r5';
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
  insertClinicalDocumentRecord,
  fetchClinicalDocumentByConsultationId,
  deleteClinicalDocumentRecord,
} from './clinicalDocumentsRepository';
import {
  createNarrativeDiv,
  withConsultationConditions,
  getConsultationConditionIds,
  withConsultationReasons,
} from '@/src/utils/fhirUtils';

export interface ConsultationDiagnosisInput {
  title: string;
  conditionId?: string;
  createCondition?: boolean;
  original?: NonNullable<Encounter['diagnosis']>[number];
  originalTitle?: string;
  originalTerminology?: ConditionInput['terminology'];
  originalConditionId?: string;
  terminology?: ConditionInput['terminology'];
}

export interface ConsultationInput {
  diagnoses?: ConsultationDiagnosisInput[];
  reasonConditionIds?: string[];
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
  input: ConsultationInput,
  withinTransaction = false
): Promise<Encounter> {
  if (!withinTransaction) {
    const db = await getDb();
    let saved: Encounter | undefined;
    await db.withTransactionAsync(async () => {
      saved = await createOrUpdateConsultation(input, true);
    });
    await clearPendingConsultationDeletions([saved!.id!]);
    notifyDatabaseChanged([
      'conditions',
      'consultations',
      'consultation_conditions',
      'clinical_documents',
    ]);
    return saved!;
  }

  const patientId = input.patientId || 'patient-default';
  let processedInput = input;
  if (input.diagnoses?.some((diagnosis) => diagnosis.createCondition)) {
    const diagnoses: ConsultationDiagnosisInput[] = [];
    for (const diagnosis of input.diagnoses || []) {
      if (!diagnosis.title.trim())
        throw new Error('Diagnosis name is required');
      if (!diagnosis.createCondition) {
        diagnoses.push(diagnosis);
        continue;
      }
      const condition = await createOrUpdateCondition(
        {
          patientId,
          title: diagnosis.title,
          terminology: diagnosis.terminology,
          clinicalStatus: 'active',
          verificationStatus: 'unconfirmed',
          category: 'encounter-diagnosis',
        },
        true
      );
      diagnoses.push({
        ...diagnosis,
        createCondition: false,
        conditionId: condition.id,
      });
    }
    processedInput = { ...input, diagnoses };
  }
  const consId = processedInput.id || `cons-${Crypto.randomUUID()}`;
  const trimmedTitle = processedInput.title.trim();
  if (!trimmedTitle) throw new Error('Consultation title is required');
  const trimmedDoctor = processedInput.doctorName?.trim() || undefined;
  const trimmedServiceType = processedInput.serviceType?.trim() || undefined;
  const trimmedNotes = processedInput.notes?.trim() || undefined;
  const existing = processedInput.id
    ? await fetchConsultationById(processedInput.id)
    : null;
  const conditionIds =
    processedInput.conditionIds ??
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
    ].includes(processedInput.status || existing?.status || 'completed')
  ) {
    throw new Error('Invalid Encounter status');
  }
  if (
    processedInput.date.includes('T') &&
    !/(Z|[+-]\d{2}:\d{2})$/.test(processedInput.date)
  ) {
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
      (processedInput.status as Encounter['status']) ||
      existing?.status ||
      'completed',
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
      start: processedInput.date,
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

  let result = withConsultationConditions(encounter, conditionIds);
  if (processedInput.reasonConditionIds !== undefined)
    result = withConsultationReasons(result, processedInput.reasonConditionIds);
  if (processedInput.diagnoses !== undefined) {
    result.diagnosis = processedInput.diagnoses.map((diagnosis) => {
      if (!diagnosis.title.trim())
        throw new Error('Diagnosis name is required');
      const original = diagnosis.original;
      const value: CodeableReference = { ...original?.condition?.[0] };
      if (
        !original ||
        diagnosis.title !== diagnosis.originalTitle ||
        JSON.stringify(diagnosis.terminology || {}) !==
          JSON.stringify(diagnosis.originalTerminology || {})
      ) {
        const coding = { ...value.concept?.coding?.[0] };
        for (const field of ['system', 'code', 'display'] as const) {
          const text = diagnosis.terminology?.[field]?.trim();
          if (text) coding[field] = text;
          else delete coding[field];
        }
        const codings = [
          ...(coding.system || coding.code || coding.display ? [coding] : []),
          ...(value.concept?.coding?.slice(1) || []),
        ];
        value.concept = {
          ...value.concept,
          text: diagnosis.title.trim(),
          coding: codings.length ? codings : undefined,
        };
      }
      if (
        !original ||
        diagnosis.conditionId !== diagnosis.originalConditionId
      ) {
        if (diagnosis.conditionId)
          value.reference = {
            ...value.reference,
            reference: `Condition/${diagnosis.conditionId}`,
          };
        else delete value.reference;
      }
      if (!value.reference && !value.concept)
        value.concept = { text: diagnosis.title.trim() };
      return {
        ...original,
        condition: [value, ...(original?.condition?.slice(1) || [])],
      };
    });
    if (!result.diagnosis.length) delete result.diagnosis;
  }
  if (!result.serviceType?.length) delete result.serviceType;
  if (!result.participant?.length) delete result.participant;
  await insertConsultationRecord(result, patientId, false, withinTransaction);

  const existingDoc = await fetchClinicalDocumentByConsultationId(
    consId,
    patientId
  );

  if (trimmedNotes) {
    const docId = existingDoc?.id || `comp-${Crypto.randomUUID()}`;
    const compStatus: Composition['status'] =
      result.status === 'completed' ? 'final' : 'preliminary';
    const composition: Composition = {
      ...existingDoc,
      resourceType: 'Composition',
      id: docId,
      meta: {
        ...existingDoc?.meta,
        lastUpdated: now,
      },
      status: compStatus,
      type: existingDoc?.type || {
        coding: [
          {
            system: 'http://loinc.org',
            code: '11488-4',
            display: 'Consultation note',
          },
        ],
        text: 'Consultation note',
      },
      title: existingDoc?.title || `${trimmedTitle} Note`,
      subject: [{ reference: `Patient/${patientId}` }],
      encounter: { reference: `Encounter/${consId}` },
      date: processedInput.date,
      author: trimmedDoctor
        ? [{ display: trimmedDoctor }]
        : [{ reference: `Patient/${patientId}` }],
      section: [
        {
          title: 'Notes',
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '48767-8',
                display: 'Annotation comment',
              },
            ],
            text: 'Notes',
          },
          text: {
            status: 'generated',
            div: createNarrativeDiv(trimmedNotes),
          },
          ...(existingDoc?.section?.[0]?.entry
            ? { entry: existingDoc.section[0].entry }
            : {}),
        },
        ...(existingDoc?.section?.slice(1) || []),
      ],
    };
    await insertClinicalDocumentRecord(
      composition,
      patientId,
      false,
      withinTransaction
    );
  } else if (existingDoc) {
    const hasOtherSections = (existingDoc.section?.length || 0) > 1;
    const hasEntries = Boolean(existingDoc.section?.[0]?.entry?.length);
    if (!hasOtherSections && !hasEntries && existingDoc.id) {
      await deleteClinicalDocumentRecord(
        existingDoc.id,
        patientId,
        withinTransaction
      );
    } else {
      const updatedComposition: Composition = {
        ...existingDoc,
        meta: {
          ...existingDoc.meta,
          lastUpdated: now,
        },
        section: existingDoc.section?.map((sec, idx) => {
          if (idx === 0) {
            const nextSec = { ...sec };
            delete nextSec.text;
            return nextSec;
          }
          return sec;
        }),
      };
      await insertClinicalDocumentRecord(
        updatedComposition,
        patientId,
        false,
        withinTransaction
      );
    }
  }

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

/**
 * Fetches the Composition linked to a Consultation.
 */
export async function getClinicalDocumentByConsultationId(
  consultationId: string,
  patientId?: string
): Promise<Composition | null> {
  return await fetchClinicalDocumentByConsultationId(consultationId, patientId);
}

/**
 * Fetches a Consultation along with its linked clinical document.
 */
export async function getConsultationWithDetails(
  id: string,
  patientId?: string
): Promise<{
  consultation: Encounter | null;
  document: Composition | null;
}> {
  const consultation = await fetchConsultationById(id, patientId);
  const document = consultation
    ? await fetchClinicalDocumentByConsultationId(consultation.id!, patientId)
    : null;
  return { consultation, document };
}
