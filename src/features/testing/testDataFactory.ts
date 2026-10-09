import {
  type SeedPatientOptions,
  type SeedConditionOptions,
  type SeedReportOptions,
} from './testSeed';

let entityCounter = 0;

function nextId(prefix: string): string {
  entityCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${entityCounter}`;
}

/**
 * Builds a deterministic or unique Patient data object.
 */
export function buildPatientData(
  overrides?: Partial<SeedPatientOptions>
): SeedPatientOptions {
  const id = overrides?.id ?? nextId('patient');
  return {
    id,
    givenName: overrides?.givenName ?? 'John',
    familyName: overrides?.familyName ?? 'Doe',
    gender: overrides?.gender ?? 'male',
    birthDate: overrides?.birthDate ?? '1990-01-01',
    syncAccount: overrides?.syncAccount,
  };
}

/**
 * Builds a deterministic or unique Condition data object.
 */
export function buildConditionData(
  overrides?: Partial<SeedConditionOptions>
): SeedConditionOptions {
  const id = overrides?.id ?? nextId('condition');
  return {
    id,
    patientId: overrides?.patientId,
    title: overrides?.title ?? `Test Condition ${entityCounter + 1}`,
    status: overrides?.status ?? 'active',
    notes: overrides?.notes,
    onsetDate: overrides?.onsetDate ?? new Date().toISOString().split('T')[0],
  };
}

/**
 * Builds a deterministic or unique DiagnosticReport data object.
 */
export function buildReportData(
  overrides?: Partial<SeedReportOptions>
): SeedReportOptions {
  const id = overrides?.id ?? nextId('report');
  return {
    id,
    patientId: overrides?.patientId,
    date: overrides?.date ?? new Date().toISOString().split('T')[0],
    notes: overrides?.notes,
    biomarkers: overrides?.biomarkers ?? [
      { name: 'Hemoglobin', value: 14.5, unit: 'g/dL' },
      { name: 'White Blood Cells', value: 6.8, unit: '10*3/uL' },
    ],
  };
}
