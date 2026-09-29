import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { ChevronLeft, Share2, Download } from 'lucide-react-native';

export interface WhoopAmbientHeaderProps {
  title?: string;
  onBack?: () => void;
  onAction?: () => void;
  actionIcon?: 'download' | 'share';
}

export const WhoopAmbientHeader: React.FC<WhoopAmbientHeaderProps> = ({
  title = 'LABS SUMMARY',
  onBack,
  onAction,
  actionIcon = 'download',
}) => {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 16 : 8);

  return (
    <View style={styles.headerWrapper}>
      {/* Ambient Emerald Green Glow Background */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="whoopGlow" x1="50%" y1="0%" x2="50%" y2="100%">
              <Stop offset="0%" stopColor="#0C4538" stopOpacity="0.95" />
              <Stop offset="35%" stopColor="#082E25" stopOpacity="0.55" />
              <Stop offset="75%" stopColor="#061F19" stopOpacity="0.2" />
              <Stop offset="100%" stopColor="#0D1217" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#whoopGlow)" />
        </Svg>
      </View>

      {/* Nav Content */}
      <View style={[styles.navRow, { paddingTop: topPadding + 6 }]}>
        {onBack ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <ChevronLeft size={26} color="#FFFFFF" strokeWidth={2.2} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}

        <Text style={styles.titleText}>{title}</Text>

        {onAction ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onAction}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            {actionIcon === 'download' ? (
              <Download size={22} color="#FFFFFF" strokeWidth={2} />
            ) : (
              <Share2 size={22} color="#FFFFFF" strokeWidth={2} />
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerWrapper: {
    height: 104,
    position: 'relative',
    backgroundColor: '#0D1217',
    zIndex: 10,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  iconPlaceholder: {
    width: 38,
    height: 38,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
