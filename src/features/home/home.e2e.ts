import {
  test,
  expect,
  createPatientViaUI,
  createTestConditionViaUI,
  checkA11y,
  seedTestPatient,
  seedTestResources,
  seedTestCondition,
  seedTestConsultation,
  seedTestReport,
  seedTestTreatment,
  seedTestServiceRequest,
  openRoute,
  useSingleColumnLayout,
} from '@/src/features/testing/testStorage';

// Home's single column and header; the desktop overview and sidebar are
// tested in desktop.e2e.ts.
test.beforeEach(async ({ page }) => useSingleColumnLayout(page));

test.describe('Fresh Install Onboarding Redirect', () => {
  test(
    'creates a persistent profile while fresh browser contexts remain isolated',
    { tag: ['@smoke'] },
    async ({ page, browser, baseURL }) => {
      await openRoute(page, '/');
      await expect(page).toHaveURL(/\/welcome$/);
      // Before a profile exists the header has no profile or settings.
      await expect(page.getByTestId('app-home-button')).toBeAttached();
      await expect(page.getByTestId('profile-header-button')).toHaveCount(0);
      await expect(page.getByTestId('settings-header-button')).toHaveCount(0);
      await createPatientViaUI(page);
      await page.reload();
      await expect(page.getByTestId('start-your-record')).toBeVisible();
      await expect(page.getByTestId('profile-header-button')).toBeVisible();
      await expect(page.getByTestId('settings-header-button')).toBeVisible();

      const isolated = await browser.newContext({ baseURL });
      try {
        const otherPage = await isolated.newPage();
        await otherPage.goto('/');
        await expect(otherPage).toHaveURL(/\/welcome$/);
        await expect(otherPage.getByTestId('welcome-title')).toBeVisible();
        await seedTestPatient(otherPage, { givenName: 'Separate' });
        await otherPage.goto('/profile');
        await expect(otherPage.getByTestId('profile-display-name')).toHaveText(
          'Separate Doe'
        );
        await openRoute(page, '/profile');
        await expect(page.getByTestId('profile-display-name')).toHaveText(
          'John'
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

  test('shows lab results on Home only as the Biomarkers grid; the Biomarkers page lists them', async ({
    page,
  }) => {
    const { report } = await seedTestReport(page, {
      date: '2026-10-02',
      biomarkers: [{ name: 'Hemoglobin', value: 14.5 }],
    });
    const home = page.getByTestId('results-scroll-view');
    await expect(home.getByTestId('labs-summary-count')).toHaveText('1');
    // Home lists neither reports nor their biomarkers.
    await expect(home.getByText('Lab Results', { exact: true })).toHaveCount(0);
    await expect(home.getByTestId(/^lab-result-card-/)).toHaveCount(0);
    await expect(home.getByTestId('biomarker-row-718-7')).toHaveCount(0);

    await seedTestServiceRequest(page, { title: 'Blood panel' });
    await seedTestTreatment(page, { title: 'Order treatment' });
    await seedTestCondition(page, { title: 'Order condition' });
    await seedTestConsultation(page, { title: 'Order consultation' });
    await expect(page.getByText('Order consultation')).toBeVisible();
    const top = async (text: string) =>
      (await page.getByText(text, { exact: true }).first().boundingBox())!.y;
    const order = [
      await top('Conditions'),
      await top('Biomarkers'),
      await top('Treatments'),
      await top('Consultations'),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));

    await home.getByRole('button', { name: 'Open biomarkers' }).click();
    const view = page.getByTestId('labs-summary-view');
    await expect(view.getByTestId('lab-results-section-count')).toHaveText('1');
    // The reports follow the grouped biomarkers.
    expect(
      (await view.getByTestId('lab-results-section').boundingBox())!.y
    ).toBeGreaterThan(
      (await view.getByTestId('labs-summary').boundingBox())!.y
    );
    const row = view.getByTestId(`lab-result-open-${report.id}`);
    await expect(row).toContainText('Lab report');
    await expect(row).toContainText('Oct 2, 2026');
    await expect(row).toContainText('Final');
    await row.click();
    await expect(page).toHaveURL(new RegExp(`lab-result/${report.id}$`));
  });

  test(
    'starts empty, shows a new condition right away, then toggles the add menu',
    { tag: ['@smoke'] },
    async ({ page }) => {
      // Empty Home suggests a first record; + comes with the first one.
      await expect(page.getByTestId('start-your-record')).toBeVisible();
      await expect(page.getByTestId('floating-add-button')).toHaveCount(0);
      await checkA11y(page);

      await createTestConditionViaUI(page, { title: 'Asthma' });
      await expect(page.getByText('Asthma')).toBeVisible();

      const floatingBtn = page.getByTestId('floating-add-button');
      const menu = page.getByTestId('floating-add-menu');
      await floatingBtn.click();
      await expect(page.getByTestId('menu-add-condition')).toBeVisible();
      await expect(page.getByTestId('menu-add-lab-results')).toBeVisible();
      // Tapping + again closes the menu
      await floatingBtn.click();
      await expect(menu).not.toBeVisible();
      // Waking the app refreshes without losing what is shown.
      await page.evaluate(() => {
        window.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await expect(page.getByText('Asthma')).toBeVisible();
      await expect(page.getByTestId('start-your-record')).toHaveCount(0);
    }
  );

  test(
    'deletes a lab result from its page after confirming',
    { tag: ['@critical'] },
    async ({ page }) => {
      const { report } = await seedTestReport(page, {
        biomarkers: [{ name: 'Hemoglobin', value: 14.2 }],
      });
      await openRoute(page, '/labs-summary');
      const row = page.getByTestId(`lab-result-card-${report.id}`);
      await row.click();
      await expect(page).toHaveURL(new RegExp(`lab-result/${report.id}$`));
      const deleteButton = page.getByTestId('delete-lab-result-button');
      const modal = page.getByTestId('delete-confirmation-modal');

      await deleteButton.click();
      await expect(page.getByText('Delete Lab Result')).toBeVisible();
      await page.getByTestId('delete-modal-cancel-button').click();
      await expect(modal).not.toBeVisible();
      await expect(page.getByTestId('lab-result-title')).toBeVisible();

      await page.clock.install();
      await deleteButton.click();
      await page.clock.runFor(5000);
      await page.getByTestId('delete-modal-confirm-button').click();
      await expect(modal).not.toBeVisible();
      await expect(page).toHaveURL(/labs-summary$/);
      await expect(row).not.toBeVisible();
      await openRoute(page, '/');
      await expect(page.getByTestId('start-your-record')).toBeVisible();
    }
  );
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

  test('shows three recent items per section with counts, expands them and opens rows', async ({
    page,
  }) => {
    await expect(page.getByTestId('home-conditions-section-count')).toHaveText(
      '4'
    );
    await expect(
      page.getByTestId('home-consultations-section-count')
    ).toHaveText('4');
    await expect(page.getByTestId('home-treatments-section-count')).toHaveText(
      '1'
    );
    await expect(
      page.getByTestId('home-service-requests-section-count')
    ).toHaveText('1');
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
    await expect(page.getByTestId('home-conditions-section-count')).toHaveText(
      '4'
    );
    await page.getByTestId('conditions-list-toggle').click();
    await expect(conditionCards).toHaveCount(3);

    // Expanded rows show their associations; types without any show none.
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

    // Clicking anywhere on a row opens it.
    await page
      .getByTestId('condition-card-c4')
      .getByText('Condition 4')
      .click();
    await expect(page).toHaveURL(/\/condition\/c4$/);
    await page.goBack();
    // Returning keeps Home's records on screen while they refresh.
    await expect(page.getByTestId('condition-card-c4')).toBeVisible();
    await expect(page.getByTestId('home-skeleton')).toHaveCount(0);
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
    // + comes with the first record.
    await seedTestCondition(page, { title: 'Asthma' });
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

test.describe('Shared header and island motion', () => {
  // Samples animation frames, so it runs with full motion.
  test.use({ reducedMotion: 'no-preference' });
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('keeps the shared header mounted, logo in the centre, and island transitions continuous', async ({
    page,
  }) => {
    const condition = await seedTestCondition(page, {
      title: 'Header navigation',
    });
    const consultation = await seedTestConsultation(page, {
      conditionIds: [condition.id],
      title: 'Dock navigation',
      // Planned steps show on the timeline without clearing its filters.
      status: 'planned',
    });
    await openRoute(page, '/');
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
    // The logo sits in the middle of the header.
    const headerBox = (await header.boundingBox())!;
    const centredX = headerBox.x + (headerBox.width - 44) / 2;
    await expect
      .poll(async () => (await logo.boundingBox())?.x)
      .toBeCloseTo(centredX);
    // The profile is at the start of the header and settings at the end.
    const profileBox = (await page
      .getByTestId('profile-header-button')
      .boundingBox())!;
    const settingsBox = (await page
      .getByTestId('settings-header-button')
      .boundingBox())!;
    expect(profileBox.x).toBeLessThan(centredX);
    expect(settingsBox.x).toBeGreaterThan(centredX + 44);

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
      .toBeCloseTo(centredX);
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
    expect(motion.positions.every((x) => Math.abs(x - centredX) < 1)).toBe(
      true
    );
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
      .getByTestId(`condition-timeline-item-consultation-${consultation.id}`)
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
      .toBeCloseTo(centredX);
    await expect(dock.getByTestId('floating-add-button')).toBeVisible();
  });
});
