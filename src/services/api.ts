import axios from 'axios';

const API_BASE = '/api';

axios.defaults.withCredentials = true;

export const api = {
  auth: {
    login: (credentials: any) => axios.post(`${API_BASE}/auth/login`, credentials),
    register: (details: any) => axios.post(`${API_BASE}/auth/register`, details),
    logout: () => axios.post(`${API_BASE}/auth/logout`),
  },
  transactions: {
    getAll: () => axios.get(`${API_BASE}/get-transactions`),
    add: (tx: any) => axios.post(`${API_BASE}/add-transaction`, tx),
    update: (tx: {
      id: number;
      stock_symbol: string;
      type: string;
      quantity: number;
      price: number;
      date: string;
      note?: string | null;
      strategy?: string | null;
    }) => axios.put(`${API_BASE}/update-transaction`, tx),
    delete: (id: number) => axios.delete(`${API_BASE}/delete-transaction?id=${id}`),
  },
  deposits: {
    getAll: () => axios.get(`${API_BASE}/monthly-deposits`),
    add: (row: { amount: number; deposit_date: string; note?: string }) =>
      axios.post(`${API_BASE}/monthly-deposits`, row),
    delete: (id: number) => axios.delete(`${API_BASE}/monthly-deposits?id=${id}`),
  },
  watchlist: {
    getAll: () => axios.get(`${API_BASE}/get-watchlist`),
    add: (symbol: string) => axios.post(`${API_BASE}/add-watchlist`, { stock_symbol: symbol }),
    remove: (id: number) => axios.delete(`${API_BASE}/remove-watchlist?id=${id}`),
  },
  market: {
    getSummary: () => axios.get(`${API_BASE}/market-summary`),
    getMarketStatus: () => axios.get(`${API_BASE}/market-status`),
    getTopGainers: () => axios.get(`${API_BASE}/top-gainers`),
    getTopLosers: () => axios.get(`${API_BASE}/top-losers`),
    getMostActive: () => axios.get(`${API_BASE}/most-active`),
    getStockPriceSeries: (symbol: string, period = '4') =>
      axios.get(
        `${API_BASE}/stock-price-series?symbol=${encodeURIComponent(symbol)}&period=${encodeURIComponent(period)}`
      ),
    getStock: (symbol: string) =>
      axios.get(`${API_BASE}/stock?symbol=${encodeURIComponent(symbol)}`),
    getChartData: (symbol: string, period = '1', chartId = '1') =>
      axios.get(
        `${API_BASE}/chart-data?symbol=${encodeURIComponent(symbol)}&period=${encodeURIComponent(period)}&chartId=${encodeURIComponent(chartId)}`
      ),
  }
};
