import {
  test,
  expect,
  createPatientViaUI,
  createReportViaUI,
  createTestConditionViaUI,
  checkA11y,
  seedTestPatient,
  seedTestResources,
  seedTestCondition,
  seedTestConsultation,
  seedTestReport,
  seedTestTreatment,
  seedTestServiceRequest,
} from '@/src/features/testing/testStorage';

test.describe('Fresh Install Onboarding Redirect', () => {
  test(
    'creates a persistent profile while fresh browser contexts remain isolated',
    { tag: ['@smoke'] },
    async ({ page, browser, baseURL }) => {
      await page.goto('/');
      await expect(page).toHaveURL(/profile\/new/);
      await createPatientViaUI(page);
      await page.reload();
      await expect(page.getByTestId('floating-add-button')).toBeVisible();

      const isolated = await browser.newContext({ baseURL });
      try {
        const otherPage = await isolated.newPage();
        await otherPage.goto('/');
        await expect(otherPage).toHaveURL(/profile\/new/);
        await expect(otherPage.getByText('Add Profile')).toBeVisible();
        await seedTestPatient(otherPage, { givenName: 'Separate' });
        await otherPage.goto('/profile');
        await expect(otherPage.getByTestId('profile-display-name')).toHaveText(
          'Separate Doe'
        );
        await page.goto('/profile');
        await expect(page.getByTestId('profile-display-name')).toHaveText(
          'John Doe'
        );
      } finally {
        await isolated.close();
      }
    }
  );
});

