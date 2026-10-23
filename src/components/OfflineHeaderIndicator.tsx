import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNetworkState } from 'expo-network';
import { WifiOff } from 'lucide-react-native';
import { useIsInternetUnreachable } from '@/src/services/reachability';
import { COLORS } from '@/src/theme/colors';

/**
 * Whether the device has no network connection, or a request just failed to
 * reach the internet through the one it has.
 */
export function useIsOffline(): boolean {
  const { isConnected, isInternetReachable } = useNetworkState();
  const isUnreachable = useIsInternetUnreachable();
  // Unknown (undefined/null) counts as online so the header never flashes offline on launch.
  return (
    isConnected === false || isInternetReachable === false || isUnreachable
  );
}

/** Offline icon, shown in the sync indicator's place while offline. */
export function OfflineHeaderIndicator() {
  return (
    <View
      testID="offline-header-indicator"
      accessible
      accessibilityLabel="Offline"
      style={styles.container}
    >
      <WifiOff size={18} color={COLORS.light.muted} strokeWidth={2.2} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
