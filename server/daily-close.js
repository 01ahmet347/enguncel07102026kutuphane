// Sarıçam GM: 22.00 Türkiye saati sunucu kapanışı.
// Sadece masa oturumları/rezervasyonlar sonlandırılır; hesap, PIN, QR veya ceza geçmişi silinmez.
import { dataCollection } from './firebase-admin.js';

export function trDayKey(at = Date.now()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(at)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function trMinuteOfDay(at = Date.now()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(at)).map(part => [part.type, Number(part.value)]));
  return parts.hour * 60 + parts.minute;
}

export const deskClearPatch = desk => ({
  status: desk?.status === 'disabled' ? 'disabled' : 'available',
  occupant: null, ownerDeviceId: null, sessionStartTime: null,
  guestOccupant: null, guestSessionStartTime: null, guestBreakEndTime: null,
  guestReported: false, guestReportEndTime: null,
  guestReportIssuedAt: null, guestReportVerifiedAt: null,
  pendingOccupant: null, pendingDeskRole: null, pendingDeskDeadline: null,
  pendingDeviceId: null, breakEndTime: null, reportEndTime: null,
  reportIssuedAt: null, reportVerifiedAt: null
});

export async function closeAllDesksAt22({ at = Date.now(), collection = dataCollection } = {}) {
  // Zamanlayıcı erken çalışırsa asla kapanış yapma.
  if (trMinuteOfDay(at) < 22 * 60) return { skipped: 'before_22' };
  const today = trDayKey(at);
  const desksCollection = collection('sgmDesks');
  const usersCollection = collection('sgmUsers');
  const lockCollection = collection('sgmDeviceLocks');
  const marker = collection('sgmDailyClosures').doc(today);
  const db = desksCollection.firestore;

  // Tek transaction: ya masalar+kullanıcılar+kilitler birlikte temizlenir ya hiçbiri.
  return db.runTransaction(async tx => {
    const markerSnap = await tx.get(marker);
    if (markerSnap.exists && markerSnap.data()?.complete) {
      return { alreadyCompleted: true, date: today };
    }
    const dRefs = Array.from({ length: 35 }, (_, i) => desksCollection.doc(String(i + 1)));
    const dSnaps = await Promise.all(dRefs.map(ref => tx.get(ref)));
    const owners = new Map();
    const locks = new Map();
    for (const snap of dSnaps) {
      if (!snap.exists) continue;
      const d = snap.data();
      const id = Number(snap.id);
      for (const uid of [d.occupant, d.guestOccupant, d.pendingOccupant]) {
        if (uid) {
          if (!owners.has(String(uid))) owners.set(String(uid), new Set());
          owners.get(String(uid)).add(id);
        }
      }
      if (d.ownerDeviceId) locks.set(d.ownerDeviceId, id);
      if (d.pendingDeviceId) locks.set(d.pendingDeviceId, id);
    }
    const uRefs = [...owners.keys()].map(uid => usersCollection.doc(uid));
    const lRefs = [...locks.keys()].map(deviceId => lockCollection.doc(deviceId));
    const [uSnaps, lSnaps] = await Promise.all([
      Promise.all(uRefs.map(ref => tx.get(ref))),
      Promise.all(lRefs.map(ref => tx.get(ref)))
    ]);
    let released = 0;
    for (const snap of dSnaps) {
      if (!snap.exists) continue;
      const before = snap.data();
      if (before.occupant || before.guestOccupant || before.pendingOccupant ||
          ['occupied', 'on_break', 'reported'].includes(before.status)) released++;
      tx.set(snap.ref, deskClearPatch(before), { merge: true });
    }
    uSnaps.forEach((snap, index) => {
      if (!snap.exists) return;
      const user = snap.data();
      const affected = owners.get(snap.id);
      const patch = {};
      if (affected.has(Number(user.activeDeskId))) {
        Object.assign(patch, { activeDeskId: null, activeDeskRole: null, adminDeskGrant: null });
      }
      if (affected.has(Number(user.pendingDeskId))) {
        Object.assign(patch, { pendingDeskId: null, pendingDeskDeadline: null });
      }
      if (Object.keys(patch).length) tx.set(uRefs[index], patch, { merge: true });
    });
    lSnaps.forEach((snap, index) => {
      if (snap.exists && Number(snap.data()?.deskId) === locks.get(snap.id)) {
        tx.delete(lRefs[index]);
      }
    });
    tx.set(marker, { day: today, closedAt: at, complete: true, released });
    return { date: today, released, completed: true };
  });
}