test.describe('Home View Flow, Floating Plus Button, and Lab Result Deletion', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('labels lab results whenever another section precedes them', async ({
    page,
  }) => {
    await seedTestReport(page, {
      date: '2026-10-02',
      biomarkers: [{ name: 'Hemoglobin', value: 14.5 }],
    });
    await page.goto('/');
    await page
      .getByTestId('results-scroll-view')
      .locator('[data-testid^="report-card-"]')
      .getByText('Hemoglobin (Hgb)')
      .waitFor();
    // A lone section needs no heading
    await expect(page.getByText('Lab Results', { exact: true })).toHaveCount(0);

    await seedTestServiceRequest(page, { title: 'Blood panel' });
    await expect(
      page.getByText('Service requests', { exact: true })
    ).toBeVisible();
    await expect(page.getByText('Lab Results', { exact: true })).toBeVisible();

    await seedTestTreatment(page, { title: 'Vitamin D' });
    await expect(page.getByText('Treatments', { exact: true })).toBeVisible();
    await expect(page.getByText('Lab Results', { exact: true })).toBeVisible();
  });

  test('keeps the shared header mounted, logo on the left, and island transitions continuous', async ({
    page,
  }) => {
    const condition = await seedTestCondition(page, {
      title: 'Header navigation',
    });
    const consultation = await seedTestConsultation(page, {
      conditionIds: [condition.id],
      title: 'Dock navigation',
    });
    await page.goto('/');
    const header = page.getByTestId('app-header');
    const logo = page.getByTestId('app-home-button');
    await expect(header).toBeVisible();
    await expect(page.getByTestId('back-button')).toHaveCount(0);
    const background = page.getByTestId('action-dock-background');
    const primaryButton = page.getByTestId('floating-add-button');
    await expect(background).toHaveCSS('opacity', '0');
    const collapsedSize = (await background.boundingBox())!;
    const primarySize = (await primaryButton.boundingBox())!;
    expect(collapsedSize.width).toBeLessThan(primarySize.width);
    expect(collapsedSize.height).toBeLessThan(primarySize.height);
    await expect
      .poll(async () => (await logo.boundingBox())?.x)
      .toBeCloseTo(16);

    // Sample actual positions across route changes to verify visible motion and persistence.
    await page.evaluate(() => {
      const element = document.querySelector(
        '[data-testid="app-home-button"]'
      )!;
      const state = {
        element,
        primary: document.querySelector('[data-testid="floating-add-button"]'),
        positions: [] as number[],
        heights: [] as number[],
        frame: 0,
      };
      (window as any).__headerMotion = state;
      const sample = () => {
        state.positions.push(element.getBoundingClientRect().x);
        const dock = document.querySelector(
          '[data-testid="resource-action-dock"]'
        );
        const height = dock?.getBoundingClientRect().height;
        state.heights.push(height ?? 0);
        state.frame = requestAnimationFrame(sample);
      };
      sample();
    });
    await page.getByTestId(`condition-open-${condition.id}`).click();
    await expect(page.getByTestId('back-button')).toBeVisible();
    await expect(header.getByTestId('back-button')).toHaveCount(0);
    await expect(
      page.getByTestId('resource-action-dock').getByTestId('back-button')
    ).toBeVisible();
    // View pages delete from their island
    await expect(page.getByTestId('delete-condition-button')).toBeVisible();
    await expect
      .poll(async () => (await logo.boundingBox())?.x)
      .toBeCloseTo(16);
    const motion = await page.evaluate(() => {
      const state = (window as any).__headerMotion;
      cancelAnimationFrame(state.frame);
      return {
        persisted:
          state.element ===
          document.querySelector('[data-testid="app-home-button"]'),
        positions: state.positions as number[],
        heights: state.heights as number[],
        primaryPersisted:
          state.primary ===
          document.querySelector('[data-testid="condition-add-button"]'),
      };
    });
    expect(motion.persisted).toBe(true);
    expect(motion.primaryPersisted).toBe(true);
    expect(motion.positions.every((x) => x === 16)).toBe(true);
    expect(motion.heights.length).toBeGreaterThan(0);
    expect(
      motion.heights.every((height) => height === primarySize.height)
    ).toBe(true);
    await expect(background).toHaveCSS('opacity', '1');
    const expandedSize = (await background.boundingBox())!;
    expect(expandedSize.width).toBeGreaterThan(primarySize.width);
    expect(expandedSize.height).toBe(primarySize.height);
    const conditionPrimary = (await page
      .getByTestId('condition-add-button')
      .boundingBox())!;
    expect(conditionPrimary.y).toBe(expandedSize.y);

    await page.evaluate(() => {
      const primary = document.querySelector(
        '[data-testid="action-dock-primary-slot"]'
      )!;
      const state = {
        primary,
        widths: [] as number[],
        heights: [] as number[],
        frame: 0,
      };
      (window as any).__dockMotion = state;
      const sample = () => {
        state.widths.push(primary.getBoundingClientRect().width);
        state.heights.push(
          document
            .querySelector('[data-testid="resource-action-dock"]')
            ?.getBoundingClientRect().height ?? 0
        );
        state.frame = requestAnimationFrame(sample);
      };
      sample();
    });

    await page
      .getByTestId(`condition-consultation-item-${consultation.id}`)
      .click();
    await expect(page.getByTestId('consultation-title')).toHaveText(
      'Dock navigation'
    );
    await expect(page.getByTestId('condition-add-button')).toHaveCount(0);
    // Both screens have a primary add action, so it stays in place unchanged.
    await expect(page.getByTestId('consultation-add-treatment')).toBeVisible();
    const dockMotion = await page.evaluate(() => {
      const state = (window as any).__dockMotion;
      cancelAnimationFrame(state.frame);
      return {
        widths: state.widths as number[],
        heights: state.heights as number[],
      };
    });
    expect(
      dockMotion.widths.every((width) => width === primarySize.width)
    ).toBe(true);
    expect(
      dockMotion.heights.every((height) => height === primarySize.height)
    ).toBe(true);
    const consultationSize = (await background.boundingBox())!;
    expect(consultationSize.height).toBe(expandedSize.height);
    await page.getByTestId('back-button').click();

    await page.getByTestId('edit-condition-button').click();
    await expect(header).toBeVisible();
    const dock = page.getByTestId('resource-action-dock');
    await expect(
      dock.getByRole('button', { name: 'Save', exact: true })
    ).toBeVisible();
    await expect(dock.getByTestId('back-button')).toHaveCount(0);
    // Edit forms have no delete; the island hugs back, save and + while
    // save stays at the screen center.
    await expect(dock.getByTestId('delete-condition-button')).toHaveCount(0);
    const viewportWidth = page.viewportSize()!.width;
    await expect
      .poll(
        async () => {
          const close = (await dock
            .getByTestId('cancel-button')
            .boundingBox())!;
          const save = (await dock.getByTestId('save-button').boundingBox())!;
          const add = (await dock
            .getByTestId('add-option-button')
            .boundingBox())!;
          const island = (await background.boundingBox())!;
          return (
            close.x + close.width < save.x &&
            save.x + save.width < add.x &&
            Math.abs(save.x + save.width / 2 - viewportWidth / 2) < 1 &&
            Math.abs(island.x - (close.x - 10)) < 1 &&
            Math.abs(island.x + island.width - (add.x + add.width + 10)) < 1
          );
        },
        { timeout: 15000 }
      )
      .toBe(true);
    await page.getByTestId('condition-title-input').fill('Unsaved change');
    await dock.getByRole('button', { name: 'Cancel', exact: true }).click();
    // Entered data is only discarded after confirming
    const discard = page.getByTestId('discard-changes-modal');
    await expect(discard.getByText('Are you sure?')).toBeVisible();
    await discard.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByTestId('condition-title')).toHaveText(
      'Header navigation'
    );
    await page.getByTestId('back-button').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('back-button')).toHaveCount(0);
    await expect
      .poll(async () => (await logo.boundingBox())?.x)
      .toBeCloseTo(16);
    await expect(dock.getByTestId('floating-add-button')).toBeVisible();
  });

  test(
    'should display "Nothing to show yet" on empty home and render floating plus button',
    { tag: ['@smoke'] },
    async ({ page }) => {
      await test.step('Verify empty state on Home and audit accessibility', async () => {
        await expect(page.getByText('Nothing to show yet')).toBeVisible();
        await checkA11y(page);
      });

      await test.step('Open floating menu', async () => {
        const floatingBtn = page.getByTestId('floating-add-button');
        await expect(floatingBtn).toBeVisible();
        await floatingBtn.click();

        const menu = page.getByTestId('floating-add-menu');
        await expect(menu).toBeVisible();
        await expect(page.getByTestId('menu-add-condition')).toBeVisible();
        await expect(page.getByTestId('menu-add-lab-results')).toBeVisible();

        // Tap floating button again -> menu closes
        await floatingBtn.click();
        await expect(menu).not.toBeVisible();
      });
    }
  );

  test(
    'should enforce 5-second countdown on Lab Result delete button and cancel safely',
    { tag: ['@critical'] },
    async ({ page }) => {
      await test.step('Create a lab report via UI and navigate to Home', async () => {
        await createReportViaUI(page, {
          biomarkers: [{ name: 'Hemoglobin', value: '14.2' }],
        });
        await page.goto('/');

        const reportCard = page.getByTestId(/^report-card-/).first();
        await expect(reportCard).toBeVisible();
        await expect(
          reportCard.getByTestId('biomarker-range-line-718-7')
        ).toBeVisible();

        const deleteBtn = page.getByTestId(/^delete-report-button-/).first();
        const editBtn = page.getByTestId(/^edit-report-button-/).first();
        await expect(editBtn).toBeVisible();
        await expect(deleteBtn).toBeVisible();
      });

      const reportCard = page.getByTestId(/^report-card-/).first();
      const deleteBtn = page.getByTestId(/^delete-report-button-/).first();

      await test.step('Open delete modal and test cancellation', async () => {
        await deleteBtn.click();
        const modal = page.getByTestId('delete-confirmation-modal');
        await expect(modal).toBeVisible();
        await expect(page.getByText('Delete Lab Result')).toBeVisible();

        const confirmBtn = page.getByTestId('delete-modal-confirm-button');
        await expect(confirmBtn).toHaveAttribute('aria-disabled', 'true');
        await expect(confirmBtn).toContainText('Delete (');

        const cancelBtn = page.getByTestId('delete-modal-cancel-button');
        await cancelBtn.click();
        await expect(modal).not.toBeVisible();
        await expect(reportCard).toBeVisible();
      });

      await test.step('Re-open modal, verify 5-second countdown, and confirm deletion', async () => {
        await page.clock.install();
        await deleteBtn.click();
        const confirmBtn = page.getByTestId('delete-modal-confirm-button');
        await expect(confirmBtn).toHaveAttribute('aria-disabled', 'true');

        await page.clock.runFor(5000);
        await expect(confirmBtn).toHaveText('Delete');
        await expect(confirmBtn).not.toHaveAttribute('aria-disabled', 'true');

        await confirmBtn.click();
        const modal = page.getByTestId('delete-confirmation-modal');
        await expect(modal).not.toBeVisible();
        await expect(reportCard).not.toBeVisible();
        await expect(page.getByText('Nothing to show yet')).toBeVisible();
      });
    }
  );

  test(
    'should persist and retrieve records in SQLite database across reloads',
    { tag: ['@critical'] },
    async ({ page }) => {
      await test.step('Create report and verify on Home', async () => {
        await createReportViaUI(page, {
          biomarkers: [{ name: 'Hemoglobin', value: '15.5' }],
          notes: 'Database persistence inspection test',
        });

        await page.goto('/');
        const reportCard = page.getByTestId(/^report-card-/).first();
        await expect(reportCard).toBeVisible();
        await expect(
          page
            .getByTestId('results-scroll-view')
            .locator('[data-testid^="report-card-"]')
            .getByText('Hemoglobin (Hgb)')
        ).toBeVisible();
        await expect(
          page
            .getByTestId('results-scroll-view')
            .locator('[data-testid^="report-card-"]')
            .getByText('15.5')
        ).toBeVisible();
        await expect(
          page.getByText('"Database persistence inspection test"')
        ).toBeVisible();
      });

      await test.step('Hard reload and verify data persists from SQLite', async () => {
        await page.reload();
        const reportCard = page.getByTestId(/^report-card-/).first();
        await expect(reportCard).toBeVisible();
        await expect(
          page
            .getByTestId('results-scroll-view')
            .locator('[data-testid^="report-card-"]')
            .getByText('Hemoglobin (Hgb)')
        ).toBeVisible();
        await expect(
          page
            .getByTestId('results-scroll-view')
            .locator('[data-testid^="report-card-"]')
            .getByText('15.5')
        ).toBeVisible();
      });
    }
  );

  test('should automatically re-render and display new condition and handle focus/wakeup sync gracefully', async ({
    page,
  }) => {
    await test.step('Verify initial empty state', async () => {
      await expect(page.getByText('Nothing to show yet')).toBeVisible();
    });

    await test.step('Add a condition and verify immediate render', async () => {
      await createTestConditionViaUI(page, { title: 'Asthma' });
      await expect(page.getByText('Asthma')).toBeVisible();
    });

    await test.step('Simulate window focus and visibility change events', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await expect(page.getByText('Asthma')).toBeVisible();
      await expect(page.getByText('Nothing to show yet')).not.toBeVisible();
    });
  });
});

