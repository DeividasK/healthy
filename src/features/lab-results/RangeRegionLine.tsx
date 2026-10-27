import React from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { getRangeRegionInfo } from '@/src/data/biomarkers/rangeRegions';
import { COLORS } from '@/src/theme/colors';
import type { ResolvedReferenceRange } from './referenceRanges';

/**
 * Names the range set a catalog range comes from: the profile's region and
 * its cited source, or that the range applies everywhere. Links to the
 * Region setting.
 */
export function RangeRegionLine({
  resolved,
  testID,
}: {
  resolved: ResolvedReferenceRange;
  testID: string;
}) {
  const router = useRouter();
  const { region, source } = resolved;
  return (
    <Text style={styles.line} testID={testID}>
      {region && source ? (
        <>
          {`${getRangeRegionInfo(region).name} range, from `}
          <Text
            style={styles.link}
            accessibilityRole="link"
            onPress={() => void Linking.openURL(source.url)}
            testID={`${testID}-source`}
          >
            {source.title}
            {source.year ? ` (${source.year})` : ''}
          </Text>
          {'. '}
        </>
      ) : (
        'This range is used for every region. '
      )}
      <Text
        style={styles.link}
        accessibilityRole="link"
        onPress={() => router.push('/settings')}
        testID={`${testID}-change`}
      >
        Change region
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  line: {
    marginTop: 12,
    color: COLORS.light.textSecondary,
    fontSize: 15,
    lineHeight: 23,
  },
  link: {
    color: COLORS.light.link,
    textDecorationLine: 'underline',
  },
});
