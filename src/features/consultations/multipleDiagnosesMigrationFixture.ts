import { openDatabaseAsync } from 'expo-sqlite';
import { getDb, migrateDatabase, DATABASE_MIGRATIONS } from '@/src/database/db';

/** Runs the production migration runner against isolated synthetic v7 databases. */
export async function verifyDiagnosisMigration(invalidOwnership = false) {
  const original = await getDb();
  const db = await openDatabaseAsync(':memory:', { useNewConnection: true });
  try {
    await db.execAsync('PRAGMA foreign_keys = ON;');
    for (const migration of DATABASE_MIGRATIONS.filter((m) => m.version <= 7)) {
      await db.execAsync(migration.sql);
    }
    await db.execAsync('PRAGMA user_version = 7;');
    const timestamp = '2026-01-01T00:00:00Z';
    for (const id of ['migration-patient', 'other-patient']) {
      await db.runAsync(
        'INSERT INTO patients (id, given_name, fhir_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?);',
        [
          id,
          'Synthetic',
          JSON.stringify({ resourceType: 'Patient', id }),
          timestamp,
          timestamp,
        ]
      );
    }
    for (const id of ['first', 'second']) {
      const patientId =
        invalidOwnership && id === 'second'
          ? 'other-patient'
          : 'migration-patient';
      await db.runAsync(
        'INSERT INTO conditions (id, patient_id, title, clinical_status, verification_status, onset_date, fhir_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
        [
          id,
          patientId,
          id,
          'active',
          'confirmed',
          '2026-01-01',
          JSON.stringify({
            resourceType: 'Condition',
            id,
            clinicalStatus: { text: 'active' },
            subject: { reference: `Patient/${patientId}` },
          }),
          timestamp,
          timestamp,
        ]
      );
    }
    const encounter = {
      resourceType: 'Encounter',
      id: 'legacy',
      status: 'completed',
      subject: { reference: 'Patient/migration-patient' },
      text: {
        status: 'additional',
        div: '<div xmlns="http://www.w3.org/1999/xhtml">Original notes</div>',
      },
      meta: { lastUpdated: timestamp },
      diagnosis: [
        {
          condition: [{ reference: { reference: 'Condition/second' } }],
          use: [{ text: 'secondary' }],
        },
      ],
    };
    await db.runAsync(
      'INSERT INTO consultations (id, patient_id, condition_id, date, title, status, fhir_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
      [
        'legacy',
        'migration-patient',
        'first',
        '2026-01-01',
        'Legacy visit',
        'completed',
        JSON.stringify(encounter),
        timestamp,
        timestamp,
      ]
    );
    let failed = false;
    try {
      await migrateDatabase(db);
    } catch {
      failed = true;
    }
    const version = await db.getFirstAsync('PRAGMA user_version;');
    const columns = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(consultations);'
    );
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'consultation_conditions';"
    );
    const links = tables.length
      ? await db.getAllAsync(
          'SELECT * FROM consultation_conditions ORDER BY condition_id;'
        )
      : [];
    const row = await db.getFirstAsync<{ fhir_json: string }>(
      'SELECT fhir_json FROM consultations WHERE id = ?;',
      ['legacy']
    );
    if (!failed) await migrateDatabase(db);
    return {
      failed,
      version,
      columns: columns.map((c) => c.name),
      links,
      encounter: JSON.parse(row!.fhir_json),
      integrity: await db.getAllAsync('PRAGMA foreign_key_check;'),
      repeatedVersion: await db.getFirstAsync('PRAGMA user_version;'),
    };
  } finally {
    await migrateDatabase(original);
    await db.closeAsync();
  }
}
