import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../../services/api';
import { computeRSI, pctChangeOverBars } from '../../lib/rsi';
import { extractCseRowArray } from '../../lib/csePayload';
import { RefreshCw, TrendingUp, TrendingDown, Activity, Radio } from 'lucide-react';

interface MarketAnalysisProps {
  onSelectStock: (symbol: string) => void;
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function looksLikeHtml(s: string): boolean {
  const t = s.trim().toLowerCase();
  return t.startsWith('<!doctype') || t.startsWith('<html');
}

function marketStatusText(payload: unknown): string {
  const d = (payload as any)?.data ?? payload;
  if (typeof d === 'string') {
    if (looksLikeHtml(d)) {
      return 'Could not load market status (got a web page instead of data). Use npm run dev so API and Vite share one server, then refresh.';
    }
    return d;
  }
  if (d && typeof d === 'object' && typeof (d as any).status === 'string') {
    const st = (d as any).status as string;
    if (looksLikeHtml(st)) {
      return 'Market status response was not in the expected format. Try refresh or check the server log.';
    }
    return st;
  }
  return JSON.stringify(d ?? {});
}

function pickInsightSymbols(gainers: any[], losers: any[], active: any[], max = 10): string[] {
  const set = new Set<string>();
  gainers.slice(0, 3).forEach((r) => r?.symbol && set.add(String(r.symbol).toUpperCase()));
  losers.slice(0, 3).forEach((r) => r?.symbol && set.add(String(r.symbol).toUpperCase()));
  active.slice(0, 5).forEach((r) => r?.symbol && set.add(String(r.symbol).toUpperCase()));
  return [...set].slice(0, max);
}

export default function MarketAnalysis({ onSelectStock }: MarketAnalysisProps) {
  const [marketStatus, setMarketStatus] = useState<string>('');
  const [gainers, setGainers] = useState<any[]>([]);
  const [losers, setLosers] = useState<any[]>([]);
  const [active, setActive] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ruleLines, setRuleLines] = useState<{ symbol: string; lines: string[] }[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);

