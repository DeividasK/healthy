import { Platform } from 'react-native';
import type { DiagnosticReport, Observation } from 'fhir/r5';
import { DiagnosticReportRecord } from '../../database/types';
import { initializeDatabase, getNativeDb } from '../../database/db';
import {
  insertDiagnosticReportWeb,
  fetchAllDiagnosticReportsWeb,
  deleteDiagnosticReportWeb,
} from '../../database/indexedDb';

/**
 * Persists a FHIR DiagnosticReport and its Observations.
 */
export async function insertDiagnosticReportRecord(
  report: DiagnosticReport,
  observations: Observation[]
): Promise<void> {
  await initializeDatabase();

  if (Platform.OS === 'web') {
    await insertDiagnosticReportWeb(report, observations);
    return;
  }

  const nativeDb = getNativeDb();
  if (nativeDb) {
    const now = new Date().toISOString();
    const effectiveDate = report.effectiveDateTime || now.split('T')[0];
    const notesText =
      report.note && report.note.length > 0
        ? report.note.map((n) => n.text).join('\n')
        : null;

    const reportId = report.id || '';

    await nativeDb.withTransactionAsync(async () => {
      await nativeDb.runAsync(
        `INSERT OR REPLACE INTO diagnostic_reports (id, effective_date, status, notes, fhir_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          reportId,
          effectiveDate,
          report.status,
          notesText,
          JSON.stringify(report),
          now,
          now,
        ]
      );

      await nativeDb.runAsync(`DELETE FROM observations WHERE report_id = ?;`, [
        reportId,
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
          [
            obs.id || '',
            reportId,
            loinc,
            name,
            val,
            unit,
            JSON.stringify(obs),
            now,
          ]
        );
      }
    });
  }
}

/**
 * Retrieves all stored diagnostic reports with their nested observations.
 */
export async function fetchAllDiagnosticReportRecords(): Promise<
  DiagnosticReportRecord[]
> {
  await initializeDatabase();

  if (Platform.OS === 'web') {
    return await fetchAllDiagnosticReportsWeb();
  }

  const nativeDb = getNativeDb();
  if (nativeDb) {
    const reportRows = await nativeDb.getAllAsync(
      `SELECT * FROM diagnostic_reports ORDER BY effective_date DESC, created_at DESC;`
    );

    const records: DiagnosticReportRecord[] = [];
    for (const r of reportRows) {
      const parsedReport: DiagnosticReport = JSON.parse(r.fhir_json);
      const obsRows = await nativeDb.getAllAsync(
        `SELECT * FROM observations WHERE report_id = ? ORDER BY name ASC;`,
        [r.id]
      );
      const observations: Observation[] = obsRows.map((o: any) =>
        JSON.parse(o.fhir_json)
      );

      if (parsedReport.result && parsedReport.result.length > 0) {
        const idOrder = new Map(
          parsedReport.result.map((ref, idx) => [
            ref.reference?.replace('Observation/', ''),
            idx,
          ])
        );
        observations.sort((a, b) => {
          const idxA = idOrder.get(a.id || '') ?? 9999;
          const idxB = idOrder.get(b.id || '') ?? 9999;
          return idxA - idxB;
        });
      }

      records.push({ report: parsedReport, observations });
    }
    return records;
  }

  return [];
}

/**
 * Deletes a diagnostic report and its associated observations.
 */
export async function deleteDiagnosticReportRecord(
  reportId: string
): Promise<void> {
  await initializeDatabase();

  if (Platform.OS === 'web') {
    await deleteDiagnosticReportWeb(reportId);
    return;
  }

  const nativeDb = getNativeDb();
  if (nativeDb) {
    await nativeDb.runAsync(`DELETE FROM observations WHERE report_id = ?;`, [
      reportId,
    ]);
    await nativeDb.runAsync(`DELETE FROM diagnostic_reports WHERE id = ?;`, [
      reportId,
    ]);
  }
}
