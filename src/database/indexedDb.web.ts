import type { DiagnosticReport, Observation, Condition } from 'fhir/r5';
import {
  DiagnosticReportRecord,
  StoredDiagnosticReportRow,
  StoredObservationRow,
  StoredConditionRow,
} from './types';
import { getConditionTitle, getConditionNotes } from '../utils/fhirUtils';

export const INDEXED_DB_NAME = 'healthy_db';
export const INDEXED_DB_VERSION = 3;

const LEGACY_STORAGE_REPORTS_KEY = '@healthy_diagnostic_reports_v1';
const LEGACY_STORAGE_OBSERVATIONS_KEY = '@healthy_observations_v1';

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

/**
 * Initializes and upgrades the IndexedDB database.
 */
export async function getWebDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  if (dbInitPromise) return dbInitPromise;

  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(INDEXED_DB_NAME, INDEXED_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      // Version 1 stores
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('diagnostic_reports')) {
          const reportStore = db.createObjectStore('diagnostic_reports', {
            keyPath: 'id',
          });
          reportStore.createIndex('effective_date', 'effective_date', {
            unique: false,
          });
        }

        if (!db.objectStoreNames.contains('observations')) {
          const obsStore = db.createObjectStore('observations', {
            keyPath: 'id',
          });
          obsStore.createIndex('report_id', 'report_id', { unique: false });
        }
      }

      // Version 3 stores: conditions (destructive migration from episodes_of_care)
      if (oldVersion < 3) {
        if (db.objectStoreNames.contains('episodes_of_care')) {
          db.deleteObjectStore('episodes_of_care');
        }

        if (!db.objectStoreNames.contains('conditions')) {
          const condStore = db.createObjectStore('conditions', {
            keyPath: 'id',
          });
          condStore.createIndex('onset_date', 'onset_date', {
            unique: false,
          });
          condStore.createIndex('clinical_status', 'clinical_status', {
            unique: false,
          });
        }
      }
    };

    request.onsuccess = async () => {
      dbInstance = request.result;

      // Handle connection closing on external deletion/upgrade
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
        dbInitPromise = null;
      };

      try {
        await migrateLegacyLocalStorage(dbInstance);
      } catch (err) {
        console.warn(
          'Failed to migrate legacy localStorage data to IndexedDB:',
          err
        );
      }

      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error);
    };

    request.onblocked = () => {
      console.warn('IndexedDB database upgrade blocked. Close other tabs.');
    };
  });

  dbInitPromise = promise.catch((err) => {
    dbInitPromise = null;
    throw err;
  });

  return dbInitPromise;
}

/**
 * Migrates data from legacy localStorage keys to IndexedDB if present.
 */
async function migrateLegacyLocalStorage(db: IDBDatabase): Promise<void> {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const rawReports = window.localStorage.getItem(LEGACY_STORAGE_REPORTS_KEY);
  const rawObs = window.localStorage.getItem(LEGACY_STORAGE_OBSERVATIONS_KEY);

  if (!rawReports && !rawObs) return;

  const parsedReports: Record<string, StoredDiagnosticReportRow> = rawReports
    ? JSON.parse(rawReports)
    : {};
  const parsedObs: Record<string, StoredObservationRow[]> = rawObs
    ? JSON.parse(rawObs)
    : {};

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      ['diagnostic_reports', 'observations'],
      'readwrite'
    );

    const reportStore = tx.objectStore('diagnostic_reports');
    const obsStore = tx.objectStore('observations');

    for (const report of Object.values(parsedReports)) {
      reportStore.put(report);
    }

    for (const obsList of Object.values(parsedObs)) {
      for (const obs of obsList) {
        obsStore.put(obs);
      }
    }

    tx.oncomplete = () => {
      window.localStorage.removeItem(LEGACY_STORAGE_REPORTS_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_OBSERVATIONS_KEY);
      resolve();
    };

    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Persists a DiagnosticReport and its Observations in IndexedDB.
 */
