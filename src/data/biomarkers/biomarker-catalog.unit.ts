import { test, expect } from '@playwright/test';
import { BIOMARKERS, REGIONAL_RANGES } from '.';

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

test('lists 220 biomarkers with unique ids, codes and names', () => {
  expect(BIOMARKERS).toHaveLength(220);
  for (const key of ['id', 'name'] as const)
    expect(new Set(BIOMARKERS.map((marker) => marker[key])).size).toBe(
      BIOMARKERS.length
    );
  const codes = BIOMARKERS.flatMap(({ loinc }) => loinc ?? []);
  expect(new Set(codes).size).toBe(codes.length);
});

test('only calculated biomarkers go without a LOINC code', () => {
  expect(
    BIOMARKERS.filter(({ loinc, calculation }) => !loinc && !calculation).map(
      ({ id }) => id
    )
  ).toEqual([]);
});

test('calculated biomarkers use catalog inputs and their units', () => {
  for (const { id, calculation } of BIOMARKERS)
    for (const input of calculation?.inputs ?? [])
      for (const inputId of [input.id].flat()) {
        const source = BIOMARKERS.find((marker) => marker.id === inputId);
        expect(source, `${id}: ${inputId}`).toBeDefined();
        expect(
          source!.units.map((unit) => unit.label),
          `${id}: ${inputId}`
        ).toContain(input.unit);
      }
});

test('every LOINC code has a valid check digit', () => {
  expect(
    BIOMARKERS.filter(
      ({ loinc }) => loinc !== undefined && !hasValidLoincCheckDigit(loinc)
    ).map(({ id, loinc }) => `${id}: ${loinc}`)
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

test('regional ranges name catalog biomarkers and cite a source', () => {
  for (const ranges of Object.values(REGIONAL_RANGES))
    for (const [id, range] of Object.entries(ranges ?? {})) {
      expect(
        BIOMARKERS.some((marker) => marker.id === id),
        id
      ).toBe(true);
      expect(range.source.url, id).toMatch(/^https:\/\//);
    }
});
