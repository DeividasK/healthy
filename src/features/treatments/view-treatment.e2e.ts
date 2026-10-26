import {
  test,
  expect,
  seedTestPatient,
  seedTestTreatment,
  getTestTreatment,
  checkA11y,
  getBrowserLocalDate,
  openRoute,
  getContentCenterX,
} from '@/src/features/testing/testStorage';

test.describe('View Treatment Flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('shows long multi-line instructions as prescribed and as being taken', async ({
    page,
  }) => {
    const longInstructions = [
      'Line 1: Take 2 tablets morning and evening with food.',
      'Line 2: Maintain adequate hydration (at least 2L of water daily).',
      'Line 3: Discontinue if rash, hives, or swelling occurs.',
      'Line 4: Special notes: Avoid direct sun exposure.',
    ].join('\n\n');

    const treatment = await seedTestTreatment(page, {
      title: 'Doxycycline 100mg',
      intent: 'order',
      status: 'active',
      dosageInstructions: longInstructions,
      notes: 'Prescribed for dermatological regimen.',
      takingSince: await getBrowserLocalDate(page, -7),
    });

    await openRoute(page, `/treatment/${treatment.id}`);
    await expect(page.getByTestId('treatment-title')).toHaveText(
      'Doxycycline 100mg'
    );
    await expect(page.getByTestId('treatment-dosage')).toHaveText(
      longInstructions
    );
    await expect(page.getByTestId('treatment-dosage-section')).toContainText(
      'Prescribed Dosage'
    );
    // Being taken, it shows the regimen followed too.
    await expect(page.getByTestId('treatment-current-regimen')).toHaveText(
      longInstructions
    );
    await checkA11y(page, { include: '[data-testid="treatment-view"]' });
    const stored = await getTestTreatment(page, treatment.id);
    expect(stored.dosageInstruction?.[0]?.text).toBe(longInstructions);
  });
});

test('the island centers Start taking and keeps Edit available beside it', async ({
  page,
}) => {
  await seedTestPatient(page);
  const treatment = await seedTestTreatment(page, { title: 'Island edge' });
  await openRoute(page, `/treatment/${treatment.id}`);
  const edit = page.getByTestId('edit-treatment-button');
  await expect(edit).toBeVisible();
  const start = page.getByTestId('treatment-usage-start');
  await expect(start).toBeVisible();
  await expect
    .poll(async () => {
      const box = (await start.boundingBox())!;
      return Math.abs(box.x + box.width / 2 - (await getContentCenterX(page)));
    })
    .toBeLessThan(1);
  await expect
    .poll(
      async () => (await edit.boundingBox())!.x - (await start.boundingBox())!.x
    )
    .toBeGreaterThan(0);
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.getByTestId('treatment-usage-form-title')).toHaveText(
    'Start taking: Island edge'
  );
});

test('unstarted treatment scroll region supports keyboard access', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await seedTestPatient(page);
  const treatment = await seedTestTreatment(page, {
    title: 'Unstarted treatment',
    status: 'active',
    dosageInstructions: Array.from(
      { length: 4 },
      (_, i) => `Line ${i + 1}: Instructions for this treatment.`
    ).join('\n\n'),
    notes: 'Not yet started.',
  });
  await openRoute(page, `/treatment/${treatment.id}`);
  await expect(page.getByTestId('treatment-title')).toHaveText(
    'Unstarted treatment'
  );
  await expect(page.getByTestId('treatment-usage-start')).toBeVisible();
  await checkA11y(page, { include: '[data-testid="treatment-view"]' });
});
