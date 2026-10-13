import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizePushCaller, authorizePushEvent, isCurrentReportNotification
} from '../server/push-authorization.js';

const reportAt = Date.parse('2026-10-13T18:30:00Z'); // 21:30 Türkiye
const event = { type: 'İHBAR', userId: 'target', actorFirebaseUid: 'reporter',
  deskId: 12, time: reportAt, id: 'report-12' };
const currentDesk = { status: 'reported', occupant: 'target',
  reportIssuedAt: reportAt, reportEndTime: reportAt + 300000 };

const activeAdmin = { uid: 'sgm-admin', admin: true, adminSessionId: 'new' };

test('Yeni aktif yönetici push gönderebilir', async () => {
  const result = await authorizePushCaller({caller:activeAdmin, req:{}, requireActiveAdmin:async()=>activeAdmin});
  assert.deepEqual(result, activeAdmin);
});

test('Eski yönetici (Firebase UID aynı olsa bile) aktif oturum denetiminden geçemez', async () => {
  await assert.rejects(
    ()=>authorizePushCaller({caller:{uid:'sgm-admin',admin:true,adminSessionId:'old'},req:{},
      requireActiveAdmin:async()=>{throw Object.assign(new Error('Başka yönetici aktif'),{status:403});}}),
    {status:403}
  );
});

test('Yönetici doğrulama sonucu ile çağıran UID uyuşmazsa reddedilir', async () => {
  await assert.rejects(
    ()=>authorizePushCaller({caller:activeAdmin,req:{},requireActiveAdmin:async()=>({...activeAdmin,uid:'other'})}),
    {status:403}
  );
});

test('Öğrenci rolü olmayan kimlik push gönderemez', async () => {
  await assert.rejects(()=>authorizePushCaller({caller:{uid:'anonymous'},req:{}}),{status:403});
});

test('Öğrenci kendi geçerli ihbar kayıt bildirimi için yetkili', () => {
  assert.equal(authorizePushEvent({event,caller:{uid:'reporter',role:'student'},userId:'target'}),'İHBAR');
});

test('Bildirim başka alıcıya gönderilemez', () => {
  assert.throws(()=>authorizePushEvent({event,caller:{uid:'reporter',role:'student'},userId:'wrong'}),{status:403});
});

test('Başka öğrenci ihbar kaydını kullanamaz', () => {
  assert.throws(()=>authorizePushEvent({event,caller:{uid:'attacker',role:'student'},userId:'target'}),{status:403});
});

test('Öğrenci yönetici masa mesajı gönderemez', () => {
  assert.throws(()=>authorizePushEvent({event:{...event,type:'ADMIN_MASA_MESAJI'},
    caller:{uid:'reporter',role:'student'},userId:'target'}),{status:403});
});

test('Rapor 5 dakikalık aktif sürede bildirilebilir', () => {
  assert.equal(isCurrentReportNotification({event,desk:currentDesk,at:reportAt+10000}),true);
});

test('Rapor QR ile kapanmışsa gecikmiş push gönderilmez', () => {
  assert.equal(isCurrentReportNotification({event,desk:{...currentDesk,status:'occupied'},at:reportAt+10000}),false);
});

test('İhbar için tam 5 dakika sona ermişse push gönderilmez', () => {
  assert.equal(isCurrentReportNotification({event,desk:currentDesk,at:reportAt+300000}),false);
});

test('Yeni rapor eski raporun push bildirimini geçersiz kılar', () => {
  assert.equal(isCurrentReportNotification({event,desk:{...currentDesk,reportIssuedAt:reportAt+1000},at:reportAt+2000}),false);
});

test('Kapanış sonrası 21:58 raporunun gecikmiş push bildirimi gönderilmez', () => {
  const closingEvent = {...event,time:Date.parse('2026-10-13T18:58:00Z')};
  const desk={...currentDesk,reportIssuedAt:closingEvent.time,reportEndTime:closingEvent.time+300000};
  assert.equal(isCurrentReportNotification({event:closingEvent,desk,at:Date.parse('2026-10-13T19:00:00Z')}),false);
});

test('Mevcut misafir ihbar bildiriminde hedef eşleştirmesi kontrol edilir', () => {
  const guestEvent={...event,type:'İHBAR_MISAFIR'};
  const guestDesk={guestOccupant:'target',guestReported:true,guestReportEndTime:reportAt+300000};
  assert.equal(isCurrentReportNotification({event:guestEvent,desk:guestDesk,at:reportAt+15000}),true);
  assert.equal(isCurrentReportNotification({event:guestEvent,desk:{...guestDesk,guestOccupant:'else'},at:reportAt+15000}),false);
});
