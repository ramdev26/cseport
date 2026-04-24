import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { BRAND_OWNER } from '../../branding';
import { Eye, Plus, Trash2, TrendingUp, TrendingDown, RefreshCw, ExternalLink } from 'lucide-react';

interface WatchlistProps {
  onSelectStock: (symbol: string) => void;
}

export default function Watchlist({ onSelectStock }: WatchlistProps) {
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSymbol, setNewSymbol] = useState('');
  const [prices, setPrices] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    try {
      const { data } = await api.watchlist.getAll();
      setWatchlist(data);
      
      const priceMap: Record<string, any> = {};
      await Promise.all(data.map(async (item: any) => {
        try {
          const res = await api.market.getStock(item.stock_symbol);
          priceMap[item.stock_symbol] = res.data;
        } catch (e) {}
      }));
      setPrices(priceMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol) return;
    try {
      await api.watchlist.add(newSymbol.toUpperCase());
      setNewSymbol('');
      fetchWatchlist();
    } catch (e) {}
  };

  const handleRemove = async (id: number) => {
    try {
      await api.watchlist.remove(id);
      fetchWatchlist();
    } catch (e) {}
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Watchlist</h1>
          <p className="text-slate-500 text-sm">Monitor stocks you're interested in</p>
          <p className="text-slate-600 text-xs mt-1">{BRAND_OWNER}</p>
        </div>
        <div className="flex items-center space-x-2">
            <button 
                onClick={fetchWatchlist}
                className="p-2 text-slate-400 hover:text-emerald-500 bg-slate-800 rounded-lg transition-colors"
            >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
        </div>
      </div>

      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <form onSubmit={handleAdd} className="flex gap-4">
          <input
            type="text"
            placeholder="Enter Stock Symbol (e.g. LOLC.N0000)"
            value={newSymbol}
            onChange={e => setNewSymbol(e.target.value.toUpperCase())}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold flex items-center space-x-2 transition-all shadow-lg shadow-emerald-900/20"
          >
            <Plus className="w-5 h-5" />
            <span>Add Stock</span>
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && watchlist.length === 0 ? (
          <div className="col-span-full py-12 text-center text-[#8E9299] text-xs uppercase tracking-widest">Synchronizing watchlist...</div>
        ) : watchlist.length === 0 ? (
          <div className="col-span-full py-12 text-center text-[#8E9299] text-xs uppercase tracking-widest bg-[#1A1D23] rounded-lg border-2 border-dashed border-[#2D323C]">
            No monitors active. Input a symbol to begin.
          </div>
        ) : (
          watchlist.map((item) => {
            const data = prices[item.stock_symbol];
            const price = data?.price?.lastTradedPrice || 0;
            const change = data?.price?.change || 0;
            const percentageChange = data?.price?.percentageChange || 0;

            return (
              <div 
                key={item.id}
                className="panel bg-[#1A1D23] border border-[#2D323C] p-6 rounded-lg hover:border-[#2979FF]/50 transition-all group relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="cursor-pointer" onClick={() => onSelectStock(item.stock_symbol)}>
                    <h3 className="text-sm font-mono font-bold text-[#2979FF] flex items-center group-hover:underline transition-colors">
                      {item.stock_symbol}
                      <ExternalLink className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </h3>
                    <p className="text-[10px] text-[#8E9299] uppercase font-bold tracking-wider">{data?.summary?.companyName || 'Loading...'}</p>
                  </div>
                  <button 
                    onClick={() => handleRemove(item.id)}
                    className="p-1.5 text-[#8E9299] hover:text-[#FF5252] bg-[#242830] rounded border border-[#2D323C] transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[9px] text-[#8E9299] uppercase font-black tracking-widest mb-1">Last Traded</p>
                    <p className="text-xl font-mono font-bold flex items-baseline leading-none">
                      <span className="text-[10px] font-normal text-[#8E9299] mr-1 italic">LKR</span>
                      {price.toFixed(2)}
                    </p>
                  </div>
                  <div className={`text-right font-mono ${percentageChange >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                    <div className="flex items-center justify-end text-sm font-bold">
                      {percentageChange >= 0 ? '▲' : '▼'}
                      <span> {percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(2)}%</span>
                    </div>
                    <p className="text-[10px] opacity-70">{change >= 0 ? '+' : ''}{change.toFixed(2)}</p>
                  </div>
                </div>

                {/* Subtle highlight side-bar */}
                <div className={`absolute left-0 top-0 w-1 h-full ${percentageChange >= 0 ? 'bg-[#00E676]' : 'bg-[#FF5252]'}`} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
