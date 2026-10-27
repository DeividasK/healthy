import type {
  DiagnosticReport,
  Encounter,
  MedicationRequest,
  ServiceRequest,
} from 'fhir/r5';
import { formatLocalDate, parseLocalDate } from '@/src/utils/dateUtils';

/**
 * How a timeline step reads at a glance: still to come, under way, paused,
 * finished, or called off (shown faded).
 */
export type StatusTone = 'planned' | 'active' | 'paused' | 'done' | 'faded';

export type TimelineItem = { date?: string; tone: StatusTone } & (
  | { type: 'consultation'; resource: Encounter }
  | { type: 'serviceRequest'; resource: ServiceRequest }
  | { type: 'treatment'; resource: MedicationRequest }
  | { type: 'labResult'; resource: DiagnosticReport }
);

export interface TimelineGroup {
  /** e.g. "October 2026", or "No date" for undated steps. */
  label: string;
  items: TimelineItem[];
}

const TONES: Record<TimelineItem['type'], Record<string, StatusTone>> = {
  consultation: {
    planned: 'planned',
    'in-progress': 'active',
    'on-hold': 'paused',
    completed: 'done',
    discharged: 'done',
    cancelled: 'faded',
    discontinued: 'faded',
    'entered-in-error': 'faded',
  },
  serviceRequest: {
    draft: 'planned',
    active: 'active',
    'on-hold': 'paused',
    completed: 'done',
    revoked: 'faded',
    'entered-in-error': 'faded',
  },
  treatment: {
    draft: 'planned',
    active: 'active',
    'on-hold': 'paused',
    completed: 'done',
    ended: 'done',
    stopped: 'faded',
    cancelled: 'faded',
    'entered-in-error': 'faded',
  },
  labResult: {
    registered: 'planned',
    partial: 'active',
    preliminary: 'active',
    modified: 'done',
    final: 'done',
    amended: 'done',
    corrected: 'done',
    appended: 'done',
    cancelled: 'faded',
    'entered-in-error': 'faded',
  },
};

/** The tone of a FHIR status; unknown or missing statuses read as done. */
export function getStatusTone(
  type: TimelineItem['type'],
  status: string | undefined
): StatusTone {
  return (status && TONES[type][status]) || 'done';
}

/**
 * Within a day, outcomes are listed above the visit that produced them:
 * results, then treatments, then requests, then the consultation.
 */
const SAME_DAY_ORDER: TimelineItem['type'][] = [
  'labResult',
  'treatment',
  'serviceRequest',
  'consultation',
];

function compareItems(a: TimelineItem, b: TimelineItem) {
  if (!a.date || !b.date) return a.date ? -1 : b.date ? 1 : 0;
  const day = b.date.slice(0, 10).localeCompare(a.date.slice(0, 10));
  if (day) return day;
  const type = SAME_DAY_ORDER.indexOf(a.type) - SAME_DAY_ORDER.indexOf(b.type);
  if (type) return type;
  return b.date.localeCompare(a.date);
}

function monthLabel(date: string) {
  return parseLocalDate(date).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Which steps the timeline shows. Empty tone and type lists match every
 * step; a period other than `all` leaves out undated steps.
 */
export interface TimelineFilters {
  tones: StatusTone[];
  types: TimelineItem['type'][];
  period: TimelinePeriod;
}

export type TimelinePeriod = 'all' | 'upcoming' | 'past3' | 'past6' | 'past12';

export const NO_TIMELINE_FILTERS: TimelineFilters = {
  tones: [],
  types: [],
  period: 'all',
};

export const DEFAULT_TIMELINE_FILTERS: TimelineFilters = {
  tones: ['active', 'planned'],
  types: [],
  period: 'all',
};

const SAVED_TONES: StatusTone[] = [
  'planned',
  'active',
  'paused',
  'done',
  'faded',
];
const TYPES = Object.keys(TONES) as TimelineItem['type'][];
const PERIODS: TimelinePeriod[] = [
  'all',
  'upcoming',
  'past3',
  'past6',
  'past12',
];

/** Saved timeline filters, without options the timeline no longer has. */
export function parseTimelineFilters(saved: unknown): TimelineFilters | null {
  if (!saved || typeof saved !== 'object') return null;
  const { tones, types, period } = saved as Partial<Record<string, unknown>>;
  if (!Array.isArray(tones) || !Array.isArray(types)) return null;
  return {
    tones: SAVED_TONES.filter((tone) => tones.includes(tone)),
    types: TYPES.filter((type) => types.includes(type)),
    period: PERIODS.find((id) => id === period) ?? 'all',
  };
}

export function hasTimelineFilters(filters: TimelineFilters) {
  return (
    filters.tones.length > 0 ||
    filters.types.length > 0 ||
    filters.period !== 'all'
  );
}

const PAST_MONTHS: Partial<Record<TimelinePeriod, number>> = {
  past3: 3,
  past6: 6,
  past12: 12,
};

function inPeriod(
  date: string | undefined,
  period: TimelinePeriod,
  today: string
) {
  if (period === 'all') return true;
  if (!date) return false;
  const day = date.slice(0, 10);
  if (period === 'upcoming') return day > today;
  const start = parseLocalDate(today);
  start.setMonth(start.getMonth() - (PAST_MONTHS[period] ?? 0));
  return day >= formatLocalDate(start) && day <= today;
}

/** The steps matching every filter, in their original order. */
export function filterTimelineItems(
  items: TimelineItem[],
  filters: TimelineFilters,
  today = formatLocalDate(new Date())
) {
  return items.filter(
    (item) =>
      (!filters.tones.length || filters.tones.includes(item.tone)) &&
      (!filters.types.length || filters.types.includes(item.type)) &&
      inPeriod(item.date, filters.period, today)
  );
}

/**
 * Every step related to a condition, newest first. Each step is dated as its
 * meta line is; undated steps come last.
 */
export function buildTimelineItems({
  consultations = [],
  serviceRequests = [],
  treatments = [],
  labResults = [],
}: {
  consultations?: Encounter[];
  serviceRequests?: ServiceRequest[];
  treatments?: MedicationRequest[];
  labResults?: DiagnosticReport[];
}): TimelineItem[] {
  return [
    ...consultations.map((resource): TimelineItem => ({
      type: 'consultation',
      resource,
      date: resource.actualPeriod?.start || resource.plannedStartDate,
      tone: getStatusTone('consultation', resource.status),
    })),
    ...serviceRequests.map((resource): TimelineItem => ({
      type: 'serviceRequest',
      resource,
      date: resource.authoredOn,
      tone: getStatusTone('serviceRequest', resource.status),
    })),
    ...treatments.map((resource): TimelineItem => ({
      type: 'treatment',
      resource,
      date: resource.authoredOn,
      tone: getStatusTone('treatment', resource.status),
    })),
    ...labResults.map((resource): TimelineItem => ({
      type: 'labResult',
      resource,
      date: resource.effectiveDateTime || resource.effectivePeriod?.start,
      tone: getStatusTone('labResult', resource.status),
    })),
  ].sort(compareItems);
}

/** Sorted steps grouped by month, with undated steps under "No date". */
export function groupTimelineItems(items: TimelineItem[]): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  for (const item of items) {
    const label = item.date ? monthLabel(item.date) : 'No date';
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

/** Every step related to a condition, newest first, grouped by month. */
export function buildConditionTimeline(
  resources: Parameters<typeof buildTimelineItems>[0]
): TimelineGroup[] {
  return groupTimelineItems(buildTimelineItems(resources));
}
