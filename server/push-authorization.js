// Saf yetki/doğrulama kuralları. Firebase bağlantısı gerektirmeyen testler içindir.
const reject = message => Object.assign(new Error(message), { status: 403 });

export async function authorizePushCaller({ caller, req, requireActiveAdmin }) {
  if (!caller || typeof caller.uid !== 'string' || !caller.uid) {
    throw Object.assign(new Error('Kimlik doğrulaması gerekli.'), { status: 401 });
  }
  if (caller.admin === true) {
    // Yönetici tokenının hâlâ geçerli olması yeterli değildir: YENİ yönetici
    // giriş yaptığında eskisinin tüm sunucu işlemlerine erişimi sonlanır.
    const currentAdmin = await requireActiveAdmin(req);
    if (!currentAdmin || currentAdmin.uid !== caller.uid || currentAdmin.admin !== true) {
      throw reject('Aktif yönetici oturumu bulunamadı.');
    }
    return currentAdmin;
  }
  if (caller.role !== 'student') {
    throw reject('Öğrenci veya aktif yönetici oturumu gerekli.');
  }
  return caller;
}

export function authorizePushEvent({ event, caller, userId }) {
  const type = event?.type;
  if (!['İHBAR', 'İHBAR_MISAFIR', 'ADMIN_MASA_MESAJI'].includes(type) ||
      event?.userId !== userId || event?.actorFirebaseUid !== caller?.uid) {
    throw reject('Bu bildirim için yetkiniz yok.');
  }
  if (type === 'ADMIN_MASA_MESAJI' && caller.admin !== true) {
    throw reject('Yönetici yetkisi gerekli.');
  }
  // Rolü doğrulanmış öğrenci yalnızca kendi oluşturduğu ihbarın
  // sunucuda onaylanmış olay kaydını bildirebilir.
  if (type !== 'ADMIN_MASA_MESAJI' && caller.admin !== true && caller.role !== 'student') {
    throw reject('Bu işlem için öğrenci oturumu gerekli.');
  }
  return type;
}

export function isCurrentReportNotification({ event, desk, at = Date.now() }) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(at)).map(part => [part.type, Number(part.value)]));
  // Kapanıştan sonra, cron gecikse bile 21:58 ihbarı için geç bildirim yollama.
  if (parts.hour * 60 + parts.minute >= 22 * 60) return false;
  if (event?.type === 'İHBAR') {
    return desk?.status === 'reported' &&
      desk.occupant === event.userId &&
      Number(desk.reportIssuedAt || 0) === Number(event.time || 0) &&
      Number(desk.reportEndTime || 0) > at;
  }
  if (event?.type === 'İHBAR_MISAFIR') {
    return desk?.guestOccupant === event.userId &&
      desk.guestReported === true &&
      Number(desk.guestReportEndTime || 0) > at;
  }
  return false;
}
