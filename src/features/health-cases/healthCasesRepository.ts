import { Platform } from 'react-native';
import type { EpisodeOfCare } from 'fhir/r5';
import { initializeDatabase, getNativeDb } from '../../database/db';
import {
  insertEpisodeOfCareWeb,
  fetchAllEpisodesOfCareWeb,
  fetchEpisodeOfCareByIdWeb,
  deleteEpisodeOfCareWeb,
} from '../../database/indexedDb';
import { getEpisodeTitle, getEpisodeDescription } from '../../utils/fhirUtils';

/**
 * Persists an EpisodeOfCare (Health Case) record.
 */
export async function insertEpisodeOfCareRecord(
  episode: EpisodeOfCare
): Promise<void> {
  if (!episode.id) {
    throw new Error('EpisodeOfCare requires an id to be persisted');
  }

  await initializeDatabase();

  if (Platform.OS === 'web') {
    await insertEpisodeOfCareWeb(episode);
    return;
  }

  const nativeDb = getNativeDb();
  if (nativeDb) {
    const now = new Date().toISOString();
    const startDate = episode.period?.start || now.split('T')[0];
    const title = getEpisodeTitle(episode);
    const descriptionText = getEpisodeDescription(episode);

    await nativeDb.runAsync(
      `INSERT INTO episodes_of_care (id, status, start_date, title, description, fhir_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         start_date = excluded.start_date,
         title = excluded.title,
         description = excluded.description,
         fhir_json = excluded.fhir_json,
         updated_at = excluded.updated_at;`,
      [
        episode.id,

        episode.status,
        startDate,
        title,
        descriptionText,
        JSON.stringify(episode),
        now,
        now,
      ]
    );
  }
}

/**
 * Retrieves all stored EpisodeOfCare records.
 */
export async function fetchAllEpisodeOfCareRecords(): Promise<EpisodeOfCare[]> {
  await initializeDatabase();

  if (Platform.OS === 'web') {
    return await fetchAllEpisodesOfCareWeb();
  }

  const nativeDb = getNativeDb();
  if (nativeDb) {
    const rows = await nativeDb.getAllAsync(
      `SELECT * FROM episodes_of_care ORDER BY start_date DESC, created_at DESC, id DESC;`
    );
    return rows.map((r: any) => JSON.parse(r.fhir_json));
  }

  return [];
}

/**
 * Retrieves an EpisodeOfCare record by its ID.
 */
export async function fetchEpisodeOfCareById(
  id: string
): Promise<EpisodeOfCare | null> {
  if (!id) return null;
  await initializeDatabase();

  if (Platform.OS === 'web') {
    return await fetchEpisodeOfCareByIdWeb(id);
  }

  const all = await fetchAllEpisodeOfCareRecords();
  return all.find((e) => e.id === id) || null;
}

/**
 * Deletes an EpisodeOfCare record by its ID.
 */
export async function deleteEpisodeOfCareRecord(id: string): Promise<void> {
  if (!id) return;
  await initializeDatabase();

  if (Platform.OS === 'web') {
    await deleteEpisodeOfCareWeb(id);
    return;
  }

  const nativeDb = getNativeDb();
  if (nativeDb) {
    await nativeDb.runAsync(`DELETE FROM episodes_of_care WHERE id = ?;`, [id]);
  }
}
