import React from 'react';
import type { DiagnosticReport } from 'fhir/r5';
import {
  ResourceRow,
  type ResourceMeta,
  type ResourceRowAppearance,
} from '@/src/components/ResourceSection';
import { getLabResultMeta, LAB_RESULT_TITLE } from './labResultMeta';

/** A lab result listed on another resource's view page. */
export function LabResultRelatedRow({
  report,
  testID,
  onPress,
  extraMeta = [],
  appearance,
}: {
  report: DiagnosticReport;
  testID?: string;
  onPress: () => void;
  /** Further meta items appended to the row, e.g. association counts. */
  extraMeta?: ResourceMeta[];
  /** Timeline node, status wash or fading. */
  appearance?: ResourceRowAppearance;
}) {
  const title = LAB_RESULT_TITLE;
  return (
    <ResourceRow
      testID={testID}
      title={title}
      meta={[...getLabResultMeta(report), ...extraMeta]}
      onPress={onPress}
      {...appearance}
    />
  );
}
