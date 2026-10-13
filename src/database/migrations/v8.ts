import type { DatabaseMigration } from './types';

/** Breaking: Encounter.diagnosis replaces the legacy single-condition projection. */
export const migrationV8: DatabaseMigration = {
  version: 8,
  description:
    'Replace single-condition consultations with diagnosis associations',
  isBreaking: true,
  sql: `
    CREATE TABLE consultation_conditions (
      consultation_id TEXT NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
      condition_id TEXT NOT NULL REFERENCES conditions(id) ON DELETE CASCADE,
      PRIMARY KEY (consultation_id, condition_id)
    );
    CREATE INDEX idx_consultation_conditions_condition ON consultation_conditions(condition_id);

    CREATE TEMP TABLE diagnosis_migration_guard (valid INTEGER CHECK (valid = 1));
    INSERT INTO diagnosis_migration_guard
      SELECT 0 FROM consultations c LEFT JOIN conditions d ON d.id = c.condition_id
      WHERE c.condition_id IS NOT NULL AND (d.id IS NULL OR d.patient_id IS NOT c.patient_id);

    UPDATE consultations SET fhir_json = json_insert(
      json_set(fhir_json, '$.diagnosis', json(COALESCE(json_extract(fhir_json, '$.diagnosis'), '[]'))),
      '$.diagnosis[#]', json_object('condition', json_array(json_object('reference', json_object('reference', 'Condition/' || condition_id))))
    ) WHERE condition_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM json_each(fhir_json, '$.diagnosis') d, json_each(d.value, '$.condition') r
      WHERE json_extract(r.value, '$.reference.reference') = 'Condition/' || condition_id
    );

    INSERT INTO diagnosis_migration_guard
      SELECT 0 FROM consultations c, json_each(c.fhir_json, '$.diagnosis') d, json_each(d.value, '$.condition') r
      LEFT JOIN conditions target ON target.id = substr(json_extract(r.value, '$.reference.reference'), 11)
      WHERE json_extract(r.value, '$.reference.reference') LIKE 'Condition/%'
        AND (target.id IS NULL OR target.patient_id IS NOT c.patient_id);

    INSERT OR IGNORE INTO consultation_conditions (consultation_id, condition_id)
      SELECT c.id, substr(json_extract(r.value, '$.reference.reference'), 11)
      FROM consultations c, json_each(c.fhir_json, '$.diagnosis') d, json_each(d.value, '$.condition') r
      WHERE json_extract(r.value, '$.reference.reference') LIKE 'Condition/%';
    DROP TABLE diagnosis_migration_guard;
    DROP INDEX idx_consultations_condition_id;
    ALTER TABLE consultations DROP COLUMN condition_id;
  `,
};
