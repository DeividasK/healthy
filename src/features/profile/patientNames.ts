import type { Patient } from 'fhir/r5';

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
