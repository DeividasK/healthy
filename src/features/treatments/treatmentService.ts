import * as Crypto from 'expo-crypto';
import type { MedicationRequest, Composition } from 'fhir/r5';
import { getDb } from '@/src/database/db';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import { DEFAULT_PATIENT_ID } from '@/src/features/profile/patientRepository';
import {
  insertMedicationRequestRecord,
  fetchMedicationRequestById,
  fetchMedicationRequestsByPatientId,
  deleteMedicationRequestRecord,
} from './treatmentsRepository';
import {
  fetchClinicalDocumentByConsultationId,
  insertClinicalDocumentRecord,
} from '@/src/features/consultations/clinicalDocumentsRepository';
import { fetchConsultationById } from '@/src/features/consultations/consultationsRepository';
import {
  createNarrativeDiv,
  withoutCompositionEntry,
  getCompositionEntryReferences,
  getTreatmentTitle,
  getTreatmentInstructions,
  getTreatmentReason,
  getTreatmentNotes,
} from '@/src/utils/fhirUtils';

export interface TreatmentInput {
  id?: string;
  patientId?: string;
  consultationId?: string; // Originating consultation (if created from one)
  title: string; // Medication / treatment name
  intent?: MedicationRequest['intent']; // Defaults to 'plan'
  status?: MedicationRequest['status']; // Defaults to 'unknown'
  authoredDate?: string; // ISO date YYYY-MM-DD or date-time with timezone
  dosageInstructions?: string | null; // Text regimen instructions
  reason?: string | null; // Indication / reason text
  /** Indication Condition ID; null removes the link, undefined keeps it. */
  reasonConditionId?: string | null;
  notes?: string | null;
  documenterName?: string;
}

/** LOINC section code for medications in clinical documents (IPS, C-CDA). */
export const TREATMENTS_SECTION_LOINC = '10160-0';
export const TREATMENTS_SECTION_DISPLAY = 'History of Medication use Narrative';
/** Code written by development builds before 10160-0; read for compatibility. */
const LEGACY_TREATMENTS_SECTION_LOINC = '18605-6';

/**
 * Creates or updates a MedicationRequest resource in SQLite.
 * If originating consultationId is supplied, links it atomically to the consultation's Composition.
 */
