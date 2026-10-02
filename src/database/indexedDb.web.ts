import {
  FHIRDiagnosticReport,
  FHIRObservation,
  FHIREpisodeOfCare,
} from '../types/fhir';
import {
  DiagnosticReportRecord,
  StoredDiagnosticReportRow,
  StoredObservationRow,
  StoredEpisodeOfCareRow,
} from './types';

export const INDEXED_DB_NAME = 'healthy_db';
export const INDEXED_DB_VERSION = 2;

const LEGACY_STORAGE_REPORTS_KEY = '@healthy_diagnostic_reports_v1';
const LEGACY_STORAGE_OBSERVATIONS_KEY = '@healthy_observations_v1';
const LEGACY_STORAGE_EPISODES_KEY = '@healthy_episodes_of_care_v1';

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

/**
 * Initializes and upgrades the IndexedDB database.
 */
export async function getWebDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = new Promise<IDBDatabase>((resolve, reject) => {
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

      // Version 2 stores: episodes_of_care
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('episodes_of_care')) {
          const episodeStore = db.createObjectStore('episodes_of_care', {
            keyPath: 'id',
          });
          episodeStore.createIndex('start_date', 'start_date', {
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

  return dbInitPromise;
}

/**
 * Migrates data from legacy localStorage keys to IndexedDB if present.
 */
async function migrateLegacyLocalStorage(db: IDBDatabase): Promise<void> {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const rawReports = window.localStorage.getItem(LEGACY_STORAGE_REPORTS_KEY);
  const rawObs = window.localStorage.getItem(LEGACY_STORAGE_OBSERVATIONS_KEY);
  const rawEpisodes = window.localStorage.getItem(LEGACY_STORAGE_EPISODES_KEY);

  if (!rawReports && !rawObs && !rawEpisodes) return;

  const parsedReports: Record<string, StoredDiagnosticReportRow> = rawReports
    ? JSON.parse(rawReports)
    : {};
  const parsedObs: Record<string, StoredObservationRow[]> = rawObs
    ? JSON.parse(rawObs)
    : {};
  const parsedEpisodes: Record<string, StoredEpisodeOfCareRow> = rawEpisodes
    ? JSON.parse(rawEpisodes)
    : {};

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      ['diagnostic_reports', 'observations', 'episodes_of_care'],
      'readwrite'
    );

    const reportStore = tx.objectStore('diagnostic_reports');
    const obsStore = tx.objectStore('observations');
    const episodeStore = tx.objectStore('episodes_of_care');

    for (const report of Object.values(parsedReports)) {
      reportStore.put(report);
    }

    for (const obsList of Object.values(parsedObs)) {
      for (const obs of obsList) {
        obsStore.put(obs);
      }
    }

    for (const episode of Object.values(parsedEpisodes)) {
      episodeStore.put(episode);
    }

    tx.oncomplete = () => {
      window.localStorage.removeItem(LEGACY_STORAGE_REPORTS_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_OBSERVATIONS_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_EPISODES_KEY);
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
  report: FHIRDiagnosticReport,
  observations: FHIRObservation[]
): Promise<void> {
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

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      ['diagnostic_reports', 'observations'],
      'readwrite'
    );
    const reportStore = tx.objectStore('diagnostic_reports');
    const obsStore = tx.objectStore('observations');

    const getReq = reportStore.get(report.id);
    getReq.onsuccess = () => {
      const existing = getReq.result as StoredDiagnosticReportRow | undefined;
      const reportRow: StoredDiagnosticReportRow = {
        id: report.id,
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
      const req = obsIndex.openKeyCursor(IDBKeyRange.only(report.id));

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
 * Fetches all Diagnostic Reports and nested Observations from IndexedDB.
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

    const reportReq = reportStore.getAll();
    const obsReq = obsStore.getAll();

    tx.oncomplete = () => {
      const reportRows =
        (reportReq.result as StoredDiagnosticReportRow[]) || [];
      const obsRows = (obsReq.result as StoredObservationRow[]) || [];

      // Group observations by report_id
      const obsByReport: Record<string, FHIRObservation[]> = {};
      for (const o of obsRows) {
        if (!obsByReport[o.report_id]) {
          obsByReport[o.report_id] = [];
        }
        obsByReport[o.report_id].push(JSON.parse(o.fhir_json));
      }

      // Sort reports by effective_date DESC, created_at DESC
      reportRows.sort((a, b) => {
        const dateCmp = b.effective_date.localeCompare(a.effective_date);
        if (dateCmp !== 0) return dateCmp;
        return b.created_at.localeCompare(a.created_at);
      });

      const records: DiagnosticReportRecord[] = reportRows.map((r) => {
        const parsedReport: FHIRDiagnosticReport = JSON.parse(r.fhir_json);
        const observations = obsByReport[r.id] || [];
        return { report: parsedReport, observations };
      });

      resolve(records);
    };

    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Deletes a DiagnosticReport and all associated Observations from IndexedDB.
 */
export async function deleteDiagnosticReportWeb(
  reportId: string
): Promise<void> {
  const db = await getWebDatabase();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      ['diagnostic_reports', 'observations'],
      'readwrite'
    );
    const reportStore = tx.objectStore('diagnostic_reports');
    const obsStore = tx.objectStore('observations');

    reportStore.delete(reportId);

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
 * Persists an EpisodeOfCare record in IndexedDB.
 */
export async function insertEpisodeOfCareWeb(
  episode: FHIREpisodeOfCare
): Promise<void> {
  const db = await getWebDatabase();
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

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('episodes_of_care', 'readwrite');
    const store = tx.objectStore('episodes_of_care');

    const getReq = store.get(episode.id);
    getReq.onsuccess = () => {
      const existing = getReq.result as StoredEpisodeOfCareRow | undefined;
      const episodeRow: StoredEpisodeOfCareRow = {
        id: episode.id,
        status: episode.status,
        start_date: startDate,
        title,
        description: descriptionText,
        fhir_json: JSON.stringify(episode),
        created_at: existing?.created_at || now,
        updated_at: now,
      };
      store.put(episodeRow);
    };

    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Fetches all EpisodeOfCare records from IndexedDB.
 */
export async function fetchAllEpisodesOfCareWeb(): Promise<
  FHIREpisodeOfCare[]
> {
  const db = await getWebDatabase();

  return new Promise<FHIREpisodeOfCare[]>((resolve, reject) => {
    const tx = db.transaction('episodes_of_care', 'readonly');
    const store = tx.objectStore('episodes_of_care');
    const req = store.getAll();

    tx.oncomplete = () => {
      const rows = (req.result as StoredEpisodeOfCareRow[]) || [];
      rows.sort((a, b) => {
        const dateCmp = b.start_date.localeCompare(a.start_date);
        if (dateCmp !== 0) return dateCmp;
        return b.created_at.localeCompare(a.created_at);
      });
      resolve(rows.map((r) => JSON.parse(r.fhir_json)));
    };

    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Fetches an EpisodeOfCare record by its ID from IndexedDB.
 */
export async function fetchEpisodeOfCareByIdWeb(
  id: string
): Promise<FHIREpisodeOfCare | null> {
  const db = await getWebDatabase();

  return new Promise<FHIREpisodeOfCare | null>((resolve, reject) => {
    const tx = db.transaction('episodes_of_care', 'readonly');
    const store = tx.objectStore('episodes_of_care');
    const req = store.get(id);

    req.onsuccess = () => {
      const row = req.result as StoredEpisodeOfCareRow | undefined;
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
 * Deletes an EpisodeOfCare record by its ID from IndexedDB.
 */
export async function deleteEpisodeOfCareWeb(id: string): Promise<void> {
  const db = await getWebDatabase();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('episodes_of_care', 'readwrite');
    const store = tx.objectStore('episodes_of_care');
    store.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
