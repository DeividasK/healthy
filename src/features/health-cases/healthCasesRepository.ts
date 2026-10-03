import { Platform } from 'react-native';
import type { EpisodeOfCare } from 'fhir/r5';
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
  episode: EpisodeOfCare
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
      episode.diagnosis?.[0]?.condition?.[0]?.concept?.text ||
      episode.diagnosis?.[0]?.condition?.[0]?.reference?.display ||
      (episode.diagnosis?.[0] as any)?.condition?.display ||
      (episode as any).description ||
      'Health Case';
    const descriptionText =
      ((episode as any).note && (episode as any).note.length > 0
        ? (episode as any).note.map((n: any) => n.text).join('\n')
        : null) ||
      (episode.text?.div
        ? episode.text.div.replace(/^<div[^>]*>|<\/div>$/gi, '')
        : null) ||
      (episode as any).description ||
      null;

    const episodeId = episode.id || '';

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
        episodeId,
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
): Promise<EpisodeOfCare | null> {
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
