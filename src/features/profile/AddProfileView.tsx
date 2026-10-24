import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArchiveRestore, Compass } from 'lucide-react-native';
import { ResourceRow } from '@/src/components/ResourceSection';
import { RowIconDisc } from '@/src/components/IconDisc';
import { COLORS } from '@/src/theme/colors';
import { FormErrorBanner } from '@/src/components/FormErrorBanner';
import { useLoadDemoProfile } from '@/src/features/demo/useLoadDemoProfile';
import { ProfileForm } from './ProfileForm';
import { createOrUpdatePatient, type PatientInput } from './patientService';
import { useActivePatient } from './ActivePatientContext';

/**
 * Adds a profile for someone else on this device. Saving switches to it and
 * opens its empty Home, ready for a first record.
 */
export function AddProfileView() {
  const router = useRouter();
  const { setActivePatientId, refreshPatients } = useActivePatient();
  const demo = useLoadDemoProfile();

  const handleSave = async (values: PatientInput) => {
    const created = await createOrUpdatePatient(values);
    if (created.id) await setActivePatientId(created.id);
    await refreshPatients();
    router.dismissTo('/');
  };

  return (
    <ProfileForm
      navigateOnSave={false}
      onSave={handleSave}
      heading={
        <View style={styles.heading}>
          <Text
            accessibilityRole="header"
            style={styles.title}
            testID="add-profile-header-title"
          >
            Add a profile
          </Text>
          <Text style={styles.subtitle}>
            For someone whose health you look after, like a child or a parent.
            Each profile keeps its own records.
          </Text>
        </View>
      }
      footer={
        <View style={styles.restore}>
          <ResourceRow
            title="Restore a profile instead"
            description="From Google Drive or a backup file"
            leading={<RowIconDisc icon={ArchiveRestore} />}
            onPress={() => router.push('/profile/restore')}
            accessibilityLabel="Restore a profile instead"
            testID="add-profile-restore"
          />
          <ResourceRow
            title="Explore a demo profile"
            description={
              demo.loading
                ? 'Adding sample records…'
                : 'A sample person with three years of records'
            }
            leading={<RowIconDisc icon={Compass} />}
            onPress={demo.loadDemo}
            accessibilityLabel="Explore a demo profile"
            testID="add-profile-demo"
          />
          {demo.error && (
            <FormErrorBanner
              message={demo.error}
              testID="add-profile-demo-error"
            />
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  heading: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.light.textSecondary,
  },
  restore: {
    marginTop: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.cardBorder,
  },
});
