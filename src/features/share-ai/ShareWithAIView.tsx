import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  Calendar,
  Copy,
  Download,
  ListChecks,
  MessageSquareText,
} from 'lucide-react-native';
import type { Condition, MedicationRequest } from 'fhir/r5';
import type { DiagnosticReportRecord } from '@/src/database/types';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import {
  FilterChip,
  FilterGroup,
  FilterGroups,
} from '@/src/components/FilterControls';
import { NativeSelect } from '@/src/components/NativeSelect';
import { getBiomarkerKey } from '@/src/data/biomarkers';
import { getObservationMarker } from '@/src/features/lab-results/biomarkerMeasurements';
import { getAllReports } from '@/src/features/lab-results/diagnosticReportService';
import { useBiomarkerRanges } from '@/src/features/lab-results/useBiomarkerRanges';
import { latestBiomarkers } from '@/src/features/home/LabsSummary';
import { fetchAllConditionRecords } from '@/src/features/conditions/conditionsRepository';
import { fetchAllMedicationRequestRecords } from '@/src/features/treatments/treatmentsRepository';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { useIsWideLayout } from '@/src/theme/layout';
import { COLORS } from '@/src/theme/colors';
import { formatDisplayDate } from '@/src/utils/dateUtils';
import { SharePreview, useShareActions } from './ShareWithAIModal';
import {
  SHARE_PERIODS,
  SHARE_QUESTIONS,
  inPeriod,
  overviewShareText,
  statusWord,
  type OverviewSection,
  type SharePeriodId,
  type ShareQuestionId,
} from './shareText';

type SectionId = 'history' | OverviewSection['id'];

const quantity = (o: { valueQuantity?: { value?: number; unit?: string } }) =>
  o.valueQuantity?.value !== undefined
    ? `${o.valueQuantity.value}${o.valueQuantity.unit ? ` ${o.valueQuantity.unit}` : ''}`
    : '';

