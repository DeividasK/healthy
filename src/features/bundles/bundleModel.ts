import type {
  RequestOrchestration,
  RequestOrchestrationAction,
  TimingRepeat,
} from 'fhir/r5';
import {
  formatClockTime,
  getWhenLabel,
} from '@/src/features/treatments/regimen';

/**
 * A treatment bundle is a FHIR R5 RequestOrchestration with one action, the
 * bundle (`title`, `groupingBehavior: visual-group`), holding one sub-action
 * per time it is taken ("slot", with `timingTiming`), each holding one
 * sub-action per treatment (`resource`). A bundle without a time has a single
 * slot without timing. Every slot lists the same treatments.
 */

export type BundleWhen = NonNullable<TimingRepeat['when']>[number];

/** When a bundle is taken: a part of the day, or an exact clock time. */
export type BundleTime =
  { kind: 'when'; code: BundleWhen } | { kind: 'time'; time: string };

const bundleAction = (bundle: RequestOrchestration) => bundle.action?.[0];

export const getBundleTitle = (bundle: RequestOrchestration) =>
  bundleAction(bundle)?.title?.trim() || 'Bundle';

/** The slot actions of a bundle, in stored order. */
export const getBundleSlots = (
  bundle: RequestOrchestration
): RequestOrchestrationAction[] => bundleAction(bundle)?.action || [];

/** A slot's time, or null when the bundle has no time. */
export function getSlotTime(
  slot: RequestOrchestrationAction
): BundleTime | null {
  const repeat = slot.timingTiming?.repeat;
  if (repeat?.when?.length) return { kind: 'when', code: repeat.when[0] };
  if (repeat?.timeOfDay?.length)
    return { kind: 'time', time: formatClockTime(repeat.timeOfDay[0]) };
  return null;
}

export const getBundleTimes = (bundle: RequestOrchestration): BundleTime[] =>
  getBundleSlots(bundle).flatMap((slot) => {
    const time = getSlotTime(slot);
    return time ? [time] : [];
  });

const memberId = (action: RequestOrchestrationAction) => {
  const reference = action.resource?.reference;
  return reference?.startsWith('MedicationRequest/')
    ? reference.slice(18)
    : null;
};

/** The bundle's treatment ids, in order and without repeats. */
export function getBundleMemberIds(bundle: RequestOrchestration): string[] {
  const ids: string[] = [];
  for (const slot of getBundleSlots(bundle))
    for (const action of slot.action || []) {
      const id = memberId(action);
      if (id && !ids.includes(id)) ids.push(id);
    }
  return ids;
}

/** e.g. "Morning" or "07:30". */
export const formatBundleTime = (time: BundleTime) =>
  time.kind === 'when' ? getWhenLabel(time.code) : time.time;

/** A comparable key for a time, e.g. "when:MORN" or "time:07:30". */
export const getBundleTimeKey = (time: BundleTime | null) =>
  !time ? '' : time.kind === 'when' ? `when:${time.code}` : `time:${time.time}`;

export const isSameBundleTime = (a: BundleTime | null, b: BundleTime | null) =>
  getBundleTimeKey(a) === getBundleTimeKey(b);

const timingOf = (
  time: BundleTime
): RequestOrchestrationAction['timingTiming'] =>
  time.kind === 'when'
    ? { repeat: { when: [time.code] } }
    : { repeat: { timeOfDay: [`${time.time}:00`] } };

export interface BundleValues {
  title: string;
  times: BundleTime[];
  memberIds: string[];
}

/**
 * The bundle with the form's values, keeping elements the form does not
 * show: other RequestOrchestration elements, the bundle and slot actions'
 * other elements, and each kept treatment's action.
 */
export function buildBundle(
  values: BundleValues,
  {
    id,
    patientId,
    existing,
    now = new Date(),
  }: {
    id: string;
    patientId: string;
    existing?: RequestOrchestration | null;
    now?: Date;
  }
): RequestOrchestration {
  const action = bundleAction(existing ?? ({} as RequestOrchestration));
  const slots = existing ? getBundleSlots(existing) : [];
  const members = (slot?: RequestOrchestrationAction) =>
    values.memberIds.map(
      (memberIdValue) =>
        slot?.action?.find(
          (candidate) => memberId(candidate) === memberIdValue
        ) ?? {
          resource: {
            reference: `MedicationRequest/${memberIdValue}`,
            type: 'MedicationRequest',
          },
        }
    );
  const slotFor = (time: BundleTime | null, index: number) => {
    const source =
      slots.find((slot) => isSameBundleTime(getSlotTime(slot), time)) ??
      slots[index];
    const { timingTiming: _timing, action: _members, ...rest } = source ?? {};
    return {
      ...rest,
      ...(time && { timingTiming: timingOf(time) }),
      action: members(source),
    };
  };
  return {
    ...existing,
    resourceType: 'RequestOrchestration',
    id,
    status: existing?.status ?? 'active',
    intent: existing?.intent ?? 'plan',
    subject: { ...existing?.subject, reference: `Patient/${patientId}` },
    author: existing?.author ?? { reference: `Patient/${patientId}` },
    authoredOn: existing?.authoredOn ?? now.toISOString(),
    meta: { ...existing?.meta, lastUpdated: now.toISOString() },
    action: [
      {
        ...action,
        title: values.title.trim(),
        groupingBehavior: action?.groupingBehavior ?? 'visual-group',
        selectionBehavior: action?.selectionBehavior ?? 'all',
        action: (values.times.length ? values.times : [null]).map(slotFor),
      },
      ...(existing?.action?.slice(1) ?? []),
    ],
  };
}

/** The bundle without a treatment, or null when none would be left. */
export function withoutMember(
  bundle: RequestOrchestration,
  treatmentId: string
): RequestOrchestration | null {
  const memberIds = getBundleMemberIds(bundle).filter(
    (id) => id !== treatmentId
  );
  if (!memberIds.length) return null;
  const [action, ...others] = bundle.action || [];
  return {
    ...bundle,
    action: [
      {
        ...action,
        action: (action?.action || []).map((slot) => ({
          ...slot,
          action: (slot.action || []).filter(
            (candidate) => memberId(candidate) !== treatmentId
          ),
        })),
      },
      ...others,
    ],
  };
}
