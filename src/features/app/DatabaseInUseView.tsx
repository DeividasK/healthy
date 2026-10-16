import { StyleSheet, Text, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { ActionDock } from '@/src/components/ActionDock';
import { COLORS } from '@/src/theme/colors';

/** Shown on web while another tab has the database open. */
export function DatabaseInUseView({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.container} testID="database-in-use">
      <Text accessibilityRole="header" style={styles.title}>
        Healthy is already open in another tab
      </Text>
      <Text style={styles.message}>Close the other tab, then retry.</Text>
      <ActionDock
        actions={[
          {
            label: 'Retry',
            testID: 'database-in-use-retry',
            icon: RefreshCw,
            onPress: onRetry,
            primary: true,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: COLORS.light.card,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    color: COLORS.light.foreground,
  },
  message: {
    marginTop: 8,
    fontSize: 16,
    textAlign: 'center',
    color: COLORS.light.mutedForeground,
  },
});
