import dotenv from 'dotenv';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import { Pool } from 'pg';
import { reduceHoldingsFromTx, type TxRow } from '../lib/portfolioMath';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const JWT_SECRET = process.env.JWT_SECRET || 'cse-portfolio-secret-123';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required for Postgres connection.');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

let initialized = false;
const ensureDb = async () => {
  if (initialized) return;

  // Supabase pooler connections can reject multi-statement queries.
  // Run schema bootstrap as individual queries to avoid startup crashes.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      stock_symbol TEXT,
      type TEXT CHECK(type IN ('BUY', 'SELL')),
      quantity INTEGER,
      price DOUBLE PRECISION,
      date TEXT,
      note TEXT,
      strategy TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS watchlist (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      stock_symbol TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS monthly_deposits (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      amount DOUBLE PRECISION NOT NULL,
      deposit_date TEXT NOT NULL,
      note TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  initialized = true;
};

export async function createApp() {
  await ensureDb();
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());

  const cache: Record<string, { data: any; expiry: number }> = {};
  const CACHE_DURATION = 60 * 1000;

  const CSE_POST_HEADERS = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Origin: 'https://www.cse.lk',
    Referer: 'https://www.cse.lk/',
  };

  const encodeCseForm = (payload: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(payload)) {
      if (v === undefined || v === null) continue;
      params.append(k, String(v));
    }
    return params.toString();
  };

  const fetchCseApi = async (endpoint: string, payload: Record<string, string | number | undefined> = {}) => {
    const cacheKey = JSON.stringify({ endpoint, payload });
    if (cache[cacheKey] && cache[cacheKey].expiry > Date.now()) return cache[cacheKey].data;

    const body = encodeCseForm(payload);
    const response = await axios.post(`https://www.cse.lk/api/${endpoint}`, body, {
      headers: CSE_POST_HEADERS,
      timeout: 25_000,
      validateStatus: (s) => s >= 200 && s < 300,
    });
    cache[cacheKey] = { data: response.data, expiry: Date.now() + CACHE_DURATION };
    return response.data;
  };

  const cseSymbolKey = (s: string) => String(s || '').trim().toUpperCase().replace(/\s+/g, '');

  const tryCompanySummary = async (sym: string): Promise<any | null> => {
    try {
      const d = await fetchCseApi('companyInfoSummery', { symbol: cseSymbolKey(sym) });
      const info = d?.reqSymbolInfo;
      return info && (info.name || info.symbol) ? d : null;
    } catch {
      return null;
    }
  };

  const resolveCseSymbol = async (input: string): Promise<{ summary: any; symbol: string } | null> => {
    const upper = cseSymbolKey(input);
    if (!upper) return null;

    let d = await tryCompanySummary(upper);
    if (d) return { summary: d, symbol: cseSymbolKey(String(d.reqSymbolInfo?.symbol || upper)) };

    if (!upper.includes('.')) {
      for (const suf of ['.N0000', '.X0000', '.V0000']) {
        d = await tryCompanySummary(upper + suf);
        if (d) return { summary: d, symbol: cseSymbolKey(String(d.reqSymbolInfo?.symbol || upper + suf)) };
      }
    }

    try {
      const trade = await fetchCseApi('tradeSummary');
      const rows: any[] = trade?.reqTradeSummery || [];
      const exact = rows.find((r) => cseSymbolKey(r.symbol) === upper);
      const prefix = !upper.includes('.') ? rows.find((r) => cseSymbolKey(r.symbol).startsWith(`${upper}.`)) : null;
      const hit = exact || prefix;
      if (hit?.symbol) {
        const sym = cseSymbolKey(hit.symbol);
        d = await tryCompanySummary(sym);
        if (d) return { summary: d, symbol: cseSymbolKey(String(d.reqSymbolInfo?.symbol || sym)) };
      }
    } catch {
      // optional fallback only
    }

    return null;
  };

  const normalizeStockPayload = (symbol: string, summary: any, todayShare: any) => {
    const info = summary?.reqSymbolInfo || {};
    const symU = cseSymbolKey(symbol);
    let row: any = null;
    if (Array.isArray(todayShare)) row = todayShare.find((p: any) => String(p.symbol).toUpperCase() === symU) || null;
    return {
      summary: {
        companyName: info.name,
        symbol: info.symbol || symbol,
        marketCap: info.marketCap,
        pe: info.peRatio ?? info.pe ?? null,
        dividendYield: info.dividendYield ?? null,
        pbv: info.pbv ?? null,
        sectorName: info.sectorName ?? info.sector ?? row?.sectorName ?? 'N/A',
        totalShares: info.quantityIssued ?? null,
        publicFloatPercentage: info.publicFloatPercentage ?? null,
        companyDescription: info.companyDescription ?? info.description ?? '',
      },
      price: {
        lastTradedPrice: info.lastTradedPrice ?? row?.lastTradedPrice ?? null,
        change: info.change ?? row?.change ?? null,
        percentageChange: info.changePercentage ?? row?.changePercentage ?? null,
      },
    };
  };

  const rowsToTxRows = (rows: any[]): TxRow[] =>
    rows.map((r) => ({
      id: r.id,
      stock_symbol: r.stock_symbol,
      type: r.type,
      quantity: Number(r.quantity),
      price: Number(r.price),
      date: r.date,
    }));

  const ledgerAllows = async (userId: number, nextTx: TxRow, replaceId?: number) => {
    const result = await pool.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY date ASC, id ASC', [userId]);
    const rows = result.rows;
    const filtered = replaceId != null ? rows.filter((r) => r.id !== replaceId) : rows;
    const maxId = filtered.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
    const txForSort: TxRow = replaceId != null ? { ...nextTx, id: replaceId } : { ...nextTx, id: maxId + 1 };
    const merged = rowsToTxRows(filtered).concat([txForSort]);
    merged.sort((a, b) => (a.date === b.date ? (a.id ?? 0) - (b.id ?? 0) : a.date.localeCompare(b.date)));
    const acc = reduceHoldingsFromTx(merged);
    return !Object.values(acc).some((v) => v.qty < -1e-9);
  };

  const authenticateToken = (req: any, res: any, next: any) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: 'Forbidden' });
      req.user = user;
      next();
    });
  };

  const normalizeStrategy = (s: unknown) => {
    const v = String(s || '').trim().toLowerCase();
    if (v === 'short_term' || v === 'long_term' || v === 'speculative') return v;
    return null;
  };

  app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const result = await pool.query('INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id', [email, hashedPassword]);
      res.status(201).json({ message: 'User registered', userId: result.rows[0].id });
    } catch {
      res.status(400).json({ error: 'Email already exists' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    res.json({ message: 'Logged in', token, user: { id: user.id, email: user.email } });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
  });

  app.get('/api/get-transactions', authenticateToken, async (req: any, res) => {
    const result = await pool.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC', [req.user.id]);
    res.json(result.rows);
  });

  app.post('/api/add-transaction', authenticateToken, async (req: any, res) => {
    const { stock_symbol, type, quantity, price, date, note, strategy } = req.body;
    const sym = String(stock_symbol || '').toUpperCase();
    const qty = Number(quantity);
    const pr = Number(price);
    if (!sym || (type !== 'BUY' && type !== 'SELL') || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(pr) || pr < 0 || !date) {
      return res.status(400).json({ error: 'Invalid transaction fields' });
    }
    const nextTx: TxRow = { stock_symbol: sym, type, quantity: qty, price: pr, date: String(date) };
    if (!(await ledgerAllows(req.user.id, nextTx))) {
      return res.status(400).json({ error: 'SELL would exceed your holdings for that symbol' });
    }
    const noteStr = note != null && String(note).trim() ? String(note).trim() : null;
    const strat = normalizeStrategy(strategy);
    await pool.query(
      'INSERT INTO transactions (user_id, stock_symbol, type, quantity, price, date, note, strategy) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [req.user.id, sym, type, qty, pr, String(date), noteStr, strat]
    );
    res.status(201).json({ message: 'Transaction added' });
  });

  app.put('/api/update-transaction', authenticateToken, async (req: any, res) => {
    const { id, stock_symbol, type, quantity, price, date, note, strategy } = req.body;
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = await pool.query('SELECT id FROM transactions WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (!row.rows[0]) return res.status(404).json({ error: 'Transaction not found' });
    if (!stock_symbol || !type || quantity == null || price == null || !date) {
      return res.status(400).json({ error: 'stock_symbol, type, quantity, price, and date are required' });
    }
    if (type !== 'BUY' && type !== 'SELL') return res.status(400).json({ error: 'type must be BUY or SELL' });
    const sym = String(stock_symbol || '').toUpperCase();
    const qty = Number(quantity);
    const pr = Number(price);
    const nextTx: TxRow = { id: Number(id), stock_symbol: sym, type, quantity: qty, price: pr, date: String(date) };
    if (!(await ledgerAllows(req.user.id, nextTx, Number(id)))) {
      return res.status(400).json({ error: 'Update would leave negative holdings for a symbol' });
    }
    const noteStr = note != null && String(note).trim() ? String(note).trim() : null;
    const strat = normalizeStrategy(strategy);
    await pool.query(
      'UPDATE transactions SET stock_symbol = $1, type = $2, quantity = $3, price = $4, date = $5, note = $6, strategy = $7 WHERE id = $8 AND user_id = $9',
      [sym, type, qty, pr, String(date), noteStr, strat, id, req.user.id]
    );
    res.json({ message: 'Transaction updated' });
  });

  app.delete('/api/delete-transaction', authenticateToken, async (req: any, res) => {
    const { id } = req.query;
    await pool.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ message: 'Transaction deleted' });
  });

  app.get('/api/monthly-deposits', authenticateToken, async (req: any, res) => {
    const result = await pool.query('SELECT * FROM monthly_deposits WHERE user_id = $1 ORDER BY deposit_date DESC, id DESC', [req.user.id]);
    res.json(result.rows);
  });

  app.post('/api/monthly-deposits', authenticateToken, async (req: any, res) => {
    const { amount, deposit_date, note } = req.body;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0 || !deposit_date) {
      return res.status(400).json({ error: 'amount and deposit_date are required' });
    }
    const result = await pool.query(
      'INSERT INTO monthly_deposits (user_id, amount, deposit_date, note) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.user.id, amt, String(deposit_date), note ? String(note) : null]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Deposit logged' });
  });

  app.delete('/api/monthly-deposits', authenticateToken, async (req: any, res) => {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    await pool.query('DELETE FROM monthly_deposits WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ message: 'Deleted' });
  });

  app.get('/api/get-watchlist', authenticateToken, async (req: any, res) => {
    const result = await pool.query('SELECT * FROM watchlist WHERE user_id = $1', [req.user.id]);
    res.json(result.rows);
  });

  app.post('/api/add-watchlist', authenticateToken, async (req: any, res) => {
    const { stock_symbol } = req.body;
    await pool.query('INSERT INTO watchlist (user_id, stock_symbol) VALUES ($1, $2)', [req.user.id, String(stock_symbol || '').toUpperCase()]);
    res.status(201).json({ message: 'Added to watchlist' });
  });

  app.delete('/api/remove-watchlist', authenticateToken, async (req: any, res) => {
    const { id } = req.query;
    await pool.query('DELETE FROM watchlist WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ message: 'Removed from watchlist' });
  });

  app.get('/api/stock', async (req, res) => {
    const raw = String(req.query.symbol || '').trim();
    if (!raw) return res.status(400).json({ error: 'symbol query parameter is required' });
    try {
      const resolved = await resolveCseSymbol(raw);
      if (!resolved) return res.status(404).json({ error: 'Could not find that ticker on CSE.', symbol: raw });
      const { symbol: listed, summary } = resolved;
      const listedKey = cseSymbolKey(listed);
      let todayShare: any = null;
      try {
        todayShare = await fetchCseApi('todaySharePrice', { symbol: listedKey });
      } catch {
        // optional fallback only
      }
      res.json({
        ...normalizeStockPayload(listedKey, summary, todayShare),
        resolvedSymbol: listedKey !== cseSymbolKey(raw) ? listedKey : undefined,
      });
    } catch {
      res.status(500).json({ error: 'Failed to fetch stock data from CSE' });
    }
  });

  app.get('/api/market-summary', async (_req, res) => {
    try {
      const [summary, aspi, snp] = await Promise.all([fetchCseApi('marketSummery'), fetchCseApi('aspiData'), fetchCseApi('snpData')]);
      res.json({
        ...summary,
        aspi: aspi?.value,
        aspiChange: aspi?.change,
        aspiPct: aspi?.percentage,
        snp: snp?.value,
        snpChange: snp?.change,
        snpPct: snp?.percentage,
      });
    } catch {
      res.status(500).json({ error: 'Failed to fetch market summary' });
    }
  });

  app.get('/api/market-status', async (_req, res) => {
    try {
      const data = await fetchCseApi('marketStatus', {});
      if (typeof data === 'string' && /<!doctype|<html[\s>]/i.test(data)) {
        return res.status(502).json({ error: 'Market status temporarily unavailable (unexpected response from CSE).' });
      }
      res.json(data);
    } catch {
      res.status(500).json({ error: 'Failed to fetch market status' });
    }
  });

  app.get('/api/stock-price-series', async (req, res) => {
    const raw = String(req.query.symbol || '').trim();
    const period = String(req.query.period || '4');
    if (!raw) return res.status(400).json({ error: 'symbol query parameter is required' });
    try {
      const resolved = await resolveCseSymbol(raw);
      if (!resolved) return res.status(404).json({ error: 'Unknown symbol', symbol: raw });
      const stockId = resolved.summary?.reqSymbolInfo?.id;
      if (stockId == null) return res.status(404).json({ error: 'Could not resolve security id' });
      const data = await fetchCseApi('companyChartDataByStock', { stockId, period });
      const arr = data?.chartData ?? data?.reqTradeSummery?.chartData ?? [];
      const list = (Array.isArray(arr) ? arr : []).filter((r: any) => r.t != null && r.p != null).sort((a: any, b: any) => Number(a.t) - Number(b.t));
      const closes = list.map((r: any) => Number(r.p));
      res.json({ symbol: cseSymbolKey(resolved.symbol), closes, bars: closes.length });
    } catch {
      res.status(500).json({ error: 'Failed to fetch price series' });
    }
  });

  app.get('/api/top-gainers', async (_req, res) => {
    try {
      const data = await fetchCseApi('topGainers');
      res.json(data);
    } catch {
      res.status(500).json({ error: 'Failed to fetch top gainers' });
    }
  });

  app.get('/api/top-losers', async (_req, res) => {
    try {
      const data = await fetchCseApi('topLooses');
      res.json(data);
    } catch {
      res.status(500).json({ error: 'Failed to fetch top losers' });
    }
  });

  app.get('/api/most-active', async (_req, res) => {
    try {
      const data = await fetchCseApi('mostActiveTrades');
      res.json(data);
    } catch {
      res.status(500).json({ error: 'Failed to fetch most active' });
    }
  });

  app.get('/api/chart-data', async (req, res) => {
    const raw = String(req.query.symbol || '').trim();
    if (!raw) return res.status(400).json({ error: 'symbol query parameter is required' });
    const period = String(req.query.period || '1');
    try {
      const resolved = await resolveCseSymbol(raw);
      if (!resolved) return res.status(404).json({ error: 'Unknown symbol for chart', symbol: raw });
      const stockId = resolved.summary?.reqSymbolInfo?.id;
      if (stockId == null) return res.status(404).json({ error: 'Could not resolve security id for chart', symbol: raw });
      const data = await fetchCseApi('companyChartDataByStock', { stockId, period });
      const arr = data?.chartData ?? data?.reqTradeSummery?.chartData ?? [];
      const list = Array.isArray(arr) ? arr : [];
      const points = list.map((row: any) => ({ d: row.t, v: row.p, p: row.p, h: row.h, l: row.l }));
      res.json({ chartData: points });
    } catch {
      res.status(500).json({ error: 'Failed to fetch chart data' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use((req, res, next) => {
      const pathOnly = req.originalUrl.split('?')[0];
      if (pathOnly.startsWith('/api')) return next();
      return vite.middlewares(req, res, next);
    });
    app.use('/api', (_req, res) => {
      if (res.headersSent) return;
      res.status(404).json({ error: 'Unknown API route' });
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.originalUrl.split('?')[0].startsWith('/api')) {
        return res.status(404).json({ error: 'Unknown API route' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}
