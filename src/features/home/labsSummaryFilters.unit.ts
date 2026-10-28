import { test, expect } from '@playwright/test';
import {
  DEFAULT_LABS_SUMMARY_FILTERS,
  hasLabsSummaryFilters,
  parseLabsSummaryFilters,
} from './labsSummaryFilters';

test('reads saved filters, dropping periods and sorts it no longer has', () => {
  expect(parseLabsSummaryFilters({ period: '12', sort: 'oldest' })).toEqual({
    period: '12',
    sort: 'oldest',
  });
  // 1 month and Lowest were offered before.
  expect(parseLabsSummaryFilters({ period: '1', sort: 'lowest' })).toEqual(
    DEFAULT_LABS_SUMMARY_FILTERS
  );
  expect(parseLabsSummaryFilters(null)).toBeNull();
});

test('knows when the period or sort differs from the default', () => {
  expect(hasLabsSummaryFilters(DEFAULT_LABS_SUMMARY_FILTERS)).toBe(false);
  expect(
    hasLabsSummaryFilters({ ...DEFAULT_LABS_SUMMARY_FILTERS, period: '6' })
  ).toBe(true);
  expect(
    hasLabsSummaryFilters({ ...DEFAULT_LABS_SUMMARY_FILTERS, sort: 'newest' })
  ).toBe(true);
});
