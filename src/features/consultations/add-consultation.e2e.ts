import type { Page } from '@playwright/test';
import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  checkA11y,
  openRoute,
  reopenRoute,
} from '@/src/features/testing/testStorage';

test.describe('Add Consultation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test(
    'creates a consultation from its condition with every optional field and lists it everywhere',
    { tag: ['@smoke', '@critical'] },
    async ({ page }) => {
      let conditionId: string;

      await test.step('Seed a condition and navigate to it from Home', async () => {
        const cond = await seedTestCondition(page, {
          title: 'Cardiology Overview',
          status: 'active',
        });
        conditionId = cond.id;
        await page.getByTestId(`condition-open-${conditionId}`).click();
        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );
        await expect(page.getByTestId('condition-title')).toHaveText(
          'Cardiology Overview'
        );
      });

      await test.step('Open the Condition’s linked Consultation form', async () => {
        await page.getByTestId('condition-add-button').click();
        await page
          .getByTestId('condition-add-menu')
          .getByTestId('menu-add-consultation')
          .click();
        await expect(page.getByTestId('condition-add-menu')).not.toBeVisible();
        await expect(page.getByText('New Consultation')).toBeVisible();
      });

      await test.step('The condition is preselected as the reason for visit', async () => {
        await expect(
          page.getByTestId(`selected-condition-${conditionId}`)
        ).toContainText('Cardiology Overview');
      });

      await test.step('Fill a future date, time, service type, doctor and notes', async () => {
        await page
          .getByTestId('consultation-title-input')
          .fill('General Cardiology Review');
        // Consultations may be planned, so future dates are allowed.
        await page.locator('#consultation-date').fill('2028-11-20');
        await expect(page.getByTestId('date-picker-button')).toContainText(
          '2028'
        );

        const addField = async (option: string) => {
          await page.getByTestId('add-option-button').click();
          await page.getByTestId(option).click();
          await expect(page.getByTestId('form-add-menu')).not.toBeVisible();
        };
        await addField('menu-add-time');
        await page.locator('#consultation-time').fill('15:45');
        await expect(page.getByTestId('time-picker-button')).toContainText(
          '15:45'
        );

        await addField('menu-add-service-type');
        const serviceType = page.getByTestId('consultation-service-type-input');
        await serviceType.fill('Cardio');
        const suggestion = page.getByTestId('service-type-autocomplete-item-0');
        await expect(suggestion).toHaveText('Cardiology');
        await suggestion.click();
        await expect(serviceType).toHaveValue('Cardiology');

        await addField('menu-add-doctor');
        await page
          .getByTestId('consultation-doctor-input')
          .fill('Dr. Marcus Welby');
        await addField('menu-add-notes');
        await page
          .getByTestId('consultation-notes-input')
          .fill('Follow-up in 6 months. Blood pressure stable.');
      });

      await test.step('Save and verify it on the Condition timeline', async () => {
        await page.getByTestId('save-button').click();
        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}$`)
        );
        const timeline = page.getByTestId('condition-timeline');
        await expect(
          timeline.getByText('General Cardiology Review')
        ).toBeVisible();
        await expect(timeline.getByText('Dr. Marcus Welby')).toBeVisible();
        await expect(
          timeline.getByText('Cardiology', { exact: true })
        ).toBeVisible();
        await expect(timeline.getByText(/Nov 20, 2028.*15:45/)).toBeVisible();
        await expect(
          timeline.getByText('"Follow-up in 6 months. Blood pressure stable."')
        ).toBeVisible();
      });

      await test.step('Open it, then find it on Home', async () => {
        await page
          .getByTestId(
            /^condition-timeline-item-consultation-(?!.*-(row|tone-\w+)$)/
          )
          .click();
        await expect(page.getByTestId('consultation-title')).toHaveText(
          'General Cardiology Review'
        );
        await page.getByTestId('back-button').click();
        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}$`)
        );
        await page.getByTestId('back-button').click();
        await expect(page).toHaveURL(/.*(\/|#)$/);
        // Home lists recent consultations, including linked ones.
        await expect(page.getByText('General Cardiology Review')).toBeVisible();
        await expect(page.getByText('Dr. Marcus Welby')).toBeVisible();
      });
    }
  );

  test(
    'should allow creating a standalone Consultation from Home view floating menu, suggesting known doctors',
    { tag: ['@smoke', '@critical'] },
    async ({ page }) => {
      await test.step('Open floating menu on Home view and select Add Consultation', async () => {
        await seedTestConsultation(page, {
          title: 'Initial Consultation',
          doctorName: 'Dr. Beverly Crusher',
          date: '2026-10-01',
        });
        await openRoute(page, '/');
        const floatingBtn = page.getByTestId('floating-add-button');
        await expect(floatingBtn).toBeVisible();
        await floatingBtn.click();

        const addConsultationMenuItem = page.getByTestId(
          'menu-add-consultation'
        );
        await expect(addConsultationMenuItem).toBeVisible();
        await addConsultationMenuItem.click();

        await expect(page).toHaveURL(/.*consultation\/add/);
        await expect(page.getByText('New Consultation')).toBeVisible();
      });

      await test.step('Fill standalone consultation form and save', async () => {
        const titleInput = page.getByTestId('consultation-title-input');
        await titleInput.fill('Annual Physical Exam');

        await page.getByTestId('add-option-button').click();
        await page.getByTestId('menu-add-doctor').click();
        await expect(page.getByTestId('form-add-menu')).not.toBeVisible();
        // Doctors from earlier records are suggested
        const doctorInput = page.getByTestId('consultation-doctor-input');
        await doctorInput.click();
        await doctorInput.fill('Bev');
        const suggestion = page.getByTestId('doctor-autocomplete-item-0');
        await expect(suggestion).toHaveText('Dr. Beverly Crusher');
        await suggestion.click();
        await expect(doctorInput).toHaveValue('Dr. Beverly Crusher');

        await page.getByTestId('add-option-button').click();
        await page.getByTestId('menu-add-notes').click();
        await expect(page.getByTestId('form-add-menu')).not.toBeVisible();
        const notesInput = page.getByTestId('consultation-notes-input');
        await notesInput.fill('All vital signs optimal. Recommended vitamins.');

        await page.getByTestId('save-button').click();
      });

      await test.step('Verify standalone consultation is displayed on Home view', async () => {
        await expect(page).toHaveURL(/.*(\/|#)$/);
        await expect(page.getByText('Consultations')).toBeVisible();
        await expect(page.getByText('Annual Physical Exam')).toBeVisible();
        await expect(page.getByText('Dr. Beverly Crusher')).toHaveCount(2);
      });

      await test.step('Open the new standalone consultation view from Home', async () => {
        await page
          .getByRole('button', { name: /^View consultation: Annual Physical/ })
          .click();
        await expect(page).toHaveURL(/.*consultation\/.*$/);
        const view = page.getByTestId('consultation-view');
        await expect(view.getByTestId('consultation-title')).toHaveText(
          'Annual Physical Exam'
        );
        await expect(view.getByText('Dr. Beverly Crusher')).toBeVisible();
      });
    }
  );
});

