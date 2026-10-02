import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Legacy route redirect:
 * /add-report -> /lab-result/add
 * /add-report?id=xxx -> /lab-result/xxx/edit
 */
export default function LegacyAddReportRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  if (id) {
    return <Redirect href={`/lab-result/${id}/edit`} />;
  }

  return <Redirect href="/lab-result/add" />;
}
