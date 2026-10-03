import * as Crypto from 'expo-crypto';
import type { Condition } from 'fhir/r5';
import {
  insertConditionRecord,
  fetchAllConditionRecords,
  fetchConditionById,
  deleteConditionRecord,
} from './conditionsRepository';

export const CLINICAL_STATUS_SYSTEM =
  'http://terminology.hl7.org/CodeSystem/condition-clinical';
export const VERIFICATION_STATUS_SYSTEM =
  'http://terminology.hl7.org/CodeSystem/condition-ver-status';
export const CONDITION_CATEGORY_SYSTEM =
  'http://terminology.hl7.org/CodeSystem/condition-category';
export const CONDITION_SEVERITY_SYSTEM =
  'http://hl7.org/fhir/ValueSet/condition-severity';

export interface ConditionInput {
  id?: string;
  title: string;
  clinicalStatus: string;
  verificationStatus: string;
  onsetDate: string; // YYYY-MM-DD
  severity?: string; // 'mild' | 'moderate' | 'severe'
  bodySite?: string;
  abatementDate?: string; // YYYY-MM-DD
  notes?: string;
}

/**
 * Builds and persists a FHIR Condition record.
 */
export async function createOrUpdateCondition(
  input: ConditionInput
): Promise<Condition> {
  const condId = input.id || `cond-${Crypto.randomUUID()}`;
  const trimmedTitle = input.title.trim();

  const condition: Condition = {
    resourceType: 'Condition',
    id: condId,
    clinicalStatus: {
      coding: [
        {
          system: CLINICAL_STATUS_SYSTEM,
          code: input.clinicalStatus,
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: VERIFICATION_STATUS_SYSTEM,
          code: input.verificationStatus,
        },
      ],
    },
    category: [
      {
        coding: [
          {
            system: CONDITION_CATEGORY_SYSTEM,
            code: 'problem-list-item',
          },
        ],
      },
    ],
    code: {
      text: trimmedTitle,
    },
    subject: {
      display: 'Self',
    },
    onsetDateTime: input.onsetDate,
    severity: input.severity
      ? {
          coding: [
            {
              system: CONDITION_SEVERITY_SYSTEM,
              code: input.severity,
              display:
                input.severity.charAt(0).toUpperCase() +
                input.severity.slice(1),
            },
          ],
        }
      : undefined,
    bodySite:
      input.bodySite && input.bodySite.trim()
        ? [
            {
              text: input.bodySite.trim(),
            },
          ]
        : undefined,
    abatementDateTime: input.abatementDate || undefined,
    note:
      input.notes && input.notes.trim()
        ? [
            {
              text: input.notes.trim(),
            },
          ]
        : undefined,
  };

  await insertConditionRecord(condition);
  return condition;
}

/**
 * Fetches all Conditions.
 */
export async function getAllConditions(): Promise<Condition[]> {
  return await fetchAllConditionRecords();
}

/**
 * Fetches a single Condition by ID.
 */
export async function getConditionById(id: string): Promise<Condition | null> {
  return await fetchConditionById(id);
}

/**
 * Deletes a Condition by ID.
 */
export async function deleteCondition(id: string): Promise<void> {
  await deleteConditionRecord(id);
}
