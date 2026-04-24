import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Express } from 'express';

let appPromise: Promise<Express> | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!appPromise) {
      appPromise = import('../src/server/app.js').then((m) => m.createApp());
    }
    const app = await appPromise;
    return app(req, res);
  } catch (error: any) {
    console.error('API bootstrap error:', error);
    return res.status(500).json({
      error: 'Server bootstrap failed',
      details: error?.message || String(error),
    });
  }
}
