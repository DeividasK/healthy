import type { DatabaseMigration } from './types';

const tableDefinition = `(
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  consultation_id TEXT REFERENCES consultations(id) ON DELETE SET NULL,
  display_label TEXT NOT NULL,
  status TEXT NOT NULL,
  intent TEXT NOT NULL,
  authored_on TEXT NOT NULL,
  fhir_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

const projections: Record<string, string> = {
  consultation_id:
    "CASE WHEN json_extract(fhir_json, '$.encounter.reference') LIKE 'Encounter/%' THEN substr(json_extract(fhir_json, '$.encounter.reference'), 11) END",
  display_label:
    "COALESCE(json_extract(fhir_json, '$.medication.concept.text'), json_extract(fhir_json, '$.medication.concept.coding[0].display'), 'Treatment')",
  status: "COALESCE(json_extract(fhir_json, '$.status'), 'unknown')",
  intent: "COALESCE(json_extract(fhir_json, '$.intent'), 'plan')",
  authored_on:
    "COALESCE(NULLIF(json_extract(fhir_json, '$.authoredOn'), ''), substr(created_at, 1, 10))",
};
const storedColumns = [
  'id',
  'patient_id',
  'fhir_json',
  'created_at',
  'updated_at',
];
const expectedColumns = [...storedColumns, ...Object.keys(projections)];

/**
 * Adds Treatments (MedicationRequest) storage.
 *
 * Non-breaking: released databases (v10) have no `medication_requests` table,
 * so this only creates a table and indexes. The `repair` step exists for
 * pre-release development builds whose table had a different layout: it
 * rebuilds only the SQL projection columns from the canonical JSON and keeps
 * `fhir_json` and storage timestamps verbatim, so no clinical data changes.
 */
export const migrationV11: DatabaseMigration = {
  version: 11,
  description: 'Add the MedicationRequest storage projection',
  isBreaking: false,
  sql: `CREATE TABLE IF NOT EXISTS medication_requests ${tableDefinition};`,
  async repair(db) {
    const columns = await db.getAllAsync<{
      name: string;
      notnull: number;
      dflt_value: string | null;
    }>('PRAGMA table_info(medication_requests);');
    const names = new Set(columns.map((column) => column.name));
    const incompatible =
      expectedColumns.some((name) => !names.has(name)) ||
      columns.some(
        (column) =>
          !expectedColumns.includes(column.name) &&
          column.notnull &&
          column.dflt_value === null
      );
    if (incompatible) {
      // Never guess missing canonical data or timestamps. Failure rolls back
      // the entire repair and leaves the original table available for recovery.
      if (storedColumns.some((name) => !names.has(name))) {
        throw new Error(
          'Cannot repair medication_requests: missing canonical storage columns'
        );
      }
      const values = expectedColumns.map((name) =>
        names.has(name) ? name : projections[name]
      );
      await db.execAsync(`
        CREATE TABLE medication_requests_repaired ${tableDefinition};
        INSERT INTO medication_requests_repaired (${expectedColumns.join(', ')})
          SELECT ${values.join(', ')} FROM medication_requests;
        DROP TABLE medication_requests;
        ALTER TABLE medication_requests_repaired RENAME TO medication_requests;
      `);
    }
    // Index creation must follow repair: older tables may lack indexed columns.
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_medication_requests_patient_id ON medication_requests(patient_id);
      CREATE INDEX IF NOT EXISTS idx_medication_requests_consultation_id ON medication_requests(consultation_id);
    `);
  },
};
