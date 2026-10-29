import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  Calendar,
  Check,
  ChevronDown,
  Copy,
  FlaskConical,
  FolderPlus,
  Minus,
  Pill,
  Share as ShareIcon,
  type LucideIcon,
} from 'lucide-react-native';
import type { Condition, MedicationRequest } from 'fhir/r5';
import type { DiagnosticReportRecord } from '@/src/database/types';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { FilterGroup, FilterGroups } from '@/src/components/FilterControls';
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
import { SharePreview, useShareActions } from './shareActions';
import {
  SHARE_PERIODS,
  inPeriod,
  overviewShareText,
  statusWord,
  type SharePeriodId,
} from './shareText';

type GroupId = 'history' | 'conditions' | 'biomarkers' | 'treatments';

interface ShareItem {
  /** Unique within the page: `<group>:<record>`. */
  key: string;
  title: string;
  meta: string;
  /** The item's line in the shared text. */
  line: string;
}

interface ShareGroup {
  id: GroupId;
  title: string;
  icon: LucideIcon;
  items: ShareItem[];
}

const quantity = (o: { valueQuantity?: { value?: number; unit?: string } }) =>
  o.valueQuantity?.value !== undefined
    ? `${o.valueQuantity.value}${o.valueQuantity.unit ? ` ${o.valueQuantity.unit}` : ''}`
    : '';

const capitalise = (text: string) =>
  text ? text[0].toUpperCase() + text.slice(1) : text;

