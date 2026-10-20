/// <reference types="node" />
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

test.describe('Multiple consultation diagnoses', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestPatient(page, { id: 'diagnosis-patient' });
  });

  test('creates, edits and removes reason links through the form and every condition detail', async ({
    page,
  }) => {
    for (const [id, title] of [
      ['first', 'First diagnosis'],
      ['second', 'Second diagnosis'],
      ['third', 'Third diagnosis'],
    ]) {
      await seedTestCondition(page, { id, title });
    }
    await openRoute(page, '/consultation/add?conditionId=first');
    await page.getByTestId('consultation-title-input').fill('Combined review');
    await page.getByTestId('condition-search-input').fill('Third');
    await expect(
      page.getByTestId('condition-autocomplete-item-first')
    ).toHaveCount(0);
    await expect(
      page.getByTestId('condition-autocomplete-item-second')
    ).toHaveCount(0);
    await page.getByTestId('condition-autocomplete-item-third').click();
    await expect(page.getByTestId('condition-search-input')).toHaveValue('');
    await page.getByTestId('condition-search-input').click();
    await expect(
      page.getByTestId('condition-autocomplete-item-second')
    ).toBeVisible();
    await expect(
      page.getByTestId('condition-autocomplete-item-first')
    ).toHaveCount(0);
    await expect(
      page.getByTestId('condition-autocomplete-item-third')
    ).toHaveCount(0);
    await page.getByTestId('consultation-title-input').click();
    await checkA11y(page);
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/consultation\/add/);
    const rows = await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
        'SELECT id FROM consultations;'
      )
    );
    const id = rows[0].id;
    await openRoute(page, '/');
    await expect(page.getByTestId(`consultation-card-${id}`)).toHaveCount(1);
    for (const conditionId of ['first', 'third']) {
      await openRoute(page, `/condition/${conditionId}`);
      await expect(
        page.getByTestId(`condition-timeline-item-consultation-${id}`)
      ).toHaveCount(1);
    }
    await openRoute(page, `/consultation/${id}`);
    await expect(
      page.getByTestId('consultation-related-condition-row')
    ).toContainText('First diagnosis');
    await expect(
      page.getByTestId('consultation-related-condition-third-row')
    ).toContainText('Third diagnosis');
    await expect(
      page.getByTestId('consultation-related-condition-third')
    ).toBeVisible();
    await page.getByTestId('edit-consultation-button').click();
    await expect(page.getByTestId('selected-condition-third')).toBeVisible();
    await page.getByTestId('remove-condition-button').click();
    await page.getByTestId('consultation-title-input').fill('Updated review');
    await page.getByTestId('save-button').click();
    await expect(page.getByTestId('consultation-title')).toHaveText(
      'Updated review'
    );
    await reopenRoute(page);
    await expect(
      page.getByTestId('consultation-related-condition-row')
    ).toContainText('Third diagnosis');
    await openRoute(page, '/condition/first');
    await expect(
      page.getByTestId(`condition-timeline-item-consultation-${id}`)
    ).toHaveCount(0);
    await openRoute(page, `/consultation/${id}/edit`);
    await page.getByTestId('remove-conditions-section-button').click();
    await expect(
      page.getByTestId('consultation-conditions-section')
    ).toHaveCount(0);
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/\/edit$/);
    await openRoute(page, '/');
    await expect(page.getByTestId(`consultation-card-${id}`)).toHaveCount(1);
  });

  test('preserves FHIR metadata and reasons; rejects cross-patient links and rolls back a failed save', async ({
    page,
  }) => {
    for (const id of ['first', 'second'])
      await seedTestCondition(page, { id, title: id });
    const original = await seedTestConsultation(page, {
      id: 'preserved',
      title: 'Original',
      conditionIds: ['first', 'second'],
      notes: 'Retained notes',
    });
    await page.evaluate(async (encounter) => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      encounter.priority = { text: 'urgent' };
      encounter.status = 'unknown';
      encounter.text.status = 'additional';
      encounter.diagnosis[0].use = [{ text: 'primary' }];
      encounter.reason = [
        {
          use: [{ text: 'referral' }],
          value: [
            { concept: { text: 'Independent reason' } },
            { reference: { reference: 'Condition/first' } },
          ],
        },
      ];
      await bridge.saveEncounter(encounter, 'diagnosis-patient');
      await bridge.seedPatient({ id: 'other-patient', givenName: 'Other' });
      await bridge.seedCondition({
        id: 'foreign',
        patientId: 'other-patient',
        title: 'Foreign',
      });
      await bridge.seedPatient({
        id: 'diagnosis-patient',
        givenName: 'Synthetic',
      });
    }, original);
    const result = await page.evaluate(async () => {
      const bridge = (window as any).__HEALTHY_TEST_BRIDGE__;
      let rejected = false;
      try {
        await bridge.seedConsultation({
          id: 'preserved',
          title: 'Invalid',
          conditionIds: ['foreign'],
        });
      } catch {
        rejected = true;
      }
      await bridge.executeSql(
        "CREATE TRIGGER reject_diagnosis BEFORE INSERT ON consultation_conditions WHEN NEW.condition_id = 'second' BEGIN SELECT RAISE(ABORT, 'injected failure'); END;"
      );
      let rolledBack = false;
      try {
        await bridge.seedConsultation({
          id: 'preserved',
          title: 'Partial update',
          conditionIds: ['first', 'second'],
        });
      } catch {
        rolledBack = true;
      }
      await bridge.executeSql('DROP TRIGGER reject_diagnosis;');
      return {
        rejected,
        rolledBack,
        foreignRead: await bridge.getConsultation('preserved', 'other-patient'),
        encounter: await bridge.getConsultation('preserved'),
        links: await bridge.querySql(
          "SELECT condition_id FROM consultation_conditions WHERE consultation_id = 'preserved' ORDER BY condition_id;"
        ),
      };
    });
    expect(result.rejected).toBe(true);
    expect(result.rolledBack).toBe(true);
    expect(result.foreignRead).toBeNull();
    expect(result.encounter.type[0].text).toBe('Original');
    expect(result.links).toEqual([
      { condition_id: 'first' },
      { condition_id: 'second' },
    ]);
    await openRoute(page, '/consultation/preserved/edit');
    await page.getByTestId('consultation-title-input').fill('Edited');
    await page.getByTestId('save-button').click();
    await expect(page).not.toHaveURL(/\/edit$/);
    const edited = await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.getConsultation('preserved')
    );
    expect(edited.priority.text).toBe('urgent');
    expect(edited.status).toBe('unknown');
    expect(edited.text.status).toBe('additional');
    expect(edited.diagnosis[0].use[0].text).toBe('primary');
    expect(edited.reason[0].value[0].concept.text).toBe('Independent reason');
    await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.deleteCondition('first')
    );
    const cleaned = await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.getConsultation('preserved')
    );
    expect(cleaned.diagnosis).toEqual([
      { condition: [{ reference: { reference: 'Condition/second' } }] },
    ]);
    expect(cleaned.reason[0].value).toEqual([
      { concept: { text: 'Independent reason' } },
    ]);
    expect(cleaned.text.div).toContain('Retained notes');
    await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.deleteConsultation('preserved')
    );
    expect(
      await page.evaluate(() =>
        (window as any).__HEALTHY_TEST_BRIDGE__.querySql(
          'SELECT * FROM consultation_conditions;'
        )
      )
    ).toEqual([]);
  });

  test('migrates v7 once and rolls back invalid ownership without dropping the old column', async ({
    page,
  }) => {
    const migrated = await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.verifyDiagnosisMigration()
    );
    expect(migrated.failed).toBe(false);
    expect(migrated.version.user_version).toBeGreaterThanOrEqual(8);
    expect(migrated.repeatedVersion.user_version).toBeGreaterThanOrEqual(8);
    expect(migrated.columns).not.toContain('condition_id');
    expect(migrated.links).toEqual([
      { consultation_id: 'legacy', condition_id: 'first' },
      { consultation_id: 'legacy', condition_id: 'second' },
    ]);
    expect(migrated.encounter.meta.lastUpdated).toBe('2026-01-01T00:00:00Z');
    expect(migrated.encounter.text.div).toContain('Original notes');
    expect(migrated.encounter.diagnosis[0].use[0].text).toBe('secondary');
    expect(migrated.integrity).toEqual([]);
    const invalid = await page.evaluate(() =>
      (window as any).__HEALTHY_TEST_BRIDGE__.verifyDiagnosisMigration(true)
    );
    expect(invalid.failed).toBe(true);
    expect(invalid.version.user_version).toBe(7);
    expect(invalid.columns).toContain('condition_id');
    expect(invalid.links).toEqual([]);
    expect(invalid.encounter.diagnosis).toEqual([
      {
        condition: [{ reference: { reference: 'Condition/second' } }],
        use: [{ text: 'secondary' }],
      },
    ]);
  });
});
