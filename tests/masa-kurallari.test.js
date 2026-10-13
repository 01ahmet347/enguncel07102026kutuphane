import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Bağımlılıkları taklit ederek Firebase ağına bağlanmadan gerçek masa fonksiyonlarını sınar.
const source = await readFile(new URL('../src/cloud-transactions.js', import.meta.url), 'utf8');
const mocked = source.replace(/^import \{ releaseUserFromDesk, json \} from '\.\/sync-core\.js';/, `
const json = value => JSON.stringify(value);
const releaseUserFromDesk = (desk, userId) => ({
  ...desk, status: desk.status === 'disabled' ? 'disabled' : 'available',
  occupant: desk.occupant === userId ? null : desk.occupant,
  pendingOccupant: desk.pendingOccupant === userId ? null : desk.pendingOccupant,
  ownerDeviceId: null, sessionStartTime: null, breakEndTime: null,
  reportEndTime: null, reportIssuedAt: null, reportVerifiedAt: null,
  pendingDeskRole: null, pendingDeskDeadline: null, pendingDeviceId: null
});`);
const { createCloudActions } = await import(`data:text/javascript;base64,${Buffer.from(mocked).toString('base64')}`);

function setup(start) {
  let clock = start;
  const records = new Map();
  const ref = (collection, id) => ({ key: `${collection}/${id}`, id: String(id) });
  const set = (collection, id, data) => records.set(ref(collection, id).key, structuredClone(data));
  const get = (collection, id) => structuredClone(records.get(ref(collection, id).key));
  const snapshot = r => ({ ...r, ref:r, exists: records.has(r.key), data: () => structuredClone(records.get(r.key)) });
  const db = {};
  const runTransaction = async (_db, handler) => {
    const writes = [];
    const tx = {
      get: async r => snapshot(r),
      set: (r, data, options) => writes.push({kind:'set', r, data:structuredClone(data), merge:options?.merge}),
      create: (r, data) => { if (records.has(r.key)) throw Error('Duplicate ID'); writes.push({kind:'set',r,data,merge:false}); },
      delete: r => writes.push({kind:'delete',r})
    };
    const result = await handler(tx);
    for(const write of writes) {
      if (write.kind === 'delete') records.delete(write.r.key);
      else records.set(write.r.key, write.merge ? {...(records.get(write.r.key)||{}), ...write.data} : structuredClone(write.data));
    }
    return result;
  };
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Istanbul', year:'numeric',month:'2-digit',day:'2-digit' }).format(clock);
  const isRestricted = (u, at) => u.blocked || u.pendingApproval || Number(u.restrictedUntil || 0) > at;
  const lostDeskToday = () => false;
  const applyViolationPolicy = (u, deskId, at) => {
    const history = [...(u.violationHistory || []), at];
    const recent = history.filter(t=>t>at-7*864e5 && t<=at);
    return { violationHistory:history, restrictedUntil:recent.length>=2?at+7*864e5:(u.restrictedUntil||0),lostDeskDate:today(),lostDeskIds:[deskId] };
  };
  const actions = createCloudActions({ db, runTransaction, ref, settings:()=>({shortBreakCount:5,longBreakCount:2,shortBreakDuration:15,longBreakDuration:60,breakCooldown:30,reportsEnabled:true,openTime:'07:00'}), dayKey:today, isRestricted,lostDeskToday,applyViolationPolicy,now:()=>clock });
  const addUser = (id, desk=null) => set('sgmUsers',id,{id,name:id,specialCode:'12345678',pin:'12345678',activeDeskId:desk,deviceId:`DEV-${id}`,breaks:{short:4,long:1},lastActiveTime:clock-2*3600e3,pendingApproval:false,restrictedUntil:0,strikes:0});
  const addDesk = (id, owner=null, status='available') => set('sgmDesks',id,{id,qrCode:`SGM-${id}-SABIT`,status,occupant:owner,sessionStartTime:owner?clock-3600e3:null,ownerDeviceId:owner?`DEV-${owner}`:null});
  return { actions, addUser, addDesk, set, get, clock:()=>clock, advance:ms=>clock+=ms };
}

// 21:00 Türkiye = 18:00 UTC; çalışma saati içi.
test('Mola süresinin dolması ihlal veya masa kaybı oluşturmaz', async () => {
  const c=setup(Date.parse('2026-10-13T18:00:00Z'));c.addUser('u',1);c.addDesk(1,'u','occupied');
  await c.actions.startBreak({userId:'u',deskId:1,type:'short'});
  c.advance(16*60000);
  const exp=await c.actions.expireDesk(1);
  assert.equal(exp,null);
  assert.equal(c.get('sgmDesks',1).status,'on_break');
  assert.equal(c.get('sgmUsers','u').strikes,0);
});

