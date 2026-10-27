/**
 * Labs in different parts of the world use slightly different reference
 * ranges, set by their medical bodies. A region names the set of ranges the
 * app uses when a lab report does not print its own.
 */
export type RangeRegion = 'international' | 'europe' | 'anz' | 'us';

export interface RangeRegionInfo {
  id: RangeRegion;
  name: string;
  /** ISO 3166-1 alpha-2 codes of the device regions it is the default for. */
  countries: string[];
}

export const RANGE_REGIONS: RangeRegionInfo[] = [
  {
    id: 'international',
    name: 'International',
    countries: [],
  },
  {
    id: 'europe',
    name: 'Europe',
    // EU, EEA, UK and Switzerland.
    countries: [
      'AT',
      'BE',
      'BG',
      'HR',
      'CY',
      'CZ',
      'DK',
      'EE',
      'FI',
      'FR',
      'DE',
      'GR',
      'HU',
      'IE',
      'IT',
      'LV',
      'LT',
      'LU',
      'MT',
      'NL',
      'PL',
      'PT',
      'RO',
      'SK',
      'SI',
      'ES',
      'SE',
      'IS',
      'LI',
      'NO',
      'GB',
      'CH',
    ],
  },
  {
    id: 'anz',
    name: 'Australia and New Zealand',
    countries: ['AU', 'NZ'],
  },
  {
    id: 'us',
    name: 'United States',
    countries: ['US'],
  },
];

export const DEFAULT_RANGE_REGION: RangeRegion = 'international';

export function isRangeRegion(value: unknown): value is RangeRegion {
  return RANGE_REGIONS.some(({ id }) => id === value);
}

export function getRangeRegionInfo(region: RangeRegion): RangeRegionInfo {
  return RANGE_REGIONS.find(({ id }) => id === region) ?? RANGE_REGIONS[0];
}

/** The region for a device region code (e.g. `LT`), International when none fits. */
export function getRangeRegionForCountry(
  countryCode: string | null | undefined
): RangeRegion {
  const code = countryCode?.toUpperCase();
  if (!code) return DEFAULT_RANGE_REGION;
  return (
    RANGE_REGIONS.find(({ countries }) => countries.includes(code))?.id ??
    DEFAULT_RANGE_REGION
  );
}