  const loadBoards = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [ms, tg, tl, ma] = await Promise.all([
        api.market.getMarketStatus(),
        api.market.getTopGainers(),
        api.market.getTopLosers(),
        api.market.getMostActive(),
      ]);
      setMarketStatus(marketStatusText(ms));
      setGainers(extractCseRowArray(tg.data));
      setLosers(extractCseRowArray(tl.data));
      setActive(extractCseRowArray(ma.data));
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || 'Failed to load market data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  const activeVolumes = useMemo(() => {
    const vols = active.map((r) => num(r.shareVolume ?? r.tradeVolume ?? r.volume)).filter((n) => n > 0);
    vols.sort((a, b) => a - b);
    const mid = vols.length ? vols[Math.floor(vols.length / 2)] : 0;
    return { median: mid };
  }, [active]);

  useEffect(() => {
    if (loading || err) return;
    const symbols = pickInsightSymbols(gainers, losers, active);
    if (!symbols.length) {
      setRuleLines([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setRulesLoading(true);
      const out: { symbol: string; lines: string[] }[] = [];
      for (const sym of symbols) {
        if (cancelled) break;
        try {
          const res = await api.market.getStockPriceSeries(sym, '4');
          if (cancelled) break;
          const closes: number[] = res.data?.closes || [];
          const lines: string[] = [];
          const ch5 = pctChangeOverBars(closes, 5);
          if (ch5 != null && ch5 > 3) lines.push(`Price up ~${ch5.toFixed(1)}% over the last several sessions — short-term uptrend (rule-based, not a forecast).`);
          if (ch5 != null && ch5 < -5)
            lines.push(
              `Price down ~${Math.abs(ch5).toFixed(1)}% over the last several sessions — sharp move; some investors watch for entries after drops (not advice).`
            );
          const rsi = computeRSI(closes, 14);
          if (rsi != null) {
            if (rsi >= 70) lines.push(`RSI(14) ≈ ${rsi.toFixed(0)} — in the “overbought” band on this simple measure.`);
            else if (rsi <= 30) lines.push(`RSI(14) ≈ ${rsi.toFixed(0)} — in the “oversold” band on this simple measure.`);
          }
          const row = active.find((r) => String(r?.symbol || '').toUpperCase() === sym);
          const sv = num(row?.shareVolume ?? row?.tradeVolume);
          if (sv > 0 && activeVolumes.median > 0 && sv >= activeVolumes.median * 1.5) {
            lines.push('Share/trade volume is high versus other names on this “most active” board snapshot.');
          }
          if (lines.length) out.push({ symbol: sym, lines });
        } catch {
          /* skip symbol */
        }
        await new Promise((r) => setTimeout(r, 120));
      }
      if (!cancelled) setRuleLines(out);
      if (!cancelled) setRulesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, err, gainers, losers, active, activeVolumes.median]);

  const tableWrap = 'rounded-lg border border-[#2D323C] bg-[#1A1D23] overflow-hidden';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-[#8E9299] max-w-2xl">
          Live board data from CSE endpoints. Smart notes below are <span className="text-slate-300">rule-based</span> from
          recent closes and volumes — not predictions or financial advice.
        </p>
        <button
          type="button"
          onClick={() => loadBoards()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#2D323C] text-xs font-bold uppercase tracking-wider text-[#8E9299] hover:text-white hover:border-[#2979FF]/50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {err && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">{err}</div>
      )}

      <div className={`${tableWrap} p-4 flex items-start gap-3`}>
        <Radio className="w-5 h-5 text-[#2979FF] shrink-0 mt-0.5" />
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E9299] mb-1">Market status</h3>
          <p className="text-sm text-white font-medium">{loading ? 'Loading…' : marketStatus || '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BoardCard title="Top gainers" icon={TrendingUp} rows={gainers} loading={loading} onRowClick={onSelectStock} accent="text-emerald-400" />
        <BoardCard title="Top losers" icon={TrendingDown} rows={losers} loading={loading} onRowClick={onSelectStock} accent="text-red-400" />
        <BoardCard title="Most active" icon={Activity} rows={active} loading={loading} onRowClick={onSelectStock} accent="text-amber-400" activeMode />
      </div>

      <div className={`${tableWrap} p-5`}>
        <h3 className="text-sm font-bold text-white mb-1">Smart insights (rules only)</h3>
        <p className="text-[11px] text-[#8E9299] mb-4">
          Built from a small sample of symbols on the boards above (price series + volume). Educational only.
        </p>
        {rulesLoading && <p className="text-xs text-[#8E9299]">Computing…</p>}
        {!rulesLoading && ruleLines.length === 0 && !loading && (
          <p className="text-xs text-[#8E9299]">No rule hits for the sampled symbols, or charts were unavailable.</p>
        )}
        <ul className="space-y-4">
          {ruleLines.map(({ symbol, lines }) => (
            <li key={symbol} className="border-t border-[#2D323C] pt-3 first:border-0 first:pt-0">
              <button
                type="button"
                onClick={() => onSelectStock(symbol)}
                className="text-left font-mono text-sm text-[#2979FF] hover:underline mb-2"
              >
                {symbol}
              </button>
              <ul className="list-disc list-inside text-xs text-[#C4C7CE] space-y-1">
                {lines.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BoardCard({
  title,
  icon: Icon,
  rows,
  loading,
  onRowClick,
  accent,
  activeMode,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: any[];
  loading: boolean;
  onRowClick: (s: string) => void;
  accent: string;
  activeMode?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[#2D323C] bg-[#1A1D23] overflow-hidden flex flex-col min-h-[280px]">
      <div className="px-4 py-3 border-b border-[#2D323C] flex items-center gap-2">
        <Icon className={`w-4 h-4 ${accent}`} />
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E9299]">{title}</h3>
      </div>
      <div className="overflow-x-auto flex-1">
        {loading ? (
          <p className="p-4 text-xs text-[#8E9299]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-xs text-[#8E9299]">No rows returned.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-[#5C6370] uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 font-semibold">Symbol</th>
                <th className="px-3 py-2 font-semibold text-right">Price</th>
                {!activeMode && (
                  <>
                    <th className="px-3 py-2 font-semibold text-right">Chg</th>
                    <th className="px-3 py-2 font-semibold text-right">%</th>
                  </>
                )}
                {activeMode && (
                  <>
                    <th className="px-3 py-2 font-semibold text-right">Vol</th>
                    <th className="px-3 py-2 font-semibold text-right">Turnover</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="text-[#C4C7CE]">
              {rows.slice(0, 12).map((r, i) => {
                const sym = String(r.symbol || r.code || '').toUpperCase();
                const price = num(r.price ?? r.lastTradedPrice ?? r.ltp);
                const chg = num(r.change ?? r.priceChange);
                const pct = num(r.changePercentage ?? r.pctChange ?? r.percentage);
                const vol = num(r.shareVolume ?? r.tradeVolume);
                const to = num(r.turnover);
                return (
                  <tr key={`${sym}-${i}`} className="border-t border-[#2D323C]/60 hover:bg-[#242830]/80">
                    <td className="px-3 py-2">
                      <button type="button" className="font-mono text-[#2979FF] hover:underline" onClick={() => sym && onRowClick(sym)}>
                        {sym || '—'}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{price ? price.toFixed(2) : '—'}</td>
                    {!activeMode && (
                      <>
                        <td className={`px-3 py-2 text-right tabular-nums ${chg >= 0 ? 'text-emerald-400/90' : 'text-red-400/90'}`}>
                          {chg ? chg.toFixed(2) : '—'}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${pct >= 0 ? 'text-emerald-400/90' : 'text-red-400/90'}`}>
                          {pct ? `${pct.toFixed(2)}%` : '—'}
                        </td>
                      </>
                    )}
                    {activeMode && (
                      <>
                        <td className="px-3 py-2 text-right tabular-nums text-[#8E9299]">{vol ? vol.toLocaleString() : '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#8E9299]">{to ? to.toLocaleString() : '—'}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
