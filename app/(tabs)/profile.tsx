import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  useColorScheme,
} from 'react-native';
import {
  User,
  Calendar,
  FileText,
  Save,
  Check,
  Building2,
  ShieldCheck,
  Sparkles,
  Globe,
} from 'lucide-react-native';
import { useUserProfile } from '../../src/context/UserProfileContext';
import { BiologicalSex } from '../../src/types/profile';
import { useResponsive } from '../../src/hooks/useResponsive';
import { useTranslation } from 'react-i18next';
import { changeLanguage, Language } from '../../src/i18n/i18n';

export default function ProfileScreen() {
  const {
    profile,
    updateProfile,
    availableLabs,
    isLoading,
  } = useUserProfile();
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'lt' ? 'lt' : 'en';
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { contentMaxWidth, containerPadding } = useResponsive();

  const [name, setName] = useState(profile.name || '');
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth || '');
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex>(
    profile.biologicalSex || 'unspecified'
  );
  const [notes, setNotes] = useState(profile.notes || '');

  const [isSaving, setIsSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Keep local form in sync when context profile finishes loading
  useEffect(() => {
    if (!isLoading) {
      setName(profile.name || '');
      setDateOfBirth(profile.dateOfBirth || '');
      setBiologicalSex(profile.biologicalSex || 'unspecified');
      setNotes(profile.notes || '');
    }
  }, [profile, isLoading]);

  // Calculate age if valid DOB
  const calculatedAge = useMemo(() => {
    if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth.trim())) {
      return null;
    }
    const birth = new Date(dateOfBirth);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 && age < 130 ? age : null;
  }, [dateOfBirth]);

  const biologicalSexOptions: { label: string; value: BiologicalSex }[] = [
    { label: t('profile.sexMale'), value: 'male' },
    { label: t('profile.sexFemale'), value: 'female' },
    { label: t('profile.sexOther'), value: 'other' },
    { label: t('profile.sexUnspecified'), value: 'unspecified' },
  ];

  const handleSave = async () => {
    if (
      dateOfBirth &&
      dateOfBirth.trim().length > 0 &&
      !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth.trim())
    ) {
      const title = t('profile.alertDobFormatTitle');
      const msg = t('profile.alertDobFormatMsg');
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert(title, msg);
      }
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        dateOfBirth: dateOfBirth.trim() || undefined,
        biologicalSex,
        notes: notes.trim() || undefined,
      });

      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
    } catch (err: any) {
      const msg = err?.message || 'Failed to save profile';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert(t('common.error'), msg);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleLanguageChange = async (newLang: Language) => {
    await changeLanguage(newLang);
  };

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' },
      ]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          maxWidth: contentMaxWidth,
          width: '100%',
          alignSelf: 'center',
          paddingHorizontal: containerPadding,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Profile Header Hero */}
      <View
        style={[
          styles.headerCard,
          {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderColor: isDark ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={styles.avatarCircle}>
            <User size={30} color="#2563EB" />
          </View>
          <View style={styles.headerTextGroup}>
            <Text
              style={[
                styles.headerName,
                { color: isDark ? '#F8FAFC' : '#0F172A' },
              ]}
            >
              {name.trim() || t('profile.headerTitle')}
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                { color: isDark ? '#94A3B8' : '#64748B' },
              ]}
            >
              {t('profile.subtitle')}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.privacyBadge,
            { backgroundColor: isDark ? '#0F172A' : '#ECFDF5' },
          ]}
        >
          <ShieldCheck size={14} color="#10B981" />
          <Text style={styles.privacyText}>{t('profile.onDeviceBadge')}</Text>
        </View>
      </View>

      {/* Language Selector Card */}
      <View
        style={[
          styles.formCard,
          {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderColor: isDark ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.cardHeaderRow}>
          <Globe size={18} color="#2563EB" />
          <Text
            style={[
              styles.cardTitle,
              { color: isDark ? '#F8FAFC' : '#0F172A', marginBottom: 0 },
            ]}
          >
            {t('profile.languageSectionTitle')}
          </Text>
        </View>
        <Text
          style={[
            styles.fieldHelperText,
            { color: isDark ? '#94A3B8' : '#64748B' },
          ]}
        >
          {t('profile.languageLabel')}
        </Text>

        <View style={styles.languageButtonsRow}>
          <TouchableOpacity
            style={[
              styles.languageBtn,
              language === 'lt'
                ? styles.languageBtnActive
                : {
                    backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                    borderColor: isDark ? '#334155' : '#CBD5E1',
                  },
            ]}
            onPress={() => handleLanguageChange('lt')}
            activeOpacity={0.8}
          >
            <Text style={styles.languageFlag}>🇱🇹</Text>
            <Text
              style={[
                styles.languageBtnText,
                language === 'lt'
                  ? styles.languageBtnTextActive
                  : { color: isDark ? '#CBD5E1' : '#475569' },
              ]}
            >
              {t('profile.langLt')}
            </Text>
            {language === 'lt' && <Check size={16} color="#FFFFFF" />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.languageBtn,
              language === 'en'
                ? styles.languageBtnActive
                : {
                    backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                    borderColor: isDark ? '#334155' : '#CBD5E1',
                  },
            ]}
            onPress={() => handleLanguageChange('en')}
            activeOpacity={0.8}
          >
            <Text style={styles.languageFlag}>🇬🇧</Text>
            <Text
              style={[
                styles.languageBtnText,
                language === 'en'
                  ? styles.languageBtnTextActive
                  : { color: isDark ? '#CBD5E1' : '#475569' },
              ]}
            >
              {t('profile.langEn')}
            </Text>
            {language === 'en' && <Check size={16} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile Details Form Card */}
      <View
        style={[
          styles.formCard,
          {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderColor: isDark ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <Text
          style={[
            styles.cardTitle,
            { color: isDark ? '#F8FAFC' : '#0F172A' },
          ]}
        >
          {t('profile.formTitle')}
        </Text>

        {/* Full Name */}
        <View style={styles.inputGroup}>
          <View style={styles.inputLabelRow}>
            <User size={14} color={isDark ? '#94A3B8' : '#64748B'} />
            <Text
              style={[
                styles.inputLabel,
                { color: isDark ? '#94A3B8' : '#64748B' },
              ]}
            >
              {t('profile.nameLabel')}
            </Text>
          </View>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                borderColor: isDark ? '#334155' : '#CBD5E1',
                color: isDark ? '#F8FAFC' : '#0F172A',
              },
            ]}
            placeholder={t('profile.namePlaceholder')}
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Date of Birth */}
        <View style={styles.inputGroup}>
          <View style={styles.inputLabelRow}>
            <Calendar size={14} color={isDark ? '#94A3B8' : '#64748B'} />
            <Text
              style={[
                styles.inputLabel,
                { color: isDark ? '#94A3B8' : '#64748B' },
              ]}
            >
              {t('profile.dobLabel')}
            </Text>
            {calculatedAge !== null && (
              <View style={styles.ageBadge}>
                <Text style={styles.ageBadgeText}>
                  {calculatedAge} {t('profile.ageYearsOld')}
                </Text>
              </View>
            )}
          </View>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                borderColor: isDark ? '#334155' : '#CBD5E1',
                color: isDark ? '#F8FAFC' : '#0F172A',
              },
            ]}
            placeholder={t('profile.dobPlaceholder')}
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            maxLength={10}
          />
        </View>

        {/* Biological Sex */}
        <View style={styles.inputGroup}>
          <View style={styles.inputLabelRow}>
            <Sparkles size={14} color={isDark ? '#94A3B8' : '#64748B'} />
            <Text
              style={[
                styles.inputLabel,
                { color: isDark ? '#94A3B8' : '#64748B' },
              ]}
            >
              {t('profile.sexLabel')}
            </Text>
          </View>
          <Text
            style={[
              styles.fieldHelperText,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            {t('profile.sexHelper')}
          </Text>
          <View style={styles.segmentedRow}>
            {biologicalSexOptions.map((opt) => {
              const isSelected = biologicalSex === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.segmentedBtn,
                    isSelected
                      ? styles.segmentedBtnActive
                      : {
                          backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                          borderColor: isDark ? '#334155' : '#CBD5E1',
                        },
                  ]}
                  onPress={() => setBiologicalSex(opt.value)}
                >
                  <Text
                    style={[
                      styles.segmentedBtnText,
                      isSelected
                        ? styles.segmentedBtnTextActive
                        : { color: isDark ? '#CBD5E1' : '#475569' },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Clinical Notes */}
        <View style={styles.inputGroup}>
          <View style={styles.inputLabelRow}>
            <FileText size={14} color={isDark ? '#94A3B8' : '#64748B'} />
            <Text
              style={[
                styles.inputLabel,
                { color: isDark ? '#94A3B8' : '#64748B' },
              ]}
            >
              {t('profile.notesLabel')}
            </Text>
          </View>
          <TextInput
            style={[
              styles.textInput,
              styles.notesInput,
              {
                backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                borderColor: isDark ? '#334155' : '#CBD5E1',
                color: isDark ? '#F8FAFC' : '#0F172A',
              },
            ]}
            placeholder={t('profile.notesPlaceholder')}
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Save size={18} color="#FFFFFF" />
          <Text style={styles.saveBtnText}>
            {isSaving ? t('profile.savingBtn') : t('profile.saveBtn')}
          </Text>
        </TouchableOpacity>

        {showSavedToast && (
          <View style={styles.toastSuccess}>
            <Check size={16} color="#065F46" />
            <Text style={styles.toastText}>{t('profile.saveSuccess')}</Text>
          </View>
        )}
      </View>

      {/* Available Laboratories Card */}
      <View
        style={[
          styles.labsCard,
          {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderColor: isDark ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.labsCardHeader}>
          <View>
            <View style={styles.labsCardTitleRow}>
              <Building2 size={18} color="#2563EB" />
              <Text
                style={[
                  styles.cardTitle,
                  { color: isDark ? '#F8FAFC' : '#0F172A', marginBottom: 0 },
                ]}
              >
                {t('profile.labsTitle')} ({availableLabs.length})
              </Text>
            </View>
            <Text
              style={[
                styles.labsSubtitle,
                { color: isDark ? '#94A3B8' : '#64748B' },
              ]}
            >
              {t('profile.labsSubtitle')}
            </Text>
          </View>
        </View>

        <View style={styles.labsList}>
          {availableLabs.map((lab) => (
            <View
              key={lab.id}
              style={[
                styles.labItem,
                {
                  backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                },
              ]}
            >
              <View style={styles.labItemMain}>
                <View style={styles.labItemHeader}>
                  <Text
                    style={[
                      styles.labItemName,
                      { color: isDark ? '#F8FAFC' : '#0F172A' },
                    ]}
                  >
                    {lab.name}
                  </Text>
                </View>

                {lab.description && (
                  <Text
                    style={[
                      styles.labItemDesc,
                      { color: isDark ? '#CBD5E1' : '#64748B' },
                    ]}
                  >
                    {lab.description}
                  </Text>
                )}

                <View style={styles.labItemFooter}>
                  {lab.city && (
                    <Text
                      style={[
                        styles.labItemMeta,
                        { color: isDark ? '#94A3B8' : '#64748B' },
                      ]}
                    >
                      📍 {lab.city}
                    </Text>
                  )}
                  {lab.website && (
                    <Text
                      style={[
                        styles.labItemMeta,
                        { color: '#2563EB' },
                      ]}
                    >
                      🔗 {lab.website.replace('https://', '')}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 48,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextGroup: {
    justifyContent: 'center',
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  privacyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  languageButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  languageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  languageBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  languageFlag: {
    fontSize: 18,
  },
  languageBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  languageBtnTextActive: {
    color: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  ageBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  ageBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  notesInput: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  fieldHelperText: {
    fontSize: 12,
    marginBottom: 8,
  },
  segmentedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentedBtn: {
    flex: 1,
    minWidth: 70,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  segmentedBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  segmentedBtnTextActive: {
    color: '#FFFFFF',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 13,
    marginTop: 6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  toastSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  toastText: {
    fontSize: 13,
    color: '#065F46',
    fontWeight: '600',
  },
  labsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  labsCardHeader: {
    marginBottom: 14,
  },
  labsCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  labsSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  labsList: {
    gap: 10,
  },
  labItem: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  labItemMain: {
    flex: 1,
  },
  labItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  labItemName: {
    fontSize: 14,
    fontWeight: '700',
  },
  labItemDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  labItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  labItemMeta: {
    fontSize: 11,
    fontWeight: '500',
  },
});
