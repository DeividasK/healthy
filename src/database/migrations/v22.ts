import type { DatabaseMigration } from './types';

/**
 * Results the app recorded under the LOINC code of another kind of
 * measurement than their unit, as `[stored code, UCUM unit, correct code]`.
 * LOINC codes mass (e.g. glucose in mg/dL, 2345-7) and amount of substance
 * (glucose in mmol/L, 14749-6) separately; the app saved every unit of a
 * test under the one code. Frozen: the catalog's codes when this shipped.
 */
// prettier-ignore
const UNIT_CODE_FIXES: [string, string, string][] = [
  ['718-7', 'mmol/L', '59260-0'],
  ['2345-7', 'mmol/L', '14749-6'],
  ['3094-0', 'mmol/L', '14937-7'],
  ['2160-0', 'umol/L', '14682-9'],
  ['17861-6', 'mmol/L', '2000-8'],
  ['1994-3', 'mg/dL', '38230-9'],
  ['46099-8', 'mmol/L', '29265-6'],
  ['19123-9', 'mmol/L', '2601-3'],
  ['19123-9', 'meq/L', '2601-3'],
  ['2777-1', 'mmol/L', '14879-1'],
  ['3084-1', 'umol/L', '14933-6'],
  ['2524-7', 'mg/dL', '14118-4'],
  ['16362-6', 'ug/dL', '22763-7'],
  ['1975-2', 'umol/L', '14631-6'],
  ['1968-7', 'umol/L', '14629-0'],
  ['1971-1', 'umol/L', '14630-8'],
  ['2093-3', 'mmol/L', '14647-2'],
  ['13457-7', 'mmol/L', '39469-2'],
  ['18262-6', 'mmol/L', '69419-0'],
  ['2085-9', 'mmol/L', '14646-4'],
  ['2571-8', 'mmol/L', '14927-8'],
  ['13458-5', 'mmol/L', '66126-4'],
  ['43396-1', 'mmol/L', '70204-3'],
  ['27353-2', 'mmol/L', '53553-4'],
  ['1986-9', 'nmol/L', '14633-2'],
  ['1986-9', 'pmol/L', '14633-2'],
  ['3024-7', 'pmol/L', '14920-3'],
  ['3051-0', 'pmol/L', '14928-6'],
  ['3026-2', 'nmol/L', '14921-1'],
  ['3053-6', 'nmol/L', '14930-2'],
  ['2498-4', 'umol/L', '14798-3'],
  ['2276-4', 'pmol/L', '14723-1'],
  ['2500-7', 'umol/L', '14800-7'],
  ['2501-5', 'umol/L', '22753-8'],
  ['62292-8', 'nmol/L', '68438-1'],
  ['1649-3', 'pmol/L', '14566-4'],
  ['2132-9', 'pmol/L', '14685-2'],
  ['2284-8', 'nmol/L', '14732-2'],
  ['2283-0', 'nmol/L', '14731-4'],
  ['2923-1', 'umol/L', '14905-4'],
  ['1823-4', 'umol/L', '14590-4'],
  ['1903-4', 'umol/L', '14622-5'],
  ['5763-8', 'umol/L', '14955-9'],
  ['5631-7', 'umol/L', '14665-4'],
  ['5724-0', 'umol/L', '25521-6'],
  ['2986-8', 'nmol/L', '14913-8'],
  ['2991-8', 'pmol/L', '14914-6'],
  ['2243-4', 'pmol/L', '14715-7'],
  ['2839-9', 'nmol/L', '14890-8'],
  ['2191-5', 'umol/L', '14688-6'],
  ['2143-6', 'nmol/L', '14675-3'],
  ['2141-0', 'pmol/L', '14674-6'],
  ['2731-8', 'pmol/L', '14866-8'],
  ['2484-4', 'nmol/L', '29775-4'],
  ['38476-8', 'pmol/L', '48377-6'],
  ['1763-2', 'pmol/L', '14586-2'],
  ['1854-9', 'nmol/L', '14603-5'],
  ['1668-3', 'nmol/L', '14569-8'],
  ['2161-8', 'mmol/L', '14683-7'],
  ['5671-3', 'umol/L', '14807-2'],
  ['10535-3', 'nmol/L', '14698-5'],
  ['9318-7', 'mg/mmol{creat}', '32294-1'],
  ['2890-2', 'mg/mmol{creat}', '34366-5'],
];

const sqlString = (value: string) => `'${value.replace(/'/g, "''")}'`;

const storedUnit = `COALESCE(
  json_extract(fhir_json, '$.valueQuantity.code'),
  json_extract(fhir_json, '$.valueQuantity.unit')
)`;

const fixedCode = UNIT_CODE_FIXES.map(
  ([code, ucum, fixed]) =>
    `WHEN loinc_code = ${sqlString(code)} AND ${storedUnit} = ${sqlString(ucum)} THEN ${sqlString(fixed)}`
).join('\n        ');

/**
 * Records each lab result under the LOINC code for its unit.
 *
 * Non-breaking: no table or column changes, and older app versions read the
 * rewritten JSON (they match results by name too). The `loinc_code` column
 * and `Observation.code.coding[0].code` are rewritten in place:
 * - results in a unit of another kind than their code's, e.g. glucose in
 *   mmol/L under the mg/dL code, get the code for their unit;
 * - RDW-SD results move from 21000-5, which LOINC 2.83 deprecated as
 *   ambiguous, to 115742-9 (its standard deviation code; 115741-1 replaced
 *   the coefficient of variation, which the app never stored there).
 * Rows written are captured for sync like any other edit, so the reports
 * replicate; devices migrating separately write the same content.
 */
export const migrationV22: DatabaseMigration = {
  version: 22,
  description: 'Record lab results under the LOINC code for their unit',
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
    WHERE (loinc_code, ${storedUnit}) IN (VALUES ${UNIT_CODE_FIXES.map(
      ([code, ucum]) => `(${sqlString(code)}, ${sqlString(ucum)})`
    ).join(', ')})
      AND json_extract(fhir_json, '$.code.coding[0].system') = 'http://loinc.org'
      AND json_extract(fhir_json, '$.code.coding[0].code') = loinc_code;

    UPDATE observations
    SET
      loinc_code = '115742-9',
      fhir_json = json_set(fhir_json, '$.code.coding[0].code', '115742-9')
    WHERE loinc_code = '21000-5'
      AND json_extract(fhir_json, '$.code.coding[0].system') = 'http://loinc.org'
      AND json_extract(fhir_json, '$.code.coding[0].code') = '21000-5';
  `,
};
