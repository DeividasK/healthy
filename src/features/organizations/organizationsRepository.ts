import type { Organization } from 'fhir/r5';
import { getDb } from '@/src/database/db';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';

/**
 * Persists a FHIR R5 Organization (a service provider) for a patient.
 * Organizations have no subject; `patient_id` is storage ownership only.
 */
export async function insertOrganizationRecord(
  organization: Organization,
  patientId: string,
  withinTransaction: boolean = false
): Promise<void> {
  if (!organization.id) {
    throw new Error('Organization requires an id to be persisted');
  }
  if (organization.resourceType !== 'Organization') {
    throw new Error('Resource must have resourceType Organization');
  }
  const name = organization.name?.trim();
  // org-1: an Organization needs a name or an identifier; the app needs a name.
  if (!name) throw new Error('Organization requires a name');

  const db = await getDb();
  const now = new Date().toISOString();
  const incomingTimestamp = organization.meta?.lastUpdated || now;
  const organizationWithMeta: Organization = {
    ...organization,
    meta: { ...organization.meta, lastUpdated: incomingTimestamp },
  };
  const orgId = organization.id;

  const persist = async () => {
    const existing = await db.getFirstAsync<{ patient_id: string }>(
      'SELECT patient_id FROM organizations WHERE id = ?;',
      [orgId]
    );
    if (existing && existing.patient_id !== patientId) {
      throw new Error(
        `Cannot update organization ${orgId}: belongs to patient ${existing.patient_id}, not ${patientId}`
      );
    }
    await db.runAsync(
      `INSERT INTO organizations (id, patient_id, name, fhir_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         fhir_json = excluded.fhir_json,
         updated_at = excluded.updated_at;`,
      [
        orgId,
        patientId,
        name,
        JSON.stringify(organizationWithMeta),
        now,
        incomingTimestamp,
      ]
    );
  };
  if (withinTransaction) await persist();
  else {
    await db.withTransactionAsync(persist);
    notifyDatabaseChanged(['organizations']);
  }
}

/** Finds a patient's Organization by name, ignoring case and outer spaces. */
export async function fetchOrganizationByName(
  patientId: string,
  name: string
): Promise<Organization | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ fhir_json: string }>(
    `SELECT fhir_json FROM organizations
     WHERE patient_id = ? AND name = ? COLLATE NOCASE
     ORDER BY created_at, id LIMIT 1;`,
    [patientId, name.trim()]
  );
  return row ? JSON.parse(row.fhir_json) : null;
}

/** A patient's Organization names, alphabetically, for autocomplete. */
export async function fetchOrganizationNames(
  patientId: string
): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT DISTINCT name FROM organizations
     WHERE patient_id = ? ORDER BY name COLLATE NOCASE;`,
    [patientId]
  );
  return rows.map((row) => row.name);
}

/**
 * Throws unless every `Organization/<id>` reference points to an
 * Organization stored for the same patient. Runs inside the caller's write.
 */
export async function assertOrganizationReferences(
  references: (string | undefined)[],
  patientId: string
): Promise<void> {
  const db = await getDb();
  for (const reference of references) {
    if (!reference?.startsWith('Organization/')) continue;
    const organization = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM organizations WHERE id = ? AND patient_id = ?;',
      [reference.slice(13), patientId]
    );
    if (!organization)
      throw new Error(
        'Service provider must reference an organization belonging to the same patient'
      );
  }
}

/** Every stored Organization with its owning patient, for backups. */
export async function fetchAllOrganizationRecords(): Promise<
  { organization: Organization; patientId: string }[]
> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ fhir_json: string; patient_id: string }>(
    'SELECT fhir_json, patient_id FROM organizations ORDER BY created_at, id;'
  );
  return rows.map((row) => ({
    organization: JSON.parse(row.fhir_json),
    patientId: row.patient_id,
  }));
}
