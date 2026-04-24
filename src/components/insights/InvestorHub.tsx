import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import type { TxJournalRow } from '../../lib/tradeAnalytics';
import {
  fifoRealizedSells,
  behaviorFromSells,
  behaviorInsightLines,
  openPositionAvgDays,
  strategyPerformance,
  detectMistakes,
} from '../../lib/tradeAnalytics';
import { monthlyDiscipline } from '../../lib/monthlyDiscipline';
import { radarFromSeries } from '../../lib/opportunityRadar';
import type { RadarHit } from '../../lib/opportunityRadar';
import { extractCseRowArray } from '../../lib/csePayload';
import { Brain, Loader2, RefreshCw } from 'lucide-react';

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function asJournalTxs(raw: any[]): TxJournalRow[] {
  return raw.map((t) => ({
    id: t.id,
    stock_symbol: t.stock_symbol,
    type: t.type,
    quantity: t.quantity,
    price: Number(t.price),
    date: t.date,
    note: t.note ?? null,
    strategy: t.strategy ?? null,
  }));
}

function stratDisplay(s: string) {
  if (s === 'short_term') return 'Short-term';
  if (s === 'long_term') return 'Long-term';
  if (s === 'speculative') return 'Speculative';
  if (s === 'unspecified') return 'Unspecified';
  return s;
}

const panel = 'rounded-lg border border-[#2D323C] bg-[#1A1D23] p-5';

