import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestCondition,
  seedTestTreatment,
  seedTestBundle,
} from '@/src/features/testing/visualTest';

test.describe('Edit Treatment - Visual Regression', () => {
  test('Populated form', async ({ page }, testInfo) => {
    await seedTestPatient(page);
    const condition = await seedTestCondition(page, {
      title: 'Acute bacterial sinusitis',
    });
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
      reason: 'Sinus infection',
      reasonConditionIds: [condition.id],
      notes: 'No penicillin allergies reported.',
    });
    // Phase 1 has two doses, so two bundles fill the field and hide its search.
    await seedTestBundle(page, {
      id: 'visual-morning',
      title: 'Morning stack',
      times: ['MORN'],
      memberIds: [treatment.id],
    });
    await seedTestBundle(page, {
      id: 'visual-evening',
      title: 'Evening stack',
      times: ['EVE'],
      memberIds: [treatment.id],
    });

    await page.goto(`/treatment/${treatment.id}/edit`);
    await page.getByTestId('treatment-regimen-field').waitFor();
    await page.getByTestId('link-selected-bundle-visual-morning').waitFor();
    await page.getByTestId('link-selected-bundle-visual-evening').waitFor();
    await takeSnapshot(page, 'Treatment - Edit Form Populated', testInfo);
  });
});