export async function createOrUpdateTreatment(
  input: TreatmentInput,
  withinTransaction: boolean = false
): Promise<MedicationRequest> {
  if (!input.title || !input.title.trim()) {
    throw new Error('Treatment name is required');
  }

  const patientId = input.patientId || DEFAULT_PATIENT_ID;
  const db = await getDb();

  const persist = async (): Promise<MedicationRequest> => {
    const treatId = input.id || `treat-${Crypto.randomUUID()}`;
    const trimmedTitle = input.title.trim();
    const trimmedInstructions = input.dosageInstructions?.trim() || undefined;
    const trimmedNotes = input.notes?.trim() || undefined;
    const trimmedReason = input.reason?.trim() || undefined;

    const existing = input.id
      ? await fetchMedicationRequestById(input.id, patientId)
      : null;

    if (existing && existing.subject?.reference !== `Patient/${patientId}`) {
      throw new Error(
        `Cannot edit treatment ${treatId}: belongs to a different patient`
      );
    }

    const authoredDateStr =
      input.authoredDate ||
      existing?.authoredOn ||
      (existing ? undefined : new Date().toISOString().split('T')[0]);

    if (
      authoredDateStr?.includes('T') &&
      !/(Z|[+-]\d{2}:\d{2})$/.test(authoredDateStr)
    ) {
      throw new Error('Authored date-time requires a timezone offset');
    }

    const now = new Date().toISOString();

    // Preserve existing unexposed fields
    const medicationRequest: MedicationRequest = {
      ...existing,
      resourceType: 'MedicationRequest',
      id: treatId,
      meta: {
        ...existing?.meta,
        lastUpdated: now,
      },
      status: input.status || existing?.status || 'unknown',
      intent: input.intent || existing?.intent || 'plan',
      medication: {
        ...existing?.medication,
        concept: {
          ...existing?.medication?.concept,
          text: trimmedTitle,
        },
      },
      subject: {
        ...existing?.subject,
        reference: `Patient/${patientId}`,
      },
      encounter: input.consultationId
        ? { reference: `Encounter/${input.consultationId}` }
        : existing?.encounter,
      authoredOn: authoredDateStr,
      dosageInstruction: existing?.dosageInstruction,
      reason: existing?.reason,
      note: existing?.note,
    };

    // Omission means unchanged; null/empty text explicitly clears only the
    // exposed text, retaining structured dosage and coded reason information.
    if (input.dosageInstructions !== undefined) {
      const first = { ...existing?.dosageInstruction?.[0] };
      if (trimmedInstructions) first.text = trimmedInstructions;
      else delete first.text;
      const dosages = [
        ...(Object.keys(first).length ? [first] : []),
        ...(existing?.dosageInstruction?.slice(1) || []),
      ];
      medicationRequest.dosageInstruction = dosages.length
        ? dosages
        : undefined;
    }
    if (input.reason !== undefined || input.reasonConditionId !== undefined) {
      const first = { ...existing?.reason?.[0] };
      const concept = { ...first.concept };
      if (trimmedReason) concept.text = trimmedReason;
      else if (input.reason !== undefined) delete concept.text;
      if (Object.keys(concept).length) first.concept = concept;
      else delete first.concept;
      if (input.reasonConditionId) {
        first.reference = {
          ...first.reference,
          reference: `Condition/${input.reasonConditionId}`,
        };
      } else if (input.reasonConditionId === null) {
        delete first.reference;
      }
      const reasons = [
        ...(Object.keys(first).length ? [first] : []),
        ...(existing?.reason?.slice(1) || []),
      ];
      medicationRequest.reason = reasons.length ? reasons : undefined;
    }
    if (input.notes !== undefined) {
      const notes = [
        ...(trimmedNotes
          ? [{ ...existing?.note?.[0], text: trimmedNotes }]
          : []),
        ...(existing?.note?.slice(1) || []),
      ];
      medicationRequest.note = notes.length ? notes : undefined;
    }

    // A generated narrative must describe the current data, so it is rebuilt
    // on every save. Authored (non-generated) narratives are preserved.
    if (!existing?.text || existing.text.status === 'generated') {
      medicationRequest.text = {
        status: 'generated',
        div: createNarrativeDiv(
          [
            getTreatmentTitle(medicationRequest),
            getTreatmentInstructions(medicationRequest),
            getTreatmentReason(medicationRequest),
            getTreatmentNotes(medicationRequest),
          ]
            .filter(Boolean)
            .join('\n\n')
        ),
      };
    }

    await insertMedicationRequestRecord(
      medicationRequest,
      patientId,
      false,
      true
    );

    // Only explicit creation/linking changes document membership. Origin is
    // provenance and must not silently restore a link removed by the user.
    if (input.consultationId) {
      await addTreatmentToComposition(
        treatId,
        input.consultationId,
        patientId,
        true,
        input.documenterName
      );
    }

    return medicationRequest;
  };

  if (withinTransaction) {
    return await persist();
  }

  let result!: MedicationRequest;
  await db.withTransactionAsync(async () => {
    result = await persist();
  });

  notifyDatabaseChanged(['medication_requests', 'clinical_documents']);
  return result;
}

/**
 * Fetches a single treatment by ID and patientId.
 */
export async function getTreatmentById(
  id: string,
  patientId?: string
): Promise<MedicationRequest | null> {
  return await fetchMedicationRequestById(id, patientId);
}

/**
 * Fetches all treatments for the given patient.
 */
export async function getAllTreatments(
  patientId: string = DEFAULT_PATIENT_ID
): Promise<MedicationRequest[]> {
  return await fetchMedicationRequestsByPatientId(patientId);
}

/**
 * Deletes a treatment and cleans all references in consultation Compositions.
 */
export async function deleteTreatment(
  id: string,
  patientId?: string
): Promise<void> {
  await deleteMedicationRequestRecord(id, patientId);
}

/**
 * Links an existing treatment to a consultation's Composition document without rewriting
 * the treatment's originating encounter.
 */
export async function linkTreatmentToConsultation(
  treatmentId: string,
  consultationId: string,
  patientId: string = DEFAULT_PATIENT_ID,
  documenterName?: string
): Promise<void> {
  const treatment = await fetchMedicationRequestById(treatmentId, patientId);
  if (!treatment) {
    throw new Error(`Treatment ${treatmentId} not found`);
  }
  if (treatment.subject?.reference !== `Patient/${patientId}`) {
    throw new Error('Treatment belongs to a different patient');
  }

  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await addTreatmentToComposition(
      treatmentId,
      consultationId,
      patientId,
      true,
      documenterName
    );
  });

  notifyDatabaseChanged(['clinical_documents']);
}

/**
 * Unlinks a treatment from a consultation by removing its reference from the consultation's Composition.
 * The MedicationRequest resource itself is NOT deleted or modified.
 */
export async function unlinkTreatmentFromConsultation(
  treatmentId: string,
  consultationId: string,
  patientId: string = DEFAULT_PATIENT_ID
): Promise<void> {
  const comp = await fetchClinicalDocumentByConsultationId(
    consultationId,
    patientId
  );
  if (!comp || !comp.section) return;

  const targetRef = `MedicationRequest/${treatmentId}`;
  const cleaned = withoutCompositionEntry(comp, targetRef);
  if (cleaned === comp) return;

  const now = new Date().toISOString();
  const updatedComp: Composition = {
    ...cleaned,
    meta: {
      ...comp.meta,
      lastUpdated: now,
    },
  };

  await insertClinicalDocumentRecord(updatedComp, patientId, false, false);
}

