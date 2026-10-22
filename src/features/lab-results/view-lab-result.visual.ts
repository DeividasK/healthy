import {
  test,
  takeSnapshot,
  seedTestPatient,
  seedTestReport,
  seedTestServiceRequest,
} from '@/src/features/testing/visualTest';

test.describe('View Lab Result - Visual Regression', () => {
  test('Notes, provider and results', async ({ page }, testInfo) => {
    await seedTestPatient(page);
    const request = await seedTestServiceRequest(page, {
      title: 'Full blood count',
      intent: 'order',
      status: 'completed',
      authoredOn: '2026-03-10',
      requesterName: 'Dr. Ana Ruiz',
    });
    const { report } = await seedTestReport(page, {
      serviceRequestIds: [request.id],
      date: '2026-03-14',
      notes: 'Fasting sample taken at 8am.\nRepeat in three months.',
      serviceProviderName: 'City Lab',
      biomarkers: [
        { name: 'Hemoglobin', value: 14.5, unit: 'g/dL' },
        { name: 'White Blood Cells', value: 12.4, unit: '10*3/uL' },
        { name: 'Red Blood Cells', value: 3.9 },
        // Together they add the calculated atherogenic index.
        { name: 'Triglycerides', value: 0.9, unit: 'mmol/L' },
        { name: 'HDL', value: 1.93, unit: 'mmol/L' },
      ],
    });

    await page.goto(`/lab-result/${report.id}`);
    await page.getByTestId('lab-result-title').waitFor();
    await takeSnapshot(page, 'Lab Result View - Details', testInfo);
  });
});
