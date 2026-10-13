import { encodeConditionCategory } from './conditionCategories';
import * as Crypto from 'expo-crypto';
import type { Condition, Coding } from 'fhir/r5';
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
export { CONDITION_CATEGORY_SYSTEM } from './conditionCategories';
export const CONDITION_SEVERITY_SYSTEM =
  'http://hl7.org/fhir/ValueSet/condition-severity';

export interface ConditionInput {
  id?: string;
  patientId?: string;
  title: string;
  clinicalStatus: string;
  verificationStatus: string;
  onsetDate?: string; // YYYY-MM-DD; unknown onset remains absent
  category?: string; // Standard category code/label or source category text
  severity?: string; // 'mild' | 'moderate' | 'severe'
  bodySite?: string;
  abatementDate?: string; // YYYY-MM-DD
  notes?: string;
  terminology?: Pick<Coding, 'system' | 'code' | 'display'>;
  /** Fields explicitly edited by the form; omitted for full service updates. */
  changedFields?: (keyof ConditionInput)[];
}

/**
 * Builds and persists a FHIR Condition record.
 */
export async function createOrUpdateCondition(
  input: ConditionInput,
  withinTransaction = false
): Promise<Condition> {
  const condId = input.id || `cond-${Crypto.randomUUID()}`;
  const trimmedTitle = input.title.trim();
  const patientId = input.patientId || 'patient-default';
  const existing = input.id ? await fetchConditionById(input.id) : null;
  if (input.id && input.changedFields && !existing)
    throw new Error('Condition not found');
  if (existing && existing.subject.reference !== `Patient/${patientId}`) {
    throw new Error('Cannot update another patient’s condition');
  }

  let condition: Condition = {
    resourceType: 'Condition',
    id: condId,
    meta: {
      lastUpdated: new Date().toISOString(),
    },
    clinicalStatus: {
      coding: [
        {
          system: CLINICAL_STATUS_SYSTEM,
          code: input.clinicalStatus,
        },
      ],
    },
    verificationStatus: input.verificationStatus
      ? {
          coding: [
            {
              system: VERIFICATION_STATUS_SYSTEM,
              code: input.verificationStatus,
            },
          ],
        }
      : undefined,
    category:
      input.category?.trim() === ''
        ? undefined
        : [encodeConditionCategory(input.category ?? 'problem-list-item')],
    code: {
      text: trimmedTitle,
    },
    subject: {
      reference: `Patient/${patientId}`,
      display: 'Self',
    },
    onsetDateTime: input.onsetDate || undefined,
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

  const changed = (field: keyof ConditionInput) =>
    !input.changedFields || input.changedFields.includes(field);
  if (existing) {
    const updated = condition;
    condition = { ...existing, meta: { ...existing.meta, ...updated.meta } };
    // Only replace fields the editor actually changed. Preserve unsupported choices,
    // extra codings, nested extensions and all other valid imported FHIR elements.
    if (changed('title'))
      condition.code = { ...existing.code, text: trimmedTitle };
    for (const field of [
      'clinicalStatus',
      'verificationStatus',
      'severity',
    ] as const) {
      if (!changed(field)) continue;
      const value = updated[field];
      if (value) {
        const previous = existing[field];
        const previousCoding = { ...previous?.coding?.[0] };
        const nextCoding = value.coding?.[0];
        const codingChanged =
          previousCoding.system !== nextCoding?.system ||
          previousCoding.code !== nextCoding?.code;
        // Labels and terminology versions describe the old coding, not its replacement.
        if (codingChanged) {
          delete previousCoding.display;
          delete previousCoding.version;
        }
        condition[field] = {
          ...previous,
          ...value,
          ...(codingChanged ? { text: undefined } : {}),
          coding: [
            { ...previousCoding, ...nextCoding },
            ...(previous?.coding?.slice(1) || []),
          ],
        };
      } else if (field !== 'clinicalStatus') {
        delete condition[field];
      }
    }
    if (changed('category') && input.category !== undefined) {
      const first = updated.category?.[0];
      const previous = existing.category?.[0];
      const rest = existing.category?.slice(1) || [];
      if (first) {
        condition.category = [
          {
            ...previous,
            ...first,
            text: first.text,
            coding: first.coding
              ? [
                  {
                    ...previous?.coding?.[0],
                    ...first.coding[0],
                    display: undefined,
                    version: undefined,
                  },
                  ...(previous?.coding?.slice(1) || []),
                ]
              : undefined,
          },
          ...rest,
        ];
      } else {
        condition.category = rest.length ? rest : undefined;
      }
    }
    if (changed('bodySite'))
      condition.bodySite = updated.bodySite
        ? [
            { ...existing.bodySite?.[0], ...updated.bodySite[0] },
            ...(existing.bodySite?.slice(1) || []),
          ]
        : undefined;
    if (changed('notes'))
      condition.note = updated.note
        ? [
            { ...existing.note?.[0], ...updated.note[0] },
            ...(existing.note?.slice(1) || []),
          ]
        : undefined;
    if (changed('onsetDate')) {
      delete condition.onsetAge;
      delete condition.onsetPeriod;
      delete condition.onsetRange;
      delete condition.onsetString;
      condition.onsetDateTime = updated.onsetDateTime;
    }
    if (changed('abatementDate')) {
      delete condition.abatementAge;
      delete condition.abatementPeriod;
      delete condition.abatementRange;
      delete condition.abatementString;
      condition.abatementDateTime = updated.abatementDateTime;
    }
  }
  if (input.terminology !== undefined && changed('terminology')) {
    const original = existing?.code?.coding?.[0];
    const coding: Coding = { ...original };
    for (const field of ['system', 'code', 'display'] as const) {
      const value = input.terminology[field]?.trim();
      if (value) coding[field] = value;
      else delete coding[field];
    }
    const populated = coding.system || coding.code || coding.display;
    const codings = [
      ...(populated ? [coding] : []),
      ...(existing?.code?.coding?.slice(1) || []),
    ];
    condition.code = { ...condition.code };
    if (codings.length) condition.code.coding = codings;
    else delete condition.code.coding;
  }

  await insertConditionRecord(condition, patientId, false, withinTransaction);
  return condition;
}

/**
 * Fetches all Conditions, optionally filtered by patientId.
 */
export async function getAllConditions(
  patientId?: string
): Promise<Condition[]> {
  return await fetchAllConditionRecords(patientId);
}

/**
 * Fetches a single Condition by ID.
 */
export async function getConditionById(
  id: string,
  patientId?: string
): Promise<Condition | null> {
  const condition = await fetchConditionById(id);
  return patientId && condition?.subject.reference !== `Patient/${patientId}`
    ? null
    : condition;
}

/**
 * Deletes a Condition by ID.
 */
export async function deleteCondition(id: string): Promise<void> {
  await deleteConditionRecord(id);
}
