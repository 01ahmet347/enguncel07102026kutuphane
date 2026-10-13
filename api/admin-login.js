import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { adminApp, dataCollection } from '../server/firebase-admin.js';

const secureMatch = (candidate, expected) => timingSafeEqual(
  createHash('sha256').update(String(candidate)).digest(),
  createHash('sha256').update(String(expected)).digest()
);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    return res.status(503).json({ ok: false, message: 'Yönetici servisi yapılandırılmamış.' });
  }
  const username = req.body?.username;
  const password = req.body?.password;
  if (typeof username !== 'string' || typeof password !== 'string' ||
      !secureMatch(username, process.env.ADMIN_USERNAME) ||
      !secureMatch(password, process.env.ADMIN_PASSWORD)) {
    return res.status(401).json({ ok: false, error: 'invalid_credentials', message: 'Yönetici bilgileri hatalı.' });
  }
  try {
    const adminSessionId = randomUUID();
    const token = await getAuth(adminApp()).createCustomToken('sgm-admin', {
      admin: true, adminSessionId
    });
    // Son başarılı giriş kazanır. Firestore kuralları ve sunucu API'leri bunu doğrular.
    await dataCollection('sgmAdminSessions').doc('current').set({
      sessionId: adminSessionId,
      createdAt: Date.now(),
      actorUid: 'sgm-admin'
    });
    return res.status(200).json({ ok: true, token });
  } catch (error) {
    console.error('Admin login error:', error.code || error.message);
    return res.status(503).json({ ok: false, error: 'admin_login_unavailable', message: 'Yönetici servisine ulaşılamadı.' });
  }
}
