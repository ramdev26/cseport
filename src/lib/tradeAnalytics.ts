import type { TxRow } from './portfolioMath';

export type StrategyTag = 'short_term' | 'long_term' | 'speculative' | 'unspecified';

export type TxJournalRow = TxRow & {
  note?: string | null;
  strategy?: string | null;
};

type Lot = { qty: number; unitCost: number; buyDate: string; strategy: StrategyTag };

function normStrategy(s?: string | null): StrategyTag {
  const v = String(s || '').trim();
  if (v === 'short_term' || v === 'long_term' || v === 'speculative') return v;
  return 'unspecified';
}

export function daysBetweenCalendar(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00').getTime();
  const db = new Date(b + 'T12:00:00').getTime();
  return Math.round((db - da) / 86_400_000);
}

/** FIFO lots → realized P/L and hold time per SELL (for journaling / behavior stats). */
export function fifoRealizedSells(transactions: TxJournalRow[]) {
  const sorted = [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.id ?? 0) - (b.id ?? 0);
  });
  const queues: Record<string, Lot[]> = {};
  const sellEvents: Array<{
    txId: number;
    symbol: string;
    date: string;
    price: number;
    qtyMatched: number;
    realizedPl: number;
    avgHoldDays: number;
    wasWin: boolean;
    dominantStrategy: StrategyTag;
  }> = [];

  for (const tx of sorted) {
    const sym = tx.stock_symbol;
    if (!queues[sym]) queues[sym] = [];

    if (tx.type === 'BUY') {
      queues[sym].push({
        qty: tx.quantity,
        unitCost: tx.price,
        buyDate: tx.date,
        strategy: normStrategy(tx.strategy),
      });
      continue;
    }

    if (tx.type === 'SELL') {
      let rem = tx.quantity;
      let realized = 0;
      let holdW = 0;
      let matched = 0;
      const stratW: Partial<Record<StrategyTag, number>> = {};

      while (rem > 0 && queues[sym].length) {
        const lot = queues[sym][0];
        const take = Math.min(rem, lot.qty);
        const d = daysBetweenCalendar(lot.buyDate, tx.date);
        realized += take * (tx.price - lot.unitCost);
        holdW += take * d;
        matched += take;
        stratW[lot.strategy] = (stratW[lot.strategy] || 0) + take;
        lot.qty -= take;
        rem -= take;
        if (lot.qty <= 0) queues[sym].shift();
      }

      if (matched > 0) {
        const dom = (Object.entries(stratW) as [StrategyTag, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unspecified';
        sellEvents.push({
          txId: tx.id ?? 0,
          symbol: sym,
          date: tx.date,
          price: tx.price,
          qtyMatched: matched,
          realizedPl: realized,
          avgHoldDays: holdW / matched,
          wasWin: realized > 0,
          dominantStrategy: dom,
        });
      }
    }
  }

  return { sellEvents, remainingLots: queues };
}

export function openPositionAvgDays(remainingLots: Record<string, Lot[]>, asOfYmd: string) {
  return Object.entries(remainingLots)
    .map(([symbol, lots]) => {
      const qty = lots.reduce((s, l) => s + l.qty, 0);
      if (qty <= 0) return null;
      const w = lots.reduce((s, l) => s + l.qty * daysBetweenCalendar(l.buyDate, asOfYmd), 0);
      return { symbol, qty, avgDaysOpen: w / qty };
    })
    .filter(Boolean) as { symbol: string; qty: number; avgDaysOpen: number }[];
}

export function behaviorFromSells(sellEvents: ReturnType<typeof fifoRealizedSells>['sellEvents']) {
  const n = sellEvents.length;
  if (n === 0) {
    return {
      totalSells: 0,
      sellsAtLoss: 0,
      lossSellRate: 0,
      winRate: 0,
      avgHoldWin: null as number | null,
      avgHoldLoss: null as number | null,
      earlySellsLt7d: 0,
      earlySellRate: 0,
    };
  }
  const losses = sellEvents.filter((e) => !e.wasWin);
  const wins = sellEvents.filter((e) => e.wasWin);
  const early = sellEvents.filter((e) => e.avgHoldDays < 7);
  const avgHoldWin = wins.length ? wins.reduce((s, e) => s + e.avgHoldDays, 0) / wins.length : null;
  const avgHoldLoss = losses.length ? losses.reduce((s, e) => s + e.avgHoldDays, 0) / losses.length : null;
  return {
    totalSells: n,
    sellsAtLoss: losses.length,
    lossSellRate: losses.length / n,
    winRate: wins.length / n,
    avgHoldWin,
    avgHoldLoss,
    earlySellsLt7d: early.length,
    earlySellRate: early.length / n,
  };
}

export function behaviorInsightLines(b: ReturnType<typeof behaviorFromSells>): string[] {
  const lines: string[] = [];
  if (b.totalSells === 0) {
    lines.push('No completed SELL legs yet — behavior stats appear after you book sales against earlier BUYs (FIFO).');
    return lines;
  }
  lines.push(
    `Recorded exits: ${b.totalSells} · Win rate (green vs red booked P/L): ${(b.winRate * 100).toFixed(0)}% · Sells at a loss: ${b.sellsAtLoss} (${(b.lossSellRate * 100).toFixed(0)}%)`
  );
  if (b.avgHoldWin != null && b.avgHoldLoss != null && b.avgHoldWin > b.avgHoldLoss + 2) {
    lines.push(
      `Average hold before a winning exit (~${b.avgHoldWin.toFixed(0)} days) is longer than before losing exits (~${b.avgHoldLoss.toFixed(0)} days) — many profits in your log come from holding more than a quick flip.`
    );
  }
  if (b.earlySellRate > 0.45 && b.lossSellRate > 0.35) {
    lines.push(
      `A large share of exits are under 7 days (${(b.earlySellRate * 100).toFixed(0)}%) and many are red — you may be closing too early vs your own profitable holds (rule-based hint, not advice).`
    );
  }
  return lines;
}

export function strategyPerformance(sellEvents: ReturnType<typeof fifoRealizedSells>['sellEvents']) {
  const by: Record<string, { pl: number; n: number; wins: number }> = {};
  for (const e of sellEvents) {
    const k = e.dominantStrategy;
    if (!by[k]) by[k] = { pl: 0, n: 0, wins: 0 };
    by[k].pl += e.realizedPl;
    by[k].n += 1;
    if (e.wasWin) by[k].wins += 1;
  }
  return Object.entries(by).map(([strategy, v]) => ({
    strategy,
    realizedPl: v.pl,
    exits: v.n,
    winRate: v.n ? v.wins / v.n : 0,
  }));
}

export type MistakeKind = 'panic_sell' | 'overtrading' | 'averaging_down';

export type MistakeRow = { kind: MistakeKind; detail: string; date?: string; symbol?: string };

export function detectMistakes(transactions: TxJournalRow[]): MistakeRow[] {
  const sorted = [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.id ?? 0) - (b.id ?? 0);
  });
  const { sellEvents } = fifoRealizedSells(transactions);
  const mistakes: MistakeRow[] = [];

  for (const se of sellEvents) {
    if (!se.wasWin && se.avgHoldDays <= 2) {
      mistakes.push({
        kind: 'panic_sell',
        symbol: se.symbol,
        date: se.date,
        detail: `Very short hold (~${se.avgHoldDays.toFixed(0)}d) before a red exit on ${se.symbol} — rule tag: possible “panic” trim (not a diagnosis).`,
      });
    }
  }

  for (let i = 0; i < sorted.length; i++) {
    const end = sorted[i].date;
    const inWin = sorted.filter((t) => {
      const d = daysBetweenCalendar(t.date, end);
      return d >= 0 && d <= 13;
    });
    if (inWin.length >= 9) {
      mistakes.push({
        kind: 'overtrading',
        date: end,
        detail: `${inWin.length} trades in a 14-day window ending ${end} — unusually high activity vs a steady plan.`,
      });
      break;
    }
  }

  const bySym: Record<string, TxJournalRow[]> = {};
  for (const t of sorted) {
    if (t.type !== 'BUY') continue;
    if (!bySym[t.stock_symbol]) bySym[t.stock_symbol] = [];
    bySym[t.stock_symbol].push(t);
  }
  const avgSym = new Set<string>();
  for (const [sym, buys] of Object.entries(bySym)) {
    const sortedB = [...buys].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 2; i < sortedB.length; i++) {
      const a = sortedB[i - 2];
      const b = sortedB[i - 1];
      const c = sortedB[i];
      if (daysBetweenCalendar(a.date, c.date) <= 45 && a.price > b.price && b.price > c.price) {
        if (!avgSym.has(sym)) {
          avgSym.add(sym);
          mistakes.push({
            kind: 'averaging_down',
            symbol: sym,
            date: c.date,
            detail: `Three descending BUY prices on ${sym} inside 45 days — frequent averaging down (rule-based flag).`,
          });
        }
        break;
      }
    }
  }

  return mistakes;
}
