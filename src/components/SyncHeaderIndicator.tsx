import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Check, AlertTriangle } from 'lucide-react-native';
import { useSync } from '@/src/context/SyncContext';
import { useRouter } from 'expo-router';
import { SyncErrorModal } from '@/src/features/profile/SyncErrorModal';
import { COLORS } from '@/src/theme/colors';

export function SyncHeaderIndicator() {
  const router = useRouter();
  const { syncState, syncError, syncNow, clearError } = useSync();
  const [errorModalVisible, setErrorModalVisible] = useState(false);

  if (syncState === 'idle') {
    return null;
  }

  return (
    <>
      <View style={styles.container} testID="sync-header-indicator">
        {syncState === 'syncing' && (
          <View testID="sync-spinner" style={styles.iconWrap}>
            <ActivityIndicator size="small" color={COLORS.light.primary} />
          </View>
        )}

        {syncState === 'just_synced' && (
          <View testID="sync-checkmark" style={styles.iconWrap}>
            <Check size={18} color="#16A34A" strokeWidth={2.5} />
          </View>
        )}

        {syncState === 'error' && (
          <TouchableOpacity
            testID="sync-warning-icon"
            accessibilityLabel="Cloud sync warning. Tap for details."
            onPress={() => setErrorModalVisible(true)}
            style={styles.warningWrap}
            activeOpacity={0.7}
          >
            <AlertTriangle size={18} color="#D97706" strokeWidth={2.2} />
          </TouchableOpacity>
        )}
      </View>

      <SyncErrorModal
        visible={errorModalVisible}
        errorMessage={syncError}
        onDismiss={() => {
          setErrorModalVisible(false);
          clearError();
        }}
        onRetry={() => {
          setErrorModalVisible(false);
          syncNow();
        }}
        onReconnect={() => {
          setErrorModalVisible(false);
          router.push('/profile');
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
  },
});