export default function InvestorHub({ onSelectStock }: { onSelectStock: (s: string) => void }) {
  const [txs, setTxs] = useState<TxJournalRow[]>([]);
  const [deposits, setDeposits] = useState<{ deposit_date: string; amount: number }[]>([]);
  const [radarHits, setRadarHits] = useState<RadarHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [radarLoading, setRadarLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRadarLoading(true);
    setErr(null);
    try {
      const [txRes, depRes, maRes] = await Promise.all([
        api.transactions.getAll(),
        api.deposits.getAll(),
        api.market.getMostActive(),
      ]);
      const journal = asJournalTxs(txRes.data);
      setTxs(journal);
      setDeposits(depRes.data.map((d: any) => ({ deposit_date: d.deposit_date, amount: Number(d.amount) })));

      const active = extractCseRowArray(maRes.data);
      const vols = active.map((r) => num(r.shareVolume ?? r.tradeVolume)).filter((x) => x > 0);
      vols.sort((a, b) => a - b);
      const median = vols.length ? vols[Math.floor(vols.length / 2)] : 0;
      const top = [...active]
        .sort((a, b) => num(b.shareVolume ?? b.tradeVolume) - num(a.shareVolume ?? a.tradeVolume))
        .slice(0, 10);
      const hits: RadarHit[] = [];
      for (const r of top) {
        const sym = String(r.symbol || '').toUpperCase();
        if (!sym) continue;
        try {
          const s = await api.market.getStockPriceSeries(sym, '4');
          const closes: number[] = s.data?.closes || [];
          const hit = radarFromSeries(sym, closes, num(r.shareVolume ?? r.tradeVolume), median);
          if (hit) hits.push(hit);
        } catch {
          /* skip */
        }
        await new Promise((res) => setTimeout(res, 120));
      }
      setRadarHits(hits);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || 'Failed to load insights');
    } finally {
      setLoading(false);
      setRadarLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fifo = useMemo(() => fifoRealizedSells(txs), [txs]);
  const behavior = useMemo(() => behaviorFromSells(fifo.sellEvents), [fifo.sellEvents]);
  const behaviorLines = useMemo(() => behaviorInsightLines(behavior), [behavior]);
  const stratRows = useMemo(() => strategyPerformance(fifo.sellEvents), [fifo.sellEvents]);
  const mistakes = useMemo(() => detectMistakes(txs), [txs]);
  const today = new Date().toISOString().slice(0, 10);
  const openDays = useMemo(() => openPositionAvgDays(fifo.remainingLots, today), [fifo.remainingLots, today]);

  const discipline = useMemo(() => {
    const allDates = [...txs.map((t) => t.date), ...deposits.map((d) => d.deposit_date)].filter(Boolean).sort();
    const firstYm = allDates[0]?.slice(0, 7);
    return monthlyDiscipline(deposits, 10_000, firstYm);
  }, [txs, deposits]);

  const radarLabelClass = (label: string) => {
    if (label === 'Momentum') return 'text-emerald-400 border-emerald-500/40';
    if (label === 'Pullback opportunity') return 'text-amber-300 border-amber-500/40';
    return 'text-sky-300 border-sky-500/40';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#2979FF]" />
            Investor cockpit
          </h2>
          <p className="text-sm text-[#8E9299] max-w-3xl mt-1">
            Rule-based stats from your ledger and CSE board data — not predictions, not financial advice. Tag strategies on
            each BUY in Portfolio to improve journal accuracy.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#2D323C] text-xs font-bold uppercase tracking-wider text-[#8E9299] hover:text-white"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {err && <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">{err}</div>}

      {loading && !txs.length ? (
        <div className="flex items-center gap-2 text-[#8E9299] text-sm py-12">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : null}

      <section className={panel}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E9299] mb-3">Investor behavior (FIFO exits)</h3>
        <ul className="space-y-2 text-sm text-[#C4C7CE] list-disc list-inside">
          {behaviorLines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        {openDays.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <p className="text-[11px] text-[#5C6370] uppercase font-bold mb-2">Open positions — avg days since lot BUY</p>
            <table className="w-full text-xs text-left">
              <thead className="text-[#8E9299] uppercase">
                <tr>
                  <th className="py-2">Symbol</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Avg days open</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[#C4C7CE]">
                {openDays.slice(0, 12).map((r) => (
                  <tr key={r.symbol} className="border-t border-[#2D323C]/60">
                    <td className="py-2">
                      <button type="button" className="text-[#2979FF] hover:underline" onClick={() => onSelectStock(r.symbol)}>
                        {r.symbol}
                      </button>
                    </td>
                    <td className="py-2 text-right">{r.qty.toLocaleString()}</td>
                    <td className="py-2 text-right">{r.avgDaysOpen.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={panel}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E9299] mb-2">Trade journal — strategy performance</h3>
        <p className="text-[11px] text-[#5C6370] mb-4">
          Realized P/L is attributed by FIFO lot to the BUY&apos;s strategy tag. Untagged BUYs count as &quot;unspecified&quot;.
        </p>
        {stratRows.length === 0 ? (
          <p className="text-xs text-[#8E9299]">No closed SELL legs yet — add strategy tags on BUYs, then book sales to see stats.</p>
        ) : (
          <table className="w-full text-xs text-left">
            <thead className="text-[#8E9299] uppercase">
              <tr>
                <th className="py-2">Strategy</th>
                <th className="py-2 text-right">Exits</th>
                <th className="py-2 text-right">Win rate</th>
                <th className="py-2 text-right">Realized P/L (LKR)</th>
              </tr>
            </thead>
            <tbody className="text-[#C4C7CE]">
              {stratRows.map((r) => (
                <tr key={r.strategy} className="border-t border-[#2D323C]/60">
                  <td className="py-2">{stratDisplay(r.strategy)}</td>
                  <td className="py-2 text-right font-mono">{r.exits}</td>
                  <td className="py-2 text-right font-mono">{(r.winRate * 100).toFixed(0)}%</td>
                  <td className={`py-2 text-right font-mono ${r.realizedPl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {r.realizedPl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={panel}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E9299] mb-2">Monthly investment discipline (10,000 LKR)</h3>
        <p className="text-[11px] text-[#5C6370] mb-3">
          Uses your cash deposit log: a month counts when total deposits in that calendar month ≥ 10,000 LKR.
        </p>
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-[#8E9299]">Current streak</span>
            <p className="text-2xl font-bold text-white">{discipline.streak} mo</p>
          </div>
          <div>
            <span className="text-[#8E9299]">Months below target</span>
            <p className="text-2xl font-bold text-amber-300">{discipline.missed.length}</p>
          </div>
        </div>
        {discipline.missed.length > 0 && (
          <p className="text-xs text-rose-300/90 mt-3">
            Missed / short months: {discipline.missed.slice(-12).join(', ')}
            {discipline.missed.length > 12 ? ' …' : ''}
          </p>
        )}
      </section>

      <section className={panel}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E9299] mb-2">Mistake detection (heuristics)</h3>
        {mistakes.length === 0 ? (
          <p className="text-xs text-[#8E9299]">No rule hits on your current ledger — or not enough activity yet.</p>
        ) : (
          <ul className="space-y-3 text-sm text-[#C4C7CE]">
            {mistakes.map((m, i) => (
              <li key={i} className="border-l-2 border-[#2979FF]/50 pl-3">
                <span className="text-[10px] uppercase font-bold text-[#8E9299]">{m.kind.replace(/_/g, ' ')}</span>
                {m.symbol && (
                  <button
                    type="button"
                    className="ml-2 font-mono text-[#2979FF] hover:underline"
                    onClick={() => onSelectStock(m.symbol!)}
                  >
                    {m.symbol}
                  </button>
                )}
                {m.date && <span className="text-[#5C6370] text-xs ml-2">{m.date}</span>}
                <p className="text-xs mt-1 text-[#8E9299]">{m.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={panel}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E9299] mb-2">Opportunity radar (CSE, rule-based)</h3>
        <p className="text-[11px] text-[#5C6370] mb-4">
          Scans top volume names vs board median: volume spike, ~5-session momentum, or pullback. Labels: Watch · Momentum ·
          Pullback opportunity.
        </p>
        {radarLoading ? (
          <p className="text-xs text-[#8E9299] flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning…
          </p>
        ) : radarHits.length === 0 ? (
          <p className="text-xs text-[#8E9299]">No radar hits for the sampled symbols (or charts unavailable).</p>
        ) : (
          <ul className="space-y-3">
            {radarHits.map((h) => (
              <li key={h.symbol} className={`rounded-lg border px-3 py-2 ${radarLabelClass(h.label)}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="font-mono font-bold hover:underline" onClick={() => onSelectStock(h.symbol)}>
                    {h.symbol}
                  </button>
                  <span className="text-[10px] font-black uppercase tracking-wider">{h.label}</span>
                </div>
                <ul className="mt-1 text-[11px] text-[#C4C7CE] list-disc list-inside">
                  {h.reasons.map((r, j) => (
                    <li key={j}>{r}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
