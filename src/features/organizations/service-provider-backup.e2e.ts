import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  seedTestPatient,
  seedTestConsultation,
  seedTestReport,
} from '@/src/features/testing/testStorage';

test('ZIP backup restores service provider Organizations and their references', async ({
  page,
}) => {
  await seedTestPatient(page, { id: 'provider-backup-patient' });
  await seedTestConsultation(page, {
    id: 'provider-backup-visit',
    title: 'Backup visit',
    serviceProviderName: 'City Hospital',
  });
  await seedTestReport(page, {
    id: 'provider-backup-report',
    serviceProviderName: 'City Hospital',
    biomarkers: [{ name: 'Hemoglobin', value: 14.5 }],
  });
  const query = () =>
    page.evaluate(async () => {
      const b = (window as any).__HEALTHY_TEST_BRIDGE__;
      return {
        organizations: await b.querySql(
          'SELECT id, patient_id, fhir_json FROM organizations;'
        ),
        encounter: await b.querySql('SELECT fhir_json FROM consultations;'),
        report: await b.querySql('SELECT fhir_json FROM diagnostic_reports;'),
      };
    });
  const original = await query();
  expect(original.organizations).toHaveLength(1);

  const download = page.waitForEvent('download');
  await page.evaluate(() =>
    (window as any).__HEALTHY_TEST_BRIDGE__.exportArchive()
  );
  const archive = Array.from(await readFile((await (await download).path())!));
  await page.evaluate(async (archive) => {
    const b = (window as any).__HEALTHY_TEST_BRIDGE__;
    await b.clearDatabase();
    await b.restoreArchive(archive);
  }, archive);

  expect(await query()).toEqual(original);
});
