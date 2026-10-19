import type { DatabaseMigration } from './types';

const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

/** The treatment's dosage, as JSON, for a row's `medication_request_id`. */
const requestDosage = (table: string) => `(
  SELECT json_extract(fhir_json, '$.dosageInstruction')
  FROM medication_requests
  WHERE medication_requests.id = ${table}.medication_request_id
)`;

/** The treatment's free-text dosing for a row's `medication_request_id`. */
const requestInstructions = (table: string) => `(
  SELECT json_extract(fhir_json, '$.dosageInstruction[0].text')
  FROM medication_requests
  WHERE medication_requests.id = ${table}.medication_request_id
)`;

/**
 * Records the regimen followed on usage periods and the dosage taken on
 * journal answers, so they stay correct after the regimen changes.
 *
 * Non-breaking and additive: no table or column changes. Canonical JSON is
 * filled in with standard R5 elements only where absent:
 * - each period of taking a treatment (`MedicationStatement`) gets
 *   `dosage`, a copy of the treatment's `dosageInstruction`, the regimen the
 *   app has followed for it so far;
 * - each journal answer (`MedicationAdministration`) without `dosage` gets
 *   `dosage.text` from the treatment's free-text dosing. Answers for doses
 *   of a structured regimen already carry theirs.
 * Rows written are stamped and captured for sync like any other edit;
 * devices migrating separately write the same content. Older app versions
 * ignore these elements.
 */
export const migrationV17: DatabaseMigration = {
  version: 17,
  description: 'Record the regimen on usage periods and journal answers',
  isBreaking: false,
  sql: `
    UPDATE medication_statements
    SET
      fhir_json = json_set(
        fhir_json,
        '$.dosage', json(${requestDosage('medication_statements')}),
        '$.meta.lastUpdated', ${NOW}
      ),
      updated_at = ${NOW}
    WHERE (adherence_code = 'taking' OR adherence_code LIKE 'taking-%')
      AND json_type(fhir_json, '$.dosage') IS NULL
      AND json_array_length(${requestDosage('medication_statements')}) > 0;

    UPDATE medication_administrations
    SET
      fhir_json = json_set(
        fhir_json,
        '$.dosage', json_object(
          'text', ${requestInstructions('medication_administrations')}
        ),
        '$.meta.lastUpdated', ${NOW}
      ),
      updated_at = ${NOW}
    WHERE json_type(fhir_json, '$.dosage') IS NULL
      AND ${requestInstructions('medication_administrations')} IS NOT NULL;
  `,
};
