import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
  openRoute,
  showAllTimelineSteps,
  getContentCenterX,
  getContentColumn,
} from '@/src/features/testing/testStorage';

test('ordinary condition edits preserve diagnosis coding and unexposed FHIR metadata', async ({
  page,
}) => {
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
  await openRoute(page, '/condition/preserved-condition/edit');
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

  await openRoute(page, '/condition/preserved-condition/edit');
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
  await openRoute(page, `/condition/${condition.id}/edit`);
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
  await openRoute(page, `/condition/${condition.id}`);
  await expect(page.getByTestId('condition-category-0')).toHaveText(
    'Category: ESI kontekstas'
  );
  await expect(page.getByTestId('condition-verification-status')).toHaveText(
    'Verification status: Confirmed'
  );
  await openRoute(page, `/condition/${condition.id}/edit`);
  await expect(page.getByTestId('condition-category-input')).toHaveValue(
    'ESI kontekstas'
  );
  await page.getByTestId('status-picker-select').selectOption('inactive');
  await page.getByTestId('condition-category-input').selectOption('Temporary');
  await page.getByTestId('save-button').click();
  await expect(page.getByTestId('condition-title-input')).not.toBeVisible();
  await openRoute(page, `/condition/${condition.id}`);
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
  await openRoute(page, `/condition/${condition.id}/edit`);
  await page
    .getByTestId('verification-picker-button')
    .selectOption('differential');

  await page.getByTestId('save-button').click();
  await expect(page.getByTestId('condition-title-input')).not.toBeVisible();
  await openRoute(page, `/condition/${condition.id}`);
  await expect(page.getByTestId('condition-verification-status')).toHaveText(
    'Verification status: Differential'
  );
  saved = await page.evaluate(
    (id) => (window as any).__HEALTHY_TEST_BRIDGE__.getCondition(id),
    condition.id
  );
  expect(saved.clinicalStatus.coding[0].code).toBe('inactive');
  expect(saved.verificationStatus.coding[0].code).toBe('differential');
  await openRoute(page, `/condition/${condition.id}/edit`);
  const dock = page.getByTestId('resource-action-dock');
  const ids = ['cancel-button', 'save-button', 'add-option-button'];
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
      return Math.abs(
        save.x + save.width / 2 - (await getContentCenterX(page))
      );
    })
    .toBeLessThan(1);
  await expect
    .poll(async () => {
      const island = (await page
        .getByTestId('action-dock-background')
        .boundingBox())!;
      return Math.abs(
        island.x + island.width / 2 - (await getContentCenterX(page))
      );
    })
    .toBeLessThan(1);
  await expect(
    page.getByTestId('action-dock-primary-slot').getByTestId('save-button')
  ).toBeVisible();
  await page.getByTestId('add-option-button').click();
  await expect(page.getByTestId('action-dock-background')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)'
  );
  await page.getByTestId('add-option-button').click();
  await page.getByTestId('remove-verification-button').click();
  await page.getByTestId('remove-category-button').click();
  await page.getByTestId('save-button').click();
  await expect(page.getByTestId('condition-title-input')).not.toBeVisible();
  await openRoute(page, `/condition/${condition.id}`);
  await expect(page.getByTestId('condition-title')).toBeVisible();
  saved = await page.evaluate(
    (id) => (window as any).__HEALTHY_TEST_BRIDGE__.getCondition(id),
    condition.id
  );
  expect(saved.verificationStatus).toBeUndefined();
  expect(saved.category).toBeUndefined();
});

test.describe('Condition add menu motion', () => {
  // Samples animation frames, so it runs with full motion.
  test.use({ reducedMotion: 'no-preference' });
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('opens the add menu and creates a linked Consultation', async ({
    page,
  }) => {
    const initial = await seedTestCondition(page, {
      title: 'Initial Condition',
    });
    await openRoute(page, `/condition/${initial.id}`);
    const view = page.getByTestId('condition-view');
    const addButton = page.getByTestId('condition-add-button');
    const menu = page.getByTestId('condition-add-menu');
    await expect(view.getByTestId('condition-title')).toBeVisible();
    const column = await getContentColumn(page);
    const conditionHeading = await view
      .getByTestId('condition-title')
      .boundingBox();
    expect(conditionHeading!.x).toBeCloseTo(column.x + 20);
    expect(conditionHeading!.width).toBeCloseTo(column.width - 40);

    await addButton.click();
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button')).toHaveCount(3);
    await expect(
      menu.getByRole('button', { name: 'Consultation', exact: true })
    ).toBeVisible();
    await expect(
      menu.getByRole('button', { name: 'Treatment', exact: true })
    ).toBeVisible();
    await expect(
      menu.getByRole('button', { name: 'Service Request', exact: true })
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
    await expect(addButton).toHaveAccessibleName('Add record');
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
      .getByRole('button', { name: 'Consultation', exact: true })
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
    await showAllTimelineSteps(page);
    await expect(
      view
        .getByTestId('condition-timeline')
        .getByText('Linked Consultation', { exact: true })
    ).toBeVisible();

    const consultationRow = view.getByTestId(
      /^condition-timeline-item-consultation-.*-row$/
    );
    // The row reaches the screen edge, after its timeline node at the margin
    const rowBox = (await consultationRow.boundingBox())!;
    expect(rowBox.x + rowBox.width).toBeCloseTo(column.x + column.width);
    const nodeBox = (await view
      .getByTestId(/^condition-timeline-item-consultation-.*-tone-done$/)
      .boundingBox())!;
    expect(nodeBox.x).toBeCloseTo(column.x + 20);
    // The whole row opens the consultation
    await consultationRow.getByText('Linked Consultation').click();
    const consultationView = page.getByTestId('consultation-view');
    await expect(consultationView.getByTestId('consultation-title')).toHaveText(
      'Linked Consultation'
    );
    const consultationHeading = await consultationView
      .getByTestId('consultation-title')
      .boundingBox();
    expect(consultationHeading!.x).toBeCloseTo(column.x + 20);
    expect(consultationHeading!.width).toBeCloseTo(column.width - 40);
    await page.getByTestId('back-button').click();

    await page.getByTestId('app-home-button').click();
    await expect(page).toHaveURL(/.*(\/|#)$/);
    // Linked consultations are listed on the homepage too.
    await expect(page.getByText('Linked Consultation')).toBeVisible();
  });
});
