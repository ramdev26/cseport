<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# CSE Portfolio Tracker

This project is set up for:
- local fullstack development with Express + Vite
- Vercel deployment with:
  - static frontend build (`dist`)
  - serverless API (`api/index.ts`)
  - hosted Postgres via `DATABASE_URL`

## Local development

1. Install dependencies:
   - `npm install`
2. Create `.env.local` from `.env.example` and set:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `GEMINI_API_KEY` (optional)
3. Run:
   - `npm run dev`

## Deploy to Vercel (fullstack)

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Set these Environment Variables in Vercel project settings:
   - `DATABASE_URL` (Supabase/Neon/Postgres connection string)
   - `JWT_SECRET`
   - `GEMINI_API_KEY` (if needed by UI features)
4. Deploy. Vercel uses:
   - `vercel.json`
   - `api/index.ts` for `/api/*`
   - `vite build` output from `dist`
