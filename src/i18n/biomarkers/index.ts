/**
 * Biomarker i18n — language-aware lookup hook and helper functions.
 *
 * Usage:
 *   // In a React component:
 *   const { getDisplayName, getDescription, getTranslation } = useBiomarkerTranslations();
 *
 *   // Outside React (pass language explicitly):
 *   import { getBiomarkerDisplayName } from 'src/i18n/biomarkers';
 *   getBiomarkerDisplayName(marker, 'en');
 */

import { useTranslation } from 'react-i18next';
import { biomarkersLt } from './lt';
import { biomarkersEn } from './en';
import { CANONICAL_KEY_ALIASES as KEY_ALIASES } from './types';
import type { BiomarkerTranslation } from './types';

export { CANONICAL_KEY_ALIASES } from './types';
export type { BiomarkerTranslation };

// Re-export the raw catalogs for code paths that need the full dictionary
// (e.g., searchBiomarkers in biomarker-catalog.ts).
export { biomarkersLt, biomarkersEn };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getCatalog(lang: 'lt' | 'en'): Record<string, BiomarkerTranslation> {
  return lang === 'en' ? biomarkersEn : biomarkersLt;
}

function lookupEntry(
  key: string,
  lang: 'lt' | 'en'
): BiomarkerTranslation | undefined {
  const catalog = getCatalog(lang);
  // Direct match
  if (catalog[key]) return catalog[key];
  // Alias match via CANONICAL_KEY_ALIASES
  const canonical = KEY_ALIASES[key];
  if (canonical && catalog[canonical]) return catalog[canonical];
  return undefined;
}

// ---------------------------------------------------------------------------
// Stateless helpers (usable outside React components)
// ---------------------------------------------------------------------------

/**
 * Get localized display name for a biomarker.
 * Falls back to marker.name when no translation is found.
 */
export function getBiomarkerDisplayName(
  marker: { canonicalKey?: string; name: string },
  lang: 'lt' | 'en' = 'lt'
): string {
  if (marker.canonicalKey) {
    const entry = lookupEntry(marker.canonicalKey, lang);
    if (entry) return entry.name;
  }

  // Name-based fuzzy fallback (case-insensitive)
  const normName = marker.name.trim().toLowerCase();
  const catalog = getCatalog(lang);
  for (const tr of Object.values(catalog)) {
    if (tr.name.toLowerCase() === normName) return tr.name;
    if (tr.aliases.some((a) => a.toLowerCase() === normName)) return tr.name;
  }

  return marker.name;
}

/**
 * Get localized clinical description for a biomarker.
 * Falls back to marker.description when no translation is found.
 */
export function getBiomarkerDescription(
  marker: { canonicalKey?: string; name: string; description?: string },
  lang: 'lt' | 'en' = 'lt'
): string {
  if (marker.canonicalKey) {
    const entry = lookupEntry(marker.canonicalKey, lang);
    if (entry) return entry.description;
  }
  return marker.description ?? '';
}

/**
 * Look up a full translation entry by canonicalKey (or alias key).
 */
export function getBiomarkerTranslation(
  key: string,
  lang: 'lt' | 'en' = 'lt'
): BiomarkerTranslation | undefined {
  return lookupEntry(key, lang);
}

// ---------------------------------------------------------------------------
// React hook — automatically reads current language from context
// ---------------------------------------------------------------------------

/**
 * Returns language-aware biomarker translation helpers bound to the current
 * app language. Prefer this inside React components.
 */
export function useBiomarkerTranslations() {
  const { i18n } = useTranslation();
  const language = i18n.language === 'lt' ? 'lt' : 'en';

  return {
    /** Get the localized display name for a biomarker marker object. */
    getDisplayName: (marker: { canonicalKey?: string; name: string }) =>
      getBiomarkerDisplayName(marker, language),

    /** Get the localized clinical description for a biomarker. */
    getDescription: (marker: {
      canonicalKey?: string;
      name: string;
      description?: string;
    }) => getBiomarkerDescription(marker, language),

    /** Look up a full translation entry by canonicalKey. */
    getTranslation: (key: string) => getBiomarkerTranslation(key, language),

    /** The current active catalog dictionary (for search / iteration). */
    catalog: getCatalog(language),

    /** Current language code. */
    language,
  };
}