/** A checkbox: ticked, empty, or a dash when only some of a group is ticked. */
function SelectBox({ state }: { state: 'all' | 'some' | 'none' }) {
  return (
    <View style={[styles.box, state !== 'none' && styles.boxChecked]}>
      {state === 'all' && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
      {state === 'some' && <Minus size={14} color="#FFFFFF" strokeWidth={3} />}
    </View>
  );
}

/** Picks records one by one, and shares them with the user's own AI. */
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
  /** Items the user unticked; everything else is shared. */
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [folded, setFolded] = useState<Set<GroupId>>(new Set(['biomarkers']));

  useEffect(() => {
    if (!activePatientId) return;
    void Promise.all([
      getAllReports(activePatientId),
      fetchAllConditionRecords(activePatientId),
      fetchAllMedicationRequestRecords(activePatientId),
    ]).then(([reports, conditions, treatments]) => {
      setData({
        reports,
        conditions,
        treatments: treatments.map(({ request }) => request),
      });
      // From a biomarker's page, its history and conditions start ticked.
      if (biomarker)
        setUnticked(
          new Set(treatments.map(({ request }) => `treatments:${request.id}`))
        );
    });
  }, [activePatientId, biomarker]);

  const groups = useMemo<ShareGroup[]>(() => {
    if (!data) return [];
    const all: ShareGroup[] = [];
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
        icon: FlaskConical,
        items: rows
          .filter(({ date }) => inPeriod(date, period))
          .map(({ observation, date }) => ({
            key: `history:${observation.id}`,
            title: formatDisplayDate(date),
            meta: quantity(observation),
            line: `- ${formatDisplayDate(date)}: ${quantity(observation)}`,
          })),
      });
    }
    all.push({
      id: 'conditions',
      title: 'Conditions',
      icon: FolderPlus,
      items: data.conditions
        .filter(
          (c) =>
            inPeriod(c.onsetDateTime, period) ||
            c.clinicalStatus?.coding?.[0]?.code === 'active'
        )
        .map((c) => {
          const status = c.clinicalStatus?.coding?.[0]?.code ?? '';
          const since = c.onsetDateTime
            ? `since ${formatDisplayDate(c.onsetDateTime)}`
            : '';
          const resolved = c.abatementDateTime
            ? `until ${formatDisplayDate(c.abatementDateTime)}`
            : '';
          const meta = [capitalise(status), since, resolved]
            .filter(Boolean)
            .join(', ');
          return {
            key: `conditions:${c.id}`,
            title: c.code?.text ?? 'Condition',
            meta,
            line: `- ${c.code?.text ?? 'Condition'}: ${[status, since, resolved].filter(Boolean).join(', ')}`,
          };
        }),
    });
    if (!biomarker)
      all.push({
        id: 'biomarkers',
        title: 'Latest biomarkers',
        icon: FlaskConical,
        items: latestBiomarkers(data.reports, -Infinity, ranges)
          .filter(({ date }) => inPeriod(date, period))
          .map((b) => {
            const meta = [
              quantity(b.observation),
              statusWord(b.status),
              b.date ? formatDisplayDate(b.date) : '',
            ]
              .filter(Boolean)
              .join(', ');
            return {
              key: `biomarkers:${b.id}`,
              title: b.name,
              meta,
              line: `- ${b.name}: ${meta}`,
            };
          }),
      });
    all.push({
      id: 'treatments',
      title: 'Treatments',
      icon: Pill,
      items: data.treatments.map((t) => {
        const meta = [
          capitalise(t.status),
          t.dosageInstruction?.[0]?.text ?? '',
        ]
          .filter(Boolean)
          .join(', ');
        const name = t.medication?.concept?.text ?? 'Treatment';
        return {
          key: `treatments:${t.id}`,
          title: name,
          meta,
          line: `- ${name}: ${[t.status, t.dosageInstruction?.[0]?.text].filter(Boolean).join(', ')}`,
        };
      }),
    });
    return all.filter(({ items }) => items.length > 0);
  }, [data, biomarker, period, ranges]);

  const text = useMemo(
    () =>
      overviewShareText({
        sections: groups
          .map(({ title, items }) => ({
            title,
            lines: items
              .filter(({ key }) => !unticked.has(key))
              .map(({ line }) => line),
          }))
          .filter(({ lines }) => lines.length > 0),
      }),
    [groups, unticked]
  );
  const { copied, copy, share } = useShareActions(text, 'My health records');

  const toggle = (keys: string[], tick: boolean) =>
    setUnticked((previous) => {
      const next = new Set(previous);
      for (const key of keys) {
        if (tick) next.delete(key);
        else next.add(key);
      }
      return next;
    });

  const list = (
    <View>
      <FilterGroups>
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
      </FilterGroups>
      {groups.map(({ id, title, icon: Icon, items }) => {
        const ticked = items.filter(({ key }) => !unticked.has(key)).length;
        const state =
          ticked === items.length ? 'all' : ticked === 0 ? 'none' : 'some';
        const isFolded = folded.has(id);
        return (
          <View key={id} style={styles.group} testID={`share-ai-group-${id}`}>
            <View style={styles.groupHeader}>
              <TouchableOpacity
                testID={`share-ai-group-${id}-checkbox`}
                accessibilityRole="checkbox"
                accessibilityLabel={`Share all ${title.toLowerCase()}`}
                accessibilityState={{
                  checked: state === 'some' ? 'mixed' : state === 'all',
                }}
                onPress={() =>
                  toggle(
                    items.map(({ key }) => key),
                    state !== 'all'
                  )
                }
                style={styles.boxTarget}
                activeOpacity={0.7}
              >
                <SelectBox state={state} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.groupTitleRow}
                onPress={() =>
                  setFolded((previous) => {
                    const next = new Set(previous);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                accessibilityRole="button"
                accessibilityState={{ expanded: !isFolded }}
                activeOpacity={0.7}
              >
                <Icon size={20} color={COLORS.light.primary} />
                <Text style={styles.groupTitle}>{title}</Text>
                <Text style={styles.count}>
                  {ticked} of {items.length}
                </Text>
                <View
                  style={[styles.chevron, isFolded && styles.chevronFolded]}
                >
                  <ChevronDown size={20} color={COLORS.light.mutedForeground} />
                </View>
              </TouchableOpacity>
            </View>
            {!isFolded &&
              items.map(({ key, title: itemTitle, meta }) => {
                const isTicked = !unticked.has(key);
                return (
                  <TouchableOpacity
                    key={key}
                    testID={`share-ai-item-${key}`}
                    style={styles.item}
                    accessibilityRole="checkbox"
                    accessibilityLabel={itemTitle}
                    accessibilityState={{ checked: isTicked }}
                    onPress={() => toggle([key], !isTicked)}
                    activeOpacity={0.7}
                  >
                    <SelectBox state={isTicked ? 'all' : 'none'} />
                    <View style={styles.itemText}>
                      <Text
                        style={[
                          styles.itemTitle,
                          !isTicked && styles.itemUnticked,
                        ]}
                      >
                        {itemTitle}
                      </Text>
                      {meta ? (
                        <Text style={styles.itemMeta}>{meta}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
          </View>
        );
      })}
    </View>
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
              label: 'Share',
              testID: 'share-ai-share-button',
              icon: ShareIcon,
              onPress: share,
              primary: true,
            },
            {
              label: copied ? 'Copied' : 'Copy',
              testID: 'share-ai-copy-button',
              icon: Copy,
              onPress: copy,
            },
          ]}
        />
      }
    >
      <Text style={styles.description}>
        Tick what to share, then send it to Claude, ChatGPT or any AI and ask
        your question there. Your name isn&apos;t included.
      </Text>
      {isWide ? (
        <View style={styles.columns}>
          <View style={styles.column}>{list}</View>
          <View style={[styles.column, styles.sticky]}>
            <SharePreview text={text} maxHeight={620} />
          </View>
        </View>
      ) : (
        <>
          {list}
          <View style={styles.previewGap}>
            <Text style={styles.previewHeading}>What will be shared</Text>
            <SharePreview text={text} maxHeight={360} />
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
  group: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.light.border,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  boxTarget: { paddingRight: 12, paddingVertical: 4 },
  groupTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  count: {
    fontSize: 14,
    color: COLORS.light.mutedForeground,
    flex: 1,
  },
  chevron: {},
  chevronFolded: { transform: [{ rotate: '-90deg' }] },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.light.border,
  },
  itemText: { flex: 1, minWidth: 0 },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  itemUnticked: { color: COLORS.light.mutedForeground },
  itemMeta: {
    fontSize: 14,
    color: COLORS.light.mutedForeground,
    marginTop: 2,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.light.border,
    backgroundColor: COLORS.light.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: COLORS.light.primary,
    borderColor: COLORS.light.primary,
  },
  columns: { flexDirection: 'row', gap: 40, alignItems: 'flex-start' },
  column: { flex: 1, minWidth: 0 },
  sticky: { position: 'sticky' as 'relative', top: 0 },
  previewGap: { marginTop: 28 },
  previewHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.light.foreground,
    marginBottom: 10,
  },
});