test.describe('Home sections: collapsing, counts and chevron navigation', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
    await seedTestResources(page, {
      conditions: [1, 2, 3, 4].map((n) => ({
        id: `c${n}`,
        title: `Condition ${n}`,
        onsetDate: `2026-0${n}-01`,
      })),
      consultations: [1, 2, 3, 4].map((n) => ({
        id: `k${n}`,
        title: `Consultation ${n}`,
        date: `2026-0${n}-15`,
        conditionIds: n === 1 ? ['c1'] : undefined,
        reasonConditionIds: n === 1 ? ['c2'] : undefined,
      })),
      treatments: [
        {
          id: 't1',
          title: 'Treatment 1',
          reasonConditionIds: ['c1'],
          consultationId: 'k1',
        },
      ],
      serviceRequests: [
        {
          id: 'p1',
          title: 'Service request 1',
          reasonConditionIds: ['c2'],
          consultationId: 'k1',
        },
      ],
    });
  });

  test('shows three recent items per section and expands and collapses them', async ({
    page,
  }) => {
    const conditionCards = page.getByTestId(/^condition-card-/);
    const consultationCards = page.getByTestId(/^consultation-card-/);
    await expect(conditionCards).toHaveCount(3);
    await expect(consultationCards).toHaveCount(3);
    // Newest consultations first; the oldest is hidden until expanded.
    await expect(page.getByTestId('consultation-card-k4')).toBeVisible();
    await expect(page.getByTestId('consultation-card-k1')).toHaveCount(0);

    await page.getByTestId('consultations-list-toggle').click();
    await expect(consultationCards).toHaveCount(4);
    await expect(page.getByTestId('consultations-list-toggle')).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await page.getByTestId('consultations-list-toggle').click();
    await expect(consultationCards).toHaveCount(3);

    await page.getByTestId('conditions-list-toggle').click();
    await expect(conditionCards).toHaveCount(4);
    await page.getByTestId('conditions-list-toggle').click();
    await expect(conditionCards).toHaveCount(3);
  });

  test('shows associated resource counts on conditions and consultations', async ({
    page,
  }) => {
    await page.getByTestId('conditions-list-toggle').click();
    await page.getByTestId('consultations-list-toggle').click();
    await expect(
      page.getByTestId('condition-consultations-count-c1')
    ).toHaveText('1');
    await expect(page.getByTestId('condition-treatments-count-c1')).toHaveText(
      '1'
    );
    await expect(
      page.getByTestId('condition-consultations-count-c2')
    ).toHaveText('1');
    // Resource types with no associations show no count at all
    await expect(page.getByTestId('condition-treatments-count-c2')).toHaveCount(
      0
    );
    await expect(
      page.getByTestId('consultation-conditions-count-k1')
    ).toHaveText('2');
    await expect(
      page.getByTestId('consultation-treatments-count-k1')
    ).toHaveText('1');
    await expect(
      page.getByTestId('consultation-conditions-count-k2')
    ).toHaveCount(0);
    await expect(page.getByTestId('treatment-conditions-count-t1')).toHaveText(
      '1'
    );
    await expect(
      page.getByTestId('condition-service-request-count-c2')
    ).toHaveText('1');
    await expect(
      page.getByTestId('consultation-service-request-count-k1')
    ).toHaveText('1');
    await expect(
      page.getByTestId('service-request-conditions-count-p1')
    ).toHaveText('1');
  });

  test('opens a condition or consultation by clicking anywhere on its row', async ({
    page,
  }) => {
    await page
      .getByTestId('condition-card-c4')
      .getByText('Condition 4')
      .click();
    await expect(page).toHaveURL(/\/condition\/c4$/);
    await page.goBack();
    await page
      .getByTestId('consultation-card-k4')
      .getByText('Consultation 4')
      .click();
    await expect(page).toHaveURL(/\/consultation\/k4$/);
  });
});

