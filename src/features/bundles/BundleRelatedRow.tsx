import React from 'react';
import { ClipboardList, Clock, Pill } from 'lucide-react-native';
import type { RequestOrchestration } from 'fhir/r5';
import {
  ResourceRow,
  type ResourceMeta,
} from '@/src/components/ResourceSection';
import {
  formatBundleTime,
  getBundleActivityIds,
  getBundleMemberIds,
  getBundleTimes,
  getBundleTitle,
} from './bundleModel';

export const formatTreatmentCount = (count: number) =>
  `${count} ${count === 1 ? 'treatment' : 'treatments'}`;

export const formatActivityCount = (count: number) =>
  `${count} ${count === 1 ? 'activity' : 'activities'}`;

/** Treatment and activity counts; activities only when there are some. */
export function getMemberCountMeta(
  treatments: number,
  activities: number,
  testIDs?: { treatments?: string; activities?: string }
): ResourceMeta[] {
  return [
    ...(treatments || !activities
      ? [
          {
            icon: Pill,
            text: formatTreatmentCount(treatments),
            testID: testIDs?.treatments,
          },
        ]
      : []),
    ...(activities
      ? [
          {
            icon: ClipboardList,
            text: formatActivityCount(activities),
            testID: testIDs?.activities,
          },
        ]
      : []),
  ];
}

/** Meta line shared by bundle rows and the bundle view heading. */
export function getBundleMeta(
  bundle: RequestOrchestration,
  { withTestIDs = false } = {}
): ResourceMeta[] {
  const times = getBundleTimes(bundle);

  return [
    ...(times.length
      ? [
          {
            icon: Clock,
            text: times.map(formatBundleTime).join(', '),
            testID: withTestIDs ? 'bundle-times' : undefined,
          },
        ]
      : []),
    ...getMemberCountMeta(
      getBundleMemberIds(bundle).length,
      getBundleActivityIds(bundle).length,
      withTestIDs
        ? {
            treatments: 'bundle-treatment-count',
            activities: 'bundle-activity-count',
          }
        : undefined
    ),
  ];
}

/** A bundle listed on another resource's view page. */
export function BundleRelatedRow({
  bundle,
  testID,
  onPress,
}: {
  bundle: RequestOrchestration;
  testID?: string;
  onPress: () => void;
}) {
  const title = getBundleTitle(bundle);
  return (
    <ResourceRow
      testID={testID}
      title={title}
      accessibilityLabel={`View bundle: ${title}`}
      meta={getBundleMeta(bundle)}
      onPress={onPress}
    />
  );
}
