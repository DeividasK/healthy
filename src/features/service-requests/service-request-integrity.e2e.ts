import {
  test,
  expect,
  seedTestPatient,
  seedTestServiceRequest,
  evaluateBridge as bridge,
} from '@/src/features/testing/testStorage';

const PATIENT = 'service-request-integrity-patient';

test.beforeEach(async ({ page }) => {
  await seedTestPatient(page, { id: PATIENT });
});

test('v14 creates the service request table with sync capture', async ({
  page,
}) => {
  const schema = await bridge(page, (b) =>
    b.querySql(
      "SELECT name FROM sqlite_master WHERE name LIKE '%service_requests%' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    )
  );
  expect(schema.map((row: any) => row.name)).toEqual([
    'idx_service_requests_consultation_id',
    'idx_service_requests_patient_id',
    'idx_service_requests_requisition',
    'service_requests',
    'sync_service_requests_delete',
    'sync_service_requests_insert',
    'sync_service_requests_update',
  ]);
  const request = await seedTestServiceRequest(page, { title: 'Chest X-ray' });
  const dirty = await bridge(
    page,
    (b, id) =>
      b.querySql(
        'SELECT resource_type FROM sync_dirty WHERE resource_id = ?;',
        [id]
      ),
    request.id
  );
  expect(dirty).toEqual([{ resource_type: 'ServiceRequest' }]);
});
