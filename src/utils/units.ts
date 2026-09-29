import { BiomarkerStatus } from '../types/health';

/**
 * Calculates whether a biomarker value is normal, low, or high
 * based on minimum and maximum reference thresholds.
 */
export function calculateBiomarkerStatus(
  value?: number,
  min?: number,
  max?: number
): BiomarkerStatus {
  if (value === undefined || value === null || isNaN(value)) return 'unknown';

  if (min !== undefined && !isNaN(min) && value < min) {
    return 'low';
  }

  if (max !== undefined && !isNaN(max) && value > max) {
    return 'high';
  }

  if ((min !== undefined && !isNaN(min)) || (max !== undefined && !isNaN(max))) {
    return 'normal';
  }

  return 'unknown';
}

/**
 * Formats a biomarker value cleanly (e.g. 14.5 or 120).
 */
export function formatValue(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Returns human-readable status badge configuration
 */
export function getStatusBadgeConfig(
  status: BiomarkerStatus,
  lang: 'lt' | 'en' = 'lt'
) {
  if (lang === 'en') {
    switch (status) {
      case 'normal':
        return { label: 'Normal', color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' };
      case 'low':
        return { label: 'Low', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' };
      case 'high':
        return { label: 'High', color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' };
      case 'critical':
        return { label: 'Critical', color: '#DC2626', bg: '#FEE2E2', border: '#F87171' };
      default:
        return { label: 'Recorded', color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' };
    }
  }

  // Default to Lithuanian
  switch (status) {
    case 'normal':
      return { label: 'Norma', color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' };
    case 'low':
      return { label: 'Žemas', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' };
    case 'high':
      return { label: 'Padidėjęs', color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' };
    case 'critical':
      return { label: 'Kritinis', color: '#DC2626', bg: '#FEE2E2', border: '#F87171' };
    default:
      return { label: 'Užfiksuota', color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' };
  }
}

