import type { DatabaseMigration } from './types';

/**
 * Moves RDW-SD results to the LOINC code that replaced theirs.
 *
 * LOINC 2.83 deprecated 21000-5 (Erythrocyte distribution width by automated
 * count) as ambiguous and replaced it with 115742-9 for the standard
 * deviation (RDW-SD) and 115741-1 for the coefficient of variation. The app
 * only recorded RDW-SD under 21000-5, in fL, so those results get 115742-9.
 *
 * Non-breaking: no table or column changes, and older app versions read the
 * rewritten JSON. The `loinc_code` column and `Observation.code.coding[0].code`
 * are rewritten in place; the rows are captured for sync like any other edit.
 */
export const migrationV22: DatabaseMigration = {
  version: 22,
  description: 'Move RDW-SD results to the LOINC code that replaced theirs',
  isBreaking: false,
  sql: `
    UPDATE observations
    SET
      loinc_code = '115742-9',
      fhir_json = json_set(fhir_json, '$.code.coding[0].code', '115742-9')
    WHERE loinc_code = '21000-5'
      AND json_extract(fhir_json, '$.code.coding[0].system') = 'http://loinc.org'
      AND json_extract(fhir_json, '$.code.coding[0].code') = '21000-5';
  `,
};