/** Adds one of a diagnosis's optional fields from the + next to its heading. */
async function addDiagnosisField(page: Page, index: number, field: string) {
  await page.getByTestId(`diagnosis-${index}-add`).click();
  await page.getByTestId(`diagnosis-option-${field}`).click();
  await expect(page.getByTestId('diagnosis-options-menu')).toHaveCount(0);
}

for (const terminology of [
  { code: 'L21' },
  {
    system: 'http://hl7.org/fhir/sid/icd-10',
    code: 'L21',
    display: 'Seborrhoeic dermatitis',
  },
]) {
  test(`keeps reasons and independently entered diagnoses separate: ${terminology.system || 'code only'}`, async ({
    page,
  }) => {
    await seedTestPatient(page, { id: 'separate-patient' });
    const reason = await seedTestCondition(page, {
      id: 'reason-condition',
      title: 'Scalp irritation',
    });
    await openRoute(page, `/consultation/add?conditionId=${reason.id}`);
    await page
      .getByTestId('consultation-title-input')
      .fill('Dermatology review');
    await expect(
      page.getByTestId('consultation-conditions-section')
    ).toContainText('Reasons for visit');
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-add-diagnosis').click();
    await expect(page.getByTestId('form-add-menu')).not.toBeVisible();
    await page
      .getByTestId('diagnosis-0-title-input')
      .fill('Seborrhoeic dermatitis');
    for (const [field, value] of Object.entries(terminology)) {
      await addDiagnosisField(page, 0, field);
      await page.getByTestId(`diagnosis-0-${field}-input`).fill(value);
    }
    // Both variants render the same controls; audit the fully populated one.
    if (terminology.system) await checkA11y(page);
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/consultation\/add/);
    const stored = await page.evaluate(async () => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      return {
        encounter: JSON.parse(
          (await bridge.querySql('SELECT fhir_json FROM consultations;'))[0]
            .fhir_json
        ),
        conditions: await bridge.querySql('SELECT id FROM conditions;'),
      };
    });
    expect(stored.conditions).toEqual([{ id: reason.id }]);
    expect(stored.encounter.reason).toEqual([
      { value: [{ reference: { reference: `Condition/${reason.id}` } }] },
    ]);
    expect(stored.encounter.diagnosis).toEqual([
      {
        condition: [
          {
            concept: { text: 'Seborrhoeic dermatitis', coding: [terminology] },
          },
        ],
      },
    ]);
    expect(stored.encounter.reasonReference).toBeUndefined();
    await openRoute(page, `/consultation/${stored.encounter.id}`);
    await expect(page.getByTestId('consultation-reasons')).toContainText(
      'Reasons for visit'
    );
    await expect(page.getByTestId('consultation-diagnoses')).toContainText(
      'Diagnoses'
    );
    await reopenRoute(page);
    await expect(page.getByTestId('consultation-diagnoses')).toContainText(
      'Seborrhoeic dermatitis'
    );
    await page.getByTestId('edit-consultation-button').click();
    // Filled optional fields show without being added again
    await expect(page.getByTestId('diagnosis-0-code-input')).toHaveValue('L21');
    await addDiagnosisField(page, 0, 'condition');
    await page.getByTestId('diagnosis-0-condition-input').click();
    await page.getByTestId(`diagnosis-0-condition-item-${reason.id}`).click();
    await page
      .getByTestId('diagnosis-0-title-input')
      .fill('Updated diagnosis wording');
    await page.getByTestId('save-button').click();
    await expect(page.getByTestId('consultation-diagnoses')).toContainText(
      'Updated diagnosis wording'
    );
    const linked = await page.evaluate(
      (id) => (window as any).__HEALTHY_TEST_BRIDGE__.getConsultation(id),
      stored.encounter.id
    );
    expect(linked.reason).toEqual(stored.encounter.reason);
    expect(linked.diagnosis[0].condition[0].reference.reference).toBe(
      `Condition/${reason.id}`
    );
    expect(linked.diagnosis[0].condition[0].concept.coding).toEqual([
      terminology,
    ]);
    await page.getByTestId('edit-consultation-button').click();
    await page.getByTestId('remove-conditions-section-button').click();
    await page.getByTestId('save-button').click();
    await expect(page.getByTestId('consultation-reasons')).toHaveCount(0);
    await expect(page.getByTestId('consultation-diagnoses')).toContainText(
      'Updated diagnosis wording'
    );
    await page.getByTestId('edit-consultation-button').click();
    await page.getByTestId('diagnosis-0-remove').click();
    await page.getByTestId('save-button').click();
    await expect(page.getByTestId('consultation-diagnoses')).toHaveCount(0);
  });
}

