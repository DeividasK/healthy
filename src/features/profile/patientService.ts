import * as Crypto from 'expo-crypto';
import type { Patient } from 'fhir/r5';
import {
  insertPatientRecord,
  fetchAllPatients,
  fetchPatientById,
  deletePatientRecord,
  getActivePatientId,
  setActivePatientId,
  clearActivePatientId,
  DEFAULT_PATIENT_ID,
} from './patientRepository';
import { getPatientDisplayName } from './patientNames';
import { removePatientFromDevice } from '@/src/features/sync/engine';

export { getPatientDisplayName, getPatientInitials } from './patientNames';

export interface PatientInput {
  id?: string;
  givenName: string;
  familyName?: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string; // YYYY-MM-DD
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

  await insertPatientRecord(patient);
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
 * Deletes a patient by ID and handles switching active patient or clearing if empty.
 * With `deviceOnly`, the profile is removed from this device but stays in the
 * cloud and on other synced devices.
 */
export async function deletePatient(
  id: string,
  options: { deviceOnly?: boolean } = {}
): Promise<{ remainingCount: number; newActiveId: string | null }> {
  if (options.deviceOnly) {
    const patient = await fetchPatientById(id);
    await removePatientFromDevice(id, getPatientDisplayName(patient));
  } else {
    await deletePatientRecord(id);
  }
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

export { DEFAULT_PATIENT_ID };
