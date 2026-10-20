import React from 'react';
import { Clock, Pill } from 'lucide-react-native';
import type { RequestOrchestration } from 'fhir/r5';
import {
  ResourceRow,
  type ResourceMeta,
} from '@/src/components/ResourceSection';
import {
  formatBundleTime,
  getBundleMemberIds,
  getBundleTimes,
  getBundleTitle,
} from './bundleModel';

export const formatTreatmentCount = (count: number) =>
  `${count} ${count === 1 ? 'treatment' : 'treatments'}`;

/** Meta line shared by bundle rows and the bundle view heading. */
export function getBundleMeta(
  bundle: RequestOrchestration,
  { withTestIDs = false } = {}
): ResourceMeta[] {
  const times = getBundleTimes(bundle);
  const count = getBundleMemberIds(bundle).length;
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
    {
      icon: Pill,
      text: formatTreatmentCount(count),
      testID: withTestIDs ? 'bundle-treatment-count' : undefined,
    },
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
