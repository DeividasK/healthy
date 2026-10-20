import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { evaluateBridge, seedTestPatient, seedTestResources } from './testSeed';

/** Every table that holds a synced, backed-up clinical record. */
export const CLINICAL_TABLES = [
  'patients',
  'conditions',
  'diagnostic_reports',
  'observations',
  'consultations',
  'consultation_conditions',
  'clinical_documents',
  'medication_requests',
  'service_requests',
  'medication_administrations',
  'medication_statements',
  'organizations',
];

/** Text that only appears inside the seeded record, never on Drive. */
export const RECORD_SECRETS = [
  'Private asthma diagnosis',
  'Confidential narrative',
  'Private Clinic',
  'Alice',
  'Request to back up',
  'Treatment to back up',
];

/**
 * Every row of every clinical table, without storage timestamps: the whole
 * record as a backup, restore or another device must reproduce it,
 * including relational projections such as consultation_conditions.
 */
export const snapshotClinicalTables = (page: Page) =>
  evaluateBridge(
    page,
    async (b, tables: string[]) => {
      const result: Record<string, Record<string, unknown>[]> = {};
      for (const table of tables) {
        const rows: Record<string, unknown>[] = await b.querySql(
          `SELECT * FROM ${table}`
        );
        result[table] = rows
          .map((row) =>
            Object.fromEntries(
              Object.entries(row).filter(([key]) => !key.endsWith('_at'))
            )
          )
          .sort((x, y) => (JSON.stringify(x) < JSON.stringify(y) ? -1 : 1));
      }
      return result;
    },
    CLINICAL_TABLES
  );

/** Exports a ZIP backup through the app and returns its bytes. */
export async function exportTestArchive(page: Page): Promise<number[]> {
  const download = page.waitForEvent('download');
  await evaluateBridge(page, (b) => b.exportArchive());
  return Array.from(await readFile((await (await download).path())!));
}

/**
 * Seeds one patient with every resource type, linked to each other and
 * carrying FHIR data the forms never expose: extensions, extra codings,
 * structured regimens, legacy encounter shapes, cleared journal answers.
 */
export async function seedEveryResource(
  page: Page,
  patientId = 'shared-patient'
): Promise<void> {
  await seedTestPatient(page, { id: patientId, givenName: 'Alice' });
  await seedTestResources(page, {
    conditions: [
      {
        id: 'asthma',
        title: 'Private asthma diagnosis',
        terminology: { code: 'L21' },
      },
      { id: 'eczema', title: 'Eczema' },
    ],
    consultations: [
      {
        id: 'visit',
        title: 'Respiratory review',
        conditionIds: ['asthma', 'eczema'],
        reasonConditionIds: ['eczema'],
        notes: 'Confidential narrative',
        serviceProviderName: 'Private Clinic',
      },
    ],
    treatments: [
      {
        id: 'inhaler',
        title: 'Treatment to back up',
        consultationId: 'visit',
        reasonConditionIds: ['asthma'],
        dosageInstructions: 'First line\nSecond line',
        reason: 'Original indication',
        notes: 'Original annotation',
      },
    ],
    serviceRequests: [
      {
        id: 'referral',
        title: 'Request to back up',
        category: '3457005',
        consultationId: 'visit',
        reasonConditionIds: ['asthma'],
        instructions: 'First line\nSecond line',
        plannedDate: '2099-05-01',
      },
    ],
    treatmentUsage: [
      { treatmentId: 'inhaler', action: 'start', date: '2026-10-01' },
      {
        treatmentId: 'inhaler',
        action: 'pause',
        date: '2026-10-04',
        notes: 'Waiting for refill',
      },
      { treatmentId: 'inhaler', action: 'resume', date: '2026-10-06' },
    ],
    // One answer is kept; the other is cleared again before any backup.
    treatmentLogs: [
      { treatmentId: 'inhaler', date: '2026-10-07', answer: 'taken' },
      { treatmentId: 'inhaler', date: '2026-10-08', answer: 'taken' },
      { treatmentId: 'inhaler', date: '2026-10-08', answer: null },
    ],
    reports: [
      {
        id: 'cbc',
        serviceProviderName: 'Private Clinic',
        serviceRequestIds: ['referral'],
        biomarkers: [{ name: 'Hemoglobin', value: 150, unit: 'g/L' }],
      },
    ],
  });
  await seedTestResources(page, {
    consultations: [
      {
        id: 'resulting-visit',
        title: 'Resulting visit',
        basedOnServiceRequestIds: ['referral'],
      },
    ],
  });
  // Data no form exposes, written as another source would.
  await evaluateBridge(
    page,
    async (b, patientId: string) => {
      const condition = await b.getCondition('asthma');
      condition.code.coding = [
        {
          code: 'L21',
          version: 'synthetic-edition',
          extension: [
            {
              url: 'https://example.org/retained',
              valueString: 'nested field',
            },
          ],
        },
        { system: 'https://example.org/second', code: 'SECOND' },
      ];
      await b.saveCondition(condition, patientId);

      const encounter = await b.getConsultation('visit');
      encounter.diagnosis[0].condition[0].concept = {
        text: 'Independent outcome',
        coding: [{ code: 'L21' }],
      };
      await b.saveEncounter(encounter, patientId);
      // A pre-v8 encounter: one diagnosis entry, reasons as values.
      await b.saveEncounter(
        {
          ...encounter,
          id: 'legacy-single',
          diagnosis: [encounter.diagnosis[0]],
          reason: [
            { value: [{ reference: { reference: 'Condition/asthma' } }] },
          ],
        },
        patientId
      );

      const request = await b.getServiceRequest('referral');
      request.requisition = { system: 'https://example.org/req', value: 'R-1' };
      request.priority = 'urgent';
      await b.saveServiceRequest(request, patientId);

      const treatment = await b.getTreatment('inhaler');
      treatment.dosageInstruction[0].route = { text: 'Oral' };
      treatment.dosageInstruction.push({
        sequence: 2,
        doseAndRate: [
          {
            doseRange: {
              low: { value: 1, unit: 'tablet', code: '{tablet}' },
              high: { value: 2, unit: 'tablet', code: '{tablet}' },
            },
          },
        ],
        timing: {
          repeat: {
            frequency: 1,
            frequencyMax: 2,
            period: 1,
            periodUnit: 'd',
            when: ['EVE'],
            boundsDuration: { value: 4, unit: 'weeks', code: 'wk' },
          },
        },
      });
      treatment.dispenseRequest = {
        quantity: { value: 56, unit: 'tablet', code: '{tablet}' },
      };
      treatment.medication.concept.coding = [
        { system: 'https://example.org/medication', code: 'synthetic-code' },
      ];
      await b.saveTreatment(treatment, patientId);
    },
    patientId
  );
}
