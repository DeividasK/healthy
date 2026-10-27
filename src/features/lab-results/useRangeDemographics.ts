import { useMemo } from 'react';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { useRangeRegion } from '@/src/features/settings/useRangeRegion';
import {
  getRangeDemographics,
  type RangeDemographics,
} from './referenceRanges';

/** The active profile's sex, date of birth and range region. */
export function useRangeDemographics(): RangeDemographics {
  const { activePatient, activePatientId } = useActivePatient();
  const gender = activePatient?.gender;
  const birthDate = activePatient?.birthDate;
  const region = useRangeRegion(activePatientId);
  return useMemo(
    () => ({
      ...getRangeDemographics({ resourceType: 'Patient', gender, birthDate }),
      region,
    }),
    [gender, birthDate, region]
  );
}
