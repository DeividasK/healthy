import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNetworkState } from 'expo-network';
import { WifiOff } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';

/** Whether the device has no network connection. */
export function useIsOffline(): boolean {
  const { isConnected, isInternetReachable } = useNetworkState();
  // Unknown (undefined/null) counts as online so the header never flashes offline on launch.
  return isConnected === false || isInternetReachable === false;
}

/** Offline icon and status, shown in the sync indicator's place while offline. */
export function OfflineHeaderIndicator() {
  return (
    <View testID="offline-header-indicator" style={styles.container}>
      <WifiOff size={18} color={COLORS.light.muted} strokeWidth={2.2} />
      <Text style={styles.label}>Offline</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: 8,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.light.muted,
  },
});
