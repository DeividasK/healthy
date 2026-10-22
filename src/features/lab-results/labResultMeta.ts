import { Calendar, CircleDot, Hospital } from 'lucide-react-native';
import type { DiagnosticReport } from 'fhir/r5';
import type { ResourceMeta } from '@/src/components/ResourceSection';
import { formatDisplayDateTime } from '@/src/utils/dateUtils';
import { isOrganizationReference } from '@/src/utils/fhirUtils';

/**
 * Title every lab result shows, also those stored with a panel code (e.g. a
 * complete blood count panel).
 */
export const LAB_RESULT_TITLE = 'Lab report';

/** Display label of a lab result's FHIR DiagnosticReport status. */
export function getLabResultStatusLabel(report: DiagnosticReport) {
  return report.status
    ? report.status.charAt(0).toUpperCase() + report.status.slice(1)
    : 'Unknown';
}

/** Name of the Organization that performed a lab result, if any. */
export function getLabResultServiceProvider(report: DiagnosticReport) {
  return report.performer?.find(isOrganizationReference)?.display;
}

/** Meta line shared by lab result rows and the lab result view heading. */
export function getLabResultMeta(
  report: DiagnosticReport,
  { withTestIDs = false } = {}
): ResourceMeta[] {
  const id = (testID: string) => (withTestIDs ? testID : undefined);
  const date = report.effectiveDateTime || report.effectivePeriod?.start;
  const serviceProvider = getLabResultServiceProvider(report);
  return [
    ...(date
      ? [
          {
            icon: Calendar,
            text: formatDisplayDateTime(date),
            testID: id('lab-result-date'),
          },
        ]
      : []),
    {
      icon: CircleDot,
      text: getLabResultStatusLabel(report),
      testID: id('lab-result-status'),
    },
    ...(serviceProvider
      ? [
          {
            icon: Hospital,
            text: serviceProvider,
            testID: id('lab-result-service-provider'),
          },
        ]
      : []),
  ];
}
