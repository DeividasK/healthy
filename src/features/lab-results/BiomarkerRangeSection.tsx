import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import {
  Calendar,
  FileText,
  Pencil,
  Ruler,
  UserPen,
} from 'lucide-react-native';
import { CollapsibleList } from '@/src/components/CollapsibleList';
import { ResourceRow, ResourceSection } from '@/src/components/ResourceSection';
import { COLORS } from '@/src/theme/colors';
import { formatDisplayDate } from '@/src/utils/dateUtils';
import { formatLimits, type BiomarkerRangeEntry } from './biomarkerRanges';

/** The concept icon for biomarker ranges, e.g. their section heading. */
export const RANGE_ICON = Ruler;

/**
 * A biomarker's ranges, like a treatment's usage: the one in use, then the
 * rest newest first behind the list's toggle. A row only where the range
 * changed, each from the day it took effect. A range from a
 * lab report opens the report; one the user set has a pencil to edit it.
 * The page's dock sets a new one. Left out until there is a range.
 */
export function BiomarkerRangeSection({
  history,
  inUse,
  unitLabel,
  onEdit,
  onOpenReport,
  testID = 'biomarker-range',
}: {
  /** Oldest first, from `rangeHistory`. */
  history: BiomarkerRangeEntry[];
  /** The range the latest result is read against, marked like a selected row. */
  inUse?: BiomarkerRangeEntry;
  unitLabel: string;
  onEdit: (entry: BiomarkerRangeEntry) => void;
  onOpenReport: (reportId: string) => void;
  testID?: string;
}) {
  if (!history.length) return null;
  return (
    <ResourceSection
      icon={RANGE_ICON}
      title="Range"
      count={history.length}
      testID={testID}
    >
      <CollapsibleList
        items={[
          ...(inUse ? [inUse] : []),
          ...[...history].reverse().filter((entry) => entry !== inUse),
        ]}
        visibleCount={1}
        testID={`${testID}-list`}
        renderItem={(entry) => {
          const title = `${formatLimits(entry.low, entry.high)} ${unitLabel}`;
          const since = formatDisplayDate(entry.since);
          const meta = [
            { icon: Calendar, text: `Since ${since}` },
            entry.source === 'report'
              ? { icon: FileText, text: 'From your lab report' }
              : { icon: UserPen, text: 'Set by you' },
          ];
          const rowTestID = `${testID}-${entry.since}`;
          return entry.source === 'user' ? (
            <ResourceRow
              key={entry.since}
              testID={rowTestID}
              selected={entry === inUse}
              title={title}
              meta={meta}
              accessory={
                <TouchableOpacity
                  testID={`${rowTestID}-edit`}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit range since ${since}`}
                  hitSlop={10}
                  style={styles.edit}
                  activeOpacity={0.6}
                  onPress={() => onEdit(entry)}
                >
                  <Pencil size={16} color={COLORS.light.iconClear} />
                </TouchableOpacity>
              }
            />
          ) : (
            <ResourceRow
              key={entry.since}
              testID={rowTestID}
              selected={entry === inUse}
              title={title}
              meta={meta}
              accessibilityLabel={`View lab result: ${since}`}
              onPress={
                entry.reportId ? () => onOpenReport(entry.reportId!) : undefined
              }
            />
          );
        }}
      />
    </ResourceSection>
  );
}

const styles = StyleSheet.create({
  // Sized like a form field's remove x, as on treatment usage rows.
  edit: {
    padding: 8,
    marginRight: -8,
  },
});
