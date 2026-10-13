import { getAuth } from 'firebase-admin/auth';
import { adminApp, dataCollection } from './firebase-admin.js';

export async function requireActiveAdmin(req) {
  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers?.authorization || '')?.[1];
  if (!bearer) throw Object.assign(new Error('Yönetici oturumu yok.'), { status: 401 });
  const decoded = await getAuth(adminApp()).verifyIdToken(bearer, true);
  if (decoded.admin !== true || typeof decoded.adminSessionId !== 'string') {
    throw Object.assign(new Error('Yönetici yetkisi bulunamadı.'), { status: 403 });
  }
  const active = await dataCollection('sgmAdminSessions').doc('current').get();
  if (!active.exists || active.data()?.sessionId !== decoded.adminSessionId) {
    throw Object.assign(new Error('Başka bir yönetici giriş yaptı. Yeniden oturum açın.'), { status: 403 });
  }
  return decoded;
}
