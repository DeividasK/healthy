import { test, expect } from '@playwright/test';
import { BIOMARKERS } from '.';

/** LOINC codes end in a mod-10 (Luhn) check digit. */
function hasValidLoincCheckDigit(loinc: string): boolean {
  const match = loinc.match(/^(\d+)-(\d)$/);
  if (!match) return false;
  const sum = [...match[1]].reverse().reduce((total, char, index) => {
    const digit = Number(char) * (index % 2 === 0 ? 2 : 1);
    return total + (digit > 9 ? digit - 9 : digit);
  }, 0);
  return (10 - (sum % 10)) % 10 === Number(match[2]);
}

test('lists 219 biomarkers with unique ids, codes and names', () => {
  expect(BIOMARKERS).toHaveLength(219);
  for (const key of ['id', 'loinc', 'name'] as const)
    expect(new Set(BIOMARKERS.map((marker) => marker[key])).size).toBe(
      BIOMARKERS.length
    );
});

test('every LOINC code has a valid check digit', () => {
  expect(
    BIOMARKERS.filter(({ loinc }) => !hasValidLoincCheckDigit(loinc)).map(
      ({ id, loinc }) => `${id}: ${loinc}`
    )
  ).toEqual([]);
});

test('names and aliases each identify one biomarker', () => {
  const owners = new Map<string, string[]>();
  for (const marker of BIOMARKERS)
    for (const name of new Set(
      [marker.name, ...marker.aliases].map((n) => n.toLowerCase())
    ))
      owners.set(name, [...(owners.get(name) ?? []), marker.id]);
  expect(
    [...owners].filter(([, ids]) => ids.length > 1).map(([name]) => name)
  ).toEqual([]);
});

test('units start with the primary unit and ranges are ordered', () => {
  for (const marker of BIOMARKERS) {
    expect(marker.units[0]).toMatchObject({
      label: marker.primaryUnit,
      ucum: marker.ucumCode,
    });
    expect(marker.units[0].factor ?? 1).toBe(1);
    expect(new Set(marker.units.map((unit) => unit.label)).size).toBe(
      marker.units.length
    );
    const { low, high } = marker.referenceRange ?? {};
    if (low !== undefined && high !== undefined)
      expect(high, marker.id).toBeGreaterThan(low);
  }
});
