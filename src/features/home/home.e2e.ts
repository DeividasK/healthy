import {
  test,
  expect,
  clearAppStorage,
  createPatientViaUI,
  createReportViaUI,
  createTestConditionViaUI,
  checkA11y,
  seedTestCondition,
  seedTestConsultation,
  seedTestReport,
  seedTestTreatment,
} from '@/src/features/testing/testStorage';

test.describe('Fresh Install Onboarding Redirect', () => {
  test(
    'should redirect to /profile/new on fresh install when no patients exist',
    { tag: ['@smoke'] },
    async ({ page }) => {
      await test.step('Clear storage and navigate to root', async () => {
        await clearAppStorage(page);
        await page.goto('/');
      });

      await test.step('Verify redirected to /profile/new', async () => {
        await expect(page).toHaveURL(/.*profile\/new/);
        await expect(page.getByText('Add Profile')).toBeVisible();
      });
    }
  );
});

test.describe('Home View Flow, Floating Plus Button, and Lab Result Deletion', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await createPatientViaUI(page);
  });

  test('labels lab results whenever another section precedes them', async ({
    page,
  }) => {
    await seedTestReport(page, {
      date: '2026-10-02',
      biomarkers: [{ name: 'Hemoglobin', value: 14.5 }],
    });
    await page.goto('/');
    await page.getByText('Hemoglobin (Hgb)').waitFor();
    // A lone section needs no heading
    await expect(page.getByText('Lab Results', { exact: true })).toHaveCount(0);

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
    await page.getByTestId(`condition-card-${condition.id}`).click();
    await expect(page.getByTestId('back-button')).toBeVisible();
    await expect(header.getByTestId('back-button')).toHaveCount(0);
    await expect(
      page.getByTestId('resource-action-dock').getByTestId('back-button')
    ).toBeVisible();
    await expect(page.getByTestId('delete-condition-button')).toHaveCount(0);
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
    await expect
      .poll(
        async () => {
          const trash = (await dock
            .getByTestId('delete-condition-button')
            .boundingBox())!;
          const save = (await dock.getByTestId('save-button').boundingBox())!;
          const close = (await dock
            .getByTestId('cancel-button')
            .boundingBox())!;
          return (
            trash.x + trash.width < save.x && save.x + save.width < close.x
          );
        },
        { timeout: 15000 }
      )
      .toBe(true);
    await page.getByTestId('condition-title-input').fill('Unsaved change');
    await dock.getByRole('button', { name: 'Cancel', exact: true }).click();
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
        await expect(page.getByText('Hemoglobin (Hgb)')).toBeVisible();
        await expect(page.getByText('15.5')).toBeVisible();
        await expect(
          page.getByText('"Database persistence inspection test"')
        ).toBeVisible();
      });

      await test.step('Hard reload and verify data persists from SQLite', async () => {
        await page.reload();
        const reportCard = page.getByTestId(/^report-card-/).first();
        await expect(reportCard).toBeVisible();
        await expect(page.getByText('Hemoglobin (Hgb)')).toBeVisible();
        await expect(page.getByText('15.5')).toBeVisible();
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
