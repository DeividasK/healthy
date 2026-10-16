import {
  test,
  expect,
  seedTestPatient,
  seedTestConsultation,
  seedTestTreatment,
  getTestTreatment,
  getTestClinicalDocument,
  findTreatmentsSection,
  checkA11y,
  getBrowserLocalDate,
} from '@/src/features/testing/testStorage';

test.describe('View Treatment Flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('preserves long multi-line instructions across reload', async ({
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

    await page.goto(`/treatment/${treatment.id}`);
    await expect(page.getByTestId('treatment-title')).toHaveText(
      'Doxycycline 100mg'
    );
    await expect(page.getByTestId('treatment-dosage')).toHaveText(
      longInstructions
    );
    await checkA11y(page, { include: '[data-testid="treatment-view"]' });

    await page.reload();
    await expect(page.getByTestId('treatment-dosage')).toHaveText(
      longInstructions
    );
    const stored = await getTestTreatment(page, treatment.id);
    expect(stored.dosageInstruction?.[0]?.text).toBe(longInstructions);
  });

  test('deletes a treatment and removes its now-empty document section', async ({
    page,
  }) => {
    const consultation = await seedTestConsultation(page, {
      title: 'Endocrinology Review',
    });
    const treatment = await seedTestTreatment(page, {
      title: 'Metformin 500mg',
      consultationId: consultation.id,
      dosageInstructions: 'Take 1 tablet twice daily with meals.',
    });
    const docBefore = await getTestClinicalDocument(page, consultation.id);
    expect(findTreatmentsSection(docBefore).entry).toContainEqual({
      reference: `MedicationRequest/${treatment.id}`,
    });

    await page.clock.install();
    await page.goto(`/treatment/${treatment.id}`);
    await page.getByTestId('delete-treatment-button').click();
    await page.clock.runFor(5000);
    await page.getByTestId('delete-modal-confirm-button').click();
    await expect(page).toHaveURL(/.*(\/|#|\/\?.*)$/);
    await expect(page.getByText('Metformin 500mg')).not.toBeVisible();

    // The document remains, but an empty section would violate R5 cmp-1
    const docAfter = await getTestClinicalDocument(page, consultation.id);
    expect(docAfter).toBeDefined();
    expect(findTreatmentsSection(docAfter)).toBeUndefined();
  });

  test('isolates treatments by profile when switching active patients', async ({
    page,
  }) => {
    await seedTestTreatment(page, {
      title: 'Atorvastatin 20mg',
      dosageInstructions: 'Take 1 tablet at bedtime.',
    });
    await page.goto('/');
    await expect(page.getByText('Atorvastatin 20mg')).toBeVisible();

    await page.evaluate(async () => {
      await (window as any).__HEALTHY_TEST_BRIDGE__.seedPatient({
        givenName: 'Jane',
        familyName: 'Smith',
      });
    });
    await page.goto('/');
    await expect(page.getByText('Atorvastatin 20mg')).not.toBeVisible();
    await expect(page.getByText('Nothing to show yet')).toBeVisible();
  });
});

test('the island centers Start taking and keeps Edit available beside it', async ({
  page,
}) => {
  await seedTestPatient(page);
  const treatment = await seedTestTreatment(page, { title: 'Island edge' });
  await page.goto(`/treatment/${treatment.id}`);
  const edit = page.getByTestId('edit-treatment-button');
  await expect(edit).toBeVisible();
  const start = page.getByTestId('treatment-usage-start');
  await expect(start).toBeVisible();
  await expect
    .poll(async () => {
      const box = (await start.boundingBox())!;
      return Math.abs(box.x + box.width / 2 - page.viewportSize()!.width / 2);
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
  // Keep this known accessibility defect visible without changing app behavior
  // in this coverage-only handoff. An unexpected pass asks us to remove fail().
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
  await page.goto(`/treatment/${treatment.id}`);
  await expect(page.getByTestId('treatment-title')).toHaveText(
    'Unstarted treatment'
  );
  await expect(page.getByTestId('treatment-usage-start')).toBeVisible();
  test.fail(
    true,
    'Existing scrollable-region-focusable violation when there are no taking days or related links. Application changes are outside this coverage-only task.'
  );
  await checkA11y(page, { include: '[data-testid="treatment-view"]' });
});
