import * as Crypto from 'expo-crypto';
import type { EpisodeOfCare } from 'fhir/r5';
import {
  insertEpisodeOfCareRecord,
  fetchAllEpisodeOfCareRecords,
  fetchEpisodeOfCareById,
  deleteEpisodeOfCareRecord,
} from './healthCasesRepository';
import { createNarrativeDiv } from '../../utils/fhirUtils';

export interface HealthCaseInput {
  id?: string;
  title: string;
  status: EpisodeOfCare['status'];
  startDate: string; // YYYY-MM-DD
  description?: string;
}

/**
 * Builds and persists a FHIR EpisodeOfCare record.
 */
export async function createOrUpdateHealthCase(
  input: HealthCaseInput
): Promise<EpisodeOfCare> {
  const caseId = input.id || `eoc-${Crypto.randomUUID()}`;
  const trimmedTitle = input.title.trim();

  const episode: EpisodeOfCare = {
    resourceType: 'EpisodeOfCare',
    id: caseId,
    status: input.status,
    patient: {
      display: 'Self',
    },
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
        condition: [
          {
            concept: {
              text: trimmedTitle,
            },
          },
        ],
      },
    ],
    text:
      input.description && input.description.trim()
        ? {
            status: 'generated',
            div: createNarrativeDiv(input.description.trim()),
          }
        : undefined,
  };

  await insertEpisodeOfCareRecord(episode);
  return episode;
}

/**
 * Fetches all Health Cases.
 */
export async function getAllHealthCases(): Promise<EpisodeOfCare[]> {
  return await fetchAllEpisodeOfCareRecords();
}

/**
 * Fetches a single Health Case by ID.
 */
export async function getHealthCaseById(
  id: string
): Promise<EpisodeOfCare | null> {
  return await fetchEpisodeOfCareById(id);
}

/**
 * Deletes a Health Case by ID.
 */
export async function deleteHealthCase(id: string): Promise<void> {
  await deleteEpisodeOfCareRecord(id);
}
