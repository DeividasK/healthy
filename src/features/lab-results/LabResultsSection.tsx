import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FlaskConical } from 'lucide-react-native';
import type { DiagnosticReportRecord } from '@/src/database/types';
import { ResourceSection } from '@/src/components/ResourceSection';
import { CollapsibleList } from '@/src/components/CollapsibleList';
import { LabResultRelatedRow } from './LabResultRelatedRow';

/** Every lab result as a resource row, three shown until expanded. */
export function LabResultsSection({
  records,
}: {
  records: DiagnosticReportRecord[];
}) {
  const router = useRouter();
  return (
    <ResourceSection
      icon={FlaskConical}
      title="Lab Results"
      count={records.length}
      testID="lab-results-section"
    >
      {records.length > 0 && (
        <CollapsibleList
          items={records}
          testID="lab-results-list"
          renderItem={({ report }) => {
            const reportId = report.id || '';
            return (
              <View key={reportId} testID={`lab-result-card-${reportId}`}>
                <LabResultRelatedRow
                  report={report}
                  testID={`lab-result-open-${reportId}`}
                  onPress={() => {
                    if (
                      Platform.OS === 'web' &&
                      typeof document !== 'undefined'
                    )
                      (document.activeElement as HTMLElement)?.blur?.();
                    router.push(`/lab-result/${reportId}`);
                  }}
                />
              </View>
            );
          }}
        />
      )}
    </ResourceSection>
  );
}
