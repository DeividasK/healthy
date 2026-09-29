/**
 * Shared types for the biomarker i18n system.
 */

export interface BiomarkerTranslation {
  name: string;
  aliases: string[];
  description: string;
}

/**
 * Canonical key aliases — maps legacy/variant keys to the authoritative key
 * in the biomarker translation dictionaries.
 */
export const CANONICAL_KEY_ALIASES: Record<string, string> = {
  metabolic_bicarbonate: 'electrolyte_bicarbonate',
  metabolic_creatinine: 'renal_creatinine',
  metabolic_egfr: 'renal_egfr',
  metabolic_glucose: 'metabolic_fasting_glucose',
  lipid_cholesterol_total: 'lipid_total_cholesterol',
  vit_d_25_hydroxy: 'vitamin_d_25oh',
  vit_b12: 'vitamin_b12',
  cbc_monocytes_percent: 'cbc_monocytes_pct',
};
