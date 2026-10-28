import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestBundle,
  seedTestResources,
} from '@/src/features/testing/visualTest';
import type { RegimenDraft } from '@/src/features/treatments/regimen';

// The visual fixture fixes today at 2026-10-08.

const dose = (
  amount: string,
  when: string,
  { amountMax = '', frequencyMax = '', boundsValue = '', boundsUnit = 'd' } = {}
): RegimenDraft['phases'][number]['doses'][number] => ({
  amount,
  amountMax,
  unit: '{tablet}',
  route: '26643006',
  site: '',
  patientInstruction: when === 'MORN' ? 'Take with breakfast' : '',
  timing: {
    frequency: '1',
    frequencyMax,
    period: '1',
    periodUnit: 'd',
    when,
    boundsValue,
    boundsUnit,
  },
});

/** Taken from 2026-10-08 in place of the free-text prescription. */
const taperingRegimen: RegimenDraft = {
  phases: [
    {
      doses: [
        dose('2', 'MORN', { boundsValue: '7' }),
        dose('1', 'EVE', { boundsValue: '7' }),
      ],
    },
    {
      doses: [
        dose('1', '', {
          amountMax: '2',
          frequencyMax: '2',
          boundsValue: '3',
          boundsUnit: 'mo',
        }),
      ],
    },
  ],
};

const longInstructions = [
  '1. Take 2 tablets in the morning and 1 tablet in the evening with food for the first week.',
  '2. Stay hydrated by drinking at least 2 liters of water daily.',
  '3. In case of rash, discontinue immediately and contact the clinic.',
  '4. Do not stop suddenly; taper as described below.',
].join('\n\n');

// Chromatic keys baselines by test title, so this keeps its original title.
test.describe('View Treatment - Visual Regression', () => {
  test('Long instructions, reason condition and consultation link', async ({
    page,
  }, testInfo) => {
    await seedTestPatient(page);
    await seedTestResources(page, {
      conditions: [
        { id: 'visual-sinusitis', title: 'Acute bacterial sinusitis' },
      ],
      consultations: [
        {
          id: 'visual-clinic',
          title: 'ENT Clinic',
          doctorName: 'Dr. Beverly Crusher',
          serviceType: 'Otolaryngology',
          date: '2025-07-25',
        },
      ],
      treatments: [
        {
          id: 'visual-prednisolone',
          title: 'Prednisolone 5mg',
          intent: 'order',
          status: 'active',
          authoredOn: '2025-07-25',
          consultationId: 'visual-clinic',
          // A treatment has free-text instructions or a regimen, never both:
          // the regimen shows as the current one, from the change below.
          dosageInstructions: longInstructions,
          dispenseQuantity: { value: '56', unit: '{tablet}' },
          reason: 'Sinus inflammation',
          reasonConditionIds: ['visual-sinusitis'],
          notes: 'Monitored for sleep problems.',
        },
      ],
      treatmentUsage: [
        {
          treatmentId: 'visual-prednisolone',
          action: 'start',
          date: '2025-07-25',
        },
        {
          treatmentId: 'visual-prednisolone',
          action: 'stop',
          date: '2026-09-01',
        },
        {
          treatmentId: 'visual-prednisolone',
          action: 'start',
          date: '2026-10-01',
        },
        {
          treatmentId: 'visual-prednisolone',
          action: 'pause',
          date: '2026-10-04',
          notes: 'Waiting for a refill',
        },
        {
          treatmentId: 'visual-prednisolone',
          action: 'resume',
          date: '2026-10-07',
        },
        {
          treatmentId: 'visual-prednisolone',
          action: 'change',
          date: '2026-10-08',
          regimen: taperingRegimen,
        },
      ],
      treatmentLogs: [
        {
          treatmentId: 'visual-prednisolone',
          date: '2026-10-03',
          answer: 'taken',
        },
        {
          treatmentId: 'visual-prednisolone',
          date: '2026-10-07',
          answer: 'not-taken',
        },
      ],
    });
    await seedTestBundle(page, {
      id: 'visual-morning',
      title: 'Morning stack',
      times: ['MORN'],
      memberIds: ['visual-prednisolone'],
    });

    await page.goto('/treatment/visual-prednisolone');
    await page.getByTestId('treatment-current-regimen').waitFor();
    await page.getByTestId('treatment-bundle-visual-morning').waitFor();
    await page.getByTestId('origin-consultation-link').waitFor();
    await page.getByTestId('treatment-log-history').waitFor();
    await page.getByTestId('treatment-usage-list-toggle').click();
    await page
      .getByRole('button', { name: 'Show less', exact: true })
      .waitFor();
    await takeSnapshot(page, 'Treatment View - Details', testInfo);
  });
});
