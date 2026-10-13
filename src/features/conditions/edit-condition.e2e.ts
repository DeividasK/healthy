import {
  test,
  expect,
  clearAppStorage,
  seedTestPatient,
  seedTestCondition,
  createTestConditionViaUI,
  DEFAULT_CONDITION_TITLE,
} from '@/src/features/testing/testStorage';

test.describe('Edit Condition Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await seedTestPatient(page);
  });

  test('explains a failed deletion and allows retrying from the confirmation modal', async ({
    page,
    consoleMonitor,
  }) => {
    const condition = await seedTestCondition(page, {
      id: 'condition-delete-failure',
      title: 'Condition to delete',
    });
    await page.reload();
    await page.getByTestId(`condition-card-${condition.id}`).click();
    await page.getByTestId('edit-condition-button').click();
    await expect(page.getByTestId('condition-title-input')).toHaveValue(
      'Condition to delete'
    );
    await page.evaluate(async () => {
      await (window as any).__HEALTHY_TEST_BRIDGE__.executeSql(
        `CREATE TEMP TRIGGER fail_condition_delete BEFORE DELETE ON conditions
         WHEN OLD.id = 'condition-delete-failure'
         BEGIN SELECT RAISE(ABORT, 'Simulated deletion failure'); END;`
      );
    });
    consoleMonitor.ignore('Failed to delete resource:');
    await page.clock.install();
    await page.getByTestId('delete-condition-button').click();
    await page.clock.runFor(5000);
    const confirm = page.getByTestId('delete-modal-confirm-button');
    await expect(confirm).toBeEnabled();
    const dialogPromise = page.waitForEvent('dialog');
    const clickPromise = confirm.click();
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe('Error\nFailed to delete. Please try again.');
    await dialog.accept();
    await clickPromise;
    await expect(page.getByTestId('delete-confirmation-modal')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`condition/${condition.id}/edit$`));
    await expect(page.getByTestId('condition-title-input')).toHaveValue(
      'Condition to delete'
    );

    await page.evaluate(async () => {
      await (window as any).__HEALTHY_TEST_BRIDGE__.executeSql(
        'DROP TRIGGER fail_condition_delete;'
      );
    });
    await confirm.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByTestId(`condition-card-${condition.id}`)
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByTestId(`condition-card-${condition.id}`)
    ).toHaveCount(0);
  });

  test(
    'should allow editing an existing Condition',
    { tag: ['@smoke'] },
    async ({ page }) => {
      await test.step('Create an initial condition', async () => {
        await createTestConditionViaUI(page);
      });

      await test.step('Open edit condition screen and verify initial title', async () => {
        await page.getByTestId(/^condition-card-/).click();
        await page.getByTestId('edit-condition-button').click();
        await expect(page).toHaveURL(/.*condition\/.*\/edit/);
        await expect(page.getByText('Edit Condition')).toBeVisible();

        const titleInput = page.getByTestId('condition-title-input');
        await expect(titleInput).toHaveValue(DEFAULT_CONDITION_TITLE);

        await titleInput.fill('Updated Condition');
        await page.getByTestId('save-button').click();
      });

      await test.step('Verify Condition view reflects the updated title', async () => {
        await expect(page).toHaveURL(/.*condition\/.*$/);
        await expect(page.getByTestId('condition-title')).toHaveText(
          'Updated Condition'
        );
      });
    }
  );

  test(
    'should open Condition View and delete from edit mode',
    { tag: ['@critical'] },
    async ({ page }) => {
      await test.step('Create a condition', async () => {
        await createTestConditionViaUI(page);
      });

      await test.step('Click condition card to open Condition View', async () => {
        const condCard = page.getByTestId(/^condition-card-/);
        await condCard.click();
        await expect(page).toHaveURL(/.*condition\/[a-zA-Z0-9_-]+$/);
        await expect(page.getByTestId('condition-title')).toHaveText(
          DEFAULT_CONDITION_TITLE
        );
      });

      await test.step('Delete condition from edit mode', async () => {
        await expect(page.getByTestId('delete-condition-button')).toHaveCount(
          0
        );
        await page.getByTestId('edit-condition-button').click();
        const deleteBtn = page.getByTestId('delete-condition-button');
        await deleteBtn.click();

        const modal = page.getByTestId('delete-confirmation-modal');
        await expect(modal).toBeVisible();

        const cancelBtn = page.getByTestId('delete-modal-cancel-button');
        await cancelBtn.click();
        await expect(modal).not.toBeVisible();
        await expect(page.getByTestId('condition-title-input')).toHaveValue(
          DEFAULT_CONDITION_TITLE
        );

        await page.clock.install();
        await deleteBtn.click();
        const confirmBtn = page.getByTestId('delete-modal-confirm-button');
        await expect(confirmBtn).toHaveAttribute('aria-disabled', 'true');

        await page.clock.runFor(5000);
        await expect(confirmBtn).toHaveText('Delete');
        await expect(confirmBtn).not.toHaveAttribute('aria-disabled', 'true');
        await confirmBtn.click();
      });

      await test.step('Verify returned to Home and condition removed', async () => {
        await expect(page).toHaveURL(/.*(\/|#)$/);
        await expect(page.getByText(DEFAULT_CONDITION_TITLE)).not.toBeVisible();
        await expect(page.getByText('Nothing to show yet')).toBeVisible();
      });
    }
  );
  test('opens the one-item add menu and creates a linked Consultation', async ({
    page,
  }) => {
    const initial = await seedTestCondition(page, {
      title: 'Initial Condition',
    });
    await page.goto(`/condition/${initial.id}`);
    const view = page.getByTestId('condition-view');
    const addButton = page.getByTestId('condition-add-button');
    const menu = page.getByTestId('condition-add-menu');
    const viewportWidth = page.viewportSize()!.width;
    await expect(view.getByTestId('condition-title')).toBeVisible();
    const conditionHeading = await view
      .getByTestId('condition-title')
      .boundingBox();
    expect(conditionHeading!.x).toBeCloseTo(20);
    expect(conditionHeading!.width).toBeCloseTo(viewportWidth - 40);

    await addButton.click();
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button')).toHaveCount(1);
    await expect(
      menu.getByRole('button', { name: 'Add Consultation', exact: true })
    ).toBeVisible();
    await expect(addButton).toHaveAttribute('aria-expanded', 'true');
    await expect(addButton).toHaveAccessibleName('Close add menu');
    await expect(addButton).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.getByTestId('condition-add-button-icon')).not.toHaveCSS(
      'transform',
      'none'
    );

    await page.evaluate(() => {
      const state = {
        samples: [] as {
          opacity: number;
          y: number;
          backdropOpacity: number;
        }[],
        frame: 0,
      };
      (window as any).__menuMotion = state;
      const sample = () => {
        const menu = document.querySelector(
          '[data-testid="condition-add-menu"]'
        );
        const backdrop = document.querySelector(
          '[data-testid="condition-add-menu-backdrop"]'
        )?.parentElement;
        if (menu && backdrop)
          state.samples.push({
            opacity: Number(getComputedStyle(menu).opacity),
            y: menu.getBoundingClientRect().y,
            backdropOpacity: Number(getComputedStyle(backdrop).opacity),
          });
        state.frame = requestAnimationFrame(sample);
      };
      sample();
    });
    await addButton.click();
    await expect(menu).not.toBeVisible();
    const menuMotion = await page.evaluate(() => {
      const state = (window as any).__menuMotion;
      cancelAnimationFrame(state.frame);
      return state.samples as {
        opacity: number;
        y: number;
        backdropOpacity: number;
      }[];
    });
    expect(
      menuMotion.some(
        (sample) =>
          sample.opacity > 0 && sample.opacity < 1 && sample.y > menuMotion[0].y
      )
    ).toBe(true);
    expect(
      menuMotion.some(
        (sample) => sample.backdropOpacity > 0 && sample.backdropOpacity < 1
      )
    ).toBe(true);
    await expect(addButton).toHaveAttribute('aria-expanded', 'false');
    await expect(addButton).toHaveAccessibleName('Add consultation');
    await expect(addButton).toHaveCSS('background-color', 'rgb(61, 100, 80)');
    await expect(page.getByTestId('condition-add-button-icon')).toHaveCSS(
      'transform',
      'matrix(1, 0, 0, 1, 0, 0)'
    );
    await addButton.click();
    await page
      .getByTestId('condition-add-menu-backdrop')
      .click({ position: { x: 10, y: 10 } });
    await expect(menu).not.toBeVisible();

    await addButton.click();
    await menu
      .getByRole('button', { name: 'Add Consultation', exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`.*consultation/add\\?conditionId=${initial.id}$`)
    );
    await expect(
      page.getByTestId(`selected-condition-${initial.id}`)
    ).toBeVisible();
    await page
      .getByTestId('consultation-title-input')
      .fill('Linked Consultation');
    await page.getByTestId('save-button').click();
    await expect(page).toHaveURL(new RegExp(`.*condition/${initial.id}$`));
    await expect(view.getByTestId('condition-title')).toHaveText(
      'Initial Condition'
    );
    await expect(
      view
        .getByTestId('condition-consultations-section')
        .getByText('Linked Consultation', { exact: true })
    ).toBeVisible();
    await page.reload();
    await expect(
      view
        .getByTestId('condition-consultations-section')
        .getByText('Linked Consultation', { exact: true })
    ).toBeVisible();

    const consultationRow = view.getByTestId(/^condition-consultation-item-/);
    expect((await consultationRow.boundingBox())!.width).toBeCloseTo(
      viewportWidth
    );
    await consultationRow.click();
    const consultationView = page.getByTestId('consultation-view');
    await expect(consultationView.getByTestId('consultation-title')).toHaveText(
      'Linked Consultation'
    );
    const consultationHeading = await consultationView
      .getByTestId('consultation-title')
      .boundingBox();
    expect(consultationHeading!.x).toBeCloseTo(20);
    expect(consultationHeading!.width).toBeCloseTo(viewportWidth - 40);
    await page.getByTestId('back-button').click();

    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await expect(page).toHaveURL(/.*(\/|#)$/);
    await expect(page.getByText('Linked Consultation')).not.toBeVisible();
  });
});

test('ordinary condition edits preserve diagnosis coding and unexposed FHIR metadata', async ({
  page,
}) => {
  await clearAppStorage(page);
  await seedTestPatient(page, { id: 'preservation-patient' });
  const seeded = await seedTestCondition(page, {
    id: 'preserved-condition',
    title: 'Original wording',
  });
  const original = {
    ...seeded,
    meta: {
      ...seeded.meta,
      tag: [{ system: 'https://example.org/tags', code: 'synthetic' }],
    },
    code: {
      text: 'Original wording',
      extension: [
        { url: 'https://example.org/concept', valueString: 'retained' },
      ],
      coding: [
        {
          code: 'L21',
          version: 'synthetic',
          extension: [
            { url: 'https://example.org/coding', valueString: 'retained' },
          ],
        },
        { system: 'https://example.org/other', code: 'SECOND' },
      ],
    },
    onsetDateTime: '2026-10-01T14:30:00+03:00',
    clinicalStatus: {
      ...seeded.clinicalStatus,
      text: 'Active',
      coding: [
        {
          ...seeded.clinicalStatus.coding[0],
          display: 'Active',
          version: 'imported-version',
          extension: [
            {
              url: 'https://example.org/status-coding',
              valueString: 'retained',
            },
          ],
        },
      ],
      extension: [
        { url: 'https://example.org/status', valueString: 'retained' },
      ],
    },
    verificationStatus: {
      text: 'Unconfirmed',
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'unconfirmed',
          display: 'Unconfirmed',
          version: 'imported-version',
        },
      ],
    },
    severity: {
      text: 'Mild',
      coding: [
        {
          system: 'http://hl7.org/fhir/ValueSet/condition-severity',
          code: 'mild',
          display: 'Mild',
          version: 'imported-version',
        },
      ],
    },
    category: [
      {
        text: 'ESI kontekstas',
        coding: [{ system: 'https://example.org/category', code: 'source' }],
      },
      { text: 'Additional category' },
    ],
    evidence: [{ concept: { text: 'Unexposed evidence' } }],
  };
  await page.evaluate(
    (resource) =>
      (window as any).__HEALTHY_TEST_BRIDGE__.saveCondition(
        resource,
        'preservation-patient'
      ),
    original
  );
  await page.goto('/condition/preserved-condition/edit');
  await page.getByTestId('condition-title-input').fill('Updated wording');
  await page.getByTestId('save-button').click();
  await expect(page.getByTestId('condition-title-input')).not.toBeVisible();
  const edited = await page.evaluate(() =>
    (window as any).__HEALTHY_TEST_BRIDGE__.getCondition('preserved-condition')
  );
  expect(edited).toEqual({
    ...original,
    meta: { ...original.meta, lastUpdated: edited.meta.lastUpdated },
    code: { ...original.code, text: 'Updated wording' },
  });

  await page.goto('/condition/preserved-condition/edit');
  await page.getByTestId('status-picker-select').selectOption('inactive');
  await page
    .getByTestId('verification-picker-button')
    .selectOption('confirmed');
  await page.getByTestId('severity-option-severe').click();
  await page.getByTestId('save-button').click();
  await expect(page.getByTestId('condition-title-input')).not.toBeVisible();
  const updated = await page.evaluate(() =>
    (window as any).__HEALTHY_TEST_BRIDGE__.getCondition('preserved-condition')
  );
  expect(updated.clinicalStatus).toEqual({
    extension: original.clinicalStatus.extension,
    coding: [
      {
        system: original.clinicalStatus.coding[0].system,
        code: 'inactive',
        extension: original.clinicalStatus.coding[0].extension,
      },
    ],
  });
  expect(updated.verificationStatus).toEqual({
    coding: [
      {
        system: original.verificationStatus.coding[0].system,
        code: 'confirmed',
      },
    ],
  });
  expect(updated.severity).toEqual({
    coding: [
      {
        system: original.severity.coding[0].system,
        code: 'severe',
        display: 'Severe',
      },
    ],
  });
});