test.describe('Home add menu keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('focuses the first option when opened with Cmd/Ctrl+Enter and cycles with arrows and Tab', async ({
    page,
  }) => {
    await expect(page.getByTestId('floating-add-button')).toBeVisible();
    await page.keyboard.press('ControlOrMeta+Enter');
    const condition = page.getByTestId('menu-add-condition');
    const treatment = page.getByTestId('menu-add-treatment');
    const labResults = page.getByTestId('menu-add-lab-results');
    await expect(condition).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(treatment).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(condition).toBeFocused();
    // Wraps from the first option to the last and back
    await page.keyboard.press('ArrowUp');
    await expect(labResults).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(condition).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(treatment).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(condition).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('floating-add-menu')).toHaveCount(0);

    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(condition).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/treatment\/add$/);
  });
});

test('lists lab results after every other section', async ({ page }) => {
  await seedTestPatient(page);
  await seedTestCondition(page, { title: 'Order condition' });
  await seedTestConsultation(page, { title: 'Order consultation' });
  await seedTestTreatment(page, { title: 'Order treatment' });
  await seedTestReport(page, {
    date: '2026-10-02',
    biomarkers: [{ name: 'Hemoglobin', value: 14.5 }],
  });
  await page.goto('/');
  await page
    .getByTestId('results-scroll-view')
    .locator('[data-testid^="report-card-"]')
    .getByText('Hemoglobin (Hgb)')
    .waitFor();
  const top = async (text: string) =>
    (await page.getByText(text, { exact: true }).first().boundingBox())!.y;
  const order = [
    await top('Conditions'),
    await top('Treatments'),
    await top('Consultations'),
    await top('Lab Results'),
  ];
  expect(order).toEqual([...order].sort((a, b) => a - b));
});

