import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  seedTestReport,
  seedTestServiceRequest,
  seedTestTreatment,
  openRoute,
  showAllTimelineSteps,
} from '@/src/features/testing/testStorage';

test.describe('View Condition', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('shows related steps as a timeline grouped by month and opens each', async ({
    page,
  }) => {
    const condition = await seedTestCondition(page, { title: 'Knee pain' });
    const other = await seedTestCondition(page, { title: 'Back pain' });
    await openRoute(page, `/condition/${condition.id}`);
    await page.getByTestId('condition-title').waitFor();
    // Nothing related yet: no empty timeline
    await expect(page.getByTestId('condition-timeline')).toHaveCount(0);

    const visit = await seedTestConsultation(page, {
      title: 'Orthopaedic review',
      conditionIds: [condition.id],
      date: '2026-10-04',
      status: 'completed',
    });
    const review = await seedTestConsultation(page, {
      title: 'MRI review',
      conditionIds: [condition.id],
      date: '2026-11-03',
      status: 'planned',
    });
    const mri = await seedTestServiceRequest(page, {
      title: 'Knee MRI',
      authoredOn: '2026-10-04',
      status: 'active',
      reasonConditionIds: [condition.id],
    });
    const xray = await seedTestServiceRequest(page, {
      title: 'Knee X-ray',
      authoredOn: '2026-09-12',
      status: 'revoked',
      reasonConditionIds: [condition.id],
    });
    const ibuprofen = await seedTestTreatment(page, {
      title: 'Ibuprofen 400mg',
      authoredOn: '2026-10-04',
      status: 'on-hold',
      reasonConditionIds: [condition.id],
    });
    const report = await seedTestReport(page, {
      date: '2026-10-04',
      serviceProviderName: 'City Lab',
      serviceRequestIds: [mri.id],
      biomarkers: [{ name: 'Hemoglobin', value: 14.5, unit: 'g/dL' }],
    });
    // Steps for other conditions stay off this timeline
    await seedTestTreatment(page, {
      title: 'Naproxen',
      reasonConditionIds: [other.id],
    });
    const unrelated = await seedTestServiceRequest(page, {
      title: 'Spine MRI',
      reasonConditionIds: [other.id],
    });
    await seedTestReport(page, {
      date: '2026-10-05',
      serviceRequestIds: [unrelated.id],
      biomarkers: [{ name: 'Hemoglobin', value: 13.9, unit: 'g/dL' }],
    });

    await showAllTimelineSteps(page);

    // Saved steps appear without leaving the screen, newest first by month;
    // on one day, outcomes sit above the visit that produced them.
    const timeline = page.getByTestId('condition-timeline');
    await expect(timeline.getByTestId('condition-timeline-count')).toHaveText(
      '6'
    );
    await expect(timeline.getByRole('heading')).toHaveText([
      'Timeline',
      'November 2026',
      'October 2026',
      'September 2026',
    ]);
    const rows = timeline.getByTestId(/^condition-timeline-item-.*-row$/);
    await expect(rows).toHaveText([
      /MRI review/,
      /^Lab report/,
      /Ibuprofen 400mg/,
      /Knee MRI/,
      /Orthopaedic review/,
      /Knee X-ray/,
    ]);
    await expect(timeline.getByText('Naproxen')).toHaveCount(0);
    await expect(timeline.getByText('Spine MRI')).toHaveCount(0);

    // Each step shows its status tone
    for (const [type, id, tone] of [
      ['consultation', review.id, 'planned'],
      ['lab-result', report.report.id, 'done'],
      ['treatment', ibuprofen.id, 'paused'],
      ['service-request', mri.id, 'active'],
      ['consultation', visit.id, 'done'],
      ['service-request', xray.id, 'faded'],
    ])
      await expect(
        page.getByTestId(`condition-timeline-item-${type}-${id}-tone-${tone}`)
      ).toBeVisible();
    await expect(
      page.getByTestId(
        `condition-timeline-item-lab-result-${report.report.id}-row`
      )
    ).toContainText('City Lab');

    // Biomarkers come only from the condition's own lab results, and each
    // opens its page, which links back to every condition it is tested for.
    const biomarkers = page.getByTestId('condition-biomarkers');
    await expect(page.getByTestId('condition-biomarkers-count')).toHaveText(
      '1'
    );
    const hemoglobin = biomarkers.getByRole('button', {
      name: 'View biomarker: Hemoglobin (Hgb)',
    });
    await expect(hemoglobin).toContainText('14.5g/dL');
    await hemoglobin.click();
    await expect(page.getByTestId('biomarker-title')).toHaveText(
      'Hemoglobin (Hgb)'
    );
    const conditions = page.getByTestId('biomarker-conditions');
    await expect(conditions.getByRole('button')).toHaveText([
      /Back pain/,
      /Knee pain/,
    ]);
    await page.getByTestId('back-button').click();
    await expect(page.getByTestId('condition-title')).toHaveText('Knee pain');

    // Every row opens its step
    for (const [type, id, titleTestID, title] of [
      ['consultation', visit.id, 'consultation-title', 'Orthopaedic review'],
      ['service-request', mri.id, 'service-request-title', 'Knee MRI'],
      ['treatment', ibuprofen.id, 'treatment-title', 'Ibuprofen 400mg'],
      ['lab-result', report.report.id, 'lab-result-title', 'Lab report'],
    ]) {
      await showAllTimelineSteps(page);
      await page.getByTestId(`condition-timeline-item-${type}-${id}`).click();
      await expect(page.getByTestId(titleTestID)).toHaveText(title);
      // The app's own back: a browser back here leaves the app's history out
      // of step, and a later test's in-app back then leaves the page.
      await page.getByTestId('back-button').click();
      await expect(page.getByTestId('condition-title')).toHaveText('Knee pain');
    }
  });
  test('filters the timeline by status, type and time period', async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date('2026-10-19T10:00:00'));
    const condition = await seedTestCondition(page, { title: 'Knee pain' });
    await seedTestConsultation(page, {
      title: 'MRI review',
      conditionIds: [condition.id],
      date: '2026-11-03',
      status: 'planned',
    });
    await seedTestConsultation(page, {
      title: 'Orthopaedic review',
      conditionIds: [condition.id],
      date: '2026-10-04',
      status: 'completed',
    });
    await seedTestServiceRequest(page, {
      title: 'Knee MRI',
      authoredOn: '2026-10-04',
      status: 'active',
      reasonConditionIds: [condition.id],
    });
    await seedTestTreatment(page, {
      title: 'Ibuprofen 400mg',
      authoredOn: '2026-03-02',
      status: 'on-hold',
      reasonConditionIds: [condition.id],
    });
    await openRoute(page, `/condition/${condition.id}`);

    const timeline = page.getByTestId('condition-timeline');
    const rows = timeline.getByTestId(/^condition-timeline-item-.*-row$/);
    const count = timeline.getByTestId('condition-timeline-count');
    const button = page.getByTestId('condition-timeline-filter-button');
    await expect(count).toHaveText('2');
    await expect(rows).toHaveText([/MRI review/, /Knee MRI/]);
    await expect(button).toHaveAccessibleName('Filter timeline, filters on');

    // Status and type chips narrow the steps as they are picked
    await button.click();
    const filters = page.getByTestId('condition-timeline-filters-card');
    await expect(filters.getByRole('checkbox')).toHaveText([
      'Planned',
      'Active',
      'Paused',
      'Done',
      'Cancelled',
      'Consultations',
      'Service requests',
      'Treatments',
    ]);
    await expect(
      page.getByTestId('condition-timeline-filter-tone-planned')
    ).toHaveAttribute('aria-checked', 'true');
    await expect(
      page.getByTestId('condition-timeline-filter-tone-active')
    ).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('condition-timeline-filters-done').click();
    await expect(filters).toHaveCount(0);
    await expect(rows).toHaveText([/MRI review/, /Knee MRI/]);
    await expect(count).toHaveText('2');
    await expect(button).toHaveAccessibleName('Filter timeline, filters on');

    await button.click();
    await page
      .getByTestId('condition-timeline-filter-type-consultation')
      .click();
    await page.keyboard.press('Escape');
    await expect(filters).toHaveCount(0);
    await expect(rows).toHaveText([/MRI review/]);

    // Reset clears every filter; then the time period alone
    await button.click();
    await page.getByTestId('condition-timeline-filters-reset').click();
    await expect(rows).toHaveCount(4);
    await expect(button).toHaveAccessibleName('Filter timeline');
    await page
      .getByTestId('condition-timeline-filter-period')
      .selectOption('past3');
    await expect(rows).toHaveText([/Knee MRI/, /Orthopaedic review/]);
    await page
      .getByTestId('condition-timeline-filter-period')
      .selectOption('upcoming');
    await expect(rows).toHaveText([/MRI review/]);

    // Nothing matching keeps the section and its filter button
    await page.getByTestId('condition-timeline-filter-tone-paused').click();
    await page.getByTestId('condition-timeline-filters-done').click();
    await expect(rows).toHaveCount(0);
    await expect(
      timeline.getByTestId('condition-timeline-no-matches')
    ).toHaveText('No steps match these filters.');
    await expect(count).toHaveText('0');
    await expect(button).toBeVisible();

    await test.step('remembers the filters after a restart', async () => {
      await page.reload();
      await expect(count).toHaveText('0');
      await expect(button).toHaveAccessibleName('Filter timeline, filters on');
      await button.click();
      await expect(
        page.getByTestId('condition-timeline-filter-tone-paused')
      ).toHaveAttribute('aria-checked', 'true');
      await expect(
        page.getByTestId('condition-timeline-filter-period')
      ).toHaveValue('upcoming');
      await page.getByTestId('condition-timeline-filters-done').click();
    });

    await test.step('keeps filters apart for each condition', async () => {
      const other = await seedTestCondition(page, { title: 'Back pain' });
      await seedTestConsultation(page, {
        title: 'Physio review',
        conditionIds: [other.id],
        date: '2026-10-04',
        status: 'completed',
      });
      await seedTestConsultation(page, {
        title: 'Spine review',
        conditionIds: [other.id],
        date: '2026-11-10',
        status: 'planned',
      });
      await openRoute(page, `/condition/${other.id}`);
      await expect(rows).toHaveText([/Spine review/]);
      await expect(button).toHaveAccessibleName('Filter timeline, filters on');
      await openRoute(page, `/condition/${condition.id}`);
      await expect(count).toHaveText('0');
    });
  });
});

