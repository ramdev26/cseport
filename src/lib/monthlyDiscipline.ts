export type DepositRow = { deposit_date: string; amount: number };

function ymFromDate(dateStr: string) {
  return dateStr.slice(0, 7);
}

function enumerateMonths(startYm: string, endYm: string): string[] {
  if (startYm > endYm) return [];
  const out: string[] = [];
  const [sy, sm] = startYm.split('-').map(Number);
  const [ey, em] = endYm.split('-').map(Number);
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** Sum deposits per calendar month (YYYY-MM). */
export function monthlyDiscipline(
  deposits: DepositRow[],
  targetPerMonth = 10_000,
  /** First month to score (defaults from earliest deposit or current month). */
  startYm?: string
) {
  const today = new Date();
  const endYm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const byYm: Record<string, number> = {};
  for (const d of deposits) {
    const ym = ymFromDate(d.deposit_date);
    byYm[ym] = (byYm[ym] || 0) + Number(d.amount);
  }

  const keys = Object.keys(byYm).sort();
  const from = startYm ?? keys[0] ?? endYm;
  const months = enumerateMonths(from, endYm);

  const rows = months.map((ym) => {
    const total = byYm[ym] || 0;
    const met = total >= targetPerMonth;
    return { ym, deposited: total, target: targetPerMonth, met, shortfall: met ? 0 : targetPerMonth - total };
  });

  let streak = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].met) streak += 1;
    else break;
  }

  const missed = rows.filter((r) => !r.met).map((r) => r.ym);

  return { rows, streak, missed, targetPerMonth };
}
