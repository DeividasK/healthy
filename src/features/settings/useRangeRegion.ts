import { useCallback, useEffect, useState } from 'react';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import type { RangeRegion } from '@/src/data/biomarkers/rangeRegions';
import { getDeviceRangeRegion } from './deviceRangeRegion';
import { getProfileSettings } from './profileSettingsRepository';

/**
 * The region whose biomarker ranges the profile uses: the one picked in
 * Settings, else the device's. Kept current as settings change.
 */
export function useRangeRegion(patientId: string | null | undefined) {
  const [deviceRegion] = useState(getDeviceRangeRegion);
  const [stored, setStored] = useState<{
    patientId: string;
    region?: RangeRegion;
  } | null>(null);

  const load = useCallback(() => {
    if (!patientId) return;
    void getProfileSettings(patientId)
      .then((settings) =>
        setStored({ patientId, region: settings.rangeRegion })
      )
      .catch((err) => console.error('Failed to load range region:', err));
  }, [patientId]);

  useEffect(load, [load]);
  useDatabaseSubscription(['profile_settings'], load);

  return (stored?.patientId === patientId && stored?.region) || deviceRegion;
}
