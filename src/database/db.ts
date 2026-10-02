import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FHIRDiagnosticReport,
  FHIRObservation,
  FHIREpisodeOfCare,
} from '../types/fhir';
import { DiagnosticReportRecord } from './types';
import { openNativeDatabase } from './sqliteDriver';

const ASYNC_STORAGE_REPORTS_KEY = '@healthy_diagnostic_reports_v1';
const ASYNC_STORAGE_OBSERVATIONS_KEY = '@healthy_observations_v1';
const ASYNC_STORAGE_EPISODES_KEY = '@healthy_episodes_of_care_v1';

const DB_NAME = 'healthy.db';
let nativeDb: any = null;
let isDbInitialized = false;

/**
 * Initializes the database tables with versioned migrations.
 */
export async function initializeDatabase(): Promise<void> {
  if (isDbInitialized) return;

  try {
    nativeDb = await openNativeDatabase(DB_NAME);
    if (nativeDb) {
      await nativeDb.execAsync('PRAGMA foreign_keys = ON;');

      // Query current schema version
      const verRow = (await nativeDb.getFirstAsync('PRAGMA user_version;')) as
        { user_version?: number } | undefined;
      const currentVersion = verRow?.user_version ?? 0;

      // Migration v1: diagnostic_reports and observations
      if (currentVersion < 1) {
        await nativeDb.execAsync(`
          CREATE TABLE IF NOT EXISTS diagnostic_reports (
            id TEXT PRIMARY KEY,
            effective_date TEXT NOT NULL,
            status TEXT NOT NULL,
            notes TEXT,
            fhir_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS observations (
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL REFERENCES diagnostic_reports(id) ON DELETE CASCADE,
            loinc_code TEXT NOT NULL,
            name TEXT NOT NULL,
            value REAL NOT NULL,
            unit TEXT NOT NULL,
            fhir_json TEXT NOT NULL,
            created_at TEXT NOT NULL
          );
          PRAGMA user_version = 1;
        `);
      }

      // Migration v2: episodes_of_care (Health Cases)
      if (currentVersion < 2) {
        await nativeDb.execAsync(`
          CREATE TABLE IF NOT EXISTS episodes_of_care (
            id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            start_date TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            fhir_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          PRAGMA user_version = 2;
        `);
      }
    }
  } catch (err) {
    console.warn(
      'Native SQLite init failed, falling back to AsyncStorage:',
      err
    );
    nativeDb = null;
  }

  isDbInitialized = true;
}

/**
 * Persists a FHIR DiagnosticReport and its Observations.
 */
