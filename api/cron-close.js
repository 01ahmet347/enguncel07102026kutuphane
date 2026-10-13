import { timingSafeEqual } from 'node:crypto';
import { closeAllDesksAt22 } from '../server/daily-close.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  const secret = process.env.CRON_SECRET;
  const header = req.headers?.authorization || '';
  const expected = `Bearer ${secret || ''}`;
  const authorized = Boolean(secret) &&
    Buffer.byteLength(header) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  if (!authorized) return res.status(401).json({ ok: false });
  try {
    const result = await closeAllDesksAt22();
    return res.status(200).json({ ok: true, result });
  } catch (error) {
    console.error('SGM daily close failed:', error.code || error.message);
    return res.status(503).json({ ok: false, error: 'daily_close_failed' });
  }
}
