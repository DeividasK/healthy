/**
 * Complete Blood Count (CBC) Standard Biomarkers Catalog
 * Curated with official LOINC (Logical Observation Identifiers Names and Codes)
 * and UCUM (Unified Code for Units of Measure) standards.
 */

export interface UnitOption {
  label: string;
  ucum: string;
  factor?: number; // relative to primary unit
}

export interface CBCBiomarkerDefinition {
  id: string;
  name: string;
  aliases: string[];
  loinc: string;
  category: 'Complete Blood Count';
  primaryUnit: string;
  ucumCode: string;
  units: UnitOption[];
  referenceRange?: {
    low?: number;
    high?: number;
    text?: string;
  };
  description: string;
}

export const CBC_PANEL_LOINC = '58410-2'; // Complete blood count (hemogram) panel - Blood by Automated count
export const GENERAL_LAB_REPORT_LOINC = '11502-2'; // Laboratory report

export const CBC_MARKERS: CBCBiomarkerDefinition[] = [
  {
    id: 'cbc_wbc',
    name: 'White Blood Cells (WBC)',
    aliases: ['WBC', 'Leukocytes', 'White Count', 'White Blood Cell Count'],
    loinc: '6690-2',
    category: 'Complete Blood Count',
    primaryUnit: '10*3/uL',
    ucumCode: '10*3/uL',
    units: [
      { label: '10*3/uL', ucum: '10*3/uL', factor: 1 },
      { label: '10*9/L', ucum: '10*9/L', factor: 1 },
      { label: '/uL', ucum: '/uL', factor: 1000 },
    ],
    referenceRange: {
      low: 4.5,
      high: 11.0,
      text: '4.5 - 11.0 10*3/uL',
    },
    description: 'Total number of white blood cells; key indicator of infection, inflammation, or immune health.',
  },
  {
    id: 'cbc_rbc',
    name: 'Red Blood Cells (RBC)',
    aliases: ['RBC', 'Erythrocytes', 'Red Count', 'Red Blood Cell Count'],
    loinc: '789-8',
    category: 'Complete Blood Count',
    primaryUnit: '10*6/uL',
    ucumCode: '10*6/uL',
    units: [
      { label: '10*6/uL', ucum: '10*6/uL', factor: 1 },
      { label: '10*12/L', ucum: '10*12/L', factor: 1 },
    ],
    referenceRange: {
      low: 4.2,
      high: 5.9,
      text: '4.2 - 5.9 10*6/uL',
    },
    description: 'Number of oxygen-carrying red blood cells per volume of blood.',
  },
  {
    id: 'cbc_hemoglobin',
    name: 'Hemoglobin (Hgb)',
    aliases: ['Hgb', 'Hb', 'Hemoglobin'],
    loinc: '718-7',
    category: 'Complete Blood Count',
    primaryUnit: 'g/dL',
    ucumCode: 'g/dL',
    units: [
      { label: 'g/dL', ucum: 'g/dL', factor: 1 },
      { label: 'g/L', ucum: 'g/L', factor: 10 },
      { label: 'mmol/L', ucum: 'mmol/L', factor: 0.6206 },
    ],
    referenceRange: {
      low: 13.5,
      high: 17.5,
      text: '13.5 - 17.5 g/dL',
    },
    description: 'Iron-containing oxygen transport metalloprotein in red blood cells.',
  },
  {
    id: 'cbc_hematocrit',
    name: 'Hematocrit (Hct)',
    aliases: ['Hct', 'Hematocrit', 'Packed Cell Volume', 'PCV'],
    loinc: '4544-3',
    category: 'Complete Blood Count',
    primaryUnit: '%',
    ucumCode: '%',
    units: [
      { label: '%', ucum: '%', factor: 1 },
      { label: 'L/L', ucum: 'L/L', factor: 0.01 },
    ],
    referenceRange: {
      low: 38.8,
      high: 50.0,
      text: '38.8 - 50.0 %',
    },
    description: 'Percentage proportion of blood volume that is occupied by red blood cells.',
  },
  {
    id: 'cbc_platelets',
    name: 'Platelets (PLT)',
    aliases: ['PLT', 'Platelets', 'Thrombocytes', 'Platelet Count'],
    loinc: '777-3',
    category: 'Complete Blood Count',
    primaryUnit: '10*3/uL',
    ucumCode: '10*3/uL',
    units: [
      { label: '10*3/uL', ucum: '10*3/uL', factor: 1 },
      { label: '10*9/L', ucum: '10*9/L', factor: 1 },
      { label: '/uL', ucum: '/uL', factor: 1000 },
    ],
    referenceRange: {
      low: 150,
      high: 450,
      text: '150 - 450 10*3/uL',
    },
    description: 'Cell fragments essential for normal blood clotting and vessel repair.',
  },
  {
    id: 'cbc_mcv',
    name: 'Mean Corpuscular Volume (MCV)',
    aliases: ['MCV', 'Mean Cell Volume'],
    loinc: '787-2',
    category: 'Complete Blood Count',
    primaryUnit: 'fL',
    ucumCode: 'fL',
    units: [
      { label: 'fL', ucum: 'fL', factor: 1 },
    ],
    referenceRange: {
      low: 80,
      high: 100,
      text: '80 - 100 fL',
    },
    description: 'Average volume and size of individual red blood cells.',
  },
  {
    id: 'cbc_mch',
    name: 'Mean Corpuscular Hemoglobin (MCH)',
    aliases: ['MCH', 'Mean Cell Hemoglobin'],
    loinc: '785-6',
    category: 'Complete Blood Count',
    primaryUnit: 'pg',
    ucumCode: 'pg',
    units: [
      { label: 'pg', ucum: 'pg', factor: 1 },
      { label: 'fmol', ucum: 'fmol', factor: 0.062 },
    ],
    referenceRange: {
      low: 27,
      high: 33,
      text: '27 - 33 pg',
    },
    description: 'Average mass of hemoglobin inside a single red blood cell.',
  },
  {
    id: 'cbc_mchc',
    name: 'Mean Corpuscular Hb Conc. (MCHC)',
    aliases: ['MCHC', 'MCH Conc'],
    loinc: '786-4',
    category: 'Complete Blood Count',
    primaryUnit: 'g/dL',
    ucumCode: 'g/dL',
    units: [
      { label: 'g/dL', ucum: 'g/dL', factor: 1 },
      { label: 'g/L', ucum: 'g/L', factor: 10 },
    ],
    referenceRange: {
      low: 32,
      high: 36,
      text: '32 - 36 g/dL',
    },
    description: 'Average concentration of hemoglobin within a given volume of packed red blood cells.',
  },
  {
    id: 'cbc_rdw_cv',
    name: 'RDW-CV',
    aliases: ['RDW', 'RDW-CV', 'Red Cell Distribution Width', 'RDW CV'],
    loinc: '788-0',
    category: 'Complete Blood Count',
    primaryUnit: '%',
    ucumCode: '%',
    units: [
      { label: '%', ucum: '%', factor: 1 },
    ],
    referenceRange: {
      low: 11.5,
      high: 14.5,
      text: '11.5 - 14.5 %',
    },
    description: 'Measurement of the variation in red blood cell volume and size (coefficient of variation).',
  },
  {
    id: 'cbc_rdw_sd',
    name: 'RDW-SD',
    aliases: ['RDW-SD', 'RDW SD'],
    loinc: '21000-5',
    category: 'Complete Blood Count',
    primaryUnit: 'fL',
    ucumCode: 'fL',
    units: [
      { label: 'fL', ucum: 'fL', factor: 1 },
    ],
    referenceRange: {
      low: 39,
      high: 46,
      text: '39 - 46 fL',
    },
    description: 'Actual measurement of the width of red blood cell volume distribution curve at 20% height.',
  },
  {
    id: 'cbc_mpv',
    name: 'Mean Platelet Volume (MPV)',
    aliases: ['MPV'],
    loinc: '32623-1',
    category: 'Complete Blood Count',
    primaryUnit: 'fL',
    ucumCode: 'fL',
    units: [
      { label: 'fL', ucum: 'fL', factor: 1 },
    ],
    referenceRange: {
      low: 7.5,
      high: 11.5,
      text: '7.5 - 11.5 fL',
    },
    description: 'Average size of platelets; reflects platelet production and bone marrow function.',
  },
  {
    id: 'cbc_neutrophils_pct',
    name: 'Neutrophils (%)',
    aliases: ['Neutrophils %', 'Neutrophil Percentage', 'Polys %', 'Segs %'],
    loinc: '751-8',
    category: 'Complete Blood Count',
    primaryUnit: '%',
    ucumCode: '%',
    units: [
      { label: '%', ucum: '%', factor: 1 },
    ],
    referenceRange: {
      low: 40,
      high: 70,
      text: '40 - 70 %',
    },
    description: 'Percentage of white blood cells that are neutrophils, vital for combating acute bacterial infections.',
  },
  {
    id: 'cbc_neutrophils_abs',
    name: 'Neutrophils (Absolute)',
    aliases: ['ANC', 'Absolute Neutrophil Count', 'Absolute Neutrophils'],
    loinc: '753-4',
    category: 'Complete Blood Count',
    primaryUnit: '10*3/uL',
    ucumCode: '10*3/uL',
    units: [
      { label: '10*3/uL', ucum: '10*3/uL', factor: 1 },
      { label: '10*9/L', ucum: '10*9/L', factor: 1 },
    ],
    referenceRange: {
      low: 1.8,
      high: 7.7,
      text: '1.8 - 7.7 10*3/uL',
    },
    description: 'Absolute count of circulating neutrophils.',
  },
  {
    id: 'cbc_lymphocytes_pct',
    name: 'Lymphocytes (%)',
    aliases: ['Lymphocytes %', 'Lymphs %'],
    loinc: '736-9',
    category: 'Complete Blood Count',
    primaryUnit: '%',
    ucumCode: '%',
    units: [
      { label: '%', ucum: '%', factor: 1 },
    ],
    referenceRange: {
      low: 20,
      high: 40,
      text: '20 - 40 %',
    },
    description: 'Percentage of white blood cells that are lymphocytes (T cells, B cells, NK cells).',
  },
  {
    id: 'cbc_lymphocytes_abs',
    name: 'Lymphocytes (Absolute)',
    aliases: ['ALC', 'Absolute Lymphocyte Count', 'Absolute Lymphs'],
    loinc: '731-0',
    category: 'Complete Blood Count',
    primaryUnit: '10*3/uL',
    ucumCode: '10*3/uL',
    units: [
      { label: '10*3/uL', ucum: '10*3/uL', factor: 1 },
      { label: '10*9/L', ucum: '10*9/L', factor: 1 },
    ],
    referenceRange: {
      low: 1.0,
      high: 4.8,
      text: '1.0 - 4.8 10*3/uL',
    },
    description: 'Absolute count of circulating lymphocytes.',
  },
  {
    id: 'cbc_monocytes_pct',
    name: 'Monocytes (%)',
    aliases: ['Monocytes %', 'Monos %'],
    loinc: '5905-5',
    category: 'Complete Blood Count',
    primaryUnit: '%',
    ucumCode: '%',
    units: [
      { label: '%', ucum: '%', factor: 1 },
    ],
    referenceRange: {
      low: 2,
      high: 8,
      text: '2 - 8 %',
    },
    description: 'Percentage of white blood cells that are monocytes, precursor cells to macrophages.',
  },
  {
    id: 'cbc_monocytes_abs',
    name: 'Monocytes (Absolute)',
    aliases: ['AMC', 'Absolute Monocyte Count', 'Absolute Monos'],
    loinc: '742-7',
    category: 'Complete Blood Count',
    primaryUnit: '10*3/uL',
    ucumCode: '10*3/uL',
    units: [
      { label: '10*3/uL', ucum: '10*3/uL', factor: 1 },
      { label: '10*9/L', ucum: '10*9/L', factor: 1 },
    ],
    referenceRange: {
      low: 0.2,
      high: 0.8,
      text: '0.2 - 0.8 10*3/uL',
    },
    description: 'Absolute count of circulating monocytes.',
  },
  {
    id: 'cbc_eosinophils_pct',
    name: 'Eosinophils (%)',
    aliases: ['Eosinophils %', 'Eos %'],
    loinc: '711-2',
    category: 'Complete Blood Count',
    primaryUnit: '%',
    ucumCode: '%',
    units: [
      { label: '%', ucum: '%', factor: 1 },
    ],
    referenceRange: {
      low: 1,
      high: 4,
      text: '1 - 4 %',
    },
    description: 'Percentage of white blood cells involved in allergic responses and parasitic defense.',
  },
  {
    id: 'cbc_eosinophils_abs',
    name: 'Eosinophils (Absolute)',
    aliases: ['AEC', 'Absolute Eosinophil Count', 'Absolute Eos'],
    loinc: '704-7',
    category: 'Complete Blood Count',
    primaryUnit: '10*3/uL',
    ucumCode: '10*3/uL',
    units: [
      { label: '10*3/uL', ucum: '10*3/uL', factor: 1 },
      { label: '10*9/L', ucum: '10*9/L', factor: 1 },
    ],
    referenceRange: {
      low: 0.05,
      high: 0.5,
      text: '0.05 - 0.5 10*3/uL',
    },
    description: 'Absolute count of circulating eosinophils.',
  },
  {
    id: 'cbc_basophils_pct',
    name: 'Basophils (%)',
    aliases: ['Basophils %', 'Basos %'],
    loinc: '706-2',
    category: 'Complete Blood Count',
    primaryUnit: '%',
    ucumCode: '%',
    units: [
      { label: '%', ucum: '%', factor: 1 },
    ],
    referenceRange: {
      low: 0.5,
      high: 1.0,
      text: '0.5 - 1.0 %',
    },
    description: 'Percentage of granulocytes releasing histamine and heparin during inflammatory reactions.',
  },
  {
    id: 'cbc_basophils_abs',
    name: 'Basophils (Absolute)',
    aliases: ['ABC', 'Absolute Basophil Count', 'Absolute Basos'],
    loinc: '702-1',
    category: 'Complete Blood Count',
    primaryUnit: '10*3/uL',
    ucumCode: '10*3/uL',
    units: [
      { label: '10*3/uL', ucum: '10*3/uL', factor: 1 },
      { label: '10*9/L', ucum: '10*9/L', factor: 1 },
    ],
    referenceRange: {
      low: 0.01,
      high: 0.2,
      text: '0.01 - 0.2 10*3/uL',
    },
    description: 'Absolute count of circulating basophils.',
  },
];

/**
 * Searches CBC markers by name, alias, or LOINC code.
 */
export function searchCBCMarkers(query: string): CBCBiomarkerDefinition[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return CBC_MARKERS;

  return CBC_MARKERS.filter((marker) => {
    if (marker.name.toLowerCase().includes(clean)) return true;
    if (marker.loinc.includes(clean)) return true;
    return marker.aliases.some((alias) => alias.toLowerCase().includes(clean));
  });
}

/**
 * Finds a CBC biomarker by its canonical key or LOINC code.
 */
export function getCBCMarker(idOrLoinc: string): CBCBiomarkerDefinition | undefined {
  return CBC_MARKERS.find(
    (m) => m.id === idOrLoinc || m.loinc === idOrLoinc
  );
}
