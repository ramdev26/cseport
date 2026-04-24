import React from 'react';
import { LayoutDashboard, ListOrdered, LogOut, Eye, BarChart3, Brain } from 'lucide-react';
import { BRAND_APP_SHORT, BRAND_OWNER } from '../../branding';

interface NavbarProps {
  onNavigate: (page: string) => void;
  activePage: string;
  onLogout: () => void;
  userEmail: string;
}

export default function Navbar({ onNavigate, activePage, onLogout, userEmail }: NavbarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'portfolio', label: 'Portfolio', icon: ListOrdered },
    { id: 'watchlist', label: 'Watchlist', icon: Eye },
    { id: 'market-analysis', label: 'Market', icon: BarChart3 },
    { id: 'investor-insights', label: 'Insights', icon: Brain },
  ];

  return (
    <aside className="w-[220px] bg-[#1A1D23] border-r border-[#2D323C] flex flex-col py-6">
      <div className="px-6 mb-10">
        <button
          type="button"
          className="text-left w-full cursor-pointer"
          onClick={() => onNavigate('dashboard')}
        >
          <div className="text-[11px] font-semibold tracking-wide text-white leading-tight">{BRAND_OWNER}</div>
          <div className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2979FF] mt-1">{BRAND_APP_SHORT}</div>
        </button>
      </div>
      
      <nav className="flex-1">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center space-x-3 px-6 py-3 cursor-pointer transition-all border-r-4 ${
                activePage === item.id 
                  ? 'bg-[#242830] text-white border-[#2979FF]' 
                  : 'text-[#8E9299] hover:text-white border-transparent'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span className="text-[13px] font-medium">{item.label}</span>
            </li>
          ))}
        </ul>
      </nav>

      <div className="px-6 pt-6 border-t border-[#2D323C]">
        <p className="text-[9px] text-[#5C6370] mb-4 leading-relaxed">© {new Date().getFullYear()} {BRAND_OWNER}</p>
        <div className="mb-4">
          <p className="text-[10px] text-[#8E9299] uppercase font-bold tracking-wider">Investor</p>
          <p className="text-xs font-mono text-white truncate" title={userEmail}>{userEmail}</p>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center space-x-2 w-full text-[#8E9299] hover:text-[#FF5252] transition-colors text-xs font-bold uppercase tracking-widest"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
