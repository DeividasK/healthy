import * as Crypto from 'expo-crypto';
import type { Encounter, ServiceRequest } from 'fhir/r5';
import { getDb } from '@/src/database/db';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import { DEFAULT_PATIENT_ID } from '@/src/features/profile/patientRepository';
import {
  insertServiceRequestRecord,
  fetchServiceRequestById,
  fetchServiceRequestsByPatientId,
  fetchServiceRequestsByReasonConditionId,
  deleteServiceRequestRecord,
} from './plannedCareRepository';
import {
  fetchClinicalDocumentByConsultationId,
  fetchConsultationIdsReferencingResource,
} from '@/src/features/consultations/clinicalDocumentsRepository';
import {
  fetchConsultationById,
  insertConsultationRecord,
} from '@/src/features/consultations/consultationsRepository';
import {
  addEntryToConsultationDocument,
  removeEntryFromConsultationDocument,
  type DocumentSectionSpec,
} from '@/src/features/consultations/consultationDocumentEntries';
import {
  createNarrativeDiv,
  getCompositionEntryReferences,
  getConsultationBasedOnIds,
  getPlannedCareInstructions,
  getPlannedCareNotes,
  getPlannedCareReason,
  getPlannedCareTitle,
  getReasonConditionIds,
  withConsultationBasedOn,
} from '@/src/utils/fhirUtils';
import { PLANNED_CARE_CATEGORIES, SNOMED_SYSTEM } from './plannedCareLabels';

export interface PlannedCareInput {
  id?: string;
  patientId?: string;
  /** Originating consultation (when created from one). */
  consultationId?: string;
  /** The requested investigation, procedure, referral or follow-up. */
  title: string;
  /** SNOMED category code; '' removes, 'current' or undefined keeps. */
  category?: string;
  intent?: ServiceRequest['intent']; // Defaults to 'plan'
  status?: ServiceRequest['status']; // Defaults to 'unknown'
  authoredDate?: string; // ISO date or date-time with timezone
  /** Known planned date; null removes it, undefined keeps it. */
  plannedDate?: string | null;
  /** Original instructions, kept verbatim. */
  instructions?: string | null;
  reason?: string | null;
  /** Associated Condition IDs; [] removes all links, undefined keeps them. */
  reasonConditionIds?: string[];
  notes?: string | null;
  /** Who recommended or ordered it; null/empty removes, undefined keeps. */
  requesterName?: string | null;
}

/** How a planned care item relates to a consultation. */
export type PlannedCareConsultationRole = 'origin' | 'planned' | 'basedOn';

export const PLANNED_CARE_ROLE_OPTIONS: {
  id: PlannedCareConsultationRole;
  label: string;
}[] = [
  { id: 'origin', label: 'Originated here' },
  { id: 'planned', label: 'Planned in this consultation' },
  { id: 'basedOn', label: 'Visit based on this' },
];

/** LOINC "Plan of care note" (the IPS plan of care section). */
export const PLANNED_CARE_SECTION_LOINC = '18776-5';
const PLANNED_CARE_SECTION: DocumentSectionSpec = {
  title: 'Planned care',
  loinc: PLANNED_CARE_SECTION_LOINC,
  display: 'Plan of care note',
};

const hasTimeWithoutZone = (value?: string | null) =>
  Boolean(value?.includes('T') && !/(Z|[+-]\d{2}:\d{2})$/.test(value));

/**
 * Creates or updates a ServiceRequest. When an originating consultation is
 * supplied, it is recorded as `encounter` and the request is added to the
 * consultation's Composition in the same transaction.
 */
