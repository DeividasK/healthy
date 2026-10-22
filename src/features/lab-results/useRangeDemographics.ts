import { useMemo } from 'react';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import {
  getRangeDemographics,
  type RangeDemographics,
} from './referenceRanges';

/** The active profile's sex and date of birth, for reference ranges. */
export function useRangeDemographics(): RangeDemographics {
  const { activePatient } = useActivePatient();
  const gender = activePatient?.gender;
  const birthDate = activePatient?.birthDate;
  return useMemo(
    () => getRangeDemographics({ resourceType: 'Patient', gender, birthDate }),
    [gender, birthDate]
  );
}