test('blank diagnoses prevent saving; removed drafts create no Conditions', async ({
  page,
}) => {
  await seedTestPatient(page);
  await openRoute(page, '/consultation/add');
  await page.getByTestId('consultation-title-input').fill('Review');
  await page.getByTestId('add-option-button').click();
  await page.getByTestId('menu-add-diagnosis').click();
  await expect(page.getByTestId('form-add-menu')).not.toBeVisible();
  const item = page.getByTestId('consultation-diagnosis-0');
  await expect(item.getByText('Diagnosis 1', { exact: true })).toBeVisible();
  await expect(item.getByText('Name *', { exact: true })).toHaveCount(1);
  // Optional fields stay behind the diagnosis's + until added
  const optionalLabels = [
    'Referenced Condition',
    'Terminology System',
    'Diagnosis Code',
    'Terminology Display',
  ];
  for (const label of optionalLabels)
    await expect(item.getByText(label, { exact: true })).toHaveCount(0);
  await page.getByTestId('diagnosis-0-add').click();
  for (const label of optionalLabels)
    await expect(
      page.getByTestId('diagnosis-options-menu').getByText(label, {
        exact: true,
      })
    ).toBeVisible();
  await page.getByTestId('diagnosis-option-condition').click();
  await expect(page.getByTestId('diagnosis-options-menu')).toHaveCount(0);
  await expect(item.getByTestId('diagnosis-0-condition-input')).toBeVisible();
  await expect(item).toHaveCSS('border-top-width', '1px');
  await expect(item).toHaveCSS('border-bottom-width', '1px');
  const titleBox = await item
    .getByTestId('diagnosis-0-title-input')
    .boundingBox();
  const referenceBox = await item
    .getByTestId('diagnosis-0-condition-input')
    .boundingBox();
  expect(titleBox!.y).toBeLessThan(referenceBox!.y);
  // A removed optional field goes back to the menu
  await page.getByTestId('remove-diagnosis-0-condition').click();
  await expect(item.getByTestId('diagnosis-0-condition-input')).toHaveCount(0);
  // The heading carries the diagnosis's remove button
  const headingBox = await item
    .getByText('Diagnosis 1', { exact: true })
    .boundingBox();
  const removeBox = await item.getByTestId('diagnosis-0-remove').boundingBox();
  expect(
    Math.abs(
      headingBox!.y +
        headingBox!.height / 2 -
        removeBox!.y -
        removeBox!.height / 2
    )
  ).toBeLessThanOrEqual(2);
  const dialogPromise = page.waitForEvent('dialog');
  const save = page.getByTestId('save-button').click();
  const dialog = await dialogPromise;
  expect(dialog.message()).toContain('Please enter a diagnosis name.');
  await dialog.accept();
  await save;
  await page.getByTestId('diagnosis-0-remove').click();
  await page.getByTestId('save-button').click();
  await expect(page).not.toHaveURL(/consultation\/add/);
  expect(
    await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
        'SELECT id FROM conditions;'
      )
    )
  ).toEqual([]);
});