test('edits verification independently and roundtrips source and standard categories', async ({
  page,
}) => {
  await clearAppStorage(page);
  await seedTestPatient(page);
  const condition = await seedTestCondition(page, {
    title: 'Seborėjinis dermatitas',
    status: 'active',
  });
  await page.evaluate(async (resource) => {
    await (window as any).__HEALTHY_TEST_BRIDGE__.saveCondition(
      { ...resource, category: [{ text: 'ESI kontekstas' }] },
      resource.subject.reference.split('/')[1]
    );
  }, condition);
  await page.goto(`/condition/${condition.id}/edit`);
  await expect(
    page.getByRole('combobox', { name: 'Category', exact: true })
  ).toHaveValue('ESI kontekstas');
  await expect(
    page.getByRole('combobox', { name: 'Verification status', exact: true })
  ).toBeVisible();
  await page
    .getByTestId('verification-picker-button')
    .selectOption('confirmed');

  await page.getByTestId('save-button').click();
  await expect(page.getByTestId('condition-title-input')).not.toBeVisible();
  await page.goto(`/condition/${condition.id}`);
  await expect(page.getByTestId('condition-category-0')).toHaveText(
    'Category: ESI kontekstas'
  );
  await expect(page.getByTestId('condition-verification-status')).toHaveText(
    'Verification status: Confirmed'
  );
  await page.goto(`/condition/${condition.id}/edit`);
  await expect(page.getByTestId('condition-category-input')).toHaveValue(
    'ESI kontekstas'
  );
  await page.getByTestId('status-picker-select').selectOption('inactive');
  await page.getByTestId('condition-category-input').selectOption('Temporary');
  await page.getByTestId('save-button').click();
  await expect(page.getByTestId('condition-title-input')).not.toBeVisible();
  await page.goto(`/condition/${condition.id}`);
  await expect(page.getByTestId('condition-category-0')).toHaveText(
    'Category: Temporary'
  );
  let saved = await page.evaluate(
    (id) => (window as any).__HEALTHY_TEST_BRIDGE__.getCondition(id),
    condition.id
  );
  expect(saved.clinicalStatus.coding[0].code).toBe('inactive');
  expect(saved.verificationStatus.coding[0].code).toBe('confirmed');
  expect(saved.category).toEqual([
    {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-category',
          code: 'encounter-diagnosis',
        },
      ],
    },
  ]);
  await page.goto(`/condition/${condition.id}/edit`);
  await page
    .getByTestId('verification-picker-button')
    .selectOption('differential');

  await page.getByTestId('save-button').click();
  await expect(page.getByTestId('condition-title-input')).not.toBeVisible();
  await page.goto(`/condition/${condition.id}`);
  await expect(page.getByTestId('condition-verification-status')).toHaveText(
    'Verification status: Differential'
  );
  saved = await page.evaluate(
    (id) => (window as any).__HEALTHY_TEST_BRIDGE__.getCondition(id),
    condition.id
  );
  expect(saved.clinicalStatus.coding[0].code).toBe('inactive');
  expect(saved.verificationStatus.coding[0].code).toBe('differential');
  await page.goto(`/condition/${condition.id}/edit`);
  const dock = page.getByTestId('resource-action-dock');
  const ids = [
    'delete-condition-button',
    'cancel-button',
    'save-button',
    'add-option-button',
  ];
  const positions = await Promise.all(
    ids.map(async (id) => {
      await expect(dock.getByTestId(id)).toBeVisible();
      return (await dock.getByTestId(id).boundingBox())!.x;
    })
  );
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  await expect
    .poll(async () => {
      const save = (await dock.getByTestId('save-button').boundingBox())!;
      return Math.abs(save.x + save.width / 2 - page.viewportSize()!.width / 2);
    })
    .toBeLessThan(1);
  await expect
    .poll(async () => {
      const island = (await page
        .getByTestId('action-dock-background')
        .boundingBox())!;
      return Math.abs(
        island.x + island.width / 2 - page.viewportSize()!.width / 2
      );
    })
    .toBeLessThan(1);
  await expect(
    page.getByTestId('action-dock-primary-slot').getByTestId('save-button')
  ).toBeVisible();
  await page.getByTestId('remove-verification-button').click();
  await page.getByTestId('remove-category-button').click();
  await expect(page.getByTestId('verification-picker-button')).toHaveCount(0);
  await expect(page.getByTestId('condition-category-input')).toHaveCount(0);
  await page.getByTestId('add-option-button').click();
  await expect(page.getByTestId('action-dock-background')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)'
  );
  await page.getByTestId('menu-add-verification').click();
  await expect(page.getByTestId('form-add-menu')).not.toBeVisible();
  await page.getByTestId('add-option-button').click();
  await page.getByTestId('menu-add-category').click();
  await expect(page.getByTestId('form-add-menu')).not.toBeVisible();
  await expect(page.getByTestId('verification-picker-button')).toBeVisible();
  await expect(page.getByTestId('condition-category-input')).toHaveValue('');
  await page.getByTestId('remove-verification-button').click();
  await page.getByTestId('remove-category-button').click();
  await page.getByTestId('save-button').click();
  await expect(page.getByTestId('condition-title-input')).not.toBeVisible();
  await page.goto(`/condition/${condition.id}`);
  await expect(page.getByTestId('condition-title')).toBeVisible();
  saved = await page.evaluate(
    (id) => (window as any).__HEALTHY_TEST_BRIDGE__.getCondition(id),
    condition.id
  );
  expect(saved.verificationStatus).toBeUndefined();
  expect(saved.category).toBeUndefined();
});