export async function createOrUpdatePlannedCare(
  input: PlannedCareInput,
  withinTransaction: boolean = false
): Promise<ServiceRequest> {
  if (!input.title?.trim()) {
    throw new Error('Service is required');
  }
  const patientId = input.patientId || DEFAULT_PATIENT_ID;
  const db = await getDb();

  const persist = async (): Promise<ServiceRequest> => {
    const requestId = input.id || `sr-${Crypto.randomUUID()}`;
    const existing = input.id
      ? await fetchServiceRequestById(input.id, patientId)
      : null;

    const authoredOn =
      input.authoredDate ||
      existing?.authoredOn ||
      new Date().toISOString().split('T')[0];
    if (
      hasTimeWithoutZone(authoredOn) ||
      hasTimeWithoutZone(input.plannedDate)
    ) {
      throw new Error('Date-times require a timezone offset');
    }

    // Preserve existing unexposed fields.
    const request: ServiceRequest = {
      ...existing,
      resourceType: 'ServiceRequest',
      id: requestId,
      meta: { ...existing?.meta, lastUpdated: new Date().toISOString() },
      status: input.status || existing?.status || 'unknown',
      intent: input.intent || existing?.intent || 'plan',
      code: {
        ...existing?.code,
        concept: { ...existing?.code?.concept, text: input.title.trim() },
      },
      subject: { ...existing?.subject, reference: `Patient/${patientId}` },
      encounter: input.consultationId
        ? { reference: `Encounter/${input.consultationId}` }
        : existing?.encounter,
      authoredOn,
    };
    if (!request.encounter) delete request.encounter;

    if (input.category !== undefined && input.category !== 'current') {
      const rest = existing?.category?.slice(1) || [];
      const known = PLANNED_CARE_CATEGORIES.find(
        (c) => c.code === input.category
      );
      const categories = known
        ? [
            {
              coding: [
                {
                  system: SNOMED_SYSTEM,
                  code: known.code,
                  display: known.display,
                },
              ],
            },
            ...rest,
          ]
        : rest;
      if (categories.length) request.category = categories;
      else delete request.category;
    }

    if (input.plannedDate !== undefined) {
      if (input.plannedDate) {
        // occurrence[x] is a choice: a known date replaces other forms.
        delete request.occurrencePeriod;
        delete request.occurrenceTiming;
        request.occurrenceDateTime = input.plannedDate;
      } else {
        delete request.occurrenceDateTime;
      }
    }

    if (input.requesterName !== undefined) {
      const name = input.requesterName?.trim();
      // An unchanged name keeps the existing reference intact.
      if (!name) delete request.requester;
      else if (name !== existing?.requester?.display)
        request.requester = { display: name };
    }

    // Omission keeps; null/empty clears only the exposed text.
    if (input.instructions !== undefined) {
      const text = input.instructions?.trim();
      const first = { ...existing?.patientInstruction?.[0] };
      if (text) first.instructionMarkdown = text;
      else delete first.instructionMarkdown;
      const instructions = [
        ...(Object.keys(first).length ? [first] : []),
        ...(existing?.patientInstruction?.slice(1) || []),
      ];
      if (instructions.length) request.patientInstruction = instructions;
      else delete request.patientInstruction;
    }

    if (input.reason !== undefined || input.reasonConditionIds !== undefined) {
      let reasons = [...(existing?.reason || [])];
      if (input.reason !== undefined) {
        const text = input.reason?.trim();
        const first = { ...reasons[0] };
        const concept = { ...first.concept };
        if (text) concept.text = text;
        else delete concept.text;
        if (Object.keys(concept).length) first.concept = concept;
        else delete first.concept;
        reasons = [
          ...(Object.keys(first).length ? [first] : []),
          ...reasons.slice(1),
        ];
      }
      if (input.reasonConditionIds !== undefined) {
        const selected = new Set(input.reasonConditionIds);
        const kept = new Set<string>();
        reasons = reasons.flatMap((entry) => {
          const ref = entry.reference?.reference;
          if (!ref?.startsWith('Condition/')) return [entry];
          const conditionId = ref.slice(10);
          if (selected.has(conditionId) && !kept.has(conditionId)) {
            kept.add(conditionId);
            return [entry];
          }
          const { reference: _removed, ...rest } = entry;
          return Object.keys(rest).length ? [rest] : [];
        });
        for (const conditionId of selected)
          if (!kept.has(conditionId))
            reasons.push({
              reference: { reference: `Condition/${conditionId}` },
            });
      }
      if (reasons.length) request.reason = reasons;
      else delete request.reason;
    }

    if (input.notes !== undefined) {
      const text = input.notes?.trim();
      const notes = [
        ...(text ? [{ ...existing?.note?.[0], text }] : []),
        ...(existing?.note?.slice(1) || []),
      ];
      if (notes.length) request.note = notes;
      else delete request.note;
    }

    // A generated narrative is rebuilt on every save; authored ones are kept.
    if (!existing?.text || existing.text.status === 'generated') {
      request.text = {
        status: 'generated',
        div: createNarrativeDiv(
          [
            getPlannedCareTitle(request),
            getPlannedCareInstructions(request),
            getPlannedCareReason(request),
            getPlannedCareNotes(request),
          ]
            .filter(Boolean)
            .join('\n\n')
        ),
      };
    }

    await insertServiceRequestRecord(request, patientId, true);

    if (input.consultationId) {
      await addEntryToConsultationDocument(
        `ServiceRequest/${requestId}`,
        input.consultationId,
        patientId,
        PLANNED_CARE_SECTION,
        true
      );
    }
    return request;
  };

  if (withinTransaction) return await persist();

  let result!: ServiceRequest;
  await db.withTransactionAsync(async () => {
    result = await persist();
  });
  notifyDatabaseChanged(['service_requests', 'clinical_documents']);
  return result;
}

