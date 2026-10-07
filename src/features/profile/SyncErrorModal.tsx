import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { AlertTriangle, X, RefreshCw } from 'lucide-react-native';
import { COLORS } from '../../theme/colors';

interface SyncErrorModalProps {
  visible: boolean;
  errorMessage: string | null;
  onDismiss: () => void;
  onRetry: () => void;
  onReconnect?: () => void;
}

export function SyncErrorModal({
  visible,
  errorMessage,
  onDismiss,
  onRetry,
  onReconnect,
}: SyncErrorModalProps) {
  if (!visible) return null;

  const isExpired =
    Boolean(errorMessage?.toLowerCase().includes('expired')) ||
    Boolean(errorMessage?.toLowerCase().includes('reconnect'));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.card} testID="sync-error-modal">
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.iconCircle}>
                <AlertTriangle size={20} color="#D97706" />
              </View>
              <Text style={styles.title}>
                {isExpired ? 'Session Expired' : 'Cloud Sync Issue'}
              </Text>
            </View>
            <TouchableOpacity
              testID="close-sync-error-modal"
              onPress={onDismiss}
              style={styles.closeBtn}
            >
              <X size={20} color={COLORS.light.iconMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <Text style={styles.message} testID="sync-error-message">
              {errorMessage ||
                'An error occurred while syncing with Google Drive.'}
            </Text>
            <Text style={styles.subtext}>
              {isExpired
                ? 'Your authorization token has expired. Reconnecting will restore seamless background backup.'
                : 'Please check your internet connection and ensure your Google account permissions are active.'}
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              testID="dismiss-sync-error-btn"
              style={styles.secondaryBtn}
              onPress={onDismiss}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryBtnText}>Dismiss</Text>
            </TouchableOpacity>

            {isExpired && onReconnect ? (
              <TouchableOpacity
                testID="reconnect-sync-btn"
                style={styles.primaryBtn}
                onPress={() => {
                  onDismiss();
                  onReconnect();
                }}
                activeOpacity={0.7}
              >
                <RefreshCw size={16} color={COLORS.light.primaryForeground} />
                <Text style={styles.primaryBtnText}>Reconnect Google</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                testID="retry-sync-btn"
                style={styles.primaryBtn}
                onPress={() => {
                  onDismiss();
                  onRetry();
                }}
                activeOpacity={0.7}
              >
                <RefreshCw size={16} color={COLORS.light.primaryForeground} />
                <Text style={styles.primaryBtnText}>Retry Sync</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.light.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    ...Platform.select({
      web: {
        boxShadow: COLORS.light.shadowWebModalCard,
      },
      default: {
        shadowColor: COLORS.light.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    marginBottom: 20,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
    lineHeight: 22,
  },
  subtext: {
    fontSize: 13,
    color: COLORS.light.muted,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.light.pillBackground,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.light.primary,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.primaryForeground,
  },
});
