import dotenv from 'dotenv';
import { createApp } from './src/server/app';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

async function startServer() {
  const app = await createApp();
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST || '127.0.0.1';
  app.listen(PORT, HOST, () => {
    const urlHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
    console.log(`Ramesh Gmage · CSE Portfolio (local): http://localhost:${PORT} or http://${urlHost}:${PORT}`);
  });
}

startServer();
