import React from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Animated from 'react-native-reanimated';
import {
  FlaskConical,
  FolderPlus,
  Pill,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react-native';
import type { Patient } from 'fhir/r5';
import { ResourceRow } from '@/src/components/ResourceSection';
import { RowIconDisc } from '@/src/components/IconDisc';
import { rise } from '@/src/features/onboarding/motion';
import { COLORS } from '@/src/theme/colors';
import { CONTENT_COLUMN } from '@/src/theme/layout';

const STARTERS: {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  href: Href;
}[] = [
  {
    id: 'condition',
    icon: FolderPlus,
    title: 'Add a condition',
    description: 'Something you are diagnosed with or managing',
    href: '/condition/add',
  },
  {
    id: 'lab-result',
    icon: FlaskConical,
    title: 'Add a lab result',
    description: 'Track biomarkers over time from a blood test',
    href: '/lab-result/add',
  },
  {
    id: 'treatment',
    icon: Pill,
    title: 'Add a medication or supplement',
    description: 'Doses, schedules and a daily journal',
    href: '/treatment/add',
  },
  {
    id: 'consultation',
    icon: Stethoscope,
    title: 'Log a doctor visit',
    description: 'Who you saw, why, and what came of it',
    href: '/consultation/add',
  },
];

/**
 * "Hi, Jane" on the only profile; "Sam's record" once several share the
 * device, where a greeting would read oddly on a child's or parent's record.
 */
export function getStartHeading(
  patient: Patient | null,
  profileCount: number
): string {
  const given = patient?.name?.[0]?.given?.[0]?.trim();
  if (!given) return 'Start your record';
  return profileCount > 1 ? `${given}'s record` : `Hi, ${given}`;
}

/** Empty Home: a greeting and what to add first. */
export function StartYourRecord({
  patient,
  profileCount,
}: {
  patient: Patient | null;
  profileCount: number;
}) {
  const router = useRouter();
  const open = (href: Href) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement)?.blur?.();
    }
    router.push(href);
  };

  return (
    <ScrollView
      testID="start-your-record"
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      <Animated.Text
        entering={rise(160)}
        accessibilityRole="header"
        style={styles.title}
        testID="start-your-record-heading"
      >
        {getStartHeading(patient, profileCount)}
      </Animated.Text>
      <Animated.Text entering={rise(240)} style={styles.subtitle}>
        Start your record with whatever you have to hand.
      </Animated.Text>
      <View style={styles.list}>
        {STARTERS.map(({ id, icon, title, description, href }, index) => (
          <Animated.View key={id} entering={rise(320 + index * 80)}>
            <ResourceRow
              title={title}
              description={description}
              leading={<RowIconDisc icon={icon} />}
              onPress={() => open(href)}
              accessibilityLabel={title}
              testID={`start-${id}`}
            />
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    ...CONTENT_COLUMN,
    padding: 20,
    paddingBottom: 132,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.light.textSecondary,
  },
  list: {
    marginTop: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.cardBorder,
  },
});
