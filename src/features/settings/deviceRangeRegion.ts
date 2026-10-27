import { getLocales } from 'expo-localization';
import { getRangeRegionForCountry } from '@/src/data/biomarkers/rangeRegions';

/** The range region for the device's region setting; read on the device only. */
export function getDeviceRangeRegion() {
  return getRangeRegionForCountry(getLocales()[0]?.regionCode);
}
