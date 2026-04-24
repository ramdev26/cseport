# CSE Portfolio Tracker

A fullstack portfolio tracking app for Colombo Stock Exchange (CSE) investors.

Track trades, monitor holdings, manage watchlists, log monthly deposits, and view market data in one place.

## Features

- Email/password authentication with JWT-based sessions
- Portfolio transaction ledger (BUY/SELL validation against holdings)
- Watchlist management
- Monthly deposit tracking
- Live CSE market data proxy (stock info, market summary, top gainers/losers, chart data)
- Vercel-ready fullstack deployment:
  - Vite frontend (static build)
  - Node serverless API (`api/index.ts`)
  - Postgres storage (`DATABASE_URL`)

## Tech Stack

- Frontend: React + Vite + TypeScript
- Backend: Express (served through Vercel serverless function)
- Database: Postgres (`pg`)
- Auth: JWT + HTTP-only cookies

## Project Structure

- `src/` - frontend source code
- `src/server/app.ts` - Express app with API routes
- `api/index.ts` - Vercel serverless entrypoint
- `server.ts` - local development server bootstrap
- `vercel.json` - Vercel routing/build configuration

## Local Development

### 1) Prerequisites

- Node.js 18+ (recommended LTS)
- A Postgres database (local or hosted)

### 2) Install dependencies

```bash
npm install
```

### 3) Configure environment

Copy `.env.example` to `.env.local` and set values:

```env
DATABASE_URL=postgres://user:password@host:5432/dbname
JWT_SECRET=your_strong_secret
GEMINI_API_KEY=optional
```

### 4) Run locally

```bash
npm run dev
```

## Scripts

- `npm run dev` - start local fullstack dev server
- `npm run build` - build frontend for production
- `npm run preview` - preview frontend production build
- `npm run lint` - TypeScript type-check

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repo into Vercel.
3. Add project environment variables in Vercel:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `GEMINI_API_KEY` (optional)
4. Deploy.

Vercel will use:
- `vercel.json` for build + route handling
- `api/index.ts` for `/api/*` routes
- `vite build` output (`dist`) for frontend

## API Notes

- API routes are exposed under `/api/*`
- Authentication token is sent via HTTP-only cookie (`token`)
- Database tables are created automatically on backend startup if they do not exist

## Security Notes

- Always set a strong `JWT_SECRET` in production
- Use a managed Postgres provider (Neon, Supabase, Railway, etc.) for production reliability
- Never commit real secrets to the repository