test('Labs Summary uses the latest measurement per biomarker regardless of import order', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-14T10:00:00Z'));
  await seedTestPatient(page);
  await seedTestCondition(page, {
    id: 'summary-condition',
    title: 'Summary order',
  });
  await seedTestReport(page, {
    id: 'summary-newer',
    date: '2026-10-10',
    biomarkers: [
      { name: 'Hemoglobin', value: 15.2 },
      { name: 'White Blood Cells', value: 3.1 },
      { name: 'Platelets', value: 480 },
    ],
  });
  await seedTestReport(page, {
    id: 'summary-older',
    date: '2020-10-01',
    biomarkers: [
      { name: 'Hemoglobin', value: 8 },
      { name: 'Red Blood Cells', value: 4.7 },
    ],
  });
  await page.goto('/');
  const summary = page.getByTestId('labs-summary');
  await expect(summary.getByTestId('labs-summary-divider')).toHaveCount(1);
  const conditionY = (await page
    .getByTestId('condition-card-summary-condition')
    .boundingBox())!.y;
  const summaryY = (await summary.boundingBox())!.y;
  expect(summaryY).toBeGreaterThan(conditionY);
  await expect(summary.getByTestId('labs-summary-total')).toHaveText('4');
  await expect(summary.getByText('Biomarkers', { exact: true })).toBeVisible();
  await expect(summary.getByTestId('labs-summary-count-Low')).toHaveText(
    'Low1'
  );
  await expect(summary.getByTestId('labs-summary-count-Normal')).toHaveText(
    'Normal2'
  );
  await expect(summary.getByTestId('labs-summary-count-High')).toHaveText(
    'High1'
  );
  await expect(
    summary.locator('[data-testid^="labs-summary-result-"]')
  ).toHaveCount(2);
  await expect(
    summary.getByText('Out of Range', { exact: true })
  ).toBeVisible();
  await expect(summary.getByTestId('labs-summary-result-718-7')).toHaveCount(0);
  await expect(summary.getByTestId('labs-summary-result-6690-2')).toContainText(
    'Low'
  );
  await expect(summary.getByTestId('labs-summary-result-777-3')).toContainText(
    'High'
  );
  await expect(
    summary.getByTestId('labs-summary-segment-718-7')
  ).toHaveAttribute('stroke', '#10B981');
  await expect(
    summary.getByTestId('labs-summary-segment-6690-2')
  ).toHaveAttribute('stroke', '#3B82F6');
  await expect(
    summary.getByTestId('labs-summary-segment-777-3')
  ).toHaveAttribute('stroke', '#EF4444');
  await expect(summary.getByTestId('labs-summary-chart')).toHaveAttribute(
    'aria-label',
    '4 biomarkers: 2 normal, 1 low, 1 high'
  );
  const period = summary.getByRole('combobox', { name: 'Period' });
  await expect(period.locator('option')).toHaveText([
    'All time',
    '10 years',
    '5 years',
    '2 years',
    '1 year',
    '6 months',
    '1 month',
  ]);
  for (const [label, count] of [
    ['10 years', 4],
    ['5 years', 3],
    ['2 years', 3],
    ['1 year', 3],
    ['6 months', 3],
    ['1 month', 3],
    ['All time', 4],
  ] as const) {
    await period.selectOption({ label });
    await expect(summary.getByTestId('labs-summary-total')).toHaveText(
      String(count)
    );
    await expect(
      summary
        .locator('[data-testid^="labs-summary-result-"]')
        .filter({ has: page.getByText(/LOINC:/) })
    ).toHaveCount(2);
    await expect(
      summary.locator('[data-testid^="labs-summary-segment-"]')
    ).toHaveCount(count);
  }
  await summary.getByTestId('labs-summary-result-6690-2').click();
  await expect(page).toHaveURL(/biomarker\/6690-2/);
  await expect(page.getByTestId('biomarker-latest-status')).toHaveText('Low');
});
