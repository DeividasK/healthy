import { useEffect, useSyncExternalStore } from 'react';
import {
  subscribeToDatabaseChanges,
  type DatabaseTable,
} from '@/src/database/dbEvents';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { getProfileSettings } from '@/src/features/settings/profileSettingsRepository';
import { buildBiomarkerRanges, type BiomarkerRanges } from './biomarkerRanges';
import { getAllReports } from './diagnosticReportService';

const WATCHED: DatabaseTable[] = [
  'diagnostic_reports',
  'observations',
  'profile_settings',
];

/** Loaded range histories by profile, shared by every screen and row. */
const loaded = new Map<string, BiomarkerRanges>();
const loading = new Map<string, Promise<void>>();
/** Profiles whose data changed while their ranges were loading. */
const reloadAfter = new Set<string>();
const listeners = new Set<() => void>();
let unsubscribeDatabase: (() => void) | undefined;

/** Loads a profile's ranges, again after one under way if it overlaps. */
function load(patientId: string) {
  if (loading.has(patientId)) {
    reloadAfter.add(patientId);
    return;
  }
  const promise = Promise.all([
    getAllReports(patientId),
    getProfileSettings(patientId),
  ])
    .then(([records, settings]) => {
      loaded.set(
        patientId,
        buildBiomarkerRanges(records, settings.biomarkerRanges)
      );
      listeners.forEach((listener) => listener());
    })
    .catch((error) => console.error('Failed to load biomarker ranges:', error))
    .finally(() => {
      loading.delete(patientId);
      if (reloadAfter.delete(patientId)) load(patientId);
    });
  loading.set(patientId, promise);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  unsubscribeDatabase ??= subscribeToDatabaseChanges((tables) => {
    if (!tables.some((table) => WATCHED.includes(table))) return;
    for (const patientId of loaded.keys()) load(patientId);
  });
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    unsubscribeDatabase?.();
    unsubscribeDatabase = undefined;
  };
}

/**
 * The active profile's range histories: the ranges on its lab reports and
 * the ones it set. Undefined until first loaded, when results fall back to
 * their own printed ranges. Each screen showing it refreshes it; parts of a
 * screen, like its rows, pass `refresh: false` to only load it once.
 */
export function useBiomarkerRanges({ refresh = true } = {}):
  BiomarkerRanges | undefined {
  const { activePatientId } = useActivePatient();
  const ranges = useSyncExternalStore(
    subscribe,
    () => (activePatientId ? loaded.get(activePatientId) : undefined),
    () => undefined
  );
  useEffect(() => {
    if (!activePatientId) return;
    const known = loaded.has(activePatientId) || loading.has(activePatientId);
    if (refresh || !known) load(activePatientId);
  }, [activePatientId, refresh]);
  return ranges;
}
