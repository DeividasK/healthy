import type { DatabaseMigration } from './types';
import { captureTriggers } from './syncTriggers';

const triggers = captureTriggers([
  ['medication_statements', 'MedicationStatement', 'patient_id'],
]);

const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

/**
 * Adds MedicationStatement storage for treatment usage: the periods a
 * treatment was taken, on hold or stopped.
 *
 * Non-breaking and additive: creates a new table, its indexes and sync
 * capture triggers, then backfills one open "taking" period for each active
 * treatment that was already logged in the journal or given a start date, so
 * those treatments stay due. The period starts at the earlier of the first
 * journal answer and `effectiveDosePeriod.start`. Backfilled ids are derived
 * from the treatment, so devices that migrate separately converge. Existing
 * tables and data are untouched. `repair` re-creates the triggers whenever
 * repairs run, because rebuilding a table drops them.
 */
export const migrationV16: DatabaseMigration = {
  version: 16,
  description: 'Add MedicationStatement storage for treatment usage',
  isBreaking: false,
  sql: `
    CREATE TABLE IF NOT EXISTS medication_statements (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      medication_request_id TEXT NOT NULL REFERENCES medication_requests(id) ON DELETE CASCADE,
      adherence_code TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      fhir_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_medication_statements_request ON medication_statements(patient_id, medication_request_id);
    ${triggers}
    INSERT OR IGNORE INTO medication_statements (
      id, patient_id, medication_request_id, adherence_code, start_date,
      end_date, fhir_json, created_at, updated_at
    )
    SELECT
      'use-' || id || '-backfill', patient_id, id, 'taking', start_date, NULL,
      json_object(
        'resourceType', 'MedicationStatement',
        'id', 'use-' || id || '-backfill',
        'meta', json_object('lastUpdated', ${NOW}),
        'status', 'recorded',
        'medication', json(json_extract(fhir_json, '$.medication')),
        'subject', json_object('reference', 'Patient/' || patient_id),
        'derivedFrom', json_array(
          json_object('reference', 'MedicationRequest/' || id)
        ),
        'effectivePeriod', json_object('start', start_date),
        'adherence', json_object(
          'code', json_object('coding', json_array(json_object(
            'system', 'http://hl7.org/fhir/CodeSystem/medication-statement-adherence',
            'code', 'taking',
            'display', 'Taking'
          )))
        ),
        'dateAsserted', ${NOW}
      ),
      ${NOW}, ${NOW}
    FROM (
      SELECT
        mr.id, mr.patient_id, mr.fhir_json,
        CASE
          WHEN first_log IS NULL THEN planned_start
          WHEN planned_start IS NULL OR first_log < planned_start THEN first_log
          ELSE planned_start
        END AS start_date
      FROM (
        SELECT
          id, patient_id, fhir_json,
          (SELECT MIN(occurrence_date) FROM medication_administrations
            WHERE medication_request_id = medication_requests.id) AS first_log,
          substr(json_extract(fhir_json, '$.effectiveDosePeriod.start'), 1, 10)
            AS planned_start
        FROM medication_requests
        WHERE status = 'active'
      ) AS mr
    )
    WHERE start_date IS NOT NULL;
  `,
  async repair(db) {
    const hasTable = await db.getFirstAsync(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'medication_statements';"
    );
    if (hasTable) await db.execAsync(triggers);
  },
};
