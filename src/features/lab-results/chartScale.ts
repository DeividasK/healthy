/**
 * The value range of a chart `rows` grid squares tall, chosen so the
 * reference limits fall on grid lines and every value fits with room for its
 * label. A two-sided range gets as many squares as fit; otherwise each
 * square is a fixed share of the values' spread. Values that cannot be
 * negative keep the axis at or above zero where they still fit.
 */
export function getChartScale(
  values: number[],
  rows: number,
  low?: number,
  high?: number
) {
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  if (low !== undefined && high !== undefined && high > low) {
    for (let band = rows - 2; band >= 1; band--) {
      const unit = (high - low) / band;
      // A square of headroom over a value above the range keeps its label in.
      const above = Math.max(
        1,
        dataMax > high ? Math.ceil((dataMax - high) / unit + 1) : 1
      );
      let below = Math.max(
        1,
        dataMin < low ? Math.ceil((low - dataMin) / unit + 0.5) : 1
      );
      if (above + band + below > rows) continue;
      // Spare squares go to both sides, the odd one on top.
      const spare = rows - above - band - below;
      below += Math.floor(spare / 2);
      const nonNegative = dataMin >= 0 && low >= 0;
      while (nonNegative && below > 1 && low - below * unit < 0) {
        if (low - (below - 1) * unit > dataMin) break;
        below--;
      }
      const min = low - below * unit;
      return { min, max: min + rows * unit };
    }
  }
  const bounds = [dataMin, dataMax, low, high].filter(
    (value): value is number => value !== undefined
  );
  const spanMin = Math.min(...bounds);
  const spanMax = Math.max(...bounds);
  const unit =
    (spanMax - spanMin || Math.max(Math.abs(spanMax) * 0.1, 1)) / (rows - 3);
  const anchor = low ?? high;
  let min =
    anchor === undefined
      ? spanMin - unit
      : anchor - (Math.ceil((anchor - spanMin) / unit) + 1) * unit;
  while (spanMin >= 0 && min < 0 && min + unit <= spanMin) min += unit;
  return { min, max: min + rows * unit };
}
