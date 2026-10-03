import { test, expect } from '@playwright/test';

test.describe('Home View Flow, Floating Plus Button, and Lab Result Deletion', () => {
  test.beforeEach(async ({ page }) => {
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
    await page.reload();
  });

  test('should display "Nothing to show yet" on empty home and render floating plus button', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByText('Nothing to show yet')).toBeVisible();

    const floatingBtn = page.getByTestId('floating-add-button');
    await expect(floatingBtn).toBeVisible();

    // Tap floating button -> menu opens
    await floatingBtn.click();
    const menu = page.getByTestId('floating-add-menu');
    await expect(menu).toBeVisible();
    await expect(page.getByTestId('menu-add-condition')).toBeVisible();
    await expect(page.getByTestId('menu-add-lab-results')).toBeVisible();

    // Tap floating button again -> menu closes
    await floatingBtn.click();
    await expect(menu).not.toBeVisible();
  });

  test('should enforce 5-second countdown on Lab Result delete button and cancel safely', async ({
    page,
  }) => {
    // 1. Seed a lab result report in IndexedDB
    await page.goto('/');
    await page.evaluate(async () => {
      const now = '2026-10-02T10:00:00.000Z';
      const report = {
        resourceType: 'DiagnosticReport',
        id: 'rep-test-del-1',
        status: 'final',
        code: {
          coding: [{ system: 'http://loinc.org', code: '58410-2' }],
          text: 'CBC',
        },
        effectiveDateTime: '2026-10-02',
      };
      const obs = [
        {
          resourceType: 'Observation',
          id: 'obs-test-del-1',
          status: 'final',
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '718-7',
                display: 'Hemoglobin',
              },
            ],
          },
          valueQuantity: { value: 14.2, unit: 'g/dL', code: 'g/dL' },
        },
      ];

      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('healthy_db', 3);
        req.onupgradeneeded = () => {
          const d = req.result;
          if (!d.objectStoreNames.contains('diagnostic_reports')) {
            const s = d.createObjectStore('diagnostic_reports', {
              keyPath: 'id',
            });
            s.createIndex('effective_date', 'effective_date', {
              unique: false,
            });
          }
          if (!d.objectStoreNames.contains('observations')) {
            const s = d.createObjectStore('observations', { keyPath: 'id' });
            s.createIndex('report_id', 'report_id', { unique: false });
          }
          if (d.objectStoreNames.contains('episodes_of_care')) {
            d.deleteObjectStore('episodes_of_care');
          }
          if (!d.objectStoreNames.contains('conditions')) {
            const s = d.createObjectStore('conditions', {
              keyPath: 'id',
            });
            s.createIndex('onset_date', 'onset_date', { unique: false });
            s.createIndex('clinical_status', 'clinical_status', {
              unique: false,
            });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const tx = db.transaction(
        ['diagnostic_reports', 'observations'],
        'readwrite'
      );
      tx.objectStore('diagnostic_reports').put({
        id: 'rep-test-del-1',
        effective_date: '2026-10-02',
        status: 'final',
        notes: null,
        fhir_json: JSON.stringify(report),
        created_at: now,
        updated_at: now,
      });
      tx.objectStore('observations').put({
        id: 'obs-test-del-1',
        report_id: 'rep-test-del-1',
        loinc_code: '718-7',
        name: 'Hemoglobin',
        value: 14.2,
        unit: 'g/dL',
        fhir_json: JSON.stringify(obs[0]),
        created_at: now,
      });

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      });
    });

    await page.reload();

    // Verify report card is visible
    const reportCard = page.getByTestId('report-card-rep-test-del-1');
    await expect(reportCard).toBeVisible();

    // Verify Delete button is on the right of Edit button
    const deleteBtn = page.getByTestId('delete-report-button-rep-test-del-1');
    const editBtn = page.getByTestId('edit-report-button-rep-test-del-1');
    await expect(editBtn).toBeVisible();
    await expect(deleteBtn).toBeVisible();

    // 2. Open delete modal
    await deleteBtn.click();
    const modal = page.getByTestId('delete-confirmation-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByText('Delete Lab Result')).toBeVisible();

    // 3. Confirm Delete button is initially disabled with countdown
    const confirmBtn = page.getByTestId('delete-modal-confirm-button');
    await expect(confirmBtn).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmBtn).toContainText('Delete (');

    // Test Cancel button dismisses modal without deleting
    const cancelBtn = page.getByTestId('delete-modal-cancel-button');
    await cancelBtn.click();
    await expect(modal).not.toBeVisible();
    await expect(reportCard).toBeVisible();

    // 4. Reopen modal and wait for 5-second countdown to finish
    await deleteBtn.click();
    await expect(confirmBtn).toHaveAttribute('aria-disabled', 'true');

    // Wait until countdown reaches 0 and button becomes enabled with text "Delete"
    await expect(confirmBtn).toHaveText('Delete', { timeout: 7000 });
    await expect(confirmBtn).not.toHaveAttribute('aria-disabled', 'true');

    // Click enabled Delete button
    await confirmBtn.click();

    // 5. Modal closes and report is deleted, returning to empty state
    await expect(modal).not.toBeVisible();
    await expect(reportCard).not.toBeVisible();
    await expect(page.getByText('Nothing to show yet')).toBeVisible();
  });

  test('should persist and retrieve records in IndexedDB across reloads, allowing inspection of healthy_db', async ({
    page,
  }) => {
    // 1. Visit home
    await page.goto('/');

    // 2. Put a report into IndexedDB directly
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('healthy_db', 3);
        req.onupgradeneeded = () => {
          const d = req.result;
          if (!d.objectStoreNames.contains('diagnostic_reports')) {
            const s = d.createObjectStore('diagnostic_reports', {
              keyPath: 'id',
            });
            s.createIndex('effective_date', 'effective_date', {
              unique: false,
            });
          }
          if (!d.objectStoreNames.contains('observations')) {
            const s = d.createObjectStore('observations', { keyPath: 'id' });
            s.createIndex('report_id', 'report_id', { unique: false });
          }
          if (d.objectStoreNames.contains('episodes_of_care')) {
            d.deleteObjectStore('episodes_of_care');
          }
          if (!d.objectStoreNames.contains('conditions')) {
            const s = d.createObjectStore('conditions', {
              keyPath: 'id',
            });
            s.createIndex('onset_date', 'onset_date', { unique: false });
            s.createIndex('clinical_status', 'clinical_status', {
              unique: false,
            });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const tx = db.transaction(
        ['diagnostic_reports', 'observations'],
        'readwrite'
      );
      tx.objectStore('diagnostic_reports').put({
        id: 'rep-idb-inspect-1',
        effective_date: '2026-10-02',
        status: 'final',
        notes: 'IndexedDB inspection test',
        fhir_json: JSON.stringify({
          resourceType: 'DiagnosticReport',
          id: 'rep-idb-inspect-1',
          status: 'final',
          code: {
            coding: [{ system: 'http://loinc.org', code: '58410-2' }],
            text: 'CBC',
          },
          effectiveDateTime: '2026-10-02',
          note: [{ text: 'IndexedDB inspection test' }],
        }),
        created_at: '2026-10-02T10:00:00.000Z',
        updated_at: '2026-10-02T10:00:00.000Z',
      });

      tx.objectStore('observations').put({
        id: 'obs-idb-inspect-1',
        report_id: 'rep-idb-inspect-1',
        loinc_code: '718-7',
        name: 'Hemoglobin',
        value: 15.5,
        unit: 'g/dL',
        fhir_json: JSON.stringify({
          resourceType: 'Observation',
          id: 'obs-idb-inspect-1',
          status: 'final',
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '718-7',
                display: 'Hemoglobin',
              },
            ],
            text: 'Hemoglobin',
          },
          valueQuantity: { value: 15.5, unit: 'g/dL', code: 'g/dL' },
        }),
        created_at: '2026-10-02T10:00:00.000Z',
      });

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      });
    });

    // 3. Reload page and verify data is read from IndexedDB
    await page.reload();
    await expect(
      page.getByTestId('report-card-rep-idb-inspect-1')
    ).toBeVisible();
    await expect(page.getByText('Hemoglobin')).toBeVisible();
    await expect(page.getByText('15.5')).toBeVisible();

    // 4. Verify directly in IndexedDB that object stores exist and contain the stored rows
    const inspected = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('healthy_db', 3);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const tx = db.transaction(
        ['diagnostic_reports', 'observations'],
        'readonly'
      );
      const repReq = tx
        .objectStore('diagnostic_reports')
        .get('rep-idb-inspect-1');
      const obsReq = tx.objectStore('observations').get('obs-idb-inspect-1');

      return new Promise<any>((resolve, reject) => {
        tx.oncomplete = () => {
          db.close();
          resolve({
            report: repReq.result,
            observation: obsReq.result,
          });
        };
        tx.onerror = () => reject(tx.error);
      });
    });

    expect(inspected.report).toBeDefined();
    expect(inspected.report.id).toBe('rep-idb-inspect-1');
    expect(inspected.report.status).toBe('final');
    expect(inspected.observation).toBeDefined();
    expect(inspected.observation.value).toBe(15.5);
    expect(inspected.observation.unit).toBe('g/dL');
  });
});
