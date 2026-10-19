import { test, expect } from '@playwright/test';
import type {
  DiagnosticReport,
  Encounter,
  MedicationRequest,
  ServiceRequest,
} from 'fhir/r5';
import {
  NO_TIMELINE_FILTERS,
  buildConditionTimeline,
  buildTimelineItems,
  filterTimelineItems,
  getStatusTone,
  hasTimelineFilters,
} from './conditionTimeline';

const subject = { reference: 'Patient/p1' };

const consultation = (
  id: string,
  start?: string,
  status: Encounter['status'] = 'completed'
): Encounter => ({
  resourceType: 'Encounter',
  id,
  status,
  subject,
  ...(start ? { actualPeriod: { start } } : {}),
});

const request = (
  id: string,
  authoredOn?: string,
  status: ServiceRequest['status'] = 'active'
): ServiceRequest => ({
  resourceType: 'ServiceRequest',
  id,
  status,
  intent: 'order',
  subject,
  authoredOn,
});

const treatment = (
  id: string,
  authoredOn?: string,
  status: MedicationRequest['status'] = 'active'
): MedicationRequest => ({
  resourceType: 'MedicationRequest',
  id,
  status,
  intent: 'order',
  subject,
  medication: { concept: { text: id } },
  authoredOn,
});

const labResult = (
  id: string,
  effectiveDateTime?: string,
  status: DiagnosticReport['status'] = 'final'
): DiagnosticReport => ({
  resourceType: 'DiagnosticReport',
  id,
  status,
  code: { text: 'Laboratory report' },
  subject,
  effectiveDateTime,
});

const ids = (groups: ReturnType<typeof buildConditionTimeline>) =>
  groups.map((group) => [
    group.label,
    group.items.map((item) => item.resource.id),
  ]);

test('lists steps newest first, grouped by month, with undated steps last', () => {
  const groups = buildConditionTimeline({
    consultations: [
      consultation('gp', '2026-09-02T14:15:00'),
      consultation('undated'),
      consultation('review', '2026-11-03T09:30:00', 'planned'),
    ],
    serviceRequests: [request('physio', '2026-09-12')],
    treatments: [treatment('ibuprofen', '2026-10-04')],
    labResults: [labResult('cbc', '2026-10-05T08:15:00')],
  });
  expect(ids(groups)).toEqual([
    ['November 2026', ['review']],
    ['October 2026', ['cbc', 'ibuprofen']],
    ['September 2026', ['physio', 'gp']],
    ['No date', ['undated']],
  ]);
});

test('lists outcomes above the visit that produced them on the same day', () => {
  const groups = buildConditionTimeline({
    consultations: [
      consultation('morning', '2026-10-04T09:00:00'),
      consultation('afternoon', '2026-10-04T15:00:00'),
    ],
    serviceRequests: [request('mri', '2026-10-04')],
    treatments: [treatment('ibuprofen', '2026-10-04')],
    labResults: [labResult('cbc', '2026-10-04')],
  });
  expect(ids(groups)).toEqual([
    ['October 2026', ['cbc', 'ibuprofen', 'mri', 'afternoon', 'morning']],
  ]);
});

test('dates consultations by their planned start when not yet held', () => {
  const planned: Encounter = {
    ...consultation('planned', undefined, 'planned'),
    plannedStartDate: '2026-12-01T10:00:00',
  };
  expect(ids(buildConditionTimeline({ consultations: [planned] }))).toEqual([
    ['December 2026', ['planned']],
  ]);
});

test('maps each type’s FHIR statuses to tones', () => {
  expect(getStatusTone('consultation', 'planned')).toBe('planned');
  expect(getStatusTone('consultation', 'in-progress')).toBe('active');
  expect(getStatusTone('consultation', 'on-hold')).toBe('paused');
  expect(getStatusTone('consultation', 'completed')).toBe('done');
  expect(getStatusTone('consultation', 'cancelled')).toBe('faded');
  expect(getStatusTone('serviceRequest', 'draft')).toBe('planned');
  expect(getStatusTone('serviceRequest', 'active')).toBe('active');
  expect(getStatusTone('serviceRequest', 'revoked')).toBe('faded');
  expect(getStatusTone('treatment', 'on-hold')).toBe('paused');
  expect(getStatusTone('treatment', 'ended')).toBe('done');
  expect(getStatusTone('treatment', 'stopped')).toBe('faded');
  expect(getStatusTone('labResult', 'registered')).toBe('planned');
  expect(getStatusTone('labResult', 'preliminary')).toBe('active');
  expect(getStatusTone('labResult', 'final')).toBe('done');
  expect(getStatusTone('labResult', 'entered-in-error')).toBe('faded');
  expect(getStatusTone('treatment', 'unknown')).toBe('done');
  expect(getStatusTone('labResult', undefined)).toBe('done');
});

test('filters steps by status tone, type and time period', () => {
  const items = buildTimelineItems({
    consultations: [
      consultation('review', '2026-11-03T09:30:00', 'planned'),
      consultation('gp', '2026-04-19T14:15:00'),
      consultation('undated'),
    ],
    serviceRequests: [request('physio', '2026-09-12')],
    treatments: [treatment('paracetamol', '2025-10-18', 'on-hold')],
    labResults: [labResult('cbc', '2026-10-19T08:15:00')],
  });
  const filter = (filters: Partial<typeof NO_TIMELINE_FILTERS>) =>
    filterTimelineItems(
      items,
      { ...NO_TIMELINE_FILTERS, ...filters },
      '2026-10-19'
    ).map((item) => item.resource.id);

  expect(filter({})).toEqual([
    'review',
    'cbc',
    'physio',
    'gp',
    'paracetamol',
    'undated',
  ]);
  expect(filter({ tones: ['planned', 'active'] })).toEqual([
    'review',
    'physio',
  ]);
  expect(filter({ types: ['consultation', 'labResult'] })).toEqual([
    'review',
    'cbc',
    'gp',
    'undated',
  ]);
  // Periods include today and their first day, and leave out undated steps
  expect(filter({ period: 'upcoming' })).toEqual(['review']);
  expect(filter({ period: 'past3' })).toEqual(['cbc', 'physio']);
  expect(filter({ period: 'past6' })).toEqual(['cbc', 'physio', 'gp']);
  expect(filter({ period: 'past12' })).toEqual(['cbc', 'physio', 'gp']);
  // Filters combine
  expect(
    filter({ types: ['consultation'], tones: ['done'], period: 'past12' })
  ).toEqual(['gp']);
  expect(filter({ tones: ['paused'], types: ['labResult'] })).toEqual([]);
});

test('knows when any filter is on', () => {
  expect(hasTimelineFilters(NO_TIMELINE_FILTERS)).toBe(false);
  expect(hasTimelineFilters({ ...NO_TIMELINE_FILTERS, tones: ['done'] })).toBe(
    true
  );
  expect(
    hasTimelineFilters({ ...NO_TIMELINE_FILTERS, types: ['treatment'] })
  ).toBe(true);
  expect(hasTimelineFilters({ ...NO_TIMELINE_FILTERS, period: 'past3' })).toBe(
    true
  );
});
