import { timingSafeEqual } from 'node:crypto';
import { dataCollection } from '../server/firebase-admin.js';
import { createServerDeskActions } from './student-desk.js';

// Requires a trusted external scheduler or Vercel Pro cron every minute.
// Never call from a client; Admin SDK can modify protected Firestore data.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  const secret = process.env.CRON_SECRET;
  const header = String(req.headers?.authorization || '');
  const expected = `Bearer ${secret || ''}`;
  if (!secret || Buffer.byteLength(header) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(header), Buffer.from(expected))) {
    return res.status(401).json({ ok: false });
  }
  try {
    const now = Date.now();
    const desks = dataCollection('sgmDesks');
    const [reported, pending] = await Promise.all([
      desks.where('status', '==', 'reported').get(),
      desks.where('pendingDeskDeadline', '<=', now).get()
    ]);
    const ids = new Set();
    for (const snap of [...reported.docs, ...pending.docs]) {
      const d = snap.data();
      if ((d.status === 'reported' && Number(d.reportEndTime || 0) <= now &&
           Number(d.reportEndTime || 0) > 0) ||
          (d.pendingOccupant && Number(d.pendingDeskDeadline || 0) > 0 &&
           Number(d.pendingDeskDeadline) <= now)) {
        ids.add(Number(snap.id));
      }
    }
    const actions = await createServerDeskActions();
    const results = [];
    // Bound concurrency prevents bursts and respects transaction retries.
    for (const id of ids) {
      if (id >= 1 && id <= 35) {
        const result = await actions.expireDesk(id);
        results.push({ deskId: id, processed: Boolean(result), skippedClosing: result?.skippedClosing === true });
      }
    }
    return res.status(200).json({ ok: true, inspected: ids.size, results });
  } catch (error) {
    console.error('SGM expiry sweep failed:', error.code || error.message);
    return res.status(503).json({ ok: false, error: 'expiry_sweep_failed' });
  }
}
