import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '@/src/theme/colors';

interface ResourceTextSectionProps {
  title: string;
  text: string;
  testID?: string;
  textTestID?: string;
}

/** Heading and plain body text for a multi-line field on a view page. */
export function ResourceTextSection({
  title,
  text,
  testID,
  textTestID,
}: ResourceTextSectionProps) {
  return (
    <View style={styles.section} testID={testID}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text} testID={textTestID}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.foreground,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.light.textSecondary,
  },
});
