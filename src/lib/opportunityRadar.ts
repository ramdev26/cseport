export type RadarLabel = 'Watch' | 'Momentum' | 'Pullback opportunity';

export type RadarHit = {
  symbol: string;
  label: RadarLabel;
  reasons: string[];
};

function cleanCloses(closes: number[]) {
  return closes.filter((x) => Number.isFinite(x) && x > 0);
}

/**
 * Rule-based screen from recent closes + board-relative volume (educational, not advice).
 */
export function radarFromSeries(
  symbol: string,
  closes: number[],
  shareVolume: number,
  medianBoardVolume: number
): RadarHit | null {
  const c = cleanCloses(closes);
  if (c.length < 6) return null;

  const volRatio = medianBoardVolume > 0 ? shareVolume / medianBoardVolume : 0;
  const last3Up = c[c.length - 1] > c[c.length - 2] && c[c.length - 2] > c[c.length - 3];
  const oldP = c[c.length - 6];
  const newP = c[c.length - 1];
  const pct5 = ((newP - oldP) / oldP) * 100;

  if (pct5 <= -5) {
    const reasons = [`Price down ~${Math.abs(pct5).toFixed(1)}% vs ~5 sessions ago`];
    if (volRatio >= 1.5) reasons.push('Heavy volume vs “most active” board median');
    return { symbol, label: 'Pullback opportunity', reasons };
  }

  if (last3Up && pct5 > 1.5) {
    const reasons = ['Three consecutive higher closes', `Up ~${pct5.toFixed(1)}% vs ~5 sessions ago`];
    if (volRatio >= 1.5) reasons.push('Heavy volume vs board median');
    return { symbol, label: 'Momentum', reasons };
  }

  if (volRatio >= 1.65) {
    return {
      symbol,
      label: 'Watch',
      reasons: ['Volume notably above median of the current “most active” board — no strong trend rule fired'],
    };
  }

  return null;
}
