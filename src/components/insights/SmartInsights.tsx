import React, { useState, useEffect } from 'react';
import { Lightbulb, Info, AlertTriangle, ArrowUpRight, CheckCircle2, Loader2, Sparkles, BrainCircuit } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface SmartInsightsProps {
  portfolioData: any[];
}

export default function SmartInsights({ portfolioData }: SmartInsightsProps) {
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Rule-based insights
  const ruleInsights = [];
    
  if (portfolioData.length > 0) {
    // 1. Concentration risk
    const largestHolding = [...portfolioData].sort((a, b) => b.currentValue - a.currentValue)[0];
    const totalValue = portfolioData.reduce((sum, item) => sum + item.currentValue, 0);
    if (largestHolding.currentValue / totalValue > 0.4) {
      ruleInsights.push({
        type: 'warning',
        title: 'High Concentration',
        text: `Stock ${largestHolding.symbol} represents over 40% of your portfolio value. Consider diversifying.`
      });
    }

    // 2. Large gains
    portfolioData.forEach(item => {
      const gainPct = (item.profit / item.totalCost) * 100;
      if (gainPct > 20) {
        ruleInsights.push({
          type: 'success',
          title: `Strong Performer: ${item.symbol}`,
          text: `You are up ${gainPct.toFixed(1)}% on this position. Consider booking partial profits.`
        });
      } else if (gainPct < -15) {
        ruleInsights.push({
          type: 'danger',
          title: `Underperformer: ${item.symbol}`,
          text: `Position is down ${Math.abs(gainPct).toFixed(1)}%. Review the company fundamentals or stop-loss.`
        });
      }
    });

    // 3. Diversification
    if (portfolioData.length < 5) {
      ruleInsights.push({
        type: 'info',
        title: 'Portfolio Size',
        text: 'A diversified portfolio typically contains 10-15 stocks across different sectors.'
      });
    }
  }

  const generateAiInsight = async () => {
    if (!process.env.GEMINI_API_KEY) return;
    setLoadingAi(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const portfolioSummary = portfolioData.map(p => 
        `${p.symbol}: Qty ${p.qty}, Avg ${p.avgPrice.toFixed(2)}, Current ${p.currentPrice.toFixed(2)}, P/L ${p.profit.toFixed(2)}`
      ).join('\n');

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are a financial portfolio analyst focused on the Colombo Stock Exchange (CSE) in Sri Lanka. 
        Analyze the following portfolio and provide a concise (max 3 sentences) data-driven insight. 
        Focus on risk, sector balance, or specific opportunities based on the numbers.
        Disclaimer: This is not financial advice.
        
        Portfolio Data:
        ${portfolioSummary}`,
      });
      setAiInsight(response.text);
    } catch (e) {
      console.error(e);
      setAiInsight("AI insights unavailable at the moment.");
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div className="panel bg-[#1A1D23] border border-[#2D323C] rounded-lg h-full flex flex-col">
      <div className="panel-header px-4 py-3 border-b border-[#2D323C] flex justify-between items-center bg-[#1A1D23]">
        <div className="panel-title text-xs font-bold uppercase tracking-widest text-[#8E9299]">Smart Insights</div>
        <button 
          onClick={generateAiInsight}
          disabled={loadingAi || !process.env.GEMINI_API_KEY}
          className="text-[#2979FF] text-[10px] font-bold uppercase tracking-wider hover:underline flex items-center space-x-1 disabled:opacity-50"
        >
          {loadingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          <span>AI Analyze</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Gemini Insight */}
        {aiInsight && (
          <div className="insight-item p-4 border-b border-[#2D323C] bg-[#242830]/30 transition-colors">
            <span className="insight-tag inline-block px-1.5 py-0.5 bg-[#242830] text-[#2979FF] text-[9px] font-bold uppercase rounded border border-[#2D323C] mb-2 tracking-wider">AI Analyst</span>
            <div className="insight-text text-xs text-white leading-relaxed italic opacity-90">
              "{aiInsight}"
            </div>
          </div>
        )}

        {/* Rule-based Insights */}
        {ruleInsights.length > 0 ? (
          ruleInsights.map((insight, i) => (
            <div 
              key={i} 
              className="insight-item p-4 border-b border-[#2D323C] hover:bg-[#242830]/50 transition-colors"
            >
              <span className={`insight-tag inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border border-[#2D323C] mb-2 tracking-wider ${
                insight.type === 'warning' ? 'text-[#FFD54F] bg-amber-500/10' : 
                insight.type === 'success' ? 'text-[#00E676] bg-emerald-500/10' : 
                insight.type === 'danger' ? 'text-[#FF5252] bg-red-500/10' :
                'text-[#2979FF] bg-blue-500/10'
              }`}>
                {insight.title}
              </span>
              <div className="insight-text text-xs text-[#8E9299] leading-relaxed">
                {insight.text}
              </div>
            </div>
          ))
        ) : !aiInsight && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
             <Info className="w-6 h-6 mb-2 text-[#8E9299]" />
             <p className="text-[10px] uppercase tracking-widest font-bold text-[#8E9299]">Analysis Pending</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[#2D323C] bg-[#1A1D23]">
        <p className="text-[9px] text-[#8E9299] uppercase tracking-[2px] font-bold text-center">
            CSE.DATA.SPEC.V1.2
        </p>
      </div>
    </div>
  );
}
