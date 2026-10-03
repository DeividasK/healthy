import {
  FHIRDiagnosticReport,
  FHIRObservation,
  FHIREpisodeOfCare,
} from '../types/fhir';
import { DiagnosticReportRecord } from './types';

export const INDEXED_DB_NAME = 'healthy_db';
export const INDEXED_DB_VERSION = 2;

export async function getWebDatabase(): Promise<null> {
  return null;
}

export async function insertDiagnosticReportWeb(
  _report: FHIRDiagnosticReport,
  _observations: FHIRObservation[]
): Promise<void> {}

export async function fetchAllDiagnosticReportsWeb(): Promise<
  DiagnosticReportRecord[]
> {
  return [];
}

export async function deleteDiagnosticReportWeb(
  _reportId: string
): Promise<void> {}

export async function insertEpisodeOfCareWeb(
  _episode: FHIREpisodeOfCare
): Promise<void> {}

export async function fetchAllEpisodesOfCareWeb(): Promise<
  FHIREpisodeOfCare[]
> {
  return [];
}

export async function fetchEpisodeOfCareByIdWeb(
  _id: string
): Promise<FHIREpisodeOfCare | null> {
  return null;
}

export async function deleteEpisodeOfCareWeb(_id: string): Promise<void> {}
