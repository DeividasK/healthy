import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useActivePatient } from './ActivePatientContext';
import { getAllPatients } from './patientService';
import { COLORS } from '@/src/theme/colors';
import { LoadingView } from '@/src/components/LoadingView';
import { ProfileHeader } from './ProfileHeader';
import { ProfileSwitcher } from './ProfileSwitcher';
import { ProfileBackupRows } from './ProfileBackupRows';
import { CONTENT_COLUMN } from '@/src/theme/layout';

export function ProfileView() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    activePatient,
    activePatientId,
    patients,
    isLoading,
    setActivePatientId,
    refreshPatients,
  } = useActivePatient();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  React.useEffect(() => {
    // Only while shown: under another screen (e.g. after the last profile was
    // deleted from its edit screen) it would replace whatever is on top.
    if (pathname !== '/profile') return;
    if (!isLoading && patients.length === 0) {
      let isMounted = true;
      getAllPatients().then((actualPatients) => {
        if (!isMounted) return;
        if (actualPatients.length === 0) {
          router.replace('/welcome');
        } else {
          refreshPatients();
        }
      });
      return () => {
        isMounted = false;
      };
    }
  }, [isLoading, patients.length, pathname, refreshPatients, router]);

  const targetId =
    activePatient?.id ||
    activePatientId ||
    (patients.length > 0 ? patients[0].id : null);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.container}>
          <LoadingView />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {switcherOpen && (
            <ProfileSwitcher
              patients={patients}
              activePatientId={activePatientId}
              onSelect={(id) => {
                setActivePatientId(id);
                setSwitcherOpen(false);
              }}
              onAdd={() => {
                setSwitcherOpen(false);
                router.push('/profile/new');
              }}
            />
          )}
          {activePatient && (
            <ProfileHeader
              patient={activePatient}
              switcherOpen={switcherOpen}
              onToggleSwitcher={() => setSwitcherOpen((open) => !open)}
            />
          )}
          <View style={styles.rows}>
            <ProfileBackupRows />
          </View>
        </ScrollView>
        {targetId && (
          <ResourceActionDock
            onEdit={() => router.push(`/profile/${targetId}/edit`)}
            editLabel="Edit Profile"
            editTestID="edit-profile-button"
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    ...CONTENT_COLUMN,
    paddingHorizontal: 20,
    paddingBottom: 132,
  },
  // The first row's top divider; each row draws the one below it.
  rows: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.light.cardBorder,
  },
});
