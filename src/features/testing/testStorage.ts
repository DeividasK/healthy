import type { Page } from '@playwright/test';

/**
 * Resets all browser storage (localStorage, sessionStorage, and IndexedDB) for clean test runs.
 */
export async function clearAppStorage(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('healthy_db');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
}

/**
 * Seeds DiagnosticReport and Observation records directly into IndexedDB.
 */
export async function seedReports(page: Page, reports: any[]): Promise<void> {
  await clearAppStorage(page);
  await page.evaluate(async (reportsList: any[]) => {
    await new Promise<void>((resolve, reject) => {
      const openReq = indexedDB.open('healthy_db', 2);
      openReq.onupgradeneeded = () => {
        const db = openReq.result;
        if (!db.objectStoreNames.contains('diagnostic_reports')) {
          const s = db.createObjectStore('diagnostic_reports', {
            keyPath: 'id',
          });
          s.createIndex('effective_date', 'effective_date', { unique: false });
        }
        if (!db.objectStoreNames.contains('observations')) {
          const s = db.createObjectStore('observations', { keyPath: 'id' });
          s.createIndex('report_id', 'report_id', { unique: false });
        }
        if (!db.objectStoreNames.contains('episodes_of_care')) {
          const s = db.createObjectStore('episodes_of_care', {
            keyPath: 'id',
          });
          s.createIndex('start_date', 'start_date', { unique: false });
        }
      };

      openReq.onsuccess = () => {
        const db = openReq.result;
        const tx = db.transaction(
          ['diagnostic_reports', 'observations'],
          'readwrite'
        );
        const reportStore = tx.objectStore('diagnostic_reports');
        const obsStore = tx.objectStore('observations');

        for (const r of reportsList) {
          reportStore.put({
            id: r.id,
            case_id: r.caseId || null,
            effective_date: r.effectiveDate,
            status: 'final',
            notes: r.notes || null,
            fhir_json: JSON.stringify({
              resourceType: 'DiagnosticReport',
              id: r.id,
              status: 'final',
              code: {
                coding: [
                  {
                    system: 'http://loinc.org',
                    code: '58410-2',
                    display: 'Complete blood count (CBC) panel',
                  },
                ],
                text: 'Complete Blood Count',
              },
              effectiveDateTime: r.effectiveDateTime || r.effectiveDate,
              result: r.observations.map((obs: any, idx: number) => ({
                reference: `Observation/obs-${r.id}-${idx}`,
                type: 'Observation',
                display: obs.name,
              })),
              note: r.notes ? [{ text: r.notes }] : undefined,
            }),
            created_at: '2026-10-02T10:00:00.000Z',
            updated_at: '2026-10-02T10:00:00.000Z',
          });

          for (const [idx, obs] of r.observations.entries()) {
            const obsId = `obs-${r.id}-${idx}`;
            const fhirObs = {
              resourceType: 'Observation',
              id: obsId,
              status: 'final',
              code: {
                coding: [
                  {
                    system: 'http://loinc.org',
                    code: obs.loinc,
                    display: obs.name,
                  },
                ],
                text: obs.name,
              },
              valueQuantity: {
                value: obs.value,
                unit: obs.unit,
                system: 'http://unitsofmeasure.org',
                code: obs.unit,
              },
              interpretation: obs.interpretationCode
                ? [
                    {
                      coding: [
                        {
                          system:
                            'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                          code: obs.interpretationCode,
                          display:
                            obs.interpretationCode === 'N'
                              ? 'Normal'
                              : obs.interpretationCode === 'L'
                                ? 'Low'
                                : 'High',
                        },
                      ],
                    },
                  ]
                : undefined,
            };

            obsStore.put({
              id: obsId,
              report_id: r.id,
              loinc_code: obs.loinc,
              name: obs.name,
              value: obs.value,
              unit: obs.unit,
              fhir_json: JSON.stringify(fhirObs),
              created_at: '2026-10-02T10:00:00.000Z',
            });
          }
        }

        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      openReq.onerror = () => reject(openReq.error);
    });
  }, reports);
}

/**
 * Seeds an EpisodeOfCare (Health Case) record directly into IndexedDB.
 */
export async function seedHealthCase(
  page: Page,
  c: {
    id: string;
    title: string;
    status: string;
    startDate: string;
    description?: string;
  }
): Promise<void> {
  await clearAppStorage(page);
  await page.evaluate(async (caseItem) => {
    await new Promise<void>((resolve, reject) => {
      const openReq = indexedDB.open('healthy_db', 2);
      openReq.onupgradeneeded = () => {
        const db = openReq.result;
        if (!db.objectStoreNames.contains('diagnostic_reports')) {
          const s = db.createObjectStore('diagnostic_reports', {
            keyPath: 'id',
          });
          s.createIndex('effective_date', 'effective_date', { unique: false });
        }
        if (!db.objectStoreNames.contains('observations')) {
          const s = db.createObjectStore('observations', { keyPath: 'id' });
          s.createIndex('report_id', 'report_id', { unique: false });
        }
        if (!db.objectStoreNames.contains('episodes_of_care')) {
          const s = db.createObjectStore('episodes_of_care', {
            keyPath: 'id',
          });
          s.createIndex('start_date', 'start_date', { unique: false });
        }
      };

      openReq.onsuccess = () => {
        const db = openReq.result;
        const tx = db.transaction('episodes_of_care', 'readwrite');
        const store = tx.objectStore('episodes_of_care');

        const episode = {
          resourceType: 'EpisodeOfCare',
          id: caseItem.id,
          status: caseItem.status,
          period: { start: caseItem.startDate },
          type: [{ text: caseItem.title }],
          diagnosis: [{ condition: { display: caseItem.title } }],
          description: caseItem.title,
          note: caseItem.description
            ? [{ text: caseItem.description, time: '2026-10-02T10:00:00.000Z' }]
            : undefined,
        };

        store.put({
          id: caseItem.id,
          status: caseItem.status,
          start_date: caseItem.startDate,
          title: caseItem.title,
          description: caseItem.description || null,
          fhir_json: JSON.stringify(episode),
          created_at: '2026-10-02T10:00:00.000Z',
          updated_at: '2026-10-02T10:00:00.000Z',
        });

        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      openReq.onerror = () => reject(openReq.error);
    });
  }, c);
}
