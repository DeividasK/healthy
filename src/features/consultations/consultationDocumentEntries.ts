import * as Crypto from 'expo-crypto';
import type { Composition } from 'fhir/r5';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  fetchClinicalDocumentByConsultationId,
  insertClinicalDocumentRecord,
} from './clinicalDocumentsRepository';
import { fetchConsultationById } from './consultationsRepository';
import {
  getCompositionEntryReferences,
  withoutCompositionEntry,
} from '@/src/utils/fhirUtils';

/** A coded Composition section that lists related records. */
export interface DocumentSectionSpec {
  title: string;
  loinc: string;
  display: string;
  /** Codes written by earlier builds; recoded to `loinc` on the next link. */
  legacyLoinc?: string[];
}

/**
 * Adds a resource entry to the section of a consultation's Composition,
 * creating the section or the Composition when missing. Existing document
 * metadata, other sections and other codings are preserved.
 */
export async function addEntryToConsultationDocument(
  reference: string,
  consultationId: string,
  patientId: string,
  spec: DocumentSectionSpec,
  withinTransaction: boolean
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

  if (
    existingDoc &&
    getCompositionEntryReferences(existingDoc).includes(reference)
  )
    return;

  const docId = existingDoc?.id || `comp-${Crypto.randomUUID()}`;
  const codes = [spec.loinc, ...(spec.legacyLoinc || [])];
  const existingSections = existingDoc?.section || [];
  const isSectionCoding = (c: { system?: string; code?: string }) =>
    c.system === 'http://loinc.org' && codes.includes(c.code || '');
  const sectionIndex = existingSections.findIndex((s) =>
    s.code?.coding?.some(isSectionCoding)
  );

  let updatedSections: NonNullable<Composition['section']>;

  if (sectionIndex >= 0) {
    const existingSection = existingSections[sectionIndex];
    const updatedSection = {
      ...existingSection,
      // Replace only legacy codings; keep any other codings.
      code: existingSection.code && {
        ...existingSection.code,
        coding: existingSection.code.coding?.map((c) =>
          isSectionCoding(c)
            ? { ...c, code: spec.loinc, display: spec.display }
            : c
        ),
      },
      entry: [...(existingSection.entry || []), { reference }],
    };
    updatedSections = existingSections.map((s, idx) =>
      idx === sectionIndex ? updatedSection : s
    );
  } else {
    updatedSections = [
      ...existingSections,
      {
        title: spec.title,
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: spec.loinc,
              display: spec.display,
            },
          ],
          text: spec.title,
        },
        entry: [{ reference }],
      },
    ];
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
    // The patient records this document themselves.
    author: existingDoc?.author || [{ reference: `Patient/${patientId}` }],
    section: updatedSections,
  };

  await insertClinicalDocumentRecord(composition, patientId, withinTransaction);
}

/**
 * Removes a resource entry from a consultation's Composition. The referenced
 * resource itself is not modified.
 */
export async function removeEntryFromConsultationDocument(
  reference: string,
  consultationId: string,
  patientId: string,
  withinTransaction: boolean = false
): Promise<void> {
  const comp = await fetchClinicalDocumentByConsultationId(
    consultationId,
    patientId
  );
  if (!comp || !comp.section) return;

  const cleaned = withoutCompositionEntry(comp, reference);
  if (cleaned === comp) return;

  await insertClinicalDocumentRecord(
    {
      ...cleaned,
      meta: { ...comp.meta, lastUpdated: new Date().toISOString() },
    },
    patientId,
    withinTransaction
  );
}

/**
 * Removes every Composition entry referencing a deleted resource, inside the
 * caller's transaction. Failures propagate so deletion and cleanup commit
 * together.
 */
export async function removeEntryFromAllDocuments(
  db: SQLiteDatabase,
  reference: string
): Promise<void> {
  const compRows = await db.getAllAsync<{ id: string; fhir_json: string }>(
    `SELECT id, fhir_json FROM clinical_documents WHERE fhir_json LIKE ?;`,
    [`%${reference}%`]
  );
  const now = new Date().toISOString();
  for (const compRow of compRows) {
    const comp: Composition = JSON.parse(compRow.fhir_json);
    const cleaned = withoutCompositionEntry(comp, reference);
    if (cleaned === comp) continue;
    cleaned.meta = { ...cleaned.meta, lastUpdated: now };
    await db.runAsync(
      `UPDATE clinical_documents SET fhir_json = ?, updated_at = ? WHERE id = ?;`,
      [JSON.stringify(cleaned), now, compRow.id]
    );
  }
}
