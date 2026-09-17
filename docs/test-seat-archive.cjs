// No dependencies: exercise actual local storage operations and admin history merging.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const data = new Map();
let now = Date.parse('2026-09-17T00:00:00Z');
class Clock extends Date { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } }
const context = { console, Date:Clock, Intl, document:{addEventListener(){}},
 localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},
};
context.window = context; vm.createContext(context);
function run(file, extra='') { vm.runInContext(fs.readFileSync(path.join(root,file),'utf8').replace(/\}\)\(\);\s*$/,extra+'\n})();'),context); }
run('js/config.js'); run('js/core.js'); run('js/store.js');
run('js/admin.js','window.archiveTest={historyRows,historyTime};');
const store = context.STORE, day = '2026-09-17';
const person={name:'테스트',dept:'철학과',sid:'00123456',tel:'01012345678'};
(async()=>{
 await store.reserveSeat(day,7,person); now+=1000;
 await assert.rejects(store.reserveSeat(day,7,person),e=>e.code==='taken');
 await assert.rejects(store.releaseSeat(day,7,{...person,sid:'99999999'},'return'),e=>e.code==='mismatch');
 await store.releaseSeat(day,7,person,'move'); now+=1000;
 await store.reserveSeat(day,8,{...person,fromSeat:7}); now+=1000;
 await store.releaseSeat(day,8,person,'return'); now+=1000;
 await store.reserveSeat(day,7,person); now+=1000;
 await store.cancelSeat(day,7); now+=1000;
 await store.reserveSeat(day,7,person); now+=1000;
 await store.releaseSeat(day,7,person,'cancel');
 let history=(await store.listSeatEvents(day)).events;
 assert.deepEqual(Array.from(history,r=>r.kind),['reserve','move-out','move-in','return','reserve','admin-cancel','reserve','cancel']);
 assert.equal(history[2].fromSeat,7); assert.equal(new Set(history.map(r=>r.id)).size,history.length);
 assert.equal(Object.keys(await store.getSeats(day)).length,0);
 await store.reserveSeat('2026-09-18',7,person);
 assert.equal((await store.listSeatEvents(day)).events.length,8);
 assert.equal((await store.listSeatEvents('2026-09-18')).events.length,1);
 const remaining=await store.listSeatLogs(day), releases=await store.listSeatReleases(day);
 const rows=context.archiveTest.historyRows(history,remaining,releases);
 assert.equal(rows.length,8,'existing release mirror must not duplicate an event');
 const legacy=context.archiveTest.historyRows([], [{seat:1,name:'과거',createdAt:'2026-09-10T01:00:00Z'}], []);
 assert.equal(legacy[0].source,'기존 잔존 기록');
 assert.equal(context.archiveTest.historyTime('2026-09-17T15:00:00Z'),'2026-09-18 00:00:00');
 console.log('PASS: repeated bookings, move-out/in, return/cancel/admin cancellation, identity rejection, day isolation, legacy deduplication and KST date.');
})().catch(e=>{console.error(e);process.exitCode=1;});