test.describe('Condition view island', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('tabs through actions left to right and shrinks the open + to a close button', async ({
    page,
  }) => {
    await seedTestCondition(page, { id: 'island-condition', title: 'Island' });
    await openRoute(page, '/condition/island-condition');
    const dock = page.getByTestId('resource-action-dock');
    const back = dock.getByTestId('back-button');
    await expect(back).toBeVisible();
    await back.focus();
    for (const id of [
      'delete-condition-button',
      'condition-add-button',
      'edit-condition-button',
    ]) {
      await page.keyboard.press('Tab');
      await expect(dock.getByTestId(id)).toBeFocused();
    }

    const add = dock.getByTestId('condition-add-button');
    await add.click();
    await expect
      .poll(async () => Math.round((await add.boundingBox())!.width))
      .toBe(44);
  });

  test('Escape cancels editing, asking first when data was entered', async ({
    page,
  }) => {
    await seedTestCondition(page, { id: 'escape-condition', title: 'Escape' });
    await openRoute(page, '/condition/escape-condition');
    await page.getByTestId('edit-condition-button').click();
    await expect(page.getByTestId('condition-title-input')).toBeVisible();
    await page.getByTestId('cancel-button').click();
    await expect(page.getByTestId('discard-changes-modal')).toHaveCount(0);
    await expect(page).toHaveURL(/\/condition\/escape-condition$/);
    await page.getByTestId('edit-condition-button').click();
    await expect(page.getByTestId('condition-title-input')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/condition\/escape-condition$/);

    await page.getByTestId('edit-condition-button').click();
    await page.getByTestId('condition-title-input').fill('Changed');
    await page.keyboard.press('Escape');
    const modal = page.getByTestId('discard-changes-modal');
    await expect(modal.getByRole('button', { name: 'No' })).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/condition\/escape-condition$/);
    await expect(page.getByTestId('condition-title')).toHaveText('Escape');
  });
});
