import * as Crypto from 'expo-crypto';
import type { Patient } from 'fhir/r5';
import {
  insertPatientRecord,
  fetchAllPatients,
  fetchAllStoredPatients,
  fetchPatientById,
  fetchStoredPatientById,
  type StoredPatient,
  deletePatientRecord,
  getActivePatientId,
  setActivePatientId,
  clearActivePatientId,
  updatePatientSyncAccount,
  DEFAULT_PATIENT_ID,
} from './patientRepository';

export interface PatientInput {
  id?: string;
  givenName: string;
  familyName?: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string; // YYYY-MM-DD
  syncAccount?: string | null;
}

/**
 * Returns a human-friendly display name for a FHIR Patient.
 */
export function getPatientDisplayName(patient?: Patient | null): string {
  if (!patient || !patient.name || patient.name.length === 0) {
    return 'Self';
  }
  const name = patient.name[0];
  const given = name.given?.join(' ') || '';
  const family = name.family || '';
  const full = `${given} ${family}`.trim();
  return full || name.text || 'Self';
}

/**
 * Returns 1-2 letter initials for the patient avatar.
 */
export function getPatientInitials(patient?: Patient | null): string {
  if (!patient || !patient.name || patient.name.length === 0) {
    return 'S';
  }
  const name = patient.name[0];
  const given = name.given?.[0] || '';
  const family = name.family || '';
  if (given && family) {
    return `${given.charAt(0)}${family.charAt(0)}`.toUpperCase();
  }
  if (given) {
    return given.slice(0, 2).toUpperCase();
  }
  return 'S';
}

/**
 * Builds and persists a FHIR Patient resource.
 */
export async function createOrUpdatePatient(
  input: PatientInput
): Promise<Patient> {
  const patientId = input.id || `patient-${Crypto.randomUUID()}`;
  const trimmedGiven = input.givenName.trim();
  const trimmedFamily = input.familyName?.trim();

  const patient: Patient = {
    resourceType: 'Patient',
    id: patientId,
    meta: {
      lastUpdated: new Date().toISOString(),
    },
    active: true,
    name: [
      {
        use: 'official',
        given: [trimmedGiven],
        family: trimmedFamily || undefined,
        text: trimmedFamily ? `${trimmedGiven} ${trimmedFamily}` : trimmedGiven,
      },
    ],
    gender: input.gender || undefined,
    birthDate: input.birthDate || undefined,
  };

  await insertPatientRecord(patient, input.syncAccount);
  return patient;
}

/**
 * Retrieves all patients.
 */
export async function getAllPatients(): Promise<Patient[]> {
  return await fetchAllPatients();
}

/**
 * Retrieves a patient by ID.
 */
export async function getPatient(id: string): Promise<Patient | null> {
  return await fetchPatientById(id);
}

/**
 * Retrieves a stored patient with syncAccount by ID.
 */
export async function getStoredPatient(
  id: string
): Promise<StoredPatient | null> {
  return await fetchStoredPatientById(id);
}

/**
 * Retrieves all stored patients with syncAccount.
 */
export async function getAllStoredPatients(): Promise<StoredPatient[]> {
  return await fetchAllStoredPatients();
}

export type { StoredPatient };

/**
 * Deletes a patient by ID and handles switching active patient or clearing if empty.
 */
export async function deletePatient(
  id: string
): Promise<{ remainingCount: number; newActiveId: string | null }> {
  await deletePatientRecord(id);
  const remaining = await fetchAllPatients();
  const currentActiveId = await getActivePatientId();

  if (remaining.length === 0) {
    await clearActivePatientId();
    return { remainingCount: 0, newActiveId: null };
  }

  if (currentActiveId === id) {
    const nextActive = remaining[0].id || null;
    if (nextActive) {
      await setActivePatientId(nextActive);
    } else {
      await clearActivePatientId();
    }
    return { remainingCount: remaining.length, newActiveId: nextActive };
  }

  return { remainingCount: remaining.length, newActiveId: currentActiveId };
}

/**
 * Gets the current active patient, or null if no patients exist.
 */
export async function getActivePatient(): Promise<Patient | null> {
  const allPatients = await fetchAllPatients();
  if (allPatients.length === 0) {
    return null;
  }

  const activeId = await getActivePatientId();
  const patient = allPatients.find((p) => p.id === activeId);
  if (patient) {
    return patient;
  }

  // If active patient not found among existing patients, pick the first one
  const firstPatient = allPatients[0];
  if (firstPatient.id) {
    await setActivePatientId(firstPatient.id);
  }
  return firstPatient;
}

/**
 * Switches the active patient to the specified patientId.
 */
export async function switchActivePatient(patientId: string): Promise<void> {
  await setActivePatientId(patientId);
}

export { DEFAULT_PATIENT_ID, updatePatientSyncAccount };