export async function insertDiagnosticReportRecord(
  report: FHIRDiagnosticReport,
  observations: FHIRObservation[]
): Promise<void> {
  await initializeDatabase();

  const now = new Date().toISOString();
  const effectiveDate = report.effectiveDateTime || now.split('T')[0];
  const notesText =
    report.note && report.note.length > 0
      ? report.note.map((n) => n.text).join('\n')
      : null;

  if (Platform.OS !== 'web' && nativeDb) {
    await nativeDb.withTransactionAsync(async () => {
      await nativeDb.runAsync(
        `INSERT OR REPLACE INTO diagnostic_reports (id, effective_date, status, notes, fhir_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          report.id,
          effectiveDate,
          report.status,
          notesText,
          JSON.stringify(report),
          now,
          now,
        ]
      );

      await nativeDb.runAsync(`DELETE FROM observations WHERE report_id = ?;`, [
        report.id,
      ]);

      for (const obs of observations) {
        const loinc = obs.code.coding?.[0]?.code || '';
        const name =
          obs.code.coding?.[0]?.display || obs.code.text || 'Unknown';
        const val = obs.valueQuantity?.value ?? 0;
        const unit = obs.valueQuantity?.unit || obs.valueQuantity?.code || '';

        await nativeDb.runAsync(
          `INSERT OR REPLACE INTO observations (id, report_id, loinc_code, name, value, unit, fhir_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [obs.id, report.id, loinc, name, val, unit, JSON.stringify(obs), now]
        );
      }
    });
    return;
  }

  // Web / AsyncStorage Fallback
  const existingReportsRaw = await AsyncStorage.getItem(
    ASYNC_STORAGE_REPORTS_KEY
  );
  const existingReports: Record<string, any> = existingReportsRaw
    ? JSON.parse(existingReportsRaw)
    : {};
  existingReports[report.id] = {
    id: report.id,
    effective_date: effectiveDate,
    status: report.status,
    notes: notesText,
    fhir_json: JSON.stringify(report),
    created_at: now,
    updated_at: now,
  };
  await AsyncStorage.setItem(
    ASYNC_STORAGE_REPORTS_KEY,
    JSON.stringify(existingReports)
  );

  const existingObsRaw = await AsyncStorage.getItem(
    ASYNC_STORAGE_OBSERVATIONS_KEY
  );
  const existingObs: Record<string, any[]> = existingObsRaw
    ? JSON.parse(existingObsRaw)
    : {};
  existingObs[report.id] = observations.map((obs) => {
    const loinc = obs.code.coding?.[0]?.code || '';
    const name = obs.code.coding?.[0]?.display || obs.code.text || 'Unknown';
    const val = obs.valueQuantity?.value ?? 0;
    const unit = obs.valueQuantity?.unit || obs.valueQuantity?.code || '';
    return {
      id: obs.id,
      report_id: report.id,
      loinc_code: loinc,
      name,
      value: val,
      unit,
      fhir_json: JSON.stringify(obs),
      created_at: now,
    };
  });
  await AsyncStorage.setItem(
    ASYNC_STORAGE_OBSERVATIONS_KEY,
    JSON.stringify(existingObs)
  );
}

/**
 * Retrieves all stored diagnostic reports with their nested observations.
 */
export async function fetchAllDiagnosticReportRecords(): Promise<
  DiagnosticReportRecord[]
> {
  await initializeDatabase();

  if (Platform.OS !== 'web' && nativeDb) {
    const reportRows = await nativeDb.getAllAsync(
      `SELECT * FROM diagnostic_reports ORDER BY effective_date DESC, created_at DESC;`
    );

    const records: DiagnosticReportRecord[] = [];
    for (const r of reportRows) {
      const parsedReport: FHIRDiagnosticReport = JSON.parse(r.fhir_json);
      const obsRows = await nativeDb.getAllAsync(
        `SELECT * FROM observations WHERE report_id = ? ORDER BY name ASC;`,
        [r.id]
      );
      const observations: FHIRObservation[] = obsRows.map((o: any) =>
        JSON.parse(o.fhir_json)
      );
      records.push({ report: parsedReport, observations });
    }
    return records;
  }

  // Web / AsyncStorage Fallback
  const reportsRaw = await AsyncStorage.getItem(ASYNC_STORAGE_REPORTS_KEY);
  if (!reportsRaw) return [];
  const reportsObj = JSON.parse(reportsRaw);

  const obsRaw = await AsyncStorage.getItem(ASYNC_STORAGE_OBSERVATIONS_KEY);
  const obsObj = obsRaw ? JSON.parse(obsRaw) : {};

  const reportList = Object.values(reportsObj).sort((a: any, b: any) =>
    b.effective_date.localeCompare(a.effective_date)
  );

  return reportList.map((r: any) => {
    const report: FHIRDiagnosticReport = JSON.parse(r.fhir_json);
    const obsList = obsObj[r.id] || [];
    const observations: FHIRObservation[] = obsList.map((o: any) =>
      JSON.parse(o.fhir_json)
    );
    return { report, observations };
  });
}

/**
 * Deletes a diagnostic report and its associated observations.
 */
