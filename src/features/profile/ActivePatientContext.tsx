import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import type { Patient } from 'fhir/r5';
import {
  getActivePatient,
  getAllPatients,
  getPatient,
  switchActivePatient,
  getPatientDisplayName,
} from './patientService';

interface ActivePatientContextValue {
  activePatient: Patient | null;
  activePatientId: string;
  activePatientName: string;
  patients: Patient[];
  isLoading: boolean;
  setActivePatientId: (patientId: string) => Promise<void>;
  refreshPatients: () => Promise<void>;
}

const ActivePatientContext = createContext<ActivePatientContextValue | null>(
  null
);

export function ActivePatientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activePatient, setActivePatient] = useState<Patient | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPatients = useCallback(async () => {
    try {
      const [currActive, all] = await Promise.all([
        getActivePatient(),
        getAllPatients(),
      ]);
      setActivePatient(currActive);
      setPatients(all);
    } catch (err) {
      console.error('Failed to load active patient context:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [currActive, all] = await Promise.all([
          getActivePatient(),
          getAllPatients(),
        ]);
        if (!isMounted) return;
        setActivePatient(currActive);
        setPatients(all);
      } catch (err) {
        console.error('Failed to load active patient context:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSetActivePatientId = async (patientId: string) => {
    try {
      await switchActivePatient(patientId);
      const updated = await getPatient(patientId);
      if (updated) {
        setActivePatient(updated);
      } else {
        await loadPatients();
      }
    } catch (err) {
      console.error('Failed to switch active patient:', err);
      throw err;
    }
  };

  const activePatientId = activePatient?.id || 'patient-default';
  const activePatientName = getPatientDisplayName(activePatient);

  return (
    <ActivePatientContext.Provider
      value={{
        activePatient,
        activePatientId,
        activePatientName,
        patients,
        isLoading,
        setActivePatientId: handleSetActivePatientId,
        refreshPatients: loadPatients,
      }}
    >
      {children}
    </ActivePatientContext.Provider>
  );
}

export function useActivePatient() {
  const ctx = useContext(ActivePatientContext);
  if (!ctx) {
    throw new Error(
      'useActivePatient must be used within an ActivePatientProvider'
    );
  }
  return ctx;
}
