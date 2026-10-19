import { getDb } from '@/src/database/db';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import {
  getProfileSettingsId,
  withDefaults,
  type ProfileSettings,
} from './profileSettings';

/** A profile's settings as stored and synced: its id plus the settings. */
export type ProfileSettingsRecord = { id: string } & Partial<ProfileSettings>;

/** A profile's settings, with defaults for anything not stored. */
export async function getProfileSettings(
  patientId: string
): Promise<ProfileSettings> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ settings_json: string }>(
    'SELECT settings_json FROM profile_settings WHERE patient_id = ?;',
    [patientId]
  );
  const { id: _id, ...stored }: ProfileSettingsRecord = row
    ? JSON.parse(row.settings_json)
    : { id: '' };
  return withDefaults(stored);
}

/**
 * Stores a profile's settings record. Keys this version does not know are
 * kept, so newer devices' settings survive a round trip.
 */
export async function insertProfileSettingsRecord(
  record: ProfileSettingsRecord,
  patientId: string,
  withinTransaction: boolean = false
): Promise<void> {
  if (record.id !== getProfileSettingsId(patientId)) {
    throw new Error('Profile settings must belong to their profile');
  }
  const db = await getDb();
  const persist = async () => {
    const patient = await db.getFirstAsync(
      'SELECT 1 FROM patients WHERE id = ?;',
      [patientId]
    );
    if (!patient) throw new Error(`Profile ${patientId} not found`);
    await db.runAsync(
      `INSERT INTO profile_settings (id, patient_id, settings_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         settings_json = excluded.settings_json,
         updated_at = excluded.updated_at;`,
      [record.id, patientId, JSON.stringify(record), new Date().toISOString()]
    );
  };
  if (withinTransaction) {
    await persist();
  } else {
    await db.withTransactionAsync(persist);
    notifyDatabaseChanged(['profile_settings']);
  }
}

/** Saves settings for a profile, keeping stored keys it does not change. */
export async function saveProfileSettings(
  patientId: string,
  settings: Partial<ProfileSettings>
): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ settings_json: string }>(
    'SELECT settings_json FROM profile_settings WHERE patient_id = ?;',
    [patientId]
  );
  const stored: ProfileSettingsRecord = row
    ? JSON.parse(row.settings_json)
    : {};
  await insertProfileSettingsRecord(
    { ...stored, ...settings, id: getProfileSettingsId(patientId) },
    patientId
  );
}
