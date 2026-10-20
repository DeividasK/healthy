import {
  test,
  expect,
  seedTestPatient,
  seedTestCondition,
  seedTestTreatment,
  getTestTreatment,
  getBrowserLocalDate,
  checkA11y,
} from '@/src/features/testing/testStorage';

test.describe('Edit Treatment Flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page);
  });

  test('edits fields, regenerates the narrative and associates multiple conditions', async ({
    page,
  }) => {
    const first = await seedTestCondition(page, { title: 'Hypertension' });
    const second = await seedTestCondition(page, { title: 'Kidney disease' });
    const treatment = await seedTestTreatment(page, {
      title: 'Amoxicillin 500mg',
      intent: 'order',
      status: 'active',
      reason: 'Blood pressure',
      reasonConditionIds: [first.id],
    });
    const before = await getTestTreatment(page, treatment.id);
    expect(before.text.div).toContain('Amoxicillin 500mg');

    await page.goto(`/treatment/${treatment.id}`);
    await page.getByTestId('edit-treatment-button').click();
    await expect(page).toHaveURL(/.*treatment\/[a-zA-Z0-9_-]+\/edit$/);
    await expect(
      page.getByTestId(`treatment-selected-condition-${first.id}`)
    ).toBeVisible();

    await page.getByTestId('treatment-title-input').fill('Lisinopril 10mg');
    await page.getByTestId('treatment-status-select').selectOption('completed');
    await page.getByTestId('treatment-condition-search-input').click();
    await page
      .getByTestId(`treatment-condition-autocomplete-item-${second.id}`)
      .click();
    await checkA11y(page, { include: '[data-testid="treatment-form"]' });
    await page.getByTestId('save-treatment-button').click();

    await expect(page.getByTestId('treatment-title')).toHaveText(
      'Lisinopril 10mg'
    );
    await expect(
      page.getByTestId('treatment-view').getByText('Completed')
    ).toBeVisible();
    const section = page.getByTestId('treatment-reason-conditions-section');
    await expect(section).toContainText('Hypertension');
    await expect(section).toContainText('Kidney disease');

    const edited = await getTestTreatment(page, treatment.id);
    expect(edited.text.div).toContain('Lisinopril 10mg');
    expect(edited.text.div).not.toContain('Amoxicillin');
    expect(
      edited.reason.map((reason: any) => reason.reference?.reference)
    ).toEqual([undefined, `Condition/${first.id}`, `Condition/${second.id}`]);

    // Removing one condition keeps the other
    await page.getByTestId('edit-treatment-button').click();
    await page.getByTestId('treatment-remove-condition-button').click();
    await page.getByTestId('save-treatment-button').click();
    await expect(section).not.toContainText('Hypertension');
    await expect(section).toContainText('Kidney disease');

    // Removing the field clears only the links; the wording stays
    await page.getByTestId('edit-treatment-button').click();
    await page.getByTestId('remove-treatment-reasonCondition-button').click();
    await page.getByTestId('save-treatment-button').click();
    await expect(section).toHaveCount(0);
    const cleared = await getTestTreatment(page, treatment.id);
    expect(cleared.reason).toEqual([{ concept: { text: 'Blood pressure' } }]);
  });

  test('labels uncommon intent and status codes instead of hiding them', async ({
    page,
  }) => {
    const treatment = await seedTestTreatment(page, {
      title: 'Imported treatment',
      intent: 'proposal',
      status: 'on-hold',
    });
    await page.goto(`/treatment/${treatment.id}`);
    await expect(page.getByTestId('treatment-intent')).toHaveText('Proposal');
    await expect(
      page.getByTestId('treatment-view').getByText('On Hold')
    ).toBeVisible();

    await page.getByTestId('edit-treatment-button').click();
    await expect(page.getByTestId('treatment-intent-select')).toHaveValue(
      'proposal'
    );
    await expect(
      page.getByTestId('treatment-intent-select').locator('option:checked')
    ).toHaveText('Proposal');
  });

  test('keeps regimen data the form does not show and edits only what changed', async ({
    page,
  }) => {
    const seeded = await seedTestTreatment(page, { title: 'Methotrexate' });
    const stored = {
      ...seeded,
      contained: [
        { resourceType: 'Medication', id: 'med', code: { text: 'MTX 2.5mg' } },
      ],
      extension: [{ url: 'https://example.org/kept', valueString: 'kept' }],
      dosageInstruction: [
        {
          sequence: 1,
          additionalInstruction: [{ text: 'Avoid alcohol' }],
          maxDosePerPeriod: [
            { numerator: { value: 4 }, denominator: { value: 1, unit: 'wk' } },
          ],
          doseAndRate: [
            {
              type: { text: 'ordered' },
              doseQuantity: { value: 4, unit: 'tablet', code: '{tablet}' },
            },
            { rateQuantity: { value: 1, unit: 'mL/h' } },
          ],
          timing: {
            code: { text: 'Weekly' },
            repeat: {
              frequency: 1,
              period: 1,
              periodUnit: 'wk',
              dayOfWeek: ['mon'],
              timeOfDay: ['08:00:00'],
            },
          },
        },
      ],
      dispenseRequest: {
        numberOfRepeatsAllowed: 2,
        quantity: { value: 24, unit: 'tablet', code: '{tablet}' },
      },
    };
    await page.evaluate(
      (request) =>
        (window as any).__HEALTHY_TEST_BRIDGE__.saveTreatment(
          request,
          request.subject.reference.slice(8)
        ),
      stored
    );

    await page.goto(`/treatment/${seeded.id}/edit`);
    await expect(
      page.getByTestId('treatment-regimen-p1-d1-amount-input')
    ).toHaveValue('4');
    await expect(
      page.getByTestId('treatment-dispenseQuantity-input')
    ).toHaveValue('24');
    await page.getByTestId('treatment-title-input').fill('Methotrexate 2.5mg');
    await page.getByTestId('save-treatment-button').click();
    await expect(page.getByTestId('treatment-title')).toHaveText(
      'Methotrexate 2.5mg'
    );
    const unrelated = await getTestTreatment(page, seeded.id);
    expect(unrelated.dosageInstruction).toEqual(stored.dosageInstruction);
    expect(unrelated.dispenseRequest).toEqual(stored.dispenseRequest);
    expect(unrelated.contained).toEqual(stored.contained);
    expect(unrelated.extension).toEqual(stored.extension);

    await page.getByTestId('edit-treatment-button').click();
    await page.getByTestId('treatment-regimen-p1-d1-amount-input').fill('6');
    await page.getByTestId('save-treatment-button').click();
    await expect(page.getByTestId('treatment-dosage')).toContainText(
      '6 tablets'
    );
    const edited = await getTestTreatment(page, seeded.id);
    expect(edited.dosageInstruction).toEqual([
      {
        ...stored.dosageInstruction[0],
        doseAndRate: [
          {
            type: { text: 'ordered' },
            doseQuantity: { value: 6, unit: 'tablet', code: '{tablet}' },
          },
          { rateQuantity: { value: 1, unit: 'mL/h' } },
        ],
      },
    ]);
  });

  test('switches between text instructions and a regimen', async ({ page }) => {
    const treatment = await seedTestTreatment(page, {
      title: 'Ibuprofen',
      dosageInstructions: 'As needed for pain',
    });
    const openMenu = async () => {
      await page.getByTestId('add-option-button').click();
      await expect(page.getByTestId('form-add-menu')).toBeVisible();
    };
    await page.goto(`/treatment/${treatment.id}/edit`);
    await expect(page.getByTestId('treatment-instructions-input')).toHaveValue(
      'As needed for pain'
    );
    await openMenu();
    await expect(page.getByTestId('menu-add-treatment-regimen')).toHaveCount(0);
    await page.getByTestId('add-option-button').click();
    await expect(page.getByTestId('form-add-menu')).toHaveCount(0);

    await page.getByTestId('remove-treatment-instructions-button').click();
    await openMenu();
    await page.getByTestId('menu-add-treatment-regimen').click();
    await page.getByTestId('treatment-regimen-p1-d1-amount-input').fill('1');
    await page.getByTestId('treatment-regimen-p1-d1-frequency-input').fill('3');
    await page.getByTestId('save-treatment-button').click();
    await expect(page.getByTestId('treatment-dosage')).toHaveText(
      '1 tablet, 3 times a day'
    );
    const structured = await getTestTreatment(page, treatment.id);
    expect(structured.dosageInstruction).toHaveLength(1);
    expect(structured.dosageInstruction[0].text).toBeUndefined();

    await page.getByTestId('edit-treatment-button').click();
    await page.getByTestId('remove-treatment-regimen-button').click();
    await openMenu();
    await page.getByTestId('menu-add-treatment-instructions').click();
    await page
      .getByTestId('treatment-instructions-input')
      .fill('Back to plain text');
    await page.getByTestId('save-treatment-button').click();
    await expect(page.getByTestId('treatment-dosage')).toHaveText(
      'Back to plain text'
    );
    const text = await getTestTreatment(page, treatment.id);
    expect(text.dosageInstruction).toEqual([{ text: 'Back to plain text' }]);
  });

  test('keeps imported text stored beside a regimen', async ({ page }) => {
    const seeded = await seedTestTreatment(page, {
      title: 'Imported regimen',
      dosageInstructions: 'One each morning',
    });
    seeded.dosageInstruction[0].timing = { repeat: { when: ['MORN'] } };
    await page.evaluate(
      (request) =>
        (window as any).__HEALTHY_TEST_BRIDGE__.saveTreatment(
          request,
          request.subject.reference.slice(8)
        ),
      seeded
    );
    await page.goto(`/treatment/${seeded.id}`);
    // Both are shown under the one Dosage heading
    await expect(page.getByTestId('treatment-dosage')).toHaveText(
      'One each morning\nin the morning'
    );

    await page.getByTestId('edit-treatment-button').click();
    await expect(page.getByTestId('treatment-instructions-input')).toHaveCount(
      0
    );
    await expect(
      page.getByTestId('treatment-regimen-p1-d1-when-select')
    ).toHaveValue('MORN');
    await page.getByTestId('treatment-title-input').fill('Imported, renamed');
    await page.getByTestId('save-treatment-button').click();
    await expect(page.getByTestId('treatment-title')).toHaveText(
      'Imported, renamed'
    );
    const kept = await getTestTreatment(page, seeded.id);
    expect(kept.dosageInstruction).toEqual(seeded.dosageInstruction);
  });

  test("cannot move the treatment's date past the day taking it started", async ({
    page,
    consoleMonitor,
  }) => {
    // The form logs the refused save before showing it.
    consoleMonitor.ignore('Failed to save treatment:');
    const [twoAgo, yesterday, today] = await Promise.all(
      [-2, -1, 0].map((offset) => getBrowserLocalDate(page, offset))
    );
    const treatment = await seedTestTreatment(page, {
      title: 'Vitamin D',
      authoredOn: twoAgo,
      takingSince: yesterday,
    });
    await page.goto(`/treatment/${treatment.id}/edit`);
    await page
      .getByTestId('treatment-date-picker')
      .locator('input')
      .fill(today);
    await page.getByTestId('save-treatment-button').click();
    await expect(page.getByTestId('treatment-form-error')).toHaveText(
      `The date cannot be after usage started, ${yesterday}`
    );
    expect((await getTestTreatment(page, treatment.id)).authoredOn).toBe(
      twoAgo
    );
  });
});
