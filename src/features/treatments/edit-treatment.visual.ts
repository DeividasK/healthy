import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestCondition,
  seedTestTreatment,
  openRoute,
} from '@/src/features/testing/visualTest';

test.describe('Edit Treatment - Visual Regression', () => {
  test('Populated form', async ({ page }, testInfo) => {
    await seedTestPatient(page);
    const condition = await seedTestCondition(page, {
      title: 'Acute bacterial sinusitis',
    });
    const treatment = await seedTestTreatment(page, {
      title: 'Amoxicillin 500mg Capsule',
      intent: 'order',
      status: 'active',
      dosageInstructions:
        'Take 1 capsule by mouth every 8 hours with meals for 10 days.\nFinish all medication even if feeling better.',
      reason: 'Sinus infection',
      reasonConditionIds: [condition.id],
      notes: 'No penicillin allergies reported.',
    });

    await openRoute(page, `/treatment/${treatment.id}/edit`);
    await page.getByTestId('treatment-form-title').waitFor();
    await takeSnapshot(page, 'Treatment - Edit Form Populated', testInfo);
  });

  test('Loaded regimen', async ({ page }, testInfo) => {
    await seedTestPatient(page);
    const treatment = await seedTestTreatment(page, {
      title: 'Prednisolone 5mg',
      intent: 'order',
      status: 'active',
      regimen: {
        phases: [
          {
            doses: [
              {
                amount: '2',
                amountMax: '',
                unit: '{tablet}',
                route: '26643006',
                site: '',
                patientInstruction: 'Take with breakfast',
                timing: {
                  frequency: '1',
                  frequencyMax: '',
                  period: '1',
                  periodUnit: 'd',
                  when: 'MORN',
                  boundsValue: '7',
                  boundsUnit: 'd',
                },
              },
              {
                amount: '1',
                amountMax: '',
                unit: '{tablet}',
                route: '26643006',
                site: '',
                patientInstruction: '',
                timing: {
                  frequency: '1',
                  frequencyMax: '',
                  period: '1',
                  periodUnit: 'd',
                  when: 'EVE',
                  boundsValue: '7',
                  boundsUnit: 'd',
                },
              },
            ],
          },
          {
            doses: [
              {
                amount: '1',
                amountMax: '2',
                unit: '{tablet}',
                route: '26643006',
                site: '',
                patientInstruction: '',
                timing: {
                  frequency: '1',
                  frequencyMax: '2',
                  period: '1',
                  periodUnit: 'd',
                  when: '',
                  boundsValue: '3',
                  boundsUnit: 'mo',
                },
              },
            ],
          },
        ],
      },
      dispenseQuantity: { value: '56', unit: '{tablet}' },
    });

    await openRoute(page, `/treatment/${treatment.id}/edit`);
    await page.getByTestId('treatment-regimen-field').waitFor();
    await takeSnapshot(page, 'Treatment - Edit Form Regimen', testInfo);
  });
});