test('Süresi dolmuş molada geçerli ihbar, 5 dk içinde QR ile kapanır',async()=>{
  const c=setup(Date.parse('2026-10-13T18:00:00Z'));c.addUser('u',1);c.addUser('reporter');c.addDesk(1,'u','occupied');
  await c.actions.startBreak({userId:'u',deskId:1,type:'short'});c.advance(16*60000);
  const result=await c.actions.reportDesk({userId:'reporter',deskId:1,targetUserId:'u'});
  assert.equal(result.waitMinutes,5);
  const done=await c.actions.verifyPresence({userId:'u',deskId:1,qrCode:'SGM-1-SABIT'});
  assert.equal(done.desk.status,'occupied');
  c.advance(6*60000);
  assert.equal(await c.actions.expireDesk(1),null);
  assert.equal(c.get('sgmUsers','u').strikes,0);
});

test('Geçerli ihbarda 5 dk geçince yalnızca bir ihlal yazılır',async()=>{
  const c=setup(Date.parse('2026-10-13T18:00:00Z'));c.addUser('u',1);c.addUser('reporter');c.addDesk(1,'u','occupied');
  await c.actions.reportDesk({userId:'reporter',deskId:1,targetUserId:'u'});c.advance(5*60000);
  const first=await c.actions.expireDesk(1);
  assert.equal(first.mode,'report_timeout');
  assert.equal(c.get('sgmUsers','u').strikes,1);
  assert.equal(await c.actions.expireDesk(1),null);
  assert.equal(c.get('sgmUsers','u').strikes,1);
});

test('Yönetici cezalı kullanıcıya masa atar ve istisna korunur',async()=>{
  const c=setup(Date.parse('2026-10-13T18:00:00Z'));c.addUser('u');c.addDesk(1);
  c.set('sgmUsers','u',{...c.get('sgmUsers','u'),restrictedUntil:c.clock()+7*864e5,violationHistory:[c.clock()-1000]});
  await c.actions.assign({userId:'u',deskId:1});
  assert.equal(c.get('sgmUsers','u').restrictedUntil,c.clock()+7*864e5);
  assert.equal(c.get('sgmUsers','u').activeDeskId,1);
  c.advance(31*60000);
  await c.actions.startBreak({userId:'u',deskId:1,type:'short'});
  assert.equal(c.get('sgmDesks',1).status,'on_break');
});

test('Masa bırakma sonrası yalnızca bırakılan masa 30 dakika bekletilir',async()=>{
  const c=setup(Date.parse('2026-10-13T18:00:00Z'));c.addUser('u',1);c.addDesk(1,'u','occupied');c.addDesk(2);
  await c.actions.leaveDesk({userId:'u',deskId:1});
  await assert.rejects(()=>c.actions.reserve({userId:'u',deskId:1,deviceId:'DEV-u'}),/30 dakikalık/);
  const reserved=await c.actions.reserve({userId:'u',deskId:2,deviceId:'DEV-u'});
  assert.equal(reserved.desk.pendingOccupant,'u');
});

test('21:58 ihbarı 22:00 sonrasında ceza doğurmaz',async()=>{
  const c=setup(Date.parse('2026-10-13T18:58:00Z'));c.addUser('u',1);c.addUser('reporter');c.addDesk(1,'u','occupied');
  await c.actions.reportDesk({userId:'reporter',deskId:1,targetUserId:'u'});
  c.advance(6*60000);
  const result=await c.actions.expireDesk(1);
  assert.equal(result.skippedClosing,true);
  assert.equal(c.get('sgmUsers','u').strikes,0);
});

test('Yönetici onaylı boşaltma cezasızdır, QR kodu aynen kalır',async()=>{
  const c=setup(Date.parse('2026-10-13T18:00:00Z'));c.addUser('u',1);c.addDesk(1,'u','occupied');
  const result=await c.actions.adminRelease({deskId:1});
  assert.equal(result.desk.qrCode,'SGM-1-SABIT');
  assert.equal(c.get('sgmDesks',1).status,'available');
  assert.equal(c.get('sgmUsers','u').activeDeskId,null);
  assert.equal(c.get('sgmUsers','u').strikes,0);
});