test('a diagnosis may create a Condition atomically, and failed links roll back both resources', async ({
  page,
}) => {
  await seedTestPatient(page, { id: 'atomic-patient' });
  await openRoute(page, '/consultation/add');
  await page.getByTestId('consultation-title-input').fill('Review');
  await page.getByTestId('add-option-button').click();
  await page.getByTestId('menu-add-diagnosis').click();
  await expect(page.getByTestId('form-add-menu')).not.toBeVisible();
  await page.getByTestId('diagnosis-0-title-input').fill('New diagnosis');
  await addDiagnosisField(page, 0, 'condition');
  await page.getByTestId('diagnosis-0-condition-input').click();
  await page.getByTestId('diagnosis-0-condition-item-__create__').click();
  await page.getByTestId('save-button').click();
  await expect(page).not.toHaveURL(/consultation\/add/);
  const result = await page.evaluate(async () => {
    const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
    const original = {
      encounters: await bridge.querySql('SELECT fhir_json FROM consultations;'),
      conditions: await bridge.querySql('SELECT fhir_json FROM conditions;'),
    };
    const encounter = JSON.parse(original.encounters[0].fhir_json);
    const condition = JSON.parse(original.conditions[0].fhir_json);
    await bridge.executeSql(
      "CREATE TEMP TRIGGER reject_new_diagnosis BEFORE INSERT ON consultation_conditions BEGIN SELECT RAISE(ABORT, 'Injected linking failure'); END;"
    );
    let rejected = false;
    try {
      await bridge.saveConsultation({
        patientId: 'atomic-patient',
        title: 'Failed review',
        date: '2026-10-13',
        diagnoses: [{ title: 'Roll back', createCondition: true }],
      });
    } catch {
      rejected = true;
    }
    return {
      rejected,
      encounter,
      condition,
      retained: {
        encounters: await bridge.querySql(
          'SELECT fhir_json FROM consultations;'
        ),
        conditions: await bridge.querySql('SELECT fhir_json FROM conditions;'),
      },
      original,
    };
  });
  expect(result.encounter.diagnosis[0].condition[0].reference.reference).toBe(
    `Condition/${result.condition.id}`
  );
  expect(result.condition.code.text).toBe('New diagnosis');
  expect(result.condition.onsetDateTime).toBeUndefined();
  expect(result.rejected).toBe(true);
  expect(result.retained).toEqual(result.original);
});

