import { randomUUID } from 'node:crypto';
import { dataCollection } from '../server/firebase-admin.js';
import { requireActiveAdmin } from '../server/admin-session.js';
import { createStudentRecord, generateStudentCredential } from '../server/student-registration.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }
  if (!/^Bearer\s+\S+$/i.test(req.headers?.authorization || '')) {
    return res.status(401).json({ ok: false, error: 'unauthenticated', message: 'Yönetici oturumu doğrulanamadı.' });
  }
  try {
    await requireActiveAdmin(req);
    const { name, requestId } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 120 ||
        typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) {
      return res.status(400).json({ ok: false, error: 'invalid_request', message: 'Ad soyad veya işlem kimliği geçersiz.' });
    }
    const normalizedName = name.trim();
    const users = dataCollection('sgmUsers');
    const authCodes = dataCollection('sgmAuthCodes');
    const requestRef = dataCollection('sgmAdminStudentRequests').doc(requestId);
    const settingsSnapshot = await dataCollection('sgmConfig').doc('settings').get();
    const settings = settingsSnapshot.data() || {};
    const userId = randomUUID();
    for (let attempt = 0; attempt < 12; attempt++) {
      const specialCode = generateStudentCredential();
      const pin = generateStudentCredential();
      const user = { ...createStudentRecord({ uid: userId, specialCode, pin, settings }), name: normalizedName };
      const result = await users.firestore.runTransaction(async tx => {
        const requestSnapshot = await tx.get(requestRef);
        if (requestSnapshot.exists) {
          const previous = requestSnapshot.data();
          if (previous.name && previous.name !== normalizedName) {
            throw Object.assign(new Error('Bu işlem kimliği başka bir kayıt için kullanılmış.'), { status: 409 });
          }
          if (!previous.userId) throw new Error('Önceki hesap oluşturma işlemi eksik.');
          const existingUserSnapshot = await tx.get(users.doc(String(previous.userId)));
          if (!existingUserSnapshot.exists) throw new Error('Önceki işlemde oluşturulan hesap bulunamadı.');
          return existingUserSnapshot.data();
        }
        const userRef = users.doc(userId);
        const codeRef = authCodes.doc(specialCode);
        const [userSnapshot, codeSnapshot] = await Promise.all([tx.get(userRef), tx.get(codeRef)]);
        if (userSnapshot.exists || codeSnapshot.exists) return null;
        tx.create(codeRef, { userId, createdAt: Date.now() });
        tx.create(userRef, user);
        tx.create(requestRef, { userId, name: normalizedName, createdAt: Date.now() });
        return user;
      });
      if (result) {
        // Yöneticiye kod ve PIN yalnızca mevcut admin ekranıyla uyumluluk için döner.
        return res.status(201).json({ ok: true, user: { ...result } });
      }
    }
    throw new Error('Unable to allocate unique student credentials.');
  } catch (error) {
    if (error.status) return res.status(error.status).json({ ok: false, error: 'admin_request_rejected', message: error.message });
    if (error.code?.startsWith('auth/')) return res.status(401).json({ ok: false, error: 'invalid_admin_session', message: 'Yönetici oturumu geçersiz.' });
    console.error('Admin student creation error:', error.code || error.message);
    return res.status(503).json({ ok: false, error: 'student_creation_unavailable', message: 'Öğrenci hesabı oluşturulamadı.' });
  }
}
