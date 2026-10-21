import React from 'react';
import { Redirect } from 'expo-router';

// Kept so older links still land on the restore screen.
export default function RestoreFromFileScreen() {
  return <Redirect href="/profile/restore" />;
}
