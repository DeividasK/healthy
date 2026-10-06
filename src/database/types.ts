import type {
  DiagnosticReport,
  Observation,
  Condition,
  Patient,
} from 'fhir/r5';

export interface StoredPatientRow {
  id: string;
  given_name: string;
  family_name: string | null;
  gender: string | null;
  birth_date: string | null;
  fhir_json: string;
  created_at: string;
  updated_at: string;
}

export interface StoredDiagnosticReportRow {
  id: string;
  patient_id: string;
  effective_date: string;
  status: string;
  notes: string | null;
  fhir_json: string;
  created_at: string;
  updated_at: string;
}

export interface StoredObservationRow {
  id: string;
  report_id: string;
  loinc_code: string;
  name: string;
  value: number;
  unit: string;
  fhir_json: string;
  created_at: string;
}

export interface DiagnosticReportRecord {
  report: DiagnosticReport;
  observations: Observation[];
}

export interface StoredConditionRow {
  id: string;
  patient_id: string;
  clinical_status: string;
  verification_status: string;
  onset_date: string;
  title: string;
  severity: string | null;
  body_site: string | null;
  abatement_date: string | null;
  description: string | null;
  fhir_json: string;
  created_at: string;
  updated_at: string;
}

export interface ConditionRecord {
  condition: Condition;
}

export interface PatientRecord {
  patient: Patient;
}
