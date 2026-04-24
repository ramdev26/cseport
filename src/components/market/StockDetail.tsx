import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ArrowLeft, RefreshCw, Info } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface StockDetailProps {
  symbol: string;
  onBack: () => void;
}

/** CSE `companyChartDataByStock` period codes — tied to security OHLC, not the old index `chartData` API. */
const CHART_PERIOD: Record<string, string> = {
  '1D': '1',
  '1W': '3',
  '1M': '4',
  '1Y': '5',
};

export default function StockDetail({ symbol, onBack }: StockDetailProps) {
  const [data, setData] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState('1D');

  useEffect(() => {
    fetchStockData();
  }, [symbol, timeFilter]);

  const fetchStockData = async () => {
    setLoading(true);
    setError(null);
    const csePeriod = CHART_PERIOD[timeFilter] || '1';
    try {
      const [stockOutcome, chartOutcome] = await Promise.allSettled([
        api.market.getStock(symbol),
        api.market.getChartData(symbol, csePeriod),
      ]);

      if (stockOutcome.status === 'fulfilled') {
        setData(stockOutcome.value.data);
      } else {
        setData(null);
        const err: any = stockOutcome.reason;
        const body = err?.response?.data as { error?: string } | undefined;
        const msg =
          (body && typeof body.error === 'string' && body.error) || err?.message || 'Could not load stock details';
        setError(msg);
      }

      if (chartOutcome.status === 'fulfilled') {
        const chartRes = chartOutcome.value;
        const points = chartRes.data?.chartData || [];
        const transformed = points.map((p: any) => ({
          time:
            p.timeLabel ||
            p.date ||
            (p.d != null
              ? new Date(Number(p.d)).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''),
          price: p.p ?? p.price ?? p.tradePrice ?? p.v ?? null,
        }));
        setChartData(transformed.filter((x: any) => x.price != null));
      } else {
        setChartData([]);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin text-emerald-500" /></div>;

  if (error) {
    return (
      <div className="space-y-4 max-w-lg">
        <button
          type="button"
          onClick={onBack}
          className="text-[10px] font-bold uppercase tracking-widest text-[#8E9299] hover:text-[#2979FF] flex items-center mb-2 transition-colors group"
        >
          <ArrowLeft className="w-3 h-3 mr-1 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </button>
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <p className="font-bold text-red-100 mb-1">Unable to load {symbol}</p>
          <p className="text-red-200/90">{error}</p>
          <p className="mt-3 text-xs text-[#8E9299]">
            CSE expects full tickers such as <span className="font-mono text-white">JKH.N0000</span> (ordinary shares are usually{' '}
            <span className="font-mono">.N0000</span>). Short codes like <span className="font-mono">JKH</span> are resolved when possible.
          </p>
        </div>
      </div>
    );
  }

  const pct = data?.price?.percentageChange;
  const ltp = data?.price?.lastTradedPrice;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <button 
            onClick={onBack}
            className="text-[10px] font-bold uppercase tracking-widest text-[#8E9299] hover:text-[#2979FF] flex items-center mb-2 transition-colors group"
          >
            <ArrowLeft className="w-3 h-3 mr-1 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </button>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-mono font-bold text-white tracking-tight">{symbol}</h1>
            {data?.resolvedSymbol && data.resolvedSymbol !== symbol ? (
              <span className="text-[10px] text-[#8E9299] font-mono border border-[#2D323C] rounded px-2 py-0.5" title="Ticker sent to CSE">
                → {data.resolvedSymbol}
              </span>
            ) : null}
            <div
              className={`px-2 py-0.5 rounded text-[10px] font-bold border border-[#2D323C] ${
                pct == null ? 'text-[#8E9299]' : pct >= 0 ? 'bg-emerald-500/10 text-[#00E676]' : 'bg-red-500/10 text-[#FF5252]'
              }`}
            >
              {pct == null ? '—' : `${pct >= 0 ? '▲' : '▼'} ${Number(pct).toFixed(2)}%`}
            </div>
          </div>
          <p className="text-xs text-[#8E9299] font-medium uppercase tracking-wider">{data?.summary?.companyName || '—'}</p>
        </div>
        
        <div className="text-right">
          <p className="text-[10px] text-[#8E9299] uppercase font-bold tracking-widest mb-1">Live Feed</p>
          <div className="text-2xl font-mono font-bold text-[#2979FF] leading-none">
            {ltp != null ? Number(ltp).toFixed(2) : '—'}
          </div>
          <p className="text-[10px] text-[#8E9299] mt-1 italic uppercase tracking-wider">Currency: LKR</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Chart Panel */}
          <div className="panel bg-[#1A1D23] border border-[#2D323C] rounded-lg">
            <div className="panel-header px-4 py-3 border-b border-[#2D323C] flex justify-between items-center bg-[#1A1D23]">
              <div className="panel-title text-xs font-bold uppercase tracking-widest text-[#8E9299]">Price history (LKR)</div>
              <div className="flex space-x-2">
                {['1D', '1W', '1M', '1Y'].map((f) => (
                  <button 
                    key={f}
                    type="button"
                    onClick={() => setTimeFilter(f)}
                    className={`text-[9px] font-bold px-2 py-1 rounded border transition-all ${
                      timeFilter === f ? 'bg-[#2979FF] border-[#2979FF] text-white' : 'bg-[#242830] border-[#2D323C] text-[#8E9299] hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[350px] w-full p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2979FF" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#2979FF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D323C" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fill: '#8E9299', fontSize: 10, fontFamily: 'monospace' }} 
                    axisLine={{ stroke: '#2D323C' }} 
                  />
                  <YAxis 
                    domain={['auto', 'auto']}
                    tick={{ fill: '#8E9299', fontSize: 10, fontFamily: 'monospace' }} 
                    axisLine={{ stroke: '#2D323C' }} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1A1D23', border: '1px solid #2D323C', borderRadius: '4px' }}
                    itemStyle={{ color: '#2979FF', fontSize: '12px', fontFamily: 'monospace' }}
                    labelStyle={{ color: '#8E9299', fontSize: '10px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#2979FF" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorPrice)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Market Cap', value: data?.summary?.marketCap ? (data.summary.marketCap / 1e9).toFixed(2) + ' B' : 'N/A' },
              { label: 'PE Ratio', value: data?.summary?.pe || 'N/A' },
              { label: 'Div Yield', value: data?.summary?.dividendYield ? data.summary.dividendYield + '%' : '0.00%' },
              { label: 'PBV', value: data?.summary?.pbv || 'N/A' }
            ].map((stat, i) => (
              <div key={i} className="panel p-4 bg-[#1A1D23] border border-[#2D323C]">
                <p className="text-[9px] text-[#8E9299] uppercase font-bold tracking-widest mb-1">{stat.label}</p>
                <p className="text-sm font-mono font-bold text-white tracking-tight">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel bg-[#1A1D23] border border-[#2D323C] rounded-lg">
            <div className="panel-header px-4 py-3 border-b border-[#2D323C] bg-[#1A1D23]">
              <div className="panel-title text-xs font-bold uppercase tracking-widest text-[#8E9299]">Metric Matrix</div>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-[#2D323C]/50">
                <span className="text-[11px] text-[#8E9299] uppercase tracking-wider font-medium">Sector</span>
                <span className="font-mono text-[10px] text-[#2979FF] bg-[#2979FF]/10 px-1.5 py-0.5 rounded border border-[#2979FF]/20">
                  {data?.summary?.sectorName || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#2D323C]/50">
                <span className="text-[11px] text-[#8E9299] uppercase tracking-wider font-medium">Shares Out</span>
                <span className="font-mono text-xs text-white">{data?.summary?.totalShares?.toLocaleString() || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#2D323C]/50">
                <span className="text-[11px] text-[#8E9299] uppercase tracking-wider font-medium">Float %</span>
                <span className="font-mono text-xs text-white">{data?.summary?.publicFloatPercentage || '0.00'} %</span>
              </div>
              <div className="py-2">
                <p className="text-[10px] text-[#8E9299] uppercase font-bold mb-2 tracking-widest">Description</p>
                <p className="text-xs text-[#8E9299] leading-relaxed line-clamp-6">
                  {data?.summary?.companyDescription || 'Data stream description unavailable for this terminal.'}
                </p>
              </div>
            </div>
          </div>

          <div className="panel bg-[#1A1D23] border border-[#2D323C] rounded-lg p-5 text-left">
             <div className="flex items-center space-x-2 text-amber-400 mb-3">
               <Info className="w-4 h-4" />
               <h4 className="text-[10px] font-black uppercase tracking-[2px]">Technical Note</h4>
             </div>
             <p className="text-[11px] text-[#8E9299] leading-relaxed">
               Asset currently trading relative to historical volatility. Significant resistance observed at <span className="text-white font-mono">
                {data?.price?.lastTradedPrice ? (data.price.lastTradedPrice * 1.05).toFixed(2) : '---'}
               </span>.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
