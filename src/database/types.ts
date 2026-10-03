import type { DiagnosticReport, Observation, EpisodeOfCare } from 'fhir/r5';

export interface StoredDiagnosticReportRow {
  id: string;
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

export interface StoredEpisodeOfCareRow {
  id: string;
  status: string;
  start_date: string;
  title: string;
  description: string | null;
  fhir_json: string;
  created_at: string;
  updated_at: string;
}

export interface HealthCaseRecord {
  episodeOfCare: EpisodeOfCare;
}