/**
 * Retrieves all treatments associated with a consultation:
 * treatments explicitly linked via the consultation's Composition document.
 */
export async function getLinkedTreatmentsForConsultation(
  consultationId: string,
  patientId: string = DEFAULT_PATIENT_ID
): Promise<MedicationRequest[]> {
  const treatmentsMap = new Map<string, MedicationRequest>();
  // Only Composition membership determines linked records.
  const comp = await fetchClinicalDocumentByConsultationId(
    consultationId,
    patientId
  );
  for (const reference of comp ? getCompositionEntryReferences(comp) : []) {
    if (!reference.startsWith('MedicationRequest/')) continue;
    const treatId = reference.slice(18);
    if (treatmentsMap.has(treatId)) continue;
    const req = await fetchMedicationRequestById(treatId, patientId);
    if (req?.id) treatmentsMap.set(req.id, req);
  }

  return Array.from(treatmentsMap.values());
}

/**
 * Internal helper to add a MedicationRequest entry to a consultation's Composition document.
 */
async function addTreatmentToComposition(
  treatmentId: string,
  consultationId: string,
  patientId: string,
  withinTransaction: boolean,
  documenterName?: string
): Promise<void> {
  const consultation = await fetchConsultationById(consultationId, patientId);
  if (!consultation) {
    throw new Error(`Consultation ${consultationId} not found`);
  }
  if (consultation.subject?.reference !== `Patient/${patientId}`) {
    throw new Error('Consultation belongs to a different patient');
  }

  const existingDoc = await fetchClinicalDocumentByConsultationId(
    consultationId,
    patientId
  );
  const now = new Date().toISOString();
  const targetRef = `MedicationRequest/${treatmentId}`;

  if (
    existingDoc &&
    getCompositionEntryReferences(existingDoc).includes(targetRef)
  )
    return;

  const docId = existingDoc?.id || `comp-${Crypto.randomUUID()}`;
  if (!existingDoc && !documenterName?.trim()) {
    throw new Error(
      'Documenter name is required for a new consultation document'
    );
  }

  const existingSections = existingDoc?.section || [];
  const isTreatmentsCoding = (c: { system?: string; code?: string }) =>
    c.system === 'http://loinc.org' &&
    (c.code === TREATMENTS_SECTION_LOINC ||
      c.code === LEGACY_TREATMENTS_SECTION_LOINC);
  const treatSectionIndex = existingSections.findIndex((s) =>
    s.code?.coding?.some(isTreatmentsCoding)
  );

  let updatedSections: NonNullable<Composition['section']>;

  if (treatSectionIndex >= 0) {
    const existingSection = existingSections[treatSectionIndex];
    const existingEntries = existingSection.entry || [];
    const alreadyLinked = existingEntries.some(
      (e) => e.reference === targetRef
    );

    if (alreadyLinked) {
      return; // Already present, nothing to do
    }

    const updatedSection = {
      ...existingSection,
      // Replace only the legacy coding; keep any other codings.
      code: existingSection.code && {
        ...existingSection.code,
        coding: existingSection.code.coding?.map((c) =>
          isTreatmentsCoding(c)
            ? {
                ...c,
                code: TREATMENTS_SECTION_LOINC,
                display: TREATMENTS_SECTION_DISPLAY,
              }
            : c
        ),
      },
      entry: [...existingEntries, { reference: targetRef }],
    };

    updatedSections = existingSections.map((s, idx) =>
      idx === treatSectionIndex ? updatedSection : s
    );
  } else {
    const newSection = {
      title: 'Treatments',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: TREATMENTS_SECTION_LOINC,
            display: TREATMENTS_SECTION_DISPLAY,
          },
        ],
        text: 'Treatments',
      },
      entry: [{ reference: targetRef }],
    };
    updatedSections = [...existingSections, newSection];
  }

  const composition: Composition = {
    ...existingDoc,
    resourceType: 'Composition',
    id: docId,
    meta: {
      ...existingDoc?.meta,
      lastUpdated: now,
    },
    status: existingDoc?.status || 'preliminary',
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
    title:
      existingDoc?.title ||
      `${consultation.type?.[0]?.text || 'Consultation'} Note`,
    subject: existingDoc?.subject || [{ reference: `Patient/${patientId}` }],
    encounter: existingDoc?.encounter || {
      reference: `Encounter/${consultationId}`,
    },
    date: existingDoc?.date || now,
    author: existingDoc?.author || [{ display: documenterName!.trim() }],
    section: updatedSections,
  };

  await insertClinicalDocumentRecord(
    composition,
    patientId,
    false,
    withinTransaction
  );
}
