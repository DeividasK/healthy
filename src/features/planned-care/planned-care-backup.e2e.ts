import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  seedTestPatient,
  seedTestConsultation,
  seedTestPlannedCare,
  connectTestSync,
  syncTestDevice,
  driveContents,
  evaluateBridge as bridge,
} from '@/src/features/testing/testStorage';

const PATIENT = 'planned-care-backup-patient';

for (const transport of ['ZIP', 'encrypted Drive'] as const) {
  test(`${transport} preserves service requests, their origin and basedOn references`, async ({
    page,
  }) => {
    await seedTestPatient(page, { id: PATIENT });
    await seedTestConsultation(page, {
      id: 'planned-care-origin-visit',
      title: 'Referring visit',
    });
    const original = await seedTestPlannedCare(page, {
      id: 'backed-up-request',
      title: 'Request to back up',
      category: '3457005',
      consultationId: 'planned-care-origin-visit',
      instructions: 'First line\nSecond line',
      plannedDate: '2099-05-01',
    });
    original.requisition = { system: 'https://example.org/req', value: 'R-1' };
    original.priority = 'urgent';
    await bridge(
      page,
      (b, { request, patientId }) => b.savePlannedCare(request, patientId),
      { request: original, patientId: PATIENT }
    );
    await seedTestConsultation(page, {
      id: 'planned-care-based-visit',
      title: 'Resulting visit',
      basedOnServiceRequestIds: ['backed-up-request'],
    });

    let archive: number[] = [];
    if (transport === 'ZIP') {
      const download = page.waitForEvent('download');
      await bridge(page, (b) => b.exportArchive());
      archive = Array.from(await readFile((await (await download).path())!));
    } else {
      const { store } = await connectTestSync(page);
      expect((await syncTestDevice(page)).pushed).toBeGreaterThanOrEqual(4);
      expect(driveContents(store)).not.toContain('Request to back up');
    }

    const restored = await bridge(
      page,
      async (b, { transport, archive }) => {
        await b.clearDatabase();
        if (transport === 'ZIP') await b.restoreArchive(archive);
        else await b.syncAllProfiles();
        return {
          request: await b.getPlannedCare('backed-up-request'),
          row: (
            await b.querySql(
              'SELECT consultation_id, requisition_system, requisition_value FROM service_requests;'
            )
          )[0],
          visit: await b.getConsultation('planned-care-based-visit'),
          document: await b.getClinicalDocumentByConsultationId(
            'planned-care-origin-visit'
          ),
        };
      },
      { transport, archive }
    );
    expect(restored.request).toEqual(original);
    expect(restored.row).toEqual({
      consultation_id: 'planned-care-origin-visit',
      requisition_system: 'https://example.org/req',
      requisition_value: 'R-1',
    });
    expect(restored.visit.basedOn).toEqual([
      { reference: 'ServiceRequest/backed-up-request', type: 'ServiceRequest' },
    ]);
    expect(restored.document.section[0].entry).toContainEqual({
      reference: 'ServiceRequest/backed-up-request',
    });

    if (transport === 'encrypted Drive') {
      // A remote deletion reaches other devices and removes the request.
      const afterDelete = await bridge(
        page,
        async (b, patientId) => {
          await b.deletePlannedCare('backed-up-request', patientId);
          await b.syncNow();
          await b.clearDatabase();
          await b.syncAllProfiles();
          return {
            request: await b.getPlannedCare('backed-up-request'),
            visit: await b.getConsultation('planned-care-based-visit'),
          };
        },
        PATIENT
      );
      expect(afterDelete.request).toBeNull();
      expect(afterDelete.visit.basedOn).toBeUndefined();
    }
  });
}
