/** Transaction row from API / SQLite */
export type TxRow = {
  id?: number;
  stock_symbol: string;
  type: string;
  quantity: number;
  price: number;
  date: string;
  note?: string | null;
  strategy?: string | null;
};

/** Same weighted-average cost logic as the live dashboard holdings reducer. */
export function reduceHoldingsFromTx(transactions: TxRow[]) {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const acc: Record<string, { qty: number; totalCost: number }> = {};
  for (const tx of sorted) {
    if (!acc[tx.stock_symbol]) acc[tx.stock_symbol] = { qty: 0, totalCost: 0 };
    const sign = tx.type === 'BUY' ? 1 : -1;
    acc[tx.stock_symbol].qty += tx.quantity * sign;
    if (tx.type === 'BUY') {
      acc[tx.stock_symbol].totalCost += tx.quantity * tx.price;
    } else {
      const q = acc[tx.stock_symbol].qty;
      const avgPrice = acc[tx.stock_symbol].totalCost / (q + tx.quantity);
      acc[tx.stock_symbol].totalCost -= tx.quantity * avgPrice;
    }
  }
  return acc;
}

export function holdingsFromAcc(acc: Record<string, { qty: number; totalCost: number }>) {
  return Object.entries(acc)
    .filter(([, v]) => v.qty > 0)
    .map(([symbol, v]) => ({
      symbol,
      qty: v.qty,
      totalCost: v.totalCost,
      avgPrice: v.totalCost / v.qty,
    }));
}

/** Simple P/L vs avg buy copy for UI — not financial advice. */
export function sellGuidance(avgBuy: number, lastPrice: number | null | undefined) {
  const px = lastPrice ?? 0;
  if (!avgBuy || avgBuy <= 0 || !px || px <= 0) {
    return { label: 'Awaiting live price', tone: 'neutral' as const, pct: null as number | null };
  }
  const pct = ((px - avgBuy) / avgBuy) * 100;
  if (pct >= 15) {
    return {
      label: 'Strong unrealized gain — consider trimming (your call; not advice)',
      tone: 'profit' as const,
      pct,
    };
  }
  if (pct >= 5) {
    return { label: 'In profit — selling some is optional', tone: 'profit' as const, pct };
  }
  if (pct > 0.5) {
    return { label: 'Slightly above your avg — neutral', tone: 'profit' as const, pct };
  }
  if (pct >= -0.5) {
    return { label: 'Roughly at your avg buy', tone: 'neutral' as const, pct };
  }
  if (pct > -10) {
    return { label: 'Below avg — usually wait unless you need cash', tone: 'loss' as const, pct };
  }
  return { label: 'Well below avg — selling locks in a loss', tone: 'loss' as const, pct };
}

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

function lastDayOfMonthStr(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function firstDayOfMonthStr(ym: string) {
  return `${ym}-01`;
}

/** Per calendar month: book cost basis, mark-to-market using supplied prices, buy volume, plan line. */
export function buildMonthlyPortfolioSeries(
  transactions: TxRow[],
  currentPrices: Record<string, number>,
  monthlyPlanLkr = 10_000
) {
  if (!transactions.length) return [];

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const minYm = ymFromDate(sorted[0].date);
  const today = new Date();
  const endYm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const months = enumerateMonths(minYm, endYm);

  return months.map((ym, i) => {
    const endStr = lastDayOfMonthStr(ym);
    const startStr = firstDayOfMonthStr(ym);
    const txsUpTo = sorted.filter((t) => t.date <= endStr);
    const acc = reduceHoldingsFromTx(txsUpTo);
    const list = holdingsFromAcc(acc);
    const costBasis = list.reduce((s, h) => s + h.totalCost, 0);
    const marketValue = list.reduce((s, h) => s + h.qty * (currentPrices[h.symbol] ?? 0), 0);
    const buysThisMonth = sorted
      .filter((t) => t.type === 'BUY' && t.date >= startStr && t.date <= endStr)
      .reduce((s, t) => s + t.quantity * t.price, 0);
    const cumulativeBuys = sorted
      .filter((t) => t.type === 'BUY' && t.date <= endStr)
      .reduce((s, t) => s + t.quantity * t.price, 0);
    const plannedCumulative = (i + 1) * monthlyPlanLkr;
    return {
      monthKey: ym,
      monthLabel: ym,
      costBasis,
      marketValue,
      buysThisMonth,
      cumulativeBuys,
      plannedCumulative,
    };
  });
}
