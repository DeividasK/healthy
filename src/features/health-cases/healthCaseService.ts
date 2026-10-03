import * as Crypto from 'expo-crypto';
import { FHIREpisodeOfCare, FHIREpisodeOfCareStatus } from '../../types/fhir';
import {
  insertEpisodeOfCareRecord,
  fetchAllEpisodeOfCareRecords,
  fetchEpisodeOfCareById,
  deleteEpisodeOfCareRecord,
} from './healthCasesRepository';

export interface HealthCaseInput {
  id?: string;
  title: string;
  status: FHIREpisodeOfCareStatus;
  startDate: string; // YYYY-MM-DD
  description?: string;
}

/**
 * Builds and persists a FHIR EpisodeOfCare record.
 */
export async function createOrUpdateHealthCase(
  input: HealthCaseInput
): Promise<FHIREpisodeOfCare> {
  const caseId = input.id || `eoc-${Crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const trimmedTitle = input.title.trim();

  const episode: FHIREpisodeOfCare = {
    resourceType: 'EpisodeOfCare',
    id: caseId,
    status: input.status,
    period: {
      start: input.startDate,
    },
    type: [
      {
        text: trimmedTitle,
      },
    ],
    diagnosis: [
      {
        condition: {
          display: trimmedTitle,
        },
      },
    ],
    description: trimmedTitle,
    note:
      input.description && input.description.trim()
        ? [
            {
              text: input.description.trim(),
              time: now,
            },
          ]
        : undefined,
  };

  await insertEpisodeOfCareRecord(episode);
  return episode;
}

/**
 * Fetches all Health Cases.
 */
export async function getAllHealthCases(): Promise<FHIREpisodeOfCare[]> {
  return await fetchAllEpisodeOfCareRecords();
}

/**
 * Fetches a single Health Case by ID.
 */
export async function getHealthCaseById(
  id: string
): Promise<FHIREpisodeOfCare | null> {
  return await fetchEpisodeOfCareById(id);
}

/**
 * Deletes a Health Case by ID.
 */
export async function deleteHealthCase(id: string): Promise<void> {
  await deleteEpisodeOfCareRecord(id);
}
