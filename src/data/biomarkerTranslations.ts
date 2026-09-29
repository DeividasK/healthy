/**
 * @deprecated Import from 'src/i18n/biomarkers' instead.
 *
 * This file is a backwards-compatible shim. All biomarker translation data
 * and helpers have been moved to the language-aware i18n system at:
 *   src/i18n/biomarkers/
 *
 * The exports below are re-exported so existing imports continue to work
 * without changes, but new code should use the hook:
 *   import { useBiomarkerTranslations } from 'src/i18n/biomarkers';
 */

export type { BiomarkerTranslation } from '../i18n/biomarkers';
export {
  CANONICAL_KEY_ALIASES,
  getBiomarkerDisplayName,
  getBiomarkerDescription,
  getBiomarkerTranslation,
  biomarkersLt as BIOMARKER_TRANSLATIONS_LT,
} from '../i18n/biomarkers';
