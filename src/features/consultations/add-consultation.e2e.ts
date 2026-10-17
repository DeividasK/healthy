import type { Page } from '@playwright/test';
import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
  seedTestConsultation,
  checkA11y,
} from '@/src/features/testing/testStorage';

async function openAddConsultationForCondition(
  page: Page,
  conditionId: string
) {
  await page.goto('/');
  await page.getByTestId(`condition-open-${conditionId}`).click();
  await page.getByTestId('condition-add-button').click();
  await page
    .getByTestId('condition-add-menu')
    .getByTestId('menu-add-consultation')
    .click();
  await expect(page.getByTestId('condition-add-menu')).not.toBeVisible();
  await expect(
    page.getByTestId(`selected-condition-${conditionId}`)
  ).toBeVisible();
}

test.describe('Add Consultation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test(
    'should allow creating a linked Consultation from Condition and audit a11y',
    { tag: ['@smoke', '@critical'] },
    async ({ page }) => {
      let conditionId: string;

      await test.step('Seed a condition and navigate to it from Home', async () => {
        const cond = await seedTestCondition(page, {
          title: 'Cardiology Overview',
          status: 'active',
        });
        conditionId = cond.id;

        const condCard = page.getByTestId(`condition-card-${conditionId}`);
        await expect(condCard).toBeVisible();
        await page.getByTestId(`condition-open-${conditionId}`).click();

        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );
        await expect(page.getByTestId('condition-title')).toHaveText(
          'Cardiology Overview'
        );
      });

      await test.step('Open the Condition’s linked Consultation form', async () => {
        await openAddConsultationForCondition(page, conditionId);
        await expect(page.getByText('New Consultation')).toBeVisible();
        await checkA11y(page);
      });

      await test.step('Fill consultation form fields', async () => {
        const titleInput = page.getByTestId('consultation-title-input');
        await titleInput.fill('General Cardiology Review');

        await page.getByTestId('add-option-button').click();
        await page.getByTestId('menu-add-doctor').click();
        await expect(page.getByTestId('form-add-menu')).not.toBeVisible();
        const doctorInput = page.getByTestId('consultation-doctor-input');
        await doctorInput.fill('Dr. Marcus Welby');

        await page.getByTestId('add-option-button').click();
        await page.getByTestId('menu-add-notes').click();
        await expect(page.getByTestId('form-add-menu')).not.toBeVisible();
        const notesInput = page.getByTestId('consultation-notes-input');
        await notesInput.fill('Follow-up in 6 months. Blood pressure stable.');
      });

      await test.step('Save consultation and verify card in Condition view', async () => {
        await page.getByTestId('save-button').click();

        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );
        const consultationsSection = page.getByTestId(
          'condition-consultations-section'
        );
        await expect(consultationsSection).toBeVisible();
        await expect(
          consultationsSection.getByText('General Cardiology Review')
        ).toBeVisible();
        await expect(
          consultationsSection.getByText('Dr. Marcus Welby')
        ).toBeVisible();
        await expect(
          consultationsSection.getByText(
            '"Follow-up in 6 months. Blood pressure stable."'
          )
        ).toBeVisible();

        const consultationRow = page.getByTestId(
          /^condition-consultation-item-(?!.*-row$)/
        );
        await expect(consultationRow).toBeVisible();
        await consultationRow.click();
        await expect(page).toHaveURL(/.*consultation\/.*$/);
        await expect(page.getByTestId('consultation-title')).toHaveText(
          'General Cardiology Review'
        );
      });

      await test.step('Verify consultation is listed on Home view', async () => {
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
    'should autocomplete doctor name from previously saved records',
    { tag: ['@smoke'] },
    async ({ page }) => {
      let conditionId: string;

      await test.step('Seed prior consultation with a doctor under a condition', async () => {
        const cond = await seedTestCondition(page, {
          title: 'Chronic Migraine',
        });
        conditionId = cond.id;
        await seedTestConsultation(page, {
          conditionIds: [conditionId],
          title: 'Initial Consultation',
          doctorName: 'Dr. Gregory House',
          date: '2026-10-01',
        });
      });

      await test.step('Open the Condition’s linked Consultation form', async () => {
        await openAddConsultationForCondition(page, conditionId);

        await page.getByTestId('add-option-button').click();
        await page.getByTestId('menu-add-doctor').click();
        await expect(page.getByTestId('form-add-menu')).not.toBeVisible();

        const doctorInput = page.getByTestId('consultation-doctor-input');
        await doctorInput.click();
        await doctorInput.fill('Greg');

        const suggestion = page.getByTestId('doctor-autocomplete-item-0');
        await expect(suggestion).toBeVisible();
        await expect(suggestion).toHaveText('Dr. Gregory House');

        await suggestion.click();
        await expect(doctorInput).toHaveValue('Dr. Gregory House');
      });
    }
  );

  test(
    'should verify separate Condition View and Condition Edit flows',
    { tag: ['@critical'] },
    async ({ page }) => {
      let conditionId: string;

      await test.step('Seed a condition with a consultation', async () => {
        const cond = await seedTestCondition(page, {
          title: 'Knee Osteoarthritis',
          status: 'active',
        });
        conditionId = cond.id;
        await seedTestConsultation(page, {
          conditionIds: [conditionId],
          title: 'Knee Arthroscopy Review',
          doctorName: 'Dr. John Doe',
        });
      });

      await test.step('Open Condition View and navigate to Condition Edit', async () => {
        await page.getByTestId(`condition-open-${conditionId}`).click();
        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );

        // Consultations and floating + are in Condition View
        await expect(
          page.getByTestId('condition-consultations-section')
        ).toBeVisible();
        await expect(page.getByTestId('condition-add-button')).toBeVisible();

        // Click edit condition button
        await page.getByTestId('edit-condition-button').click();
        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}\\/edit`)
        );

        // Consultations and floating + are NOT in Condition Edit
        await expect(
          page.getByTestId('condition-consultations-section')
        ).not.toBeVisible();
        await expect(
          page.getByTestId('condition-add-button')
        ).not.toBeVisible();
      });

      await test.step('Edit condition in Condition Edit and save', async () => {
        const titleInput = page.getByTestId('condition-title-input');
        await titleInput.fill('Updated Knee Osteoarthritis');
        await page.getByTestId('save-button').click();

        // Returns to Condition View
        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );
        await expect(page.getByTestId('condition-title')).toHaveText(
          'Updated Knee Osteoarthritis'
        );
        await expect(
          page.getByTestId('condition-consultations-section')
        ).toBeVisible();
      });
    }
  );

  test(
    'should allow creating a standalone Consultation from Home view floating menu',
    { tag: ['@smoke', '@critical'] },
    async ({ page }) => {
      await test.step('Open floating menu on Home view and select Add Consultation', async () => {
        await page.goto('/');
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
        const doctorInput = page.getByTestId('consultation-doctor-input');
        await doctorInput.fill('Dr. Beverly Crusher');

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
        await expect(page.getByText('Dr. Beverly Crusher')).toBeVisible();
      });

      await test.step('Open the new standalone consultation view from Home', async () => {
        await page.getByRole('button', { name: /^View consultation:/ }).click();
        await expect(page).toHaveURL(/.*consultation\/.*$/);
        const view = page.getByTestId('consultation-view');
        await expect(view.getByTestId('consultation-title')).toHaveText(
          'Annual Physical Exam'
        );
        await expect(view.getByText('Dr. Beverly Crusher')).toBeVisible();
      });
    }
  );

  test(
    'should support future date, optional consultation time, serviceType, and removable condition',
    { tag: ['@smoke', '@critical'] },
    async ({ page }) => {
      let conditionId: string;

      await test.step('Seed a condition and open its linked Consultation form', async () => {
        const cond = await seedTestCondition(page, {
          title: 'Heart Health Review',
          status: 'active',
        });
        conditionId = cond.id;
        await openAddConsultationForCondition(page, conditionId);
        await expect(page.getByText('New Consultation')).toBeVisible();
      });

      await test.step('Verify conditions section supports individual and whole-section removal', async () => {
        const conditionPill = page.getByTestId(
          `selected-condition-${conditionId}`
        );
        await expect(conditionPill).toBeVisible();
        await expect(conditionPill).toContainText('Heart Health Review');

        // Remove condition
        const removeCondBtn = page.getByTestId('remove-condition-button');
        await expect(removeCondBtn).toBeVisible();
        await removeCondBtn.click();

        await expect(conditionPill).not.toBeVisible();

        await expect(
          page.getByTestId('consultation-conditions-section')
        ).toBeVisible();
        await expect(page.getByTestId('condition-search-input')).toBeVisible();
        await page.getByTestId('remove-conditions-section-button').click();
        await expect(
          page.getByTestId('consultation-conditions-section')
        ).not.toBeVisible();

        // Re-add condition via + menu
        await page.getByTestId('add-option-button').click();
        const addCondMenu = page.getByTestId('menu-add-condition');
        await expect(addCondMenu).toBeVisible();
        await addCondMenu.click();
        await page.getByTestId('condition-search-input').click();
        await page
          .getByTestId(`condition-autocomplete-item-${conditionId}`)
          .click();

        await expect(conditionPill).toBeVisible();
      });

      await test.step('Set future consultation date without validation restriction', async () => {
        const dateInput = page.locator('#consultation-date');
        await dateInput.fill('2028-11-20');
        await expect(page.getByTestId('date-picker-button')).toContainText(
          '2028'
        );
      });

      await test.step('Add consultation time via + menu', async () => {
        await page.getByTestId('add-option-button').click();
        await page.getByTestId('menu-add-time').click();
        await expect(page.getByTestId('form-add-menu')).not.toBeVisible();

        const timePicker = page.getByTestId('time-picker-button');
        await expect(timePicker).toBeVisible();

        const timeInput = page.locator('#consultation-time');
        await timeInput.fill('15:45');
        await expect(timePicker).toContainText('15:45');
      });

      await test.step('Add serviceType via + menu and select autocomplete', async () => {
        await page.getByTestId('add-option-button').click();
        await page.getByTestId('menu-add-service-type').click();
        await expect(page.getByTestId('form-add-menu')).not.toBeVisible();

        const serviceTypeInput = page.getByTestId(
          'consultation-service-type-input'
        );
        await expect(serviceTypeInput).toBeVisible();
        await serviceTypeInput.fill('Cardio');

        const suggestion = page.getByTestId('service-type-autocomplete-item-0');
        await expect(suggestion).toBeVisible();
        await expect(suggestion).toHaveText('Cardiology');
        await suggestion.click();

        await expect(serviceTypeInput).toHaveValue('Cardiology');
      });

      await test.step('Fill title and save consultation', async () => {
        const titleInput = page.getByTestId('consultation-title-input');
        await titleInput.fill('Future Cardiology Assessment');

        await page.getByTestId('save-button').click();

        await expect(page).toHaveURL(
          new RegExp(`.*condition\\/${conditionId}`)
        );
      });

      await test.step('Verify consultation details render on Condition View', async () => {
        const consultationsSection = page.getByTestId(
          'condition-consultations-section'
        );
        await expect(consultationsSection).toBeVisible();
        await expect(
          consultationsSection.getByText('Future Cardiology Assessment')
        ).toBeVisible();
        await expect(
          consultationsSection.getByText('Cardiology', { exact: true })
        ).toBeVisible();
        await expect(
          consultationsSection.getByText(/Nov 20, 2028.*15:45/)
        ).toBeVisible();
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
    await page.goto(`/consultation/add?conditionId=${reason.id}`);
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
    await page.goto(`/consultation/${stored.encounter.id}`);
    await expect(page.getByTestId('consultation-reasons')).toContainText(
      'Reasons for visit'
    );
    await expect(page.getByTestId('consultation-diagnoses')).toContainText(
      'Diagnoses'
    );
    await page.reload();
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
  await page.goto('/consultation/add');
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
  await page.goto('/consultation/add');
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

test('rejects foreign references for either list and retains diagnosis text when its Condition is deleted', async ({
  page,
}) => {
  await seedTestPatient(page, { id: 'foreign-patient' });
  await seedTestCondition(page, {
    id: 'foreign-condition',
    title: 'Foreign condition',
  });
  await seedTestPatient(page, { id: 'owner-patient' });
  await seedTestCondition(page, {
    id: 'owned-condition',
    title: 'Reason condition',
  });
  const result = await page.evaluate(async () => {
    const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
    const rejected: boolean[] = [];
    for (const extra of [
      { reasonConditionIds: ['foreign-condition'] },
      { diagnoses: [{ title: 'Outcome', conditionId: 'foreign-condition' }] },
    ]) {
      try {
        await bridge.saveConsultation({
          patientId: 'owner-patient',
          title: 'Denied',
          date: '2026-10-13',
          ...extra,
        });
        rejected.push(false);
      } catch {
        rejected.push(true);
      }
    }
    const encounter = await bridge.saveConsultation({
      id: 'separate-owned',
      patientId: 'owner-patient',
      title: 'Review',
      date: '2026-10-13',
      reasonConditionIds: ['owned-condition'],
      diagnoses: [
        {
          title: 'Separate outcome',
          conditionId: 'owned-condition',
          terminology: { code: 'L21' },
        },
      ],
    });
    await bridge.deleteCondition('owned-condition');
    return {
      rejected,
      encounter,
      cleaned: await bridge.getConsultation(encounter.id),
    };
  });
  expect(result.rejected).toEqual([true, true]);
  expect(result.cleaned.reason).toBeUndefined();
  expect(result.cleaned.diagnosis).toEqual([
    {
      condition: [
        { concept: { text: 'Separate outcome', coding: [{ code: 'L21' }] } },
      ],
    },
  ]);
  await page.goto('/consultation/separate-owned');
  await expect(page.getByTestId('consultation-diagnoses')).toContainText(
    'Separate outcome'
  );
  await expect(page.getByTestId('consultation-reasons')).toHaveCount(0);
});

test('records a service provider and reuses its Organization', async ({
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
    await page.goto('/consultation/add');
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
    await page.goto(`/consultation/${id}`);
    await expect(
      page.getByTestId('consultation-service-provider')
    ).toContainText('City Hospital');
  });

  await test.step('Reuse it from autocomplete', async () => {
    await page.goto('/consultation/add');
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
});

test('scrolls a field added from the + menu into view and focuses it', async ({
  page,
}) => {
  await seedTestPatient(page);
  await page.goto('/consultation/add');
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