export async function deleteDiagnosticReportRecord(
  reportId: string
): Promise<void> {
  await initializeDatabase();

  if (Platform.OS !== 'web' && nativeDb) {
    await nativeDb.runAsync(`DELETE FROM observations WHERE report_id = ?;`, [
      reportId,
    ]);
    await nativeDb.runAsync(`DELETE FROM diagnostic_reports WHERE id = ?;`, [
      reportId,
    ]);
    return;
  }

  // Web / AsyncStorage
  const reportsRaw = await AsyncStorage.getItem(ASYNC_STORAGE_REPORTS_KEY);
  if (reportsRaw) {
    const reportsObj = JSON.parse(reportsRaw);
    delete reportsObj[reportId];
    await AsyncStorage.setItem(
      ASYNC_STORAGE_REPORTS_KEY,
      JSON.stringify(reportsObj)
    );
  }

  const obsRaw = await AsyncStorage.getItem(ASYNC_STORAGE_OBSERVATIONS_KEY);
  if (obsRaw) {
    const obsObj = JSON.parse(obsRaw);
    delete obsObj[reportId];
    await AsyncStorage.setItem(
      ASYNC_STORAGE_OBSERVATIONS_KEY,
      JSON.stringify(obsObj)
    );
  }
}

/**
 * Persists an EpisodeOfCare (Health Case) record.
 */
export async function insertEpisodeOfCareRecord(
  episode: FHIREpisodeOfCare
): Promise<void> {
  await initializeDatabase();

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

  if (Platform.OS !== 'web' && nativeDb) {
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
    return;
  }

  // Web / AsyncStorage Fallback
  const raw = await AsyncStorage.getItem(ASYNC_STORAGE_EPISODES_KEY);
  const episodesObj: Record<string, any> = raw ? JSON.parse(raw) : {};
  episodesObj[episode.id] = {
    id: episode.id,
    status: episode.status,
    start_date: startDate,
    title,
    description: descriptionText,
    fhir_json: JSON.stringify(episode),
    created_at: episodesObj[episode.id]?.created_at ?? now,
    updated_at: now,
  };
  await AsyncStorage.setItem(
    ASYNC_STORAGE_EPISODES_KEY,
    JSON.stringify(episodesObj)
  );
}

/**
 * Retrieves all stored EpisodeOfCare records.
 */
export async function fetchAllEpisodeOfCareRecords(): Promise<
  FHIREpisodeOfCare[]
> {
  await initializeDatabase();

  if (Platform.OS !== 'web' && nativeDb) {
    const rows = await nativeDb.getAllAsync(
      `SELECT * FROM episodes_of_care ORDER BY start_date DESC, created_at DESC;`
    );
    return rows.map((r: any) => JSON.parse(r.fhir_json));
  }

  // Web / AsyncStorage Fallback
  const raw = await AsyncStorage.getItem(ASYNC_STORAGE_EPISODES_KEY);
  if (!raw) return [];
  const episodesObj = JSON.parse(raw);
  const list = Object.values(episodesObj).sort((a: any, b: any) =>
    b.start_date.localeCompare(a.start_date)
  );
  return list.map((item: any) => JSON.parse(item.fhir_json));
}

/**
 * Retrieves an EpisodeOfCare record by its ID.
 */
export async function fetchEpisodeOfCareById(
  id: string
): Promise<FHIREpisodeOfCare | null> {
  const all = await fetchAllEpisodeOfCareRecords();
  return all.find((e) => e.id === id) || null;
}

/**
 * Deletes an EpisodeOfCare record by its ID.
 */
export async function deleteEpisodeOfCareRecord(id: string): Promise<void> {
  await initializeDatabase();

  if (Platform.OS !== 'web' && nativeDb) {
    await nativeDb.runAsync(`DELETE FROM episodes_of_care WHERE id = ?;`, [id]);
    return;
  }

  // Web / AsyncStorage Fallback
  const raw = await AsyncStorage.getItem(ASYNC_STORAGE_EPISODES_KEY);
  if (raw) {
    const obj = JSON.parse(raw);
    delete obj[id];
    await AsyncStorage.setItem(ASYNC_STORAGE_EPISODES_KEY, JSON.stringify(obj));
  }
}
