import type { DiagnosticReport, Observation } from 'fhir/r5';
import { DiagnosticReportRecord } from '../../database/types';
import { getDb } from '../../database/db';
import { DEFAULT_PATIENT_ID } from '../profile/patientRepository';

/**
 * Persists a FHIR DiagnosticReport and its Observations in SQLite.
 * Single unified implementation across Web, Android, and iOS.
 */
export async function insertDiagnosticReportRecord(
  report: DiagnosticReport,
  observations: Observation[],
  patientId: string = DEFAULT_PATIENT_ID
): Promise<void> {
  if (!report.id) {
    throw new Error('DiagnosticReport requires an id to be persisted');
  }
  for (const obs of observations) {
    if (!obs.id) {
      throw new Error('Observation requires an id to be persisted');
    }
  }
  const reportId = report.id;
  const db = await getDb();
  const now = new Date().toISOString();
  const effectiveDate = report.effectiveDateTime || now.split('T')[0];
  const notesText =
    report.note && report.note.length > 0
      ? report.note.map((n) => n.text).join('\n')
      : null;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR REPLACE INTO diagnostic_reports (id, patient_id, effective_date, status, notes, fhir_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        reportId,
        patientId,
        effectiveDate,
        report.status,
        notesText,
        JSON.stringify(report),
        now,
        now,
      ]
    );

    await db.runAsync(`DELETE FROM observations WHERE report_id = ?;`, [
      reportId,
    ]);

    for (const obs of observations) {
      const loinc = obs.code.coding?.[0]?.code || '';
      const name = obs.code.coding?.[0]?.display || obs.code.text || 'Unknown';
      const val = obs.valueQuantity?.value ?? 0;
      const unit = obs.valueQuantity?.unit || obs.valueQuantity?.code || '';
      const obsId = obs.id!;

      await db.runAsync(
        `INSERT OR REPLACE INTO observations (id, report_id, loinc_code, name, value, unit, fhir_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [obsId, reportId, loinc, name, val, unit, JSON.stringify(obs), now]
      );
    }
  });
}

/**
 * Retrieves all stored diagnostic reports with their nested observations from SQLite.
 * Filters by patientId if provided.
 */
export async function fetchAllDiagnosticReportRecords(
  patientId?: string
): Promise<DiagnosticReportRecord[]> {
  const db = await getDb();
  let reportRows: { id: string; fhir_json: string }[] = [];

  if (patientId) {
    reportRows = await db.getAllAsync<{ id: string; fhir_json: string }>(
      `SELECT id, fhir_json FROM diagnostic_reports WHERE patient_id = ? ORDER BY effective_date DESC, created_at DESC, id DESC;`,
      [patientId]
    );
  } else {
    reportRows = await db.getAllAsync<{ id: string; fhir_json: string }>(
      `SELECT id, fhir_json FROM diagnostic_reports ORDER BY effective_date DESC, created_at DESC, id DESC;`
    );
  }

  const records: DiagnosticReportRecord[] = [];
  for (const r of reportRows) {
    const parsedReport: DiagnosticReport = JSON.parse(r.fhir_json);
    const obsRows = await db.getAllAsync<{ fhir_json: string }>(
      `SELECT fhir_json FROM observations WHERE report_id = ? ORDER BY name ASC, id ASC;`,
      [r.id]
    );
    const observations: Observation[] = obsRows.map((o) =>
      JSON.parse(o.fhir_json)
    );

    if (parsedReport.result && parsedReport.result.length > 0) {
      const idOrder = new Map(
        parsedReport.result.map((ref, idx) => {
          const cleanRef = ref.reference?.replace(/^Observation\//, '') || '';
          return [cleanRef, idx];
        })
      );
      observations.sort((a, b) => {
        const cleanA = a.id?.replace(/^Observation\//, '') || '';
        const cleanB = b.id?.replace(/^Observation\//, '') || '';
        const idxA = idOrder.get(cleanA) ?? idOrder.get(a.id || '') ?? 9999;
        const idxB = idOrder.get(cleanB) ?? idOrder.get(b.id || '') ?? 9999;
        if (idxA !== idxB) {
          return idxA - idxB;
        }
        return (a.id || '').localeCompare(b.id || '');
      });
    } else {
      observations.sort((a, b) => {
        const nameA = a.code.coding?.[0]?.display || a.code.text || '';
        const nameB = b.code.coding?.[0]?.display || b.code.text || '';
        const nameCmp = nameA.localeCompare(nameB);
        if (nameCmp !== 0) return nameCmp;
        return (a.id || '').localeCompare(b.id || '');
      });
    }

    records.push({ report: parsedReport, observations });
  }

  return records;
}

/**
 * Deletes a diagnostic report and its associated observations from SQLite.
 * Single unified implementation across Web, Android, and iOS.
 */
export async function deleteDiagnosticReportRecord(
  reportId: string
): Promise<void> {
  if (!reportId) return;
  const db = await getDb();
  await db.runAsync(`DELETE FROM observations WHERE report_id = ?;`, [
    reportId,
  ]);
  await db.runAsync(`DELETE FROM diagnostic_reports WHERE id = ?;`, [reportId]);
}