export async function insertDiagnosticReportWeb(
  report: DiagnosticReport,
  observations: Observation[]
): Promise<void> {
  if (!report.id) {
    throw new Error('DiagnosticReport requires an id to be persisted');
  }
  for (const obs of observations) {
    if (!obs.id) {
      throw new Error('Observation requires an id to be persisted');
    }
  }

  const db = await getWebDatabase();
  const now = new Date().toISOString();
  const effectiveDate = report.effectiveDateTime || now.split('T')[0];
  const notesText =
    report.note && report.note.length > 0
      ? report.note.map((n) => n.text).join('\n')
      : null;

  const obsRows: StoredObservationRow[] = observations.map((obs) => {
    const loinc = obs.code.coding?.[0]?.code || '';
    const name = obs.code.coding?.[0]?.display || obs.code.text || 'Unknown';
    const val = obs.valueQuantity?.value ?? 0;
    const unit = obs.valueQuantity?.unit || obs.valueQuantity?.code || '';

    return {
      id: obs.id!,
      report_id: report.id!,
      loinc_code: loinc,
      name,
      value: val,
      unit,
      fhir_json: JSON.stringify(obs),
      created_at: now,
    };
  });

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      ['diagnostic_reports', 'observations'],
      'readwrite'
    );
    const reportStore = tx.objectStore('diagnostic_reports');
    const obsStore = tx.objectStore('observations');

    const getReq = reportStore.get(report.id!);
    getReq.onsuccess = () => {
      const existing = getReq.result as StoredDiagnosticReportRow | undefined;
      const reportRow: StoredDiagnosticReportRow = {
        id: report.id!,
        effective_date: effectiveDate,
        status: report.status,
        notes: notesText,
        fhir_json: JSON.stringify(report),
        created_at: existing?.created_at || now,
        updated_at: now,
      };
      reportStore.put(reportRow);

      // Delete existing observations for this report
      const obsIndex = obsStore.index('report_id');
      const req = obsIndex.openKeyCursor(IDBKeyRange.only(report.id!));

      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          obsStore.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          // After cleaning old observations, insert new ones
          for (const obs of obsRows) {
            obsStore.put(obs);
          }
        }
      };

      req.onerror = () => reject(req.error);
    };

    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Fetches all DiagnosticReports and their child Observations from IndexedDB.
 */
export async function fetchAllDiagnosticReportsWeb(): Promise<
  DiagnosticReportRecord[]
