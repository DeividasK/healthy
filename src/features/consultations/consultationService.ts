import { getDb } from '@/src/database/db';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import {
  createOrUpdateCondition,
  type ConditionInput,
} from '@/src/features/conditions/conditionService';
import { resolveOrganizationReference } from '@/src/features/organizations/organizationService';
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
  getConsultationReasonConditionIds,
  getConsultationTitle,
  withoutEncounterReference,
  withConsultationBasedOn,
} from '@/src/utils/fhirUtils';
import { fetchServiceRequestById } from '@/src/features/planned-care/plannedCareRepository';
import { formatDisplayDate } from '@/src/utils/dateUtils';

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
  /** Planned care this consultation is based on; undefined keeps them. */
  basedOnServiceRequestIds?: string[];
  id?: string;
  patientId?: string;
  conditionIds?: string[];
  date: string; // FHIR date or date-time with timezone offset
  title: string;
  doctorName?: string;
  /**
   * Service provider (Organization) name, found or created on save. Omit to
   * keep the stored reference; `null` or blank removes it.
   */
  serviceProviderName?: string | null;
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
    notifyDatabaseChanged([
      'conditions',
      'organizations',
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
  const trimmedServiceProvider =
    processedInput.serviceProviderName?.trim() || undefined;
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
    serviceProvider:
      processedInput.serviceProviderName === undefined
        ? existing?.serviceProvider
        : trimmedServiceProvider
          ? existing?.serviceProvider?.display === trimmedServiceProvider
            ? existing.serviceProvider
            : await resolveOrganizationReference(
                trimmedServiceProvider,
                patientId
              )
          : undefined,
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
  if (processedInput.basedOnServiceRequestIds !== undefined) {
    for (const requestId of processedInput.basedOnServiceRequestIds)
      if (!(await fetchServiceRequestById(requestId, patientId)))
        throw new Error(`Service request ${requestId} not found`);
    result = withConsultationBasedOn(
      result,
      processedInput.basedOnServiceRequestIds
    );
  }
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
  if (!result.serviceProvider) delete result.serviceProvider;
  await insertConsultationRecord(result, patientId, withinTransaction);

  const existingDoc = await fetchClinicalDocumentByConsultationId(
    consId,
    patientId
  );
  const existingSections = existingDoc?.section || [];
  const notesSectionIndex = existingSections.findIndex(
    (section) =>
      section.title === 'Notes' ||
      section.code?.coding?.some(
        (coding) =>
          coding.system === 'http://loinc.org' && coding.code === '48767-8'
      )
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
      section: (() => {
        const notesSection: NonNullable<Composition['section']>[number] = {
          ...(notesSectionIndex >= 0
            ? existingSections[notesSectionIndex]
            : {
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
              }),
          text: {
            ...existingSections[notesSectionIndex]?.text,
            status: 'generated',
            div: createNarrativeDiv(trimmedNotes),
          },
        };
        return notesSectionIndex >= 0
          ? existingSections.map((section, index) =>
              index === notesSectionIndex ? notesSection : section
            )
          : [...existingSections, notesSection];
      })(),
    };
    await insertClinicalDocumentRecord(
      composition,
      patientId,
      withinTransaction
    );
  } else if (existingDoc && notesSectionIndex >= 0) {
    const remainingSections = existingSections.flatMap((section, index) => {
      if (index !== notesSectionIndex) return [section];
      if (!section.entry?.length && !section.section?.length) return [];
      const nextSection = { ...section };
      delete nextSection.text;
      return [nextSection];
    });
    if (!remainingSections.length && existingDoc.id) {
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
        section: remainingSections,
      };
      await insertClinicalDocumentRecord(
        updatedComposition,
        patientId,
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
 * The patient's consultations as link options. Titles repeat, so the date
 * is part of the label.
 */
export async function getConsultationLinkOptions(
  patientId: string
): Promise<{ id: string; label: string }[]> {
  return (await getAllConsultations(patientId)).flatMap((consultation) => {
    if (!consultation.id) return [];
    const date =
      consultation.actualPeriod?.start || consultation.plannedStartDate;
    const title = getConsultationTitle(consultation);
    return [
      {
        id: consultation.id,
        label: date ? `${title} · ${formatDisplayDate(date)}` : title,
      },
    ];
  });
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

/** How a consultation refers to a condition. */
export type ConsultationConditionRole = 'reason' | 'diagnosis';

export const CONSULTATION_CONDITION_ROLE_OPTIONS: {
  id: ConsultationConditionRole;
  label: string;
}[] = [
  { id: 'reason', label: 'Reason for visit' },
  { id: 'diagnosis', label: 'Diagnosis' },
];

/** The condition's role in the consultation, or null when not linked. */
export function getConsultationConditionRole(
  consultation: Encounter,
  conditionId: string
): ConsultationConditionRole | null {
  if (getConsultationReasonConditionIds(consultation).includes(conditionId))
    return 'reason';
  if (getConsultationConditionIds(consultation).includes(conditionId))
    return 'diagnosis';
  return null;
}

/**
 * Links a condition to a consultation as a reason for visit or diagnosis, or
 * unlinks it (role null). Unlinking keeps any wording on the entry.
 */
export async function setConsultationConditionRole(
  consultationId: string,
  conditionId: string,
  patientId: string,
  role: ConsultationConditionRole | null
): Promise<void> {
  const consultation = await fetchConsultationById(consultationId, patientId);
  if (!consultation)
    throw new Error(`Consultation ${consultationId} not found`);
  if (getConsultationConditionRole(consultation, conditionId) === role) return;
  let updated = withoutEncounterReference(
    consultation,
    `Condition/${conditionId}`
  );
  if (role === 'reason')
    updated = withConsultationReasons(updated, [
      ...getConsultationReasonConditionIds(updated),
      conditionId,
    ]);
  if (role === 'diagnosis')
    updated = withConsultationConditions(updated, [
      ...getConsultationConditionIds(updated),
      conditionId,
    ]);
  updated.meta = {
    ...consultation.meta,
    lastUpdated: new Date().toISOString(),
  };
  await insertConsultationRecord(updated, patientId);
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