/** Picks records by kind and dates, and copies them for the user's AI. */
export function ShareWithAIView() {
  const { biomarker } = useLocalSearchParams<{ biomarker?: string }>();
  const { activePatientId } = useActivePatient();
  const ranges = useBiomarkerRanges();
  const isWide = useIsWideLayout();
  const [data, setData] = useState<{
    reports: DiagnosticReportRecord[];
    conditions: Condition[];
    treatments: MedicationRequest[];
  } | null>(null);
  const [period, setPeriod] = useState<SharePeriodId>('all');
  const [question, setQuestion] = useState<ShareQuestionId>('explain');
  const [included, setIncluded] = useState<SectionId[]>(
    biomarker
      ? ['history', 'conditions']
      : ['conditions', 'biomarkers', 'treatments']
  );

  useEffect(() => {
    if (!activePatientId) return;
    void Promise.all([
      getAllReports(activePatientId),
      fetchAllConditionRecords(activePatientId),
      fetchAllMedicationRequestRecords(activePatientId),
    ]).then(([reports, conditions, treatments]) =>
      setData({
        reports,
        conditions,
        treatments: treatments.map(({ request }) => request),
      })
    );
  }, [activePatientId]);

  const sections = useMemo(() => {
    if (!data) return [];
    const all: (
      OverviewSection | (Omit<OverviewSection, 'id'> & { id: 'history' })
    )[] = [];
    if (biomarker) {
      const rows = data.reports
        .flatMap(({ report, observations }) =>
          observations.map((observation) => ({
            observation,
            date:
              observation.effectiveDateTime ?? report.effectiveDateTime ?? '',
          }))
        )
        .filter(({ observation }) => {
          const marker = getObservationMarker(observation);
          return marker && getBiomarkerKey(marker) === biomarker;
        })
        .sort((a, b) => b.date.localeCompare(a.date));
      const name = rows[0]
        ? getObservationMarker(rows[0].observation)!.name
        : 'Biomarker';
      all.push({
        id: 'history',
        title: `${name} history`,
        lines: rows
          .filter(({ date }) => inPeriod(date, period))
          .map(
            ({ observation, date }) =>
              `- ${formatDisplayDate(date)}: ${quantity(observation)}`
          ),
      });
    }
    all.push({
      id: 'conditions',
      title: 'Conditions',
      lines: data.conditions
        .filter(
          (c) =>
            inPeriod(c.onsetDateTime, period) ||
            c.clinicalStatus?.coding?.[0]?.code === 'active'
        )
        .map(
          (c) =>
            `- ${c.code?.text ?? 'Condition'}: ${c.clinicalStatus?.coding?.[0]?.code ?? 'unknown'}${c.onsetDateTime ? `, since ${formatDisplayDate(c.onsetDateTime)}` : ''}`
        ),
    });
    if (!biomarker)
      all.push({
        id: 'biomarkers',
        title: 'Latest biomarkers',
        lines: latestBiomarkers(data.reports, -Infinity, ranges)
          .filter(({ date }) => inPeriod(date, period))
          .map(
            (b) =>
              `- ${b.name}: ${quantity(b.observation)}${b.status ? ` (${statusWord(b.status)})` : ''}${b.date ? `, ${formatDisplayDate(b.date)}` : ''}`
          ),
      });
    all.push({
      id: 'treatments',
      title: 'Treatments',
      lines: data.treatments.map(
        (t) =>
          `- ${t.medication?.concept?.text ?? 'Treatment'}: ${t.status}${t.dosageInstruction?.[0]?.text ? `, ${t.dosageInstruction[0].text}` : ''}`
      ),
    });
    return all;
  }, [data, biomarker, period, ranges]);

  const text = useMemo(
    () =>
      overviewShareText({
        question,
        sections: sections.filter(
          ({ id, lines }) => included.includes(id) && lines.length > 0
        ) as OverviewSection[],
      }),
    [sections, included, question]
  );
  const { copied, copy, share, shareLabel } = useShareActions(
    text,
    'Healthy records.md'
  );

  const options = (
    <FilterGroups>
      <FilterGroup icon={ListChecks} label="Include">
        <View style={styles.chips}>
          {sections.map(({ id, title, lines }) => (
            <FilterChip
              key={id}
              label={`${title} (${lines.length})`}
              testID={`share-ai-include-${id}`}
              selected={included.includes(id)}
              onPress={() =>
                setIncluded((list) =>
                  list.includes(id)
                    ? list.filter((item) => item !== id)
                    : [...list, id]
                )
              }
            />
          ))}
        </View>
      </FilterGroup>
      <FilterGroup icon={Calendar} label="Dates">
        <NativeSelect
          compact
          label="Dates"
          name="share-ai-period"
          testID="share-ai-period"
          value={period}
          options={SHARE_PERIODS.map(({ id, label }) => ({ id, label }))}
          onChange={(value) => setPeriod(value as SharePeriodId)}
        />
      </FilterGroup>
      <FilterGroup icon={MessageSquareText} label="Ask">
        <NativeSelect
          compact
          label="Ask"
          name="share-ai-question"
          testID="share-ai-question"
          value={question}
          options={SHARE_QUESTIONS.map(({ id, label }) => ({ id, label }))}
          onChange={(value) => setQuestion(value as ShareQuestionId)}
        />
      </FilterGroup>
    </FilterGroups>
  );

  return (
    <ResourceViewLayout
      testID="share-ai-view"
      title="Share with AI"
      wide={isWide}
      isLoading={!data}
      actions={
        <ResourceActionDock
          actions={[
            {
              label: copied ? 'Copied' : 'Copy',
              testID: 'share-ai-copy-button',
              icon: Copy,
              onPress: copy,
              primary: true,
            },
            {
              label: shareLabel,
              testID: 'share-ai-share-button',
              icon: Download,
              onPress: share,
            },
          ]}
        />
      }
    >
      <Text style={styles.description}>
        Choose what to share, then paste it into Claude, ChatGPT or any AI. Your
        name isn&apos;t included.
      </Text>
      {isWide ? (
        <View style={styles.columns}>
          <View style={styles.column}>{options}</View>
          <View style={styles.column}>
            <SharePreview text={text} maxHeight={520} />
          </View>
        </View>
      ) : (
        <>
          {options}
          <View style={styles.previewGap}>
            <SharePreview text={text} maxHeight={320} />
          </View>
        </>
      )}
    </ResourceViewLayout>
  );
}

const styles = StyleSheet.create({
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.light.mutedForeground,
    marginBottom: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  columns: { flexDirection: 'row', gap: 40, alignItems: 'flex-start' },
  column: { flex: 1, minWidth: 0 },
  previewGap: { marginTop: 20 },
});