> {
  const db = await getWebDatabase();

  return new Promise<DiagnosticReportRecord[]>((resolve, reject) => {
    const tx = db.transaction(
      ['diagnostic_reports', 'observations'],
      'readonly'
    );
    const reportStore = tx.objectStore('diagnostic_reports');
    const obsStore = tx.objectStore('observations');

    const reportsReq = reportStore.getAll();
    const obsReq = obsStore.getAll();

    tx.oncomplete = () => {
      const reportRows =
        (reportsReq.result as StoredDiagnosticReportRow[]) || [];
      const obsRows = (obsReq.result as StoredObservationRow[]) || [];

      // Group observations by report_id
      const obsByReport: Record<string, Observation[]> = {};
      for (const row of obsRows) {
        if (!obsByReport[row.report_id]) {
          obsByReport[row.report_id] = [];
        }
        obsByReport[row.report_id].push(JSON.parse(row.fhir_json));
      }

      // Sort reports descending by effective_date then created_at
      reportRows.sort((a, b) => {
        const dateCmp = b.effective_date.localeCompare(a.effective_date);
        if (dateCmp !== 0) return dateCmp;
        const createdCmp = b.created_at.localeCompare(a.created_at);
        if (createdCmp !== 0) return createdCmp;
        return b.id.localeCompare(a.id);
      });

      const records: DiagnosticReportRecord[] = reportRows.map((r) => {
        const parsedReport: DiagnosticReport = JSON.parse(r.fhir_json);
        const observations = obsByReport[r.id] || [];

        if (parsedReport.result && parsedReport.result.length > 0) {
          const idOrder = new Map(
            parsedReport.result.map((ref, idx) => {
              const cleanRef =
                ref.reference?.replace(/^Observation\//, '') || '';
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

        return { report: parsedReport, observations };
      });

      resolve(records);
    };

    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Deletes a DiagnosticReport and cascades deletion of its Observations from IndexedDB.
 */
export async function deleteDiagnosticReportWeb(
  reportId: string
): Promise<void> {
  if (!reportId) return;

  const db = await getWebDatabase();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      ['diagnostic_reports', 'observations'],
      'readwrite'
    );
    const reportStore = tx.objectStore('diagnostic_reports');
    const obsStore = tx.objectStore('observations');

    reportStore.delete(reportId);

    // Delete all child observations matching report_id
    const obsIndex = obsStore.index('report_id');
    const req = obsIndex.openKeyCursor(IDBKeyRange.only(reportId));

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        obsStore.delete(cursor.primaryKey);
        cursor.continue();
      }
    };

    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Persists a Condition record in IndexedDB.
 */
export async function insertConditionWeb(condition: Condition): Promise<void> {
  if (!condition.id) {
    throw new Error('Condition requires an id to be persisted');
  }

  const db = await getWebDatabase();
  const now = new Date().toISOString();
  const onsetDate = condition.onsetDateTime || now.split('T')[0];
  const title = getConditionTitle(condition);
  const notesText = getConditionNotes(condition);
  const clinicalStatus =
    condition.clinicalStatus?.coding?.[0]?.code || 'active';
  const verificationStatus =
    condition.verificationStatus?.coding?.[0]?.code || 'unconfirmed';
  const severity = condition.severity?.coding?.[0]?.code || null;
  const bodySite = condition.bodySite?.[0]?.text || null;
  const abatementDate = condition.abatementDateTime || null;

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('conditions', 'readwrite');
    const store = tx.objectStore('conditions');

    const getReq = store.get(condition.id!);
    getReq.onsuccess = () => {
      const existing = getReq.result as StoredConditionRow | undefined;
      const conditionRow: StoredConditionRow = {
        id: condition.id!,
        clinical_status: clinicalStatus,
        verification_status: verificationStatus,
        onset_date: onsetDate,
        title,
        severity,
        body_site: bodySite,
        abatement_date: abatementDate,
        description: notesText,
        fhir_json: JSON.stringify(condition),
        created_at: existing?.created_at || now,
        updated_at: now,
      };
      store.put(conditionRow);
    };

    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Fetches all Condition records from IndexedDB.
 */
export async function fetchAllConditionsWeb(): Promise<Condition[]> {
  const db = await getWebDatabase();

  return new Promise<Condition[]>((resolve, reject) => {
    const tx = db.transaction('conditions', 'readonly');
    const store = tx.objectStore('conditions');
    const req = store.getAll();

    tx.oncomplete = () => {
      const rows = (req.result as StoredConditionRow[]) || [];
      rows.sort((a, b) => {
        const dateCmp = b.onset_date.localeCompare(a.onset_date);
        if (dateCmp !== 0) return dateCmp;
        const createdCmp = b.created_at.localeCompare(a.created_at);
        if (createdCmp !== 0) return createdCmp;
        return b.id.localeCompare(a.id);
      });
      resolve(rows.map((r) => JSON.parse(r.fhir_json)));
    };

    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Fetches a Condition record by its ID from IndexedDB.
 */
export async function fetchConditionByIdWeb(
  id: string
): Promise<Condition | null> {
  if (!id) return null;

  const db = await getWebDatabase();

  return new Promise<Condition | null>((resolve, reject) => {
    const tx = db.transaction('conditions', 'readonly');
    const store = tx.objectStore('conditions');
    const req = store.get(id);

    req.onsuccess = () => {
      const row = req.result as StoredConditionRow | undefined;
      if (!row) {
        resolve(null);
        return;
      }
      resolve(JSON.parse(row.fhir_json));
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Deletes a Condition record by its ID from IndexedDB.
 */
export async function deleteConditionWeb(id: string): Promise<void> {
  if (!id) return;

  const db = await getWebDatabase();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('conditions', 'readwrite');
    const store = tx.objectStore('conditions');
    store.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
