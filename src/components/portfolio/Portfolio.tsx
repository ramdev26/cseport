import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { BRAND_OWNER } from '../../branding';
import { holdingsFromAcc, reduceHoldingsFromTx, sellGuidance } from '../../lib/portfolioMath';
import { Plus, Trash2, Loader2, Calendar, Hash, Tag, Pencil, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react';

interface PortfolioProps {
  onSelectStock: (symbol: string) => void;
}

type StrategyForm = '' | 'short_term' | 'long_term' | 'speculative';

const emptyForm = () => ({
  stock_symbol: '',
  type: 'BUY' as 'BUY' | 'SELL',
  quantity: '',
  price: '',
  date: new Date().toISOString().split('T')[0],
  note: '',
  strategy: '' as StrategyForm,
});

const emptyDepositForm = () => ({
  amount: '',
  deposit_date: new Date().toISOString().split('T')[0],
  note: '',
});

export default function Portfolio({ onSelectStock }: PortfolioProps) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositsLoading, setDepositsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [depositForm, setDepositForm] = useState(emptyDepositForm);
  const [prices, setPrices] = useState<Record<string, number>>({});

  const holdings = useMemo(() => holdingsFromAcc(reduceHoldingsFromTx(transactions)), [transactions]);

  const holdingQtyMap = useMemo(() => {
    const m: Record<string, number> = {};
    holdings.forEach((h) => {
      m[h.symbol] = h.qty;
    });
    return m;
  }, [holdings]);

  useEffect(() => {
    fetchTransactions();
    fetchDeposits();
  }, []);

  useEffect(() => {
    if (!holdings.length) {
      setPrices({});
      return;
    }
    let cancelled = false;
    (async () => {
      const map: Record<string, number> = {};
      await Promise.all(
        holdings.map(async (h) => {
          try {
            const res = await api.market.getStock(h.symbol);
            map[h.symbol] = res.data.price?.lastTradedPrice || 0;
          } catch {
            map[h.symbol] = 0;
          }
        })
      );
      if (!cancelled) setPrices(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [holdings]);

  const fetchTransactions = async () => {
    try {
      const { data } = await api.transactions.getAll();
      setTransactions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeposits = async () => {
    try {
      const { data } = await api.deposits.getAll();
      setDeposits(data);
    } catch (e) {
      console.error(e);
    } finally {
      setDepositsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(emptyForm());
    setEditingId(null);
  };

  const openAdd = () => {
    resetForm();
    setShowAddForm(true);
  };

  const openQuickBuy = (symbol: string) => {
    const px = prices[symbol];
    setEditingId(null);
    setFormData({
      ...emptyForm(),
      stock_symbol: symbol,
      type: 'BUY',
      price: px ? String(px) : '',
    });
    setShowAddForm(true);
  };

  const openQuickSell = (symbol: string, maxQty: number) => {
    const px = prices[symbol];
    setEditingId(null);
    setFormData({
      ...emptyForm(),
      stock_symbol: symbol,
      type: 'SELL',
      quantity: String(maxQty),
      price: px ? String(px) : '',
    });
    setShowAddForm(true);
  };

  const openEdit = (tx: any) => {
    setEditingId(tx.id);
    const st = (tx.strategy || '') as StrategyForm;
    setFormData({
      stock_symbol: tx.stock_symbol,
      type: tx.type,
      quantity: String(tx.quantity),
      price: String(tx.price),
      date: tx.date,
      note: tx.note ? String(tx.note) : '',
      strategy: st === 'short_term' || st === 'long_term' || st === 'speculative' ? st : '',
    });
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(formData.quantity, 10);
    const pr = parseFloat(formData.price);
    const maxOwn = holdingQtyMap[formData.stock_symbol] ?? 0;
    if (formData.type === 'SELL' && qty > maxOwn && editingId == null) {
      alert(`You only hold ${maxOwn} shares of ${formData.stock_symbol}. Reduce quantity or buy more first.`);
      return;
    }
    if (formData.type === 'SELL' && editingId != null) {
      const sim = transactions.filter((t) => t.id !== editingId);
      const acc = reduceHoldingsFromTx(
        sim.map((t) => ({
          stock_symbol: t.stock_symbol,
          type: t.type,
          quantity: t.quantity,
          price: t.price,
          date: t.date,
        }))
      );
      const allowed = acc[formData.stock_symbol]?.qty ?? 0;
      if (qty > allowed) {
        alert(`After removing this edit, you can sell at most ${allowed} of ${formData.stock_symbol}.`);
        return;
      }
    }
    try {
      const payload = {
        stock_symbol: formData.stock_symbol,
        type: formData.type,
        quantity: qty,
        price: pr,
        date: formData.date,
        note: formData.note.trim() || null,
        strategy: formData.strategy || null,
      };
      if (editingId != null) {
        await api.transactions.update({ id: editingId, ...payload });
      } else {
        await api.transactions.add(payload);
      }
      setShowAddForm(false);
      resetForm();
      fetchTransactions();
    } catch (err: any) {
      const msg = err?.response?.data?.error || (editingId != null ? 'Error updating transaction' : 'Error adding transaction');
      alert(msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this transaction?')) return;
    try {
      await api.transactions.delete(id);
      fetchTransactions();
    } catch (e) {}
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.deposits.add({
        amount: parseFloat(depositForm.amount),
        deposit_date: depositForm.deposit_date,
        note: depositForm.note.trim() || undefined,
      });
      setDepositForm(emptyDepositForm());
      setShowDepositForm(false);
      fetchDeposits();
    } catch {
      alert('Could not save deposit');
    }
  };

  const handleDeleteDeposit = async (id: number) => {
    if (!confirm('Remove this deposit log?')) return;
    try {
      await api.deposits.delete(id);
      fetchDeposits();
    } catch (e) {}
  };

  const depositsTotal = deposits.reduce((s, d) => s + Number(d.amount), 0);

  const toneClass = (tone: string) =>
    tone === 'profit'
      ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
      : tone === 'loss'
        ? 'text-rose-400 border-rose-500/40 bg-rose-500/10'
        : 'text-slate-400 border-[#2D323C] bg-[#242830]';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Portfolio management</h1>
          <p className="text-slate-500 text-sm">
            Cash deposits (monthly savings) · stock BUY/SELL · quick sell from holdings · P/L hints vs your avg buy (not advice)
          </p>
          <p className="text-slate-600 text-xs mt-1">{BRAND_OWNER}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowDepositForm((v) => !v)}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl flex items-center space-x-2 border border-slate-600"
          >
            <PiggyBank className="w-5 h-5 text-amber-400" />
            <span>{showDepositForm ? 'Close deposit form' : 'Log cash deposit'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (showAddForm) {
                setShowAddForm(false);
                resetForm();
              } else {
                openAdd();
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl flex items-center space-x-2 shadow-lg shadow-emerald-900/20"
          >
            <Plus className="w-5 h-5" />
            <span>{showAddForm ? (editingId != null ? 'Cancel edit' : 'Close form') : 'Stock BUY / SELL'}</span>
          </button>
        </div>
      </div>

      {showDepositForm && (
        <div className="bg-slate-900 border border-amber-500/25 rounded-2xl p-6 shadow-xl">
          <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-amber-400" /> Monthly / ad-hoc cash deposit
          </h2>
          <p className="text-xs text-slate-500 mb-4">Track money you add to invest (separate from a stock BUY line).</p>
          <form onSubmit={handleDepositSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Amount (LKR)</label>
              <input
                type="number"
                required
                min={0.01}
                step="0.01"
                value={depositForm.amount}
                onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Date</label>
              <input
                type="date"
                required
                value={depositForm.deposit_date}
                onChange={(e) => setDepositForm({ ...depositForm, deposit_date: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Note (optional)</label>
              <input
                type="text"
                placeholder="e.g. April salary top-up"
                value={depositForm.note}
                onChange={(e) => setDepositForm({ ...depositForm, note: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm"
              />
            </div>
            <div className="md:col-span-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowDepositForm(false)} className="text-slate-400 px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg text-sm font-bold">
                Save deposit
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel bg-[#1A1D23] border border-[#2D323C] rounded-lg shadow-xl">
        <div className="panel-header px-4 py-3 border-b border-[#2D323C] flex flex-wrap justify-between gap-2">
          <div>
            <div className="panel-title text-xs font-bold uppercase tracking-widest text-[#8E9299]">Cash deposit log</div>
            <p className="text-[10px] text-[#5C6370] mt-1">Total logged: {depositsTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} LKR</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#2D323C]">
                <th className="px-4 py-3 text-[11px] font-bold text-[#8E9299] uppercase">Date</th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8E9299] uppercase text-right">Amount (LKR)</th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8E9299] uppercase">Note</th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8E9299] uppercase text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2D323C]">
              {depositsLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[#8E9299] text-xs">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Loading…
                  </td>
                </tr>
              ) : deposits.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[#8E9299] text-xs">
                    No deposits logged yet — use &quot;Log cash deposit&quot; above.
                  </td>
                </tr>
              ) : (
                deposits.map((d) => (
                  <tr key={d.id} className="hover:bg-[#242830]">
                    <td className="px-4 py-3 text-xs font-mono text-[#8E9299]">{d.deposit_date}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-amber-300">
                      {Number(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{d.note || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteDeposit(d.id)}
                        className="p-1.5 text-[#8E9299] hover:text-[#FF5252] rounded border border-[#2D323C]"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {holdings.length > 0 && (
        <div className="panel bg-[#1A1D23] border border-[#2D323C] rounded-lg shadow-xl">
          <div className="panel-header px-4 py-3 border-b border-[#2D323C]">
            <div className="panel-title text-xs font-bold uppercase tracking-widest text-[#8E9299]">Holdings</div>
            <p className="text-[10px] text-[#5C6370] mt-1">
              After a BUY you can record a SELL with the same symbol. Use <strong>Sell</strong> to pre-fill (qty = all, price = last). “Sell view” compares last price to your average buy — not a buy/sell recommendation.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left border-collapse min-w-[860px]">
              <thead>
                <tr className="border-b border-[#2D323C]">
                  <th className="px-3 py-3 text-[10px] font-bold text-[#8E9299] uppercase">Symbol</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-[#8E9299] uppercase text-right">Qty</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-[#8E9299] uppercase text-right">Avg buy</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-[#8E9299] uppercase text-right">Last</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-[#8E9299] uppercase text-right">P/L %</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-[#8E9299] uppercase">Sell view</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-[#8E9299] uppercase text-right">Est. value</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-[#8E9299] uppercase text-right">Trade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D323C]">
                {holdings.map((h) => {
                  const px = prices[h.symbol] ?? 0;
                  const est = h.qty * px;
                  const plPct = px > 0 && h.avgPrice > 0 ? ((px - h.avgPrice) / h.avgPrice) * 100 : null;
                  const g = sellGuidance(h.avgPrice, px);
                  return (
                    <tr key={h.symbol} className="hover:bg-[#242830]">
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => onSelectStock(h.symbol)}
                          className="font-mono font-bold text-[#2979FF] hover:underline text-sm"
                        >
                          {h.symbol}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-sm">{h.qty.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right font-mono text-sm text-emerald-300/90">{h.avgPrice.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right font-mono text-sm">{px ? px.toFixed(2) : '—'}</td>
                      <td className="px-3 py-3 text-right font-mono text-sm">
                        {plPct == null ? (
                          '—'
                        ) : (
                          <span className={plPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {plPct >= 0 ? '+' : ''}
                            {plPct.toFixed(2)}%
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 max-w-[240px]">
                        <div className={`text-[10px] leading-snug rounded border px-2 py-1.5 ${toneClass(g.tone)}`}>
                          {g.pct != null && (
                            <span className="font-mono font-bold mr-1">{g.pct >= 0 ? '+' : ''}
                            {g.pct.toFixed(1)}% </span>
                          )}
                          {g.label}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-sm text-white">
                        {est.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openQuickBuy(h.symbol)}
                          className="text-[10px] font-bold uppercase px-2 py-1 rounded border border-[#2979FF] text-[#2979FF] hover:bg-[#2979FF]/10 mr-1"
                        >
                          Buy more
                        </button>
                        <button
                          type="button"
                          onClick={() => openQuickSell(h.symbol, h.qty)}
                          className="text-[10px] font-bold uppercase px-2 py-1 rounded border border-rose-500/60 text-rose-300 hover:bg-rose-500/10"
                        >
                          Sell
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <h2 className="text-sm font-bold text-white mb-1">{editingId != null ? 'Edit transaction' : 'Stock transaction'}</h2>
          <p className="text-xs text-slate-500 mb-4">
            Choose <strong>SELL</strong> to exit (or part-exit) a position you bought. Price is usually the last traded price — adjust if needed.
          </p>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Stock symbol</label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
                <input
                  type="text"
                  required
                  placeholder="e.g. JKH.N0000"
                  value={formData.stock_symbol}
                  onChange={(e) => setFormData({ ...formData, stock_symbol: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Buy / Sell</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'BUY' | 'SELL' })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Quantity</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
                <input
                  type="number"
                  required
                  min={1}
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-right"
                />
              </div>
              {formData.type === 'SELL' && formData.stock_symbol && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Max you can sell now: {holdingQtyMap[formData.stock_symbol] ?? 0} (same-day order uses server rules)
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Price (LKR)</label>
              <input
                type="number"
                step="0.01"
                required
                min={0}
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-right"
              />
            </div>

            <div className="lg:col-span-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Strategy tag</label>
              <select
                value={formData.strategy}
                onChange={(e) => setFormData({ ...formData, strategy: e.target.value as StrategyForm })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">— Optional —</option>
                <option value="short_term">Short-term</option>
                <option value="long_term">Long-term</option>
                <option value="speculative">Speculative</option>
              </select>
            </div>

            <div className="lg:col-span-4">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Journal note (why you bought / sold)</label>
              <input
                type="text"
                placeholder="Optional — e.g. dividend play, rebalance"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="lg:col-span-6 flex justify-end space-x-3 mt-4 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-100 text-sm font-medium px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg text-sm font-bold transition-all"
              >
                {editingId != null ? 'Save changes' : 'Save transaction'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel bg-[#1A1D23] border border-[#2D323C] rounded-lg shadow-xl">
        <div className="panel-header px-4 py-3 border-b border-[#2D323C]">
          <div className="panel-title text-xs font-bold uppercase tracking-widest text-[#8E9299]">Transaction log</div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#2D323C]">
                <th className="px-4 py-3 text-[11px] font-bold text-[#8E9299] uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8E9299] uppercase tracking-wider">Stock</th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8E9299] uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8E9299] uppercase tracking-wider text-right">Qty</th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8E9299] uppercase tracking-wider text-right">Price</th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8E9299] uppercase tracking-wider text-right">Total</th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8E9299] uppercase tracking-wider">Strategy</th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8E9299] uppercase tracking-wider">Note</th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8E9299] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2D323C]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[#8E9299] text-xs uppercase tracking-widest">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2 opacity-50" />
                    Loading…
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[#8E9299] text-xs uppercase tracking-widest">
                    No stock transactions yet — add a BUY first.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#242830] transition-colors group">
                    <td className="px-4 py-4 whitespace-nowrap text-xs font-mono text-[#8E9299]">{tx.date}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectStock(tx.stock_symbol)}
                        className="font-mono font-bold text-[#2979FF] hover:underline text-sm"
                      >
                        {tx.stock_symbol}
                      </button>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#242830] border border-[#2D323C] ${
                          tx.type === 'BUY' ? 'text-[#00E676]' : 'text-[#FF5252]'
                        }`}
                      >
                        {tx.type === 'BUY' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-mono">{tx.quantity.toLocaleString()}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-mono text-[#8E9299]">{Number(tx.price).toFixed(2)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-mono font-bold text-white">
                      {(tx.quantity * tx.price).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-xs text-[#8E9299] max-w-[100px] truncate" title={tx.strategy || ''}>
                      {tx.strategy === 'short_term'
                        ? 'Short'
                        : tx.strategy === 'long_term'
                          ? 'Long'
                          : tx.strategy === 'speculative'
                            ? 'Spec'
                            : '—'}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-400 max-w-[140px] truncate" title={tx.note || ''}>
                      {tx.note || '—'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(tx)}
                        className="p-1.5 mr-1 text-[#8E9299] hover:text-[#2979FF] bg-[#0F1115] rounded border border-[#2D323C] inline-flex"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(tx.id)}
                        className="p-1.5 text-[#8E9299] hover:text-[#FF5252] bg-[#0F1115] rounded border border-[#2D323C] inline-flex"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
