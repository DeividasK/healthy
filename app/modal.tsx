import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, ScrollView, View, Text, useColorScheme } from 'react-native';
import { ShieldCheck, Database, Sparkles, HeartHandshake, BookOpen, Cloud } from 'lucide-react-native';
import { useResponsive } from '../src/hooks/useResponsive';
import { useLanguage } from '../src/i18n';

export default function ModalScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { modalMaxWidth, containerPadding } = useResponsive();
  const { t } = useLanguage();

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' },
      ]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          maxWidth: modalMaxWidth,
          width: '100%',
          alignSelf: 'center',
          paddingHorizontal: containerPadding,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
          {t('modal.title')}
        </Text>
        <Text
          style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}
        >
          {t('modal.subtitle')}
        </Text>
      </View>

      {/* Feature 1: Privacy First */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderColor: isDark ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.iconCircle}>
          <ShieldCheck size={22} color="#10B981" />
        </View>
        <View style={styles.cardContent}>
          <Text
            style={[
              styles.cardTitle,
              { color: isDark ? '#F8FAFC' : '#0F172A' },
            ]}
          >
            {t('modal.privacyTitle')}
          </Text>
          <Text
            style={[
              styles.cardDesc,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            {t('modal.privacyDesc')}
          </Text>
        </View>
      </View>

      {/* Feature 2: LOINC Standard */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderColor: isDark ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.iconCircle}>
          <BookOpen size={22} color="#2563EB" />
        </View>
        <View style={styles.cardContent}>
          <Text
            style={[
              styles.cardTitle,
              { color: isDark ? '#F8FAFC' : '#0F172A' },
            ]}
          >
            {t('modal.loincTitle')}
          </Text>
          <Text
            style={[
              styles.cardDesc,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            {t('modal.loincDesc')}
          </Text>
        </View>
      </View>

      {/* Feature 3: Dual-Unit & Live Flagging */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderColor: isDark ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.iconCircle}>
          <Sparkles size={22} color="#F59E0B" />
        </View>
        <View style={styles.cardContent}>
          <Text
            style={[
              styles.cardTitle,
              { color: isDark ? '#F8FAFC' : '#0F172A' },
            ]}
          >
            {t('modal.dualUnitTitle')}
          </Text>
          <Text
            style={[
              styles.cardDesc,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            {t('modal.dualUnitDesc')}
          </Text>
        </View>
      </View>

      {/* Feature 4: Self-Hosted Google Drive Sync */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderColor: isDark ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.iconCircle}>
          <Cloud size={22} color="#2563EB" />
        </View>
        <View style={styles.cardContent}>
          <Text
            style={[
              styles.cardTitle,
              { color: isDark ? '#F8FAFC' : '#0F172A' },
            ]}
          >
            {t('modal.driveSyncTitle')}
          </Text>
          <Text
            style={[
              styles.cardDesc,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            {t('modal.driveSyncDesc')}
          </Text>
        </View>
      </View>

      {/* Medical Disclaimer */}
      <View
        style={[
          styles.disclaimerCard,
          {
            backgroundColor: isDark ? '#1E293B' : '#FEF3C7',
            borderColor: isDark ? '#D97706' : '#FDE68A',
          },
        ]}
      >
        <Text style={[styles.disclaimerTitle, { color: isDark ? '#FCD34D' : '#92400E' }]}>
          {t('modal.disclaimerTitle')}
        </Text>
        <Text style={[styles.disclaimerText, { color: isDark ? '#FDE68A' : '#78350F' }]}>
          {t('modal.disclaimerDesc')}
        </Text>
      </View>

      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  disclaimerCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginTop: 10,
  },
  disclaimerTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  disclaimerText: {
    fontSize: 12,
    lineHeight: 17,
  },
});
