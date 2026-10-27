import type { RangeStatus } from '@/src/features/lab-results/biomarkerMeasurements';

/** Sufficient: inside the range but outside its optimal part. */
export type RangeZoneStatus = RangeStatus | 'sufficient';

export type RangeZone = { status: RangeZoneStatus; width: number };

/**
 * Lays out a range bar: out-of-range zones either side of the reference
 * range, sized to the real values, with the value's position. An optimal
 * part splits the range into sufficient zones around it. Widths and
 * positions are percentages of the bar. Returns undefined without a usable
 * bound. Without a value the bar shows the range alone.
 */
export function getRangeZones(
  value: number | undefined,
  low?: number,
  high?: number,
  optimalLow?: number,
  optimalHigh?: number
) {
  if (
    (value !== undefined && !Number.isFinite(value)) ||
    (low === undefined && high === undefined)
  )
    return undefined;
  if (low !== undefined && high !== undefined && high <= low) return undefined;
  const bound = (low ?? high)!;
  // A one-sided range borrows a span from the value or the bound's size.
  const span =
    low !== undefined && high !== undefined
      ? high - low
      : Math.max(Math.abs((value ?? bound) - bound), Math.abs(bound) * 0.5, 1);
  const lowEdge = low ?? high! - span;
  const highEdge = high ?? low! + span;
  // A range starting at zero has nothing below it to show.
  const min = Math.min(low === 0 ? 0 : lowEdge - span * 0.4, value ?? Infinity);
  const max = Math.max(highEdge + span * 0.4, value ?? -Infinity);
  const position = (v: number) => ((v - min) / (max - min)) * 100;
  const inStart = position(low ?? min);
  const inEnd = position(high ?? max);
  const zones: RangeZone[] = [];
  if (inStart > 0) zones.push({ status: 'outOfRange', width: inStart });
  const hasOptimal = optimalLow !== undefined || optimalHigh !== undefined;
  // The optimal part, kept inside the range.
  const optimalStart = Math.max(inStart, position(optimalLow ?? low ?? min));
  const optimalEnd = Math.min(inEnd, position(optimalHigh ?? high ?? max));
  if (hasOptimal && optimalEnd > optimalStart) {
    if (optimalStart > inStart)
      zones.push({ status: 'sufficient', width: optimalStart - inStart });
    zones.push({ status: 'inRange', width: optimalEnd - optimalStart });
    if (optimalEnd < inEnd)
      zones.push({ status: 'sufficient', width: inEnd - optimalEnd });
  } else zones.push({ status: 'inRange', width: inEnd - inStart });
  if (inEnd < 100) zones.push({ status: 'outOfRange', width: 100 - inEnd });
  return {
    zones,
    // Keeps the marker fully on the bar at the extremes.
    marker:
      value === undefined
        ? undefined
        : Math.min(97, Math.max(3, position(value))),
    limits: [low, ...(hasOptimal ? [optimalLow, optimalHigh] : []), high]
      .filter((limit): limit is number => limit !== undefined)
      .map((limit) => ({ value: limit, position: position(limit) })),
  };
}
