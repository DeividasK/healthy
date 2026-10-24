import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { createDemoProfile } from './demoProfile';

/**
 * Creates the demo profile, switches to it and opens its Home. `loading` is
 * true while its records are written; `error` says when that failed.
 */
export function useLoadDemoProfile() {
  const router = useRouter();
  const { setActivePatientId, refreshPatients } = useActivePatient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDemo = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const patientId = await createDemoProfile();
      await setActivePatientId(patientId);
      await refreshPatients();
      router.dismissTo('/');
    } catch (err) {
      console.error('Failed to create the demo profile:', err);
      setError('Could not load the demo. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return { loadDemo, loading, error };
}