export async function getPlannedCareById(
  id: string,
  patientId?: string
): Promise<ServiceRequest | null> {
  return await fetchServiceRequestById(id, patientId);
}

export async function getAllPlannedCare(
  patientId: string = DEFAULT_PATIENT_ID
): Promise<ServiceRequest[]> {
  return await fetchServiceRequestsByPatientId(patientId);
}

export async function getPlannedCareByConditionId(
  conditionId: string,
  patientId: string
): Promise<ServiceRequest[]> {
  return await fetchServiceRequestsByReasonConditionId(conditionId, patientId);
}

/** The patient's planned care as link options. */
export async function getPlannedCareLinkOptions(
  patientId: string
): Promise<{ id: string; label: string }[]> {
  return (await fetchServiceRequestsByPatientId(patientId)).flatMap(
    (request) =>
      request.id
        ? [{ id: request.id, label: getPlannedCareTitle(request) }]
        : []
  );
}

/** Associates planned care with a condition, or removes the association. */
export async function setPlannedCareConditionLink(
  requestId: string,
  conditionId: string,
  patientId: string,
  linked: boolean
): Promise<void> {
  const request = await fetchServiceRequestById(requestId, patientId);
  if (!request) throw new Error(`Planned care ${requestId} not found`);
  const ids = getReasonConditionIds(request);
  if (ids.includes(conditionId) === linked) return;
  await createOrUpdatePlannedCare({
    id: requestId,
    patientId,
    title: getPlannedCareTitle(request),
    reasonConditionIds: linked
      ? [...ids, conditionId]
      : ids.filter((id) => id !== conditionId),
  });
}

/** IDs of the consultations whose documents list the planned care. */
export async function getConsultationIdsLinkingPlannedCare(
  requestId: string,
  patientId: string
): Promise<string[]> {
  return (
    await fetchConsultationIdsReferencingResource(
      `ServiceRequest/${requestId}`,
      patientId
    )
  ).filter(Boolean);
}

