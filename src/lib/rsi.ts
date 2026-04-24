/**
 * Simple RSI from the last `period` price changes (rough gauge, not trading advice).
 * Uses average gain vs average loss over the last `period` daily bars.
 */
export function computeRSI(closes: number[], period = 14): number | null {
  const clean = closes.filter((x) => Number.isFinite(x) && x > 0);
  if (clean.length < period + 1) return null;
  const changes: number[] = [];
  for (let i = 1; i < clean.length; i++) changes.push(clean[i] - clean[i - 1]);
  const slice = changes.slice(-period);
  const avgGain = slice.reduce((s, c) => s + (c > 0 ? c : 0), 0) / period;
  const avgLoss = slice.reduce((s, c) => s + (c < 0 ? -c : 0), 0) / period;
  if (avgLoss === 0) return avgGain > 0 ? 100 : 50;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Approximate % change over the last `bars` closes (oldest → newest). */
export function pctChangeOverBars(closes: number[], bars = 5): number | null {
  const c = closes.filter((x) => Number.isFinite(x) && x > 0);
  if (c.length < bars + 1) return null;
  const oldP = c[c.length - 1 - bars];
  const newP = c[c.length - 1];
  if (!oldP) return null;
  return ((newP - oldP) / oldP) * 100;
}
