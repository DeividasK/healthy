import type { RangeSource, RegionalRange } from '../types';

const AACB: RangeSource = {
  title: 'AACB/RCPA harmonised reference intervals',
  year: 2016,
  url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5111244/',
  evidence: 'consensus',
};

/** AACB/RCPA harmonised adult intervals, converted to each primary unit. */
const harmonised = (range: Omit<RegionalRange, 'source'>): RegionalRange => ({
  ...range,
  source: AACB,
});

/**
 * Australia and New Zealand: the AACB/RCPA harmonised adult reference
 * intervals (Table 1), by catalog id. Creatinine is left out: it is
 * harmonised only up to age 60.
 */
export const ANZ_RANGES: Record<string, RegionalRange> = {
  sodium: harmonised({ low: 135, high: 145 }),
  potassium: harmonised({ low: 3.5, high: 5.2 }),
  chloride: harmonised({ low: 95, high: 110 }),
  bicarbonate: harmonised({ low: 22, high: 32 }),
  // 2.10–2.60 mmol/L.
  calcium: harmonised({ low: 8.42, high: 10.42 }),
  calcium_corrected: harmonised({ low: 8.42, high: 10.42 }),
  // 0.75–1.50 mmol/L.
  phosphate: harmonised({ low: 2.32, high: 4.65 }),
  // 0.70–1.10 mmol/L.
  magnesium: harmonised({ low: 1.7, high: 2.67 }),
  ldh: harmonised({ low: 120, high: 250 }),
  alp: harmonised({ low: 30, high: 110 }),
  // 60–80 g/L.
  total_protein: harmonised({ low: 6.0, high: 8.0 }),
  // 1–20 µmol/L.
  bilirubin_total: harmonised({ low: 0.06, high: 1.17 }),
  ck: harmonised({
    low: 30,
    high: 250,
    ranges: [
      { sex: 'male', maxAge: 60, low: 45, high: 250 },
      { sex: 'male', minAge: 60, low: 40, high: 200 },
      { sex: 'female', low: 30, high: 150 },
    ],
  }),
  alt: harmonised({
    low: 5,
    high: 40,
    ranges: [
      { sex: 'male', low: 5, high: 40 },
      { sex: 'female', low: 5, high: 35 },
    ],
  }),
  ast: harmonised({
    low: 5,
    high: 35,
    ranges: [
      { sex: 'male', low: 5, high: 35 },
      { sex: 'female', low: 5, high: 30 },
    ],
  }),
  ggt: harmonised({
    low: 5,
    high: 50,
    ranges: [
      { sex: 'male', low: 5, high: 50 },
      { sex: 'female', low: 5, high: 35 },
    ],
  }),
  lipase: harmonised({ low: 10, high: 60 }),
};
