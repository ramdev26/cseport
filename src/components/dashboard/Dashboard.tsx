import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { RefreshCw } from 'lucide-react';
import {
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import SmartInsights from '../insights/SmartInsights';
import { buildMonthlyPortfolioSeries } from '../../lib/portfolioMath';

interface DashboardProps {
  onSelectStock: (symbol: string) => void;
}

/** Reference monthly contribution for “plan vs actual” chart (LKR). */
const MONTHLY_PLAN_LKR = 10_000;

export default function Dashboard({ onSelectStock }: DashboardProps) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [marketSummary, setMarketSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [txRes, marketRes] = await Promise.all([api.transactions.getAll(), api.market.getSummary()]);
      setTransactions(txRes.data);
      setMarketSummary(marketRes.data);

      const symbols = Array.from(new Set(txRes.data.map((t: any) => t.stock_symbol)));
      const priceMap: Record<string, number> = {};
      await Promise.all(
        symbols.map(async (s: any) => {
          try {
            const res = await api.market.getStock(s);
            priceMap[s] = res.data.price?.lastTradedPrice || 0;
          } catch (e) {
            priceMap[s] = 0;
          }
        })
      );
      setPrices(priceMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const holdings = transactions.reduce((acc: any, tx: any) => {
    if (!acc[tx.stock_symbol]) acc[tx.stock_symbol] = { qty: 0, totalCost: 0, transactions: [] };
    const sign = tx.type === 'BUY' ? 1 : -1;
    acc[tx.stock_symbol].qty += tx.quantity * sign;
    if (tx.type === 'BUY') {
      acc[tx.stock_symbol].totalCost += tx.quantity * tx.price;
    } else {
      const avgPrice = acc[tx.stock_symbol].totalCost / (acc[tx.stock_symbol].qty + tx.quantity);
      acc[tx.stock_symbol].totalCost -= tx.quantity * avgPrice;
    }
    acc[tx.stock_symbol].transactions.push(tx);
    return acc;
  }, {});

  const portfolioData = Object.entries(holdings)
    .filter(([_, data]: any) => data.qty > 0)
    .map(([symbol, data]: any) => {
      const currentPrice = prices[symbol] || 0;
      const currentValue = data.qty * currentPrice;
      const avgPrice = data.totalCost / data.qty;
      const profit = currentValue - data.totalCost;
      return { symbol, ...data, avgPrice, currentPrice, currentValue, profit };
    });

  const totalInvested = portfolioData.reduce((sum, item) => sum + item.totalCost, 0);
  const totalValue = portfolioData.reduce((sum, item) => sum + item.currentValue, 0);
  const totalProfit = totalValue - totalInvested;
  const profitPercentage = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  const monthlySeries = useMemo(
    () => buildMonthlyPortfolioSeries(transactions, prices, MONTHLY_PLAN_LKR),
    [transactions, prices]
  );

  const monthlyPlanChartData = useMemo(
    () =>
      monthlySeries.map((r) => ({
        month: r.monthLabel,
        planned: MONTHLY_PLAN_LKR,
        actualBuys: r.buysThisMonth,
      })),
    [monthlySeries]
  );

  const growthChartData = useMemo(
    () =>
      monthlySeries.map((r) => ({
        month: r.monthLabel,
        costBasis: Math.round(r.costBasis),
        marketValue: Math.round(r.marketValue),
        plannedCumulative: Math.round(r.plannedCumulative),
        cumulativeBuys: Math.round(r.cumulativeBuys),
      })),
    [monthlySeries]
  );

  const chartTooltip = {
    contentStyle: { backgroundColor: '#1A1D23', border: '1px solid #2D323C', borderRadius: '4px' },
    labelStyle: { color: '#8E9299', fontSize: 10 },
    itemStyle: { fontSize: 12, fontFamily: 'monospace' },
  };

  if (loading)
    return (
      <div className="flex items-center justify-center p-20">
        <RefreshCw className="animate-spin text-emerald-500" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="stats-row grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card bg-[#1A1D23] border border-[#2D323C] p-5 rounded-lg shadow-inner">
          <div className="stat-label text-[10px] uppercase tracking-wider text-[#8E9299] mb-2 font-bold">Total invested (LKR)</div>
          <div className="stat-value font-mono text-xl font-bold text-white tracking-tight leading-none">
            {totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="stat-delta text-[11px] mt-2 text-[#8E9299]">Book cost of open positions</p>
        </div>

        <div className="stat-card bg-[#1A1D23] border border-[#2D323C] p-5 rounded-lg shadow-inner">
          <div className="stat-label text-[10px] uppercase tracking-wider text-[#8E9299] mb-2 font-bold">Current portfolio value (LKR)</div>
          <div className="stat-value font-mono text-xl font-bold text-[#2979FF] tracking-tight leading-none">
            {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="stat-delta text-[11px] mt-2 text-[#8E9299]">Qty × last synced price</p>
        </div>

        <div className="stat-card bg-[#1A1D23] border border-[#2D323C] p-5 rounded-lg shadow-inner">
          <div className="stat-label text-[10px] uppercase tracking-wider text-[#8E9299] mb-2 font-bold">Profit / loss</div>
          <div
            className={`stat-value font-mono text-xl font-bold tracking-tight leading-none ${
              totalProfit >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'
            }`}
          >
            {totalProfit >= 0 ? '+' : ''}
            {totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LKR
          </div>
          <div className={`stat-delta text-[11px] mt-2 font-bold ${totalProfit >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
            {totalProfit >= 0 ? '▲' : '▼'} {profitPercentage.toFixed(2)}% on invested capital
          </div>
          <p className="text-[10px] text-[#5C6370] mt-1">Absolute change vs. percentage return</p>
        </div>

        <div className="stat-card bg-[#1A1D23] border border-[#2D323C] p-5 rounded-lg shadow-inner">
          <div className="stat-label text-[10px] uppercase tracking-wider text-[#8E9299] mb-2 font-bold">Monthly plan (reference)</div>
          <div className="stat-value font-mono text-xl font-bold text-amber-400 tracking-tight leading-none">
            {MONTHLY_PLAN_LKR.toLocaleString()} LKR
          </div>
          <p className="stat-delta text-[11px] mt-2 text-[#8E9299]">
            Target per month · see chart below for actual buys
          </p>
        </div>
      </div>

      {transactions.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="panel bg-[#1A1D23] border border-[#2D323C] rounded-lg">
            <div className="panel-header px-4 py-3 border-b border-[#2D323C]">
              <div className="panel-title text-xs font-bold uppercase tracking-widest text-[#8E9299]">
                Monthly investment vs plan
              </div>
              <p className="text-[10px] text-[#5C6370] mt-1">
                Planned {MONTHLY_PLAN_LKR.toLocaleString()} LKR/month vs BUY totals per calendar month
              </p>
            </div>
            <div className="h-[280px] w-full p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyPlanChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D323C" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#8E9299', fontSize: 9 }} axisLine={{ stroke: '#2D323C' }} />
                  <YAxis
                    tick={{ fill: '#8E9299', fontSize: 10 }}
                    axisLine={{ stroke: '#2D323C' }}
                    tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`)}
                  />
                  <Tooltip {...chartTooltip} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="planned" name={`Plan (${MONTHLY_PLAN_LKR.toLocaleString()}/mo)`} fill="#5C6370" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="actualBuys" name="Actual BUY (LKR)" fill="#2979FF" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel bg-[#1A1D23] border border-[#2D323C] rounded-lg">
            <div className="panel-header px-4 py-3 border-b border-[#2D323C]">
              <div className="panel-title text-xs font-bold uppercase tracking-widest text-[#8E9299]">
                Portfolio growth over time
              </div>
              <p className="text-[10px] text-[#5C6370] mt-1">
                Book cost basis & mark-to-market (same last price applied to each month-end quantity)
              </p>
            </div>
            <div className="h-[280px] w-full p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D323C" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#8E9299', fontSize: 9 }} axisLine={{ stroke: '#2D323C' }} />
                  <YAxis
                    tick={{ fill: '#8E9299', fontSize: 10 }}
                    axisLine={{ stroke: '#2D323C' }}
                    tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`)}
                  />
                  <Tooltip {...chartTooltip} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="plannedCumulative" name="Plan cumulative (10k×mo)" stroke="#5C6370" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="cumulativeBuys" name="Cumulative BUY (LKR)" stroke="#00BFA5" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="costBasis" name="Book cost basis" stroke="#FFC107" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="marketValue" name="Est. market value" stroke="#2979FF" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-grid grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="panel bg-[#1A1D23] border border-[#2D323C] rounded-lg">
            <div className="panel-header px-4 py-3 border-b border-[#2D323C] flex justify-between items-center">
              <div className="panel-title text-xs font-bold uppercase tracking-widest text-[#8E9299]">Holdings</div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#2D323C]">
                    <th className="text-left text-[11px] font-bold uppercase text-[#8E9299] px-4 py-3">Stock</th>
                    <th className="text-right text-[11px] font-bold uppercase text-[#8E9299] px-4 py-3">Qty</th>
                    <th className="text-right text-[11px] font-bold uppercase text-[#8E9299] px-4 py-3">Avg buy</th>
                    <th className="text-right text-[11px] font-bold uppercase text-[#8E9299] px-4 py-3">Last</th>
                    <th className="text-right text-[11px] font-bold uppercase text-[#8E9299] px-4 py-3">P/L %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2D323C]">
                  {portfolioData.map((item, index) => (
                    <tr
                      key={index}
                      className="hover:bg-[#242830] cursor-pointer transition-colors"
                      onClick={() => onSelectStock(item.symbol)}
                    >
                      <td className="px-4 py-4">
                        <span className="text-[#2979FF] font-mono font-bold text-sm">{item.symbol}</span>
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-sm">{item.qty.toLocaleString()}</td>
                      <td className="px-4 py-4 text-right font-mono text-sm">{item.avgPrice.toFixed(2)}</td>
                      <td className="px-4 py-4 text-right font-mono text-sm">{item.currentPrice.toFixed(2)}</td>
                      <td
                        className={`px-4 py-4 text-right font-mono text-sm font-bold ${
                          item.profit >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'
                        }`}
                      >
                        {item.profit >= 0 ? '+' : ''}
                        {((item.profit / item.totalCost) * 100).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                  {portfolioData.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[#8E9299] text-xs uppercase tracking-widest">
                        No active holdings — add BUY transactions in Portfolio
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel bg-[#1A1D23] border border-[#2D323C] rounded-lg">
            <div className="panel-header px-4 py-3 border-b border-[#2D323C]">
              <div className="panel-title text-xs font-bold uppercase tracking-widest text-[#8E9299]">Value by holding (LKR)</div>
            </div>
            <div className="h-[250px] w-full p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={portfolioData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D323C" vertical={false} />
                  <XAxis dataKey="symbol" tick={{ fill: '#8E9299', fontSize: 10 }} axisLine={{ stroke: '#2D323C' }} />
                  <YAxis
                    tick={{ fill: '#8E9299', fontSize: 10 }}
                    axisLine={{ stroke: '#2D323C' }}
                    tickFormatter={(val) => (val / 1000).toFixed(0) + 'k'}
                  />
                  <Tooltip {...chartTooltip} />
                  <Bar dataKey="currentValue" fill="#2979FF" radius={[2, 2, 0, 0]} name="Current value" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <SmartInsights portfolioData={portfolioData} />

          <div className="panel bg-[#1A1D23] border border-[#2D323C] rounded-lg shadow-lg">
            <div className="panel-header px-4 py-3 border-b border-[#2D323C]">
              <div className="panel-title text-xs font-bold uppercase tracking-widest text-[#8E9299]">Market snapshot</div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center p-3 bg-[#242830] rounded border border-[#2D323C]">
                <span className="text-[11px] font-bold text-[#8E9299] uppercase tracking-wider">ASPI</span>
                <span className="font-mono font-bold text-sm text-white">
                  {marketSummary?.aspi != null
                    ? `${Number(marketSummary.aspi).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-[#242830] rounded border border-[#2D323C]">
                <span className="text-[11px] font-bold text-[#8E9299] uppercase tracking-wider">S&amp;P SL20</span>
                <span className="font-mono font-bold text-sm text-white">
                  {marketSummary?.snp != null
                    ? `${Number(marketSummary.snp).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
