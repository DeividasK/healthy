import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FHIRDiagnosticReport, FHIRObservation } from '../types/fhir';
import { DiagnosticReportRecord } from './types';
import { openNativeDatabase } from './sqliteDriver';

const ASYNC_STORAGE_REPORTS_KEY = '@healthy_diagnostic_reports_v1';
const ASYNC_STORAGE_OBSERVATIONS_KEY = '@healthy_observations_v1';

const DB_NAME = 'healthy.db';
let nativeDb: any = null;
let isDbInitialized = false;

/**
 * Initializes the database tables.
 */
export async function initializeDatabase(): Promise<void> {
  if (isDbInitialized) return;

  try {
    nativeDb = await openNativeDatabase(DB_NAME);
    if (nativeDb) {
      await nativeDb.execAsync(`
        PRAGMA foreign_keys = ON;
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
      `);
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
