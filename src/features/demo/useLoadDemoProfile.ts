import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { createDemoProfile } from './demoProfile';

/**
 * Creates the demo profile, switches to it and opens its Home. `loading` is
 * true while its records are written; `error` says when that failed.
 * `loadDemo` resolves to whether the demo was created.
 */
export function useLoadDemoProfile() {
  const router = useRouter();
  const { setActivePatientId, refreshPatients } = useActivePatient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDemo = async (): Promise<boolean> => {
    if (loading) return false;
    setLoading(true);
    setError(null);
    try {
      const patientId = await createDemoProfile();
      await setActivePatientId(patientId);
      await refreshPatients();
      router.dismissTo('/');
      return true;
    } catch (err) {
      console.error('Failed to create the demo profile:', err);
      setError('Could not load the demo. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { loadDemo, loading, error };
}
