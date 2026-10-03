import { Platform } from 'react-native';
import { FHIREpisodeOfCare } from '../../types/fhir';
import { initializeDatabase, getNativeDb } from '../../database/db';
import {
  insertEpisodeOfCareWeb,
  fetchAllEpisodesOfCareWeb,
  fetchEpisodeOfCareByIdWeb,
  deleteEpisodeOfCareWeb,
} from '../../database/indexedDb';

/**
 * Persists an EpisodeOfCare (Health Case) record.
 */
export async function insertEpisodeOfCareRecord(
  episode: FHIREpisodeOfCare
): Promise<void> {
  await initializeDatabase();

  if (Platform.OS === 'web') {
    await insertEpisodeOfCareWeb(episode);
    return;
  }

  const nativeDb = getNativeDb();
  if (nativeDb) {
    const now = new Date().toISOString();
    const startDate = episode.period?.start || now.split('T')[0];
    const title =
      episode.type?.[0]?.text ||
      episode.diagnosis?.[0]?.condition?.display ||
      episode.description ||
      'Health Case';
    const descriptionText =
      episode.note && episode.note.length > 0
        ? episode.note.map((n) => n.text).join('\n')
        : episode.description || null;

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
export async function fetchAllEpisodeOfCareRecords(): Promise<
  FHIREpisodeOfCare[]
> {
  await initializeDatabase();

  if (Platform.OS === 'web') {
    return await fetchAllEpisodesOfCareWeb();
  }

  const nativeDb = getNativeDb();
  if (nativeDb) {
    const rows = await nativeDb.getAllAsync(
      `SELECT * FROM episodes_of_care ORDER BY start_date DESC, created_at DESC;`
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
): Promise<FHIREpisodeOfCare | null> {
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
