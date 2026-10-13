import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src=await readFile(new URL('../server/daily-close.js',import.meta.url),'utf8');
const { closeAllDesksAt22, deskClearPatch,trDayKey,trMinuteOfDay }=await import('data:text/javascript;base64,'+Buffer.from(src.replace("import { dataCollection } from './firebase-admin.js';",'const dataCollection = () => { throw Error("Mock collection required"); };')).toString('base64'));
const base=Date.parse('2026-10-13T19:01:00Z');
function storage() {
  const items=new Map();
  const db={runTransaction:async fn=>{
    const edits=[];
    const tx={get:async ref=>({ref,id:ref.id,exists:items.has(ref.key),data:()=>structuredClone(items.get(ref.key))}),set:(ref,data,opt)=>edits.push(['set',ref,data,opt]),delete:ref=>edits.push(['delete',ref])};
    const result=await fn(tx);
    for(const [kind,ref,data,opt] of edits) {if(kind==='delete')items.delete(ref.key); else items.set(ref.key,opt?.merge?{...items.get(ref.key),...data}:data);}
    return result;
  }};
  const collection=name=>({firestore:db,doc:id=>({key:`${name}/${id}`,id:String(id)})});
  const put=(bucket,id,data)=>items.set(`${bucket}/${id}`,structuredClone(data));
  const get=(bucket,id)=>structuredClone(items.get(`${bucket}/${id}`));
  return {collection,put,get};
}

test('Kapanış 22:00 öncesinde veri değiştirmez',async()=>{
  const db=storage();db.put('sgmDesks','1',{id:1,status:'occupied',occupant:'a',qrCode:'SABIT'});
  assert.equal((await closeAllDesksAt22({at:base-2*60000,collection:db.collection})).skipped,'before_22');
  assert.equal(db.get('sgmDesks','1').occupant,'a');
});

test('Kapanış 35 masa üzerinde QR/PIN/ihlal geçmişi korur, ikinci kez çalışmaz',async()=>{
  const db=storage();
  for(let id=1;id<=35;id++)db.put('sgmDesks',String(id),{id,status:id===35?'disabled':id===1?'on_break':'available',qrCode:`SABIT-${id}`,occupant:id===1?'a':null,sessionStartTime:base-3600000});
  db.put('sgmUsers','a',{id:'a',activeDeskId:1,pin:'87654321',specialCode:'12345678',violationHistory:[base-2000],restrictedUntil:base+200000,adminDeskGrant:{deskId:1}});
  const result=await closeAllDesksAt22({at:base,collection:db.collection});
  assert.equal(result.released,1);
  assert.equal(db.get('sgmDesks','1').status,'available');
  assert.equal(db.get('sgmDesks','1').qrCode,'SABIT-1');
  assert.equal(db.get('sgmDesks','35').status,'disabled');
  assert.equal(db.get('sgmUsers','a').activeDeskId,null);
  assert.equal(db.get('sgmUsers','a').pin,'87654321');
  assert.equal(db.get('sgmUsers','a').restrictedUntil,base+200000);
  assert.deepEqual(db.get('sgmUsers','a').violationHistory,[base-2000]);
  assert.equal((await closeAllDesksAt22({at:base+60000,collection:db.collection})).alreadyCompleted,true);
});

test('Türkiye saati dönüşümü 22:00 = 19:00 UTC',()=>{
 assert.equal(trMinuteOfDay(Date.parse('2026-10-13T19:00:00Z')),1320);
 assert.equal(trDayKey(base),'2026-10-13');
});
