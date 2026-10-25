import { test, expect } from '@playwright/test';
import { withDefaults } from './profileSettings';

test('every stored journal order is kept only as a list of keys', () => {
  const { journalOrder } = withDefaults({
    journalOrder: {
      MORN: ['MedicationRequest/a', 3],
      '07:30': 'invalid',
      '09:00': ['MedicationRequest/b'],
    } as never,
  });
  expect(journalOrder).toEqual({
    MORN: ['MedicationRequest/a'],
    '09:00': ['MedicationRequest/b'],
  });
});
