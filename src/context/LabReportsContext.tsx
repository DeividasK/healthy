import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { LabReport } from '../types/health';
import * as storage from '../services/storage';
import { DatabaseVersionInfo } from '../database/types';
import { SAMPLE_WHOOP_LAB_REPORT } from '../data/sampleWhoopLabs';

interface LabReportsState {
  reports: LabReport[];
  isLoading: boolean;
  error: string | null;
}

type LabReportsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOAD_REPORTS_SUCCESS'; payload: LabReport[] }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SAVE_REPORT_SUCCESS'; payload: LabReport[] }
  | { type: 'DELETE_REPORT_SUCCESS'; payload: LabReport[] };

const initialState: LabReportsState = {
  reports: [],
  isLoading: true,
  error: null,
};

function labReportsReducer(
  state: LabReportsState,
  action: LabReportsAction
): LabReportsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'LOAD_REPORTS_SUCCESS':
      return { ...state, reports: action.payload, isLoading: false, error: null };
    case 'SAVE_REPORT_SUCCESS':
      return { ...state, reports: action.payload, isLoading: false, error: null };
    case 'DELETE_REPORT_SUCCESS':
      return { ...state, reports: action.payload, isLoading: false, error: null };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    default:
      return state;
  }
}

interface LabReportsContextValue {
  reports: LabReport[];
  isLoading: boolean;
  error: string | null;
  versionInfo: DatabaseVersionInfo | null;
  refreshReports: () => Promise<void>;
  saveReport: (report: LabReport) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  getReportById: (id: string) => LabReport | undefined;
  loadSampleWhoopReport: () => Promise<void>;
  totalReports: number;
  totalMarkersCount: number;
  latestReport: LabReport | undefined;
}

const LabReportsContext = createContext<LabReportsContextValue | undefined>(
  undefined
);

export function LabReportsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(labReportsReducer, initialState);
  const [versionInfo, setVersionInfo] = useState<DatabaseVersionInfo | null>(null);

  const loadData = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      // Initialize database and run any pending migrations
      const vInfo = await storage.initDatabase();
      setVersionInfo(vInfo);

      const data = await storage.getLabReports();
      dispatch({ type: 'LOAD_REPORTS_SUCCESS', payload: data });
    } catch (err: any) {
      dispatch({
        type: 'SET_ERROR',
        payload: err?.message || 'Failed to load reports',
      });
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveReport = useCallback(async (report: LabReport) => {
    try {
      const updatedReports = await storage.saveLabReport(report);
      dispatch({ type: 'SAVE_REPORT_SUCCESS', payload: updatedReports });
    } catch (err: any) {
      dispatch({
        type: 'SET_ERROR',
        payload: err?.message || 'Failed to save report',
      });
      throw err;
    }
  }, []);

  const deleteReport = useCallback(async (id: string) => {
    try {
      const updatedReports = await storage.deleteLabReport(id);
      dispatch({ type: 'DELETE_REPORT_SUCCESS', payload: updatedReports });
    } catch (err: any) {
      dispatch({
        type: 'SET_ERROR',
        payload: err?.message || 'Failed to delete report',
      });
      throw err;
    }
  }, []);

  const loadSampleWhoopReport = useCallback(async () => {
    await saveReport(SAMPLE_WHOOP_LAB_REPORT);
  }, [saveReport]);

  const getReportById = useCallback(
    (id: string) => {
      return state.reports.find((r) => r.id === id);
    },
    [state.reports]
  );

  const stats = useMemo(() => {
    const totalReports = state.reports.length;
    const totalMarkersCount = state.reports.reduce(
      (sum, r) => sum + (r.markers ? r.markers.length : 0),
      0
    );
    const latestReport = state.reports.length > 0 ? state.reports[0] : undefined;

    return {
      totalReports,
      totalMarkersCount,
      latestReport,
    };
  }, [state.reports]);

  const value = useMemo<LabReportsContextValue>(
    () => ({
      reports: state.reports,
      isLoading: state.isLoading,
      error: state.error,
      versionInfo,
      refreshReports: loadData,
      saveReport,
      deleteReport,
      getReportById,
      loadSampleWhoopReport,
      ...stats,
    }),
    [
      state.reports,
      state.isLoading,
      state.error,
      versionInfo,
      loadData,
      saveReport,
      deleteReport,
      getReportById,
      loadSampleWhoopReport,
      stats,
    ]
  );

  return (
    <LabReportsContext.Provider value={value}>
      {children}
    </LabReportsContext.Provider>
  );
}

export function useLabReports(): LabReportsContextValue {
  const context = useContext(LabReportsContext);
  if (!context) {
    throw new Error('useLabReports must be used within a LabReportsProvider');
  }
  return context;
}