/** IDs of the patient's consultations based on the planned care. */
export async function getConsultationIdsBasedOnPlannedCare(
  requestId: string,
  patientId: string
): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM consultations
     WHERE patient_id = ?
     AND EXISTS (
       SELECT 1 FROM json_each(fhir_json, '$.basedOn')
       WHERE json_extract(value, '$.reference') = ?
     )
     ORDER BY date DESC;`,
    [patientId, `ServiceRequest/${requestId}`]
  );
  return rows.map((row) => row.id);
}

/**
 * How each consultation relates to the planned care. Where data records
 * more than one relationship, origin wins over planned, then basedOn.
 */
export async function getPlannedCareConsultationRoles(
  requestId: string,
  patientId: string
): Promise<Record<string, PlannedCareConsultationRole>> {
  const request = await fetchServiceRequestById(requestId, patientId);
  if (!request) return {};
  const roles: Record<string, PlannedCareConsultationRole> = {};
  for (const id of await getConsultationIdsBasedOnPlannedCare(
    requestId,
    patientId
  ))
    roles[id] = 'basedOn';
  for (const id of await getConsultationIdsLinkingPlannedCare(
    requestId,
    patientId
  ))
    roles[id] = 'planned';
  const origin = getPlannedCareOriginId(request);
  if (origin) roles[origin] = 'origin';
  return roles;
}

/** How each planned care item relates to the consultation. */
export async function getConsultationPlannedCareRoles(
  consultationId: string,
  patientId: string
): Promise<Record<string, PlannedCareConsultationRole>> {
  const roles: Record<string, PlannedCareConsultationRole> = {};
  const consultation = await fetchConsultationById(consultationId, patientId);
  if (!consultation) return roles;
  for (const id of getConsultationBasedOnIds(consultation))
    roles[id] = 'basedOn';
  for (const request of await getLinkedPlannedCareForConsultation(
    consultationId,
    patientId
  ))
    if (request.id) roles[request.id] = 'planned';
  for (const request of await fetchServiceRequestsByPatientId(patientId))
    if (request.id && getPlannedCareOriginId(request) === consultationId)
      roles[request.id] = 'origin';
  return roles;
}

export function getPlannedCareOriginId(request: ServiceRequest): string | null {
  const ref = request.encounter?.reference;
  return ref?.startsWith('Encounter/') ? ref.slice(10) : null;
}

/**
 * Records one relationship between planned care and a consultation inside
 * the caller's transaction, replacing any other relationship between the
 * pair. `null` removes them all. Planned care has at most one origin: making
 * this consultation the origin replaces the previous one, which keeps its
 * document entry.
 */
async function applyConsultationRole(
  requestId: string,
  consultationId: string,
  patientId: string,
  role: PlannedCareConsultationRole | null
): Promise<void> {
  const request = await fetchServiceRequestById(requestId, patientId);
  if (!request) throw new Error(`Planned care ${requestId} not found`);
  const consultation = await fetchConsultationById(consultationId, patientId);
  if (!consultation)
    throw new Error(`Consultation ${consultationId} not found`);
  const reference = `ServiceRequest/${requestId}`;
  const now = new Date().toISOString();

  const isOrigin = getPlannedCareOriginId(request) === consultationId;
  if ((role === 'origin') !== isOrigin) {
    const updated: ServiceRequest = {
      ...request,
      meta: { ...request.meta, lastUpdated: now },
    };
    if (role === 'origin')
      updated.encounter = { reference: `Encounter/${consultationId}` };
    else delete updated.encounter;
    await insertServiceRequestRecord(updated, patientId, true);
  }

  if (role === 'origin' || role === 'planned')
    await addEntryToConsultationDocument(
      reference,
      consultationId,
      patientId,
      PLANNED_CARE_SECTION,
      true
    );
  else
    await removeEntryFromConsultationDocument(
      reference,
      consultationId,
      patientId,
      true
    );

  const basedOnIds = getConsultationBasedOnIds(consultation);
  if (basedOnIds.includes(requestId) !== (role === 'basedOn')) {
    const updated: Encounter = withConsultationBasedOn(
      consultation,
      role === 'basedOn'
        ? [...basedOnIds, requestId]
        : basedOnIds.filter((id) => id !== requestId)
    );
    updated.meta = { ...updated.meta, lastUpdated: now };
    await insertConsultationRecord(updated, patientId, true);
  }
}

/** Sets how one planned care item relates to one consultation. */
export async function setPlannedCareConsultationRole(
  requestId: string,
  consultationId: string,
  patientId: string,
  role: PlannedCareConsultationRole | null
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(() =>
    applyConsultationRole(requestId, consultationId, patientId, role)
  );
  notifyDatabaseChanged([
    'service_requests',
    'clinical_documents',
    'consultations',
  ]);
}

/**
 * Replaces all consultation relationships of a planned care item in one
 * transaction. At most one consultation may be the origin.
 */
export async function savePlannedCareConsultationRoles(
  requestId: string,
  patientId: string,
  roles: Record<string, PlannedCareConsultationRole>
): Promise<void> {
  const origins = Object.values(roles).filter((role) => role === 'origin');
  if (origins.length > 1) {
    throw new Error('Planned care can originate in only one consultation');
  }
  const current = await getPlannedCareConsultationRoles(requestId, patientId);
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const consultationId of Object.keys(current))
      if (!roles[consultationId])
        await applyConsultationRole(requestId, consultationId, patientId, null);
    // Demote a replaced origin before recording the new one.
    const ordered = Object.entries(roles).sort(
      ([, a], [, b]) => Number(a === 'origin') - Number(b === 'origin')
    );
    for (const [consultationId, role] of ordered)
      if (current[consultationId] !== role)
        await applyConsultationRole(requestId, consultationId, patientId, role);
  });
  notifyDatabaseChanged([
    'service_requests',
    'clinical_documents',
    'consultations',
  ]);
}

/** Planned care listed in the consultation's document. */
export async function getLinkedPlannedCareForConsultation(
  consultationId: string,
  patientId: string = DEFAULT_PATIENT_ID
): Promise<ServiceRequest[]> {
  const comp = await fetchClinicalDocumentByConsultationId(
    consultationId,
    patientId
  );
  const requests = new Map<string, ServiceRequest>();
  for (const reference of comp ? getCompositionEntryReferences(comp) : []) {
    if (!reference.startsWith('ServiceRequest/')) continue;
    const id = reference.slice(15);
    if (requests.has(id)) continue;
    const request = await fetchServiceRequestById(id, patientId);
    if (request?.id) requests.set(request.id, request);
  }
  return Array.from(requests.values());
}

/** Planned care the consultation is based on (`Encounter.basedOn`). */
export async function getBasedOnPlannedCareForConsultation(
  consultation: Encounter,
  patientId: string
): Promise<ServiceRequest[]> {
  const requests: ServiceRequest[] = [];
  for (const id of getConsultationBasedOnIds(consultation)) {
    const request = await fetchServiceRequestById(id, patientId);
    if (request) requests.push(request);
  }
  return requests;
}

/**
 * Deletes planned care and removes its document entries and
 * `Encounter.basedOn` references.
 */
export async function deletePlannedCare(
  id: string,
  patientId?: string
): Promise<void> {
  await deleteServiceRequestRecord(id, patientId);
}
