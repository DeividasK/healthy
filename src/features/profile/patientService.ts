import * as Crypto from 'expo-crypto';
import type { Patient } from 'fhir/r5';
import {
  insertPatientRecord,
  fetchAllPatients,
  fetchPatientById,
  deletePatientRecord,
  getActivePatientId,
  setActivePatientId,
  DEFAULT_PATIENT_ID,
} from './patientRepository';

export interface PatientInput {
  id?: string;
  givenName: string;
  familyName?: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string; // YYYY-MM-DD
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
 * Deletes a patient by ID.
 */
export async function deletePatient(id: string): Promise<void> {
  await deletePatientRecord(id);
}

/**
 * Gets the current active patient.
 */
export async function getActivePatient(): Promise<Patient> {
  const activeId = await getActivePatientId();
  const patient = await fetchPatientById(activeId);
  if (patient) {
    return patient;
  }

  // Fallback to default patient if found
  const defaultPatient = await fetchPatientById(DEFAULT_PATIENT_ID);
  if (defaultPatient) {
    await setActivePatientId(DEFAULT_PATIENT_ID);
    return defaultPatient;
  }

  // If no patient exists at all, bootstrap default
  const fallback = await createOrUpdatePatient({
    id: DEFAULT_PATIENT_ID,
    givenName: 'Self',
  });
  await setActivePatientId(DEFAULT_PATIENT_ID);
  return fallback;
}

/**
 * Switches the active patient to the specified patientId.
 */
export async function switchActivePatient(patientId: string): Promise<void> {
  await setActivePatientId(patientId);
}

export { DEFAULT_PATIENT_ID };
