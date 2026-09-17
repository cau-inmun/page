// Run only against a local emulator: FIRESTORE_EMULATOR_HOST=127.0.0.1:8787 node docs/test-seat-rules.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {initializeTestEnvironment,assertFails} = require('@firebase/rules-unit-testing');
const firebase = require('firebase/compat/app'); require('firebase/compat/firestore');
if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Local Firestore emulator required');
const root=path.resolve(__dirname,'..');
(async()=>{
 const [host, port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');
 let env=await initializeTestEnvironment({projectId:'demo-cau-archive',firestore:{host,port:Number(port),rules:fs.readFileSync(path.join(root,'firestore.rules'),'utf8')}});
 try {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx=>ctx.firestore().collection('admins').doc('council-admin').set({}));
  const publicDb=env.unauthenticatedContext().firestore(), adminDb=env.authenticatedContext('council-admin').firestore();
  const c={console,Date,Intl,firebase,localStorage:{getItem:()=>null,setItem(){}},document:{addEventListener(){}}};c.window=c;
  for(const f of ['js/config.js','js/core.js','js/store.js']) {
   let text=fs.readFileSync(path.join(root,f),'utf8');
   if(f==='js/store.js')text=text.replace(/\}\)\(\);\s*$/, 'window.bindTestDb=(value)=>{mode="firebase";db=value;};\n})();');
   new Function("window", "localStorage", "firebase", "document", text)(c,c.localStorage,firebase,c.document);
  }
  const day='2026-09-17', person={name:'테스트',dept:'철학과',sid:'00123456',tel:'01012345678'};
  c.bindTestDb(publicDb);
  await c.STORE.reserveSeat(day,7,person);
  await assert.rejects(c.STORE.reserveSeat(day,7,person),e=>e.code==='taken');
  await assert.rejects(c.STORE.releaseSeat(day,7,{...person,sid:'99999999'},'return'),e=>e.code==='mismatch');
  await c.STORE.releaseSeat(day,7,person,'move');
  await c.STORE.reserveSeat(day,8,{...person,fromSeat:7});
  await c.STORE.releaseSeat(day,8,person,'return');
  await c.STORE.reserveSeat(day,7,person);
  c.bindTestDb(adminDb); await c.STORE.cancelSeat(day,7);
  let history=await c.STORE.listSeatEvents(day);
  assert.equal(history.enabled,true); assert.equal(history.events.length,6,'Every successful operation must have an archive event (no silent legacy fallback)');
  assert.deepEqual(history.events.map(r=>r.kind).sort(),['admin-cancel','move-in','move-out','reserve','reserve','return'].sort());
  const ref=publicDb.collection('seatdays').doc(day).collection('events');
  await assertFails(ref.get());
  await assertFails(ref.doc(history.events[0].id).get());
  await assertFails(ref.doc('forged').set({...person,seat:1,fromSeat:0,kind:'reserve',createdAt:firebase.firestore.FieldValue.serverTimestamp()}));
  const privateRef=adminDb.collection('seatdays').doc(day).collection('events').doc(history.events[0].id);
  await assertFails(privateRef.update({name:'changed'})); await assertFails(privateRef.delete());
  c.bindTestDb(publicDb); await c.STORE.reserveSeat('2026-09-18',7,person);
  await c.STORE.releaseSeat('2026-09-18',7,person,'cancel');
  c.bindTestDb(adminDb);
  assert.equal((await c.STORE.listSeatEvents(day)).events.length,6);
  assert.equal((await c.STORE.listSeatEvents('2026-09-18')).events.length,2);
  assert.equal(Object.keys(await c.STORE.getSeats(day)).length,0);
  console.log('PASS: actual Firestore rules + store operations: atomic history, moves, cancellation, collisions, wrong identity, private immutable events and day isolation.');
  if (process.env.SEAT_LEGACY_RULES) {
   await env.cleanup();
   env=await initializeTestEnvironment({projectId:'demo-cau-archive',firestore:{host,port:Number(port),rules:fs.readFileSync(process.env.SEAT_LEGACY_RULES,'utf8')}});
   await env.clearFirestore();
   await env.withSecurityRulesDisabled(async ctx=>ctx.firestore().collection('admins').doc('council-admin').set({}));
   c.bindTestDb(env.unauthenticatedContext().firestore());
   await c.STORE.reserveSeat(day,7,person);
   await c.STORE.releaseSeat(day,7,person,'return');
   c.bindTestDb(env.authenticatedContext('council-admin').firestore());
   assert.equal((await c.STORE.listSeatEvents(day)).enabled,false);
   assert.equal((await c.STORE.listSeatReleases(day)).length,1);
   assert.equal(Object.keys(await c.STORE.getSeats(day)).length,0);
   console.log('PASS: old deployed rules still allow booking and return; admin detects missing archive rules.');
  }

 } finally { await env.cleanup(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
