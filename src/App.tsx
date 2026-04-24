import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import Navbar from './components/layout/Navbar';
import Dashboard from './components/dashboard/Dashboard';
import Portfolio from './components/portfolio/Portfolio';
import Watchlist from './components/market/Watchlist';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import StockDetail from './components/market/StockDetail';
import MarketAnalysis from './components/market/MarketAnalysis';
import InvestorHub from './components/insights/InvestorHub';
import { motion, AnimatePresence } from 'motion/react';
import { BRAND_OWNER } from './branding';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [returnFromStock, setReturnFromStock] = useState('dashboard');

  const openStock =
    (from: string) =>
    (symbol: string) => {
      setReturnFromStock(from);
      setSelectedStock(symbol);
      setCurrentPage('stock-detail');
    };

  useEffect(() => {
    // Check if user is logged in (session/cookie handled by browser/express)
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData: any) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    setCurrentPage('dashboard');
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch (e) {}
    setUser(null);
    localStorage.removeItem('user');
    setCurrentPage('login');
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white gap-2">
        <p className="text-xs text-emerald-500/90 font-medium tracking-wide">{BRAND_OWNER}</p>
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    );

  if (!user && currentPage !== 'register') {
    return <Login onLogin={handleLogin} onGoToRegister={() => setCurrentPage('register')} />;
  }

  if (!user && currentPage === 'register') {
    return <Register onRegister={() => setCurrentPage('login')} onGoToLogin={() => setCurrentPage('login')} />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onSelectStock={openStock('dashboard')} />;
      case 'portfolio':
        return <Portfolio onSelectStock={openStock('portfolio')} />;
      case 'watchlist':
        return <Watchlist onSelectStock={openStock('watchlist')} />;
      case 'market-analysis':
        return <MarketAnalysis onSelectStock={openStock('market-analysis')} />;
      case 'investor-insights':
        return <InvestorHub onSelectStock={openStock('investor-insights')} />;
      case 'stock-detail':
        return <StockDetail symbol={selectedStock || ''} onBack={() => setCurrentPage(returnFromStock)} />;
      default:
        return <Dashboard onSelectStock={openStock('dashboard')} />;
    }
  };

  const pageTitle =
    currentPage === 'dashboard'
      ? 'Portfolio Overview'
      : currentPage === 'stock-detail'
        ? selectedStock || 'Stock'
        : currentPage === 'market-analysis'
          ? 'Market analysis'
          : currentPage === 'investor-insights'
            ? 'Investor insights'
            : currentPage.charAt(0).toUpperCase() + currentPage.slice(1).replace(/-/g, ' ');

  return (
    <div className="flex min-h-screen bg-[#0F1115] text-white font-sans overflow-hidden">
      <Navbar 
        onNavigate={setCurrentPage} 
        activePage={currentPage} 
        onLogout={handleLogout} 
        userEmail={user.email} 
      />
      <main className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar p-6 space-y-6">
        <header className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-xl font-bold">{pageTitle}</h1>
            <p className="text-xs text-[#8E9299]">
              {BRAND_OWNER} · Last market sync: {new Date().toLocaleTimeString()} · Colombo, Sri Lanka
            </p>
          </div>
          <button 
            onClick={() => setCurrentPage('portfolio')}
            className="bg-[#2979FF] hover:bg-[#2979FF]/80 text-white px-4 py-2 rounded font-bold text-xs uppercase tracking-wider transition-all"
          >
            + Add Transaction
          </button>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1"
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