test('records a service provider and reuses its Organization for consultations and lab results', async ({
  page,
}) => {
  await seedTestPatient(page);
  const stored = async () =>
    await page.evaluate(async () => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      return {
        organizations: await bridge.querySql(
          'SELECT id, name FROM organizations;'
        ),
        providers: (
          await bridge.querySql(
            'SELECT fhir_json FROM consultations ORDER BY created_at;'
          )
        ).map(
          (row: { fhir_json: string }) =>
            JSON.parse(row.fhir_json).serviceProvider
        ),
      };
    });

  await test.step('Add a new service provider', async () => {
    await openRoute(page, '/consultation/add');
    await page.getByTestId('consultation-title-input').fill('Annual check-up');
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-add-service-provider').click();
    await expect(page.getByTestId('form-add-menu')).not.toBeVisible();
    await page
      .getByTestId('consultation-service-provider-input')
      .fill('City Hospital');
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/consultation\/add/);
  });

  await test.step('Store an Organization reference', async () => {
    const { organizations, providers } = await stored();
    expect(organizations).toEqual([
      { id: expect.stringMatching(/^org-/), name: 'City Hospital' },
    ]);
    expect(providers).toEqual([
      {
        reference: `Organization/${organizations[0].id}`,
        type: 'Organization',
        display: 'City Hospital',
      },
    ]);
  });

  await test.step('Show it on the consultation view', async () => {
    const [{ id }] = await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
        'SELECT id FROM consultations;'
      )
    );
    await openRoute(page, `/consultation/${id}`);
    await expect(
      page.getByTestId('consultation-service-provider')
    ).toContainText('City Hospital');
  });

  await test.step('Reuse it from autocomplete', async () => {
    await openRoute(page, '/consultation/add');
    await page.getByTestId('consultation-title-input').fill('Follow-up');
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('menu-add-service-provider').click();
    await page.getByTestId('consultation-service-provider-input').fill('city');
    const suggestion = page.getByTestId('service-provider-autocomplete-item-0');
    await expect(suggestion).toHaveText('City Hospital');
    await suggestion.click();
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/consultation\/add/);

    const { organizations, providers } = await stored();
    expect(organizations).toHaveLength(1);
    expect(providers.map((p: { reference: string }) => p.reference)).toEqual([
      `Organization/${organizations[0].id}`,
      `Organization/${organizations[0].id}`,
    ]);
  });

  await test.step('Reuse it as a lab result performer', async () => {
    await openRoute(page, '/lab-result/add');
    await page.getByTestId('test-search-input').fill('Hemoglobin');
    await page.getByTestId('autocomplete-item-cbc_hemoglobin').click();
    await page.getByTestId('marker-value-input-0').fill('14.5');
    await page.getByTestId('plus-menu-button').click();
    await page.getByTestId('menu-add-service-provider').click();
    await page.getByTestId('lab-result-service-provider-input').fill('city');
    const suggestion = page.getByTestId('service-provider-autocomplete-item-0');
    await expect(suggestion).toHaveText('City Hospital');
    await suggestion.click();
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/lab-result\/add/);

    const { organizations } = await stored();
    const [{ fhir_json }] = await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
        'SELECT fhir_json FROM diagnostic_reports;'
      )
    );
    expect(organizations).toHaveLength(1);
    expect(JSON.parse(fhir_json).performer).toEqual([
      {
        reference: `Organization/${organizations[0].id}`,
        type: 'Organization',
        display: 'City Hospital',
      },
    ]);
  });
});

test('scrolls a field added from the + menu into view and focuses it', async ({
  page,
}) => {
  await seedTestPatient(page);
  await openRoute(page, '/consultation/add');
  const addField = async (testID: string) => {
    await page.getByTestId('add-option-button').click();
    await page.getByTestId('form-add-menu').getByTestId(testID).click();
    await expect(page.getByTestId('form-add-menu')).not.toBeVisible();
  };
  const expectRevealed = async (field: ReturnType<typeof page.getByTestId>) => {
    await expect(field).toBeFocused();
    await expect(field).toBeInViewport({ ratio: 1 });
    // The floating action dock must not cover it.
    await expect
      .poll(async () => {
        const box = await field.boundingBox();
        const dock = await page.getByTestId('add-option-button').boundingBox();
        return box!.y + box!.height <= dock!.y;
      })
      .toBe(true);
  };

  // Two diagnoses make the form taller than the viewport.
  await addField('menu-add-diagnosis');
  await expect(page.getByTestId('diagnosis-0-title-input')).toBeFocused();
  await addField('menu-add-diagnosis');
  await expect(page.getByTestId('diagnosis-1-title-input')).toBeFocused();

  await addField('menu-add-notes');
  await expectRevealed(page.getByTestId('consultation-notes-input'));

  // Non-text controls are focused too.
  await addField('menu-add-time');
  await expectRevealed(page.getByTestId('time-picker-button').locator('input'));
});
