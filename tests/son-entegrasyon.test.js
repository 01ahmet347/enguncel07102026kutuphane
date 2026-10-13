import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import cronHandler from '../api/cron-expire.js';

const response = () => ({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
test('İhbar süresi sunucu endpointi yetkisiz GET isteğini reddeder',async()=>{
 const res=response();await cronHandler({method:'GET',headers:{}},res);
 assert.equal(res.statusCode,401);assert.equal(res.headers['Cache-Control'],'no-store');
});
test('İhbar süresi sunucu endpointi sadece GET kabul eder',async()=>{
 const res=response();await cronHandler({method:'POST',headers:{}},res);assert.equal(res.statusCode,405);
});
test('Masa API sunucu eylemlerini cron için aynı işlem kodundan oluşturur',()=>{
 const code=readFileSync(new URL('../api/student-desk.js',import.meta.url),'utf8');
 assert.match(code,/export async function createServerDeskActions\(/);
 assert.match(code,/createActions: createServerDeskActions/);
});
test('FCM token değişmediyse gereksiz kullanıcı yazımı yapılmaz',()=>{
 const code=readFileSync(new URL('../server/student-activity.js',import.meta.url),'utf8');
 assert.match(code,/user\.pushTokens\.every/);
 assert.match(code,/deduplicated: true/);
});
