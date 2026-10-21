import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

// Kept so older links still land on the restore screen.
export default function RestoreFromGoogleDriveScreen() {
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  return (
    <Redirect href={pick ? '/profile/restore?pick=1' : '/profile/restore'} />
  );
}
