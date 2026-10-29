import { useEffect, useState } from 'react';
import type { Condition } from 'fhir/r5';
import { getAllConditions } from '@/src/features/conditions/conditionService';
import { getConditionTitle } from '@/src/utils/fhirUtils';
import type { ExistingCondition } from './proposals';

/** The patient's conditions as the review matches them. */
export const toExistingConditions = (
  conditions: Condition[]
): ExistingCondition[] =>
  conditions.map((condition) => ({
    id: condition.id!,
    title: getConditionTitle(condition),
    code: condition.code?.coding?.[0]?.code,
    system: condition.code?.coding?.[0]?.system,
  }));

/** The patient's conditions, which a proposed diagnosis may already be. */
export function useExistingConditions(patientId: string) {
  const [existing, setExisting] = useState<ExistingCondition[]>([]);
  useEffect(() => {
    let cancelled = false;
    getAllConditions(patientId)
      .then((conditions) => {
        if (!cancelled) setExisting(toExistingConditions(conditions));
      })
      .catch((err) => console.warn('Failed to load conditions:', err));
    return () => {
      cancelled = true;
    };
  }, [patientId]);
  return existing;
}
