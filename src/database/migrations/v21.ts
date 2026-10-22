import type { DatabaseMigration } from './types';

/**
 * Complete blood count codes the app stored wrongly, as `[stored code, test
 * name, correct LOINC code]`. The wrong codes belong to other tests in the
 * same list, so rows are matched on code and name together.
 */
const CODE_FIXES: [string, string, string][] = [
  ['751-8', 'Neutrophils (%)', '770-8'],
  ['753-4', 'Neutrophils (Absolute)', '751-8'],
  ['711-2', 'Eosinophils (%)', '713-8'],
  ['704-7', 'Eosinophils (Absolute)', '711-2'],
  ['702-1', 'Basophils (Absolute)', '704-7'],
];

/**
 * The general reference ranges the app copied into every observation it
 * saved before ranges depended on sex and age: `[LOINC code (corrected),
 * low, high, [UCUM code, factor from the primary unit][]]`. Frozen: these
 * are the old defaults, not the current catalog.
 */
// prettier-ignore
const LEGACY_DEFAULT_RANGES: [string, number, number, [string, number][]][] = [
  ['6690-2', 4.5, 11.0, [['10*3/uL', 1], ['10*9/L', 1], ['/uL', 1000]]],
  ['789-8', 4.2, 5.9, [['10*6/uL', 1], ['10*12/L', 1]]],
  ['718-7', 13.5, 17.5, [['g/dL', 1], ['g/L', 10], ['mmol/L', 0.6206]]],
  ['4544-3', 38.8, 50.0, [['%', 1], ['L/L', 0.01]]],
  ['777-3', 150, 450, [['10*3/uL', 1], ['10*9/L', 1], ['/uL', 1000]]],
  ['787-2', 80, 100, [['fL', 1]]],
  ['785-6', 27, 33, [['pg', 1], ['fmol', 0.062]]],
  ['786-4', 32, 36, [['g/dL', 1], ['g/L', 10]]],
  ['788-0', 11.5, 14.5, [['%', 1]]],
  ['21000-5', 39, 46, [['fL', 1]]],
  ['32623-1', 7.5, 11.5, [['fL', 1]]],
  ['770-8', 40, 70, [['%', 1]]],
  ['751-8', 1.8, 7.7, [['10*3/uL', 1], ['10*9/L', 1]]],
  ['736-9', 20, 40, [['%', 1]]],
  ['731-0', 1.0, 4.8, [['10*3/uL', 1], ['10*9/L', 1]]],
  ['5905-5', 2, 8, [['%', 1]]],
  ['742-7', 0.2, 0.8, [['10*3/uL', 1], ['10*9/L', 1]]],
  ['713-8', 1, 4, [['%', 1]]],
  ['711-2', 0.05, 0.5, [['10*3/uL', 1], ['10*9/L', 1]]],
  ['706-2', 0.5, 1.0, [['%', 1]]],
  ['704-7', 0.01, 0.2, [['10*3/uL', 1], ['10*9/L', 1]]],
];

const sqlString = (value: string) => `'${value.replace(/'/g, "''")}'`;

const fixedCode = CODE_FIXES.map(
  ([code, name, fixed]) =>
    `WHEN loinc_code = ${sqlString(code)} AND name = ${sqlString(name)} THEN ${sqlString(fixed)}`
).join('\n        ');

const legacyRangeRows = LEGACY_DEFAULT_RANGES.flatMap(
  ([code, low, high, units]) =>
    units.map(
      ([ucum, factor]) =>
        `(${sqlString(code)}, ${sqlString(ucum)}, ${low * factor}, ${high * factor})`
    )
).join(',\n      ');

/** A stored bound equals the legacy default, allowing for float rounding. */
const matches = (bound: 'low' | 'high') => `abs(
  json_extract(observations.fhir_json, '$.referenceRange[0].${bound}.value') - r.${bound}
) <= 1e-9 * max(1, abs(r.${bound}))`;

/** The low, normal or high flag the app derived from its own default range. */
const appInterpretation = `json_array_length(fhir_json, '$.interpretation') = 1
    AND json_array_length(fhir_json, '$.interpretation[0].coding') = 1
    AND json_extract(fhir_json, '$.interpretation[0].coding[0].system') = 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation'
    AND json_extract(fhir_json, '$.interpretation[0].coding[0].code') IN ('L', 'N', 'H')`;

/**
 * Corrects stored complete blood count codes and lets ranges follow the
 * patient's sex and age.
 *
 * Non-breaking: no table or column changes, and older app versions read the
 * rewritten JSON. Data is rewritten in place:
 * - five complete blood count tests were saved with another test's LOINC
 *   code (e.g. Basophils (Absolute) as 702-1, Anisocytosis); their
 *   `loinc_code` column and `Observation.code.coding[0].code` get the
 *   correct code;
 * - observations whose only reference range is exactly the general default
 *   the app copied in when saving lose `referenceRange`, and the low, normal
 *   or high `interpretation` derived from it. The app now works ranges out
 *   from its catalog and the patient's sex and age when showing results.
 *   Ranges a laboratory reported (any other values, or with text, age or
 *   population) are kept.
 * Rows written are captured for sync like any other edit, so the reports
 * replicate; devices migrating separately write the same content.
 */
export const migrationV21: DatabaseMigration = {
  version: 21,
  description:
    'Correct complete blood count codes and drop copied default ranges',
  isBreaking: false,
  sql: `
    UPDATE observations
    SET
      loinc_code = CASE
        ${fixedCode}
      END,
      fhir_json = json_set(fhir_json, '$.code.coding[0].code', CASE
        ${fixedCode}
      END)
    WHERE (loinc_code, name) IN (VALUES ${CODE_FIXES.map(
      ([code, name]) => `(${sqlString(code)}, ${sqlString(name)})`
    ).join(', ')})
      AND json_extract(fhir_json, '$.code.coding[0].system') = 'http://loinc.org'
      AND json_extract(fhir_json, '$.code.coding[0].code') = loinc_code;

    CREATE TEMP TABLE legacy_default_ranges (
      loinc_code TEXT NOT NULL,
      ucum TEXT NOT NULL,
      low REAL NOT NULL,
      high REAL NOT NULL
    );
    INSERT INTO legacy_default_ranges (loinc_code, ucum, low, high) VALUES
      ${legacyRangeRows};

    UPDATE observations
    SET fhir_json = CASE
      WHEN ${appInterpretation}
        THEN json_remove(fhir_json, '$.referenceRange', '$.interpretation')
      ELSE json_remove(fhir_json, '$.referenceRange')
    END
    WHERE json_array_length(fhir_json, '$.referenceRange') = 1
      AND json_type(fhir_json, '$.referenceRange[0].text') IS NULL
      AND json_type(fhir_json, '$.referenceRange[0].type') IS NULL
      AND json_type(fhir_json, '$.referenceRange[0].appliesTo') IS NULL
      AND json_type(fhir_json, '$.referenceRange[0].age') IS NULL
      AND EXISTS (
        SELECT 1 FROM legacy_default_ranges r
        WHERE r.loinc_code = observations.loinc_code
          AND r.ucum = COALESCE(
            json_extract(observations.fhir_json, '$.valueQuantity.code'),
            json_extract(observations.fhir_json, '$.valueQuantity.unit')
          )
          AND ${matches('low')}
          AND ${matches('high')}
      );

    DROP TABLE legacy_default_ranges;
  `,
};
