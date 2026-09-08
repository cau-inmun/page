/* ============================================================
   store.js — 데이터 계층 (Firebase Firestore ↔ 로컬 저장소)
   ------------------------------------------------------------
   Firebase 설정이 채워져 있으면 Firestore 를, 아니면 브라우저
   localStorage 를 씁니다. 화면 코드는 어느 쪽인지 몰라도 됩니다.

   다루는 데이터
     config/links      링크 모음      (공개 읽기 / 관리자 쓰기)
     forms/{id}        폼 정의        (공개 읽기 / 관리자 쓰기)
     submissions/{id}  폼 제출 내용    (제출만 공개 / 읽기는 관리자만)
     notices/{id}      공지           (공개 읽기 / 관리자 쓰기)
   ============================================================ */
(function () {
  'use strict';

  const KEY = {
    links: 'cau-inmun:links',
    site: 'cau-inmun:site',
    forms: 'cau-inmun:forms',
    submissions: 'cau-inmun:submissions',
    notices: 'cau-inmun:notices',
    seats: 'cau-inmun:seats'
  };

  let mode = 'local';          // 'local' | 'firebase'
  let db = null, auth = null;
  let currentUser = null;
  let initPromise = null;
  const userWatchers = [];

  /* ---------- 로컬 저장소 도우미 ---------- */
  function lsGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* config.js 의 기본값을 그대로 돌려주면, 화면에서 그 배열을 고칠 때
     원본까지 같이 바뀐다. 저장 함수가 기본값을 다시 읽어 항목을 덧붙이는
     경로에서는 같은 항목이 두 번 들어가기도 한다.
     기본값을 내보낼 때는 항상 복사본을 준다. */
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

  /* Firestore Timestamp ↔ ISO 문자열 (앱 내부는 전부 ISO 로 다룬다) */
  function tsToIso(v) {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (v.toDate) { try { return v.toDate().toISOString(); } catch (e) { return ''; } }
    return '';
  }
  function isoToTs(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d) ? null : firebase.firestore.Timestamp.fromDate(d);
  }
  const SCHEDULE_KEYS = ['publishAt', 'expireAt', 'openAt', 'closeAt'];

  function decodeDoc(data) {
    const out = Object.assign({}, data);
    SCHEDULE_KEYS.forEach((k) => { if (k in out) out[k] = tsToIso(out[k]); });
    if ('createdAt' in out) out.createdAt = tsToIso(out.createdAt);
    return out;
  }
  function encodeDoc(obj) {
    const out = Object.assign({}, obj);
    SCHEDULE_KEYS.forEach((k) => {
      if (!(k in out)) return;
      const t = isoToTs(out[k]);
      if (t) out[k] = t; else delete out[k];
    });
    return out;
  }

  /* ---------- Firebase 준비 ---------- */
  function configured() {
    const c = window.FIREBASE_CONFIG;
    return !!(c && c.apiKey && c.projectId &&
              !/^(여기에|YOUR_|<)/.test(String(c.apiKey)));
  }

  /* SDK 를 못 받는 상황에서 페이지가 멈추지 않도록 하는 제한 시간.
     요청이 '실패'하면 바로 알 수 있지만, 교내 방화벽이나 캡티브 포털처럼
     응답도 실패도 없이 매달리는 경우가 있다. 그때 이 값이 없으면
     공지 자리에 로딩 표시가 영원히 남는다. */
  const SDK_TIMEOUT_MS = 8000;

  function loadScript(src, timeoutMs) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      let done = false;
      const finish = (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        err ? reject(err) : resolve();
      };
      const timer = setTimeout(
        () => finish(new Error('시간 초과: ' + src)),
        timeoutMs || SDK_TIMEOUT_MS);
      s.src = src;
      s.onload = () => finish(null);
      s.onerror = () => finish(new Error('스크립트를 불러오지 못했습니다: ' + src));
      document.head.appendChild(s);
    });
  }

  /* 전체 초기화에도 상한을 둔다. 개별 스크립트가 통과해도
     initializeApp 이나 첫 연결에서 매달릴 수 있다. */
  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('시간 초과: ' + label)), ms))
    ]);
  }

  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      if (!configured()) { mode = 'local'; await loadSite(); return mode; }
      const v = window.FIREBASE_SDK_VERSION || '10.14.1';
      const base = 'https://www.gstatic.com/firebasejs/' + v + '/';
      try {
        await withTimeout((async () => {
          await loadScript(base + 'firebase-app-compat.js');
          await Promise.all([
            loadScript(base + 'firebase-auth-compat.js'),
            loadScript(base + 'firebase-firestore-compat.js')
          ]);
          firebase.initializeApp(window.FIREBASE_CONFIG);
          db = firebase.firestore();
          auth = firebase.auth();
          auth.onAuthStateChanged((u) => {
            currentUser = u;
            userWatchers.forEach((fn) => { try { fn(u); } catch (e) {} });
          });
        })(), SDK_TIMEOUT_MS + 2000, 'Firebase 초기화');
        mode = 'firebase';
      } catch (err) {
        console.warn(
          '[store] Firebase 에 연결하지 못해 저장소 파일로 대체합니다.\n' +
          '공지는 data/notices.json, 링크는 js/config.js 의 값이 표시되며 폼 제출은 되지 않습니다.\n' +
          '원인을 확인하려면 setup.html 을 여세요.', err);
        db = null; auth = null;
        mode = 'local';
      }
      /* 화면이 그려지기 전에 사이트 정보를 반영해 둔다 */
      await loadSite();
      return mode;
    })();
    return initPromise;
  }

  /* ---------- 인증 ---------- */
  const auth$ = {
    get user() { return currentUser; },
    onChange(fn) {
      userWatchers.push(fn);
      fn(currentUser);
      return () => {
        const i = userWatchers.indexOf(fn);
        if (i > -1) userWatchers.splice(i, 1);
      };
    },
    async signIn(email, password) {
      if (mode !== 'firebase') throw new Error('로컬 모드에서는 로그인이 필요 없습니다.');
      const cred = await auth.signInWithEmailAndPassword(email, password);
      return cred.user;
    },
    async signOut() {
      if (mode === 'firebase' && auth) await auth.signOut();
    }
  };

  /* ---------- 사이트 정보 ----------
     학생회 이름 · 소개 · 연락처 · 상단 버튼처럼 '코드가 아니라 내용'인 것들.
     저장된 값이 있으면 js/config.js 의 기본값 위에 덮어쓴다.

     주의: window.SITE 를 새 객체로 바꾸지 않고 '내용만' 덮어쓴다.
     각 화면 스크립트가 const S = window.SITE 로 참조를 붙잡고 있어서,
     객체를 교체하면 그 참조들이 옛 값을 계속 보게 된다. */
  const SITE_KEYS = [
    'brand', 'college', 'councilTerm', 'councilName', 'tagline', 'description',
    'quickLinks', 'about', 'contact', 'categories', 'departments', 'consentText'
  ];

  async function loadSite() {
    let stored = null;
    try {
      if (mode === 'firebase') {
        const snap = await db.collection('config').doc('site').get();
        if (snap.exists) stored = snap.data();
      } else {
        stored = lsGet(KEY.site, null);
      }
    } catch (e) {
      console.warn('[store] 사이트 정보를 불러오지 못해 기본값을 씁니다.', e);
    }
    if (stored && window.SITE) {
      SITE_KEYS.forEach((k) => {
        if (stored[k] !== undefined && stored[k] !== null) window.SITE[k] = stored[k];
      });
    }
    return window.SITE;
  }

  function getSite() { return window.SITE; }

  async function saveSite(patch) {
    const body = {};
    SITE_KEYS.forEach((k) => { if (patch[k] !== undefined) body[k] = patch[k]; });
    if (mode === 'firebase') {
      await db.collection('config').doc('site').set(
        Object.assign({}, body, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
    } else {
      lsSet(KEY.site, body);
    }
    SITE_KEYS.forEach((k) => { if (body[k] !== undefined) window.SITE[k] = body[k]; });
    return true;
  }

  /* ---------- 링크 ---------- */
  async function getLinks() {
    if (mode === 'firebase') {
      const snap = await db.collection('config').doc('links').get();
      const groups = snap.exists ? (snap.data().groups || []) : [];
      if (groups.length) return groups;
    } else {
      const groups = lsGet(KEY.links, null);
      if (groups && groups.length) return clone(groups);
    }
    /* 아직 등록된 게 없으면 js/config.js 의 기본값을 쓴다 */
    return clone((window.SITE && window.SITE.linkGroups) || []);
  }

  async function saveLinks(groups) {
    if (mode === 'firebase') {
      await db.collection('config').doc('links').set({
        groups,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return true;
    }
    return lsSet(KEY.links, groups);
  }

  /* ---------- 폼 정의 ---------- */
  /* config.js 의 기본 폼.
     서버에 아직 등록되지 않았다는 표시(_seed)를 달아서 돌려준다.
     보안 규칙은 'Firestore 에 실제로 존재하는 폼' 에만 제출을 허용하므로,
     이 표시가 붙은 폼은 화면에서도 접수를 막아야 한다.
     그러지 않으면 학우가 폼을 다 채운 뒤에야 거부당한다. */
  function defaultForms() {
    return clone((window.SITE && window.SITE.defaultForms) || [])
      .map((f) => Object.assign({}, f, { _seed: true }));
  }

  async function getForms() {
    if (mode === 'firebase') {
      const snap = await db.collection('forms').get();
      const list = snap.docs.map((d) => Object.assign({ id: d.id }, decodeDoc(d.data())));
      if (list.length) return list.sort((a, b) => (a.order || 0) - (b.order || 0));
    } else {
      const list = lsGet(KEY.forms, null);
      if (list && list.length) return list;
    }
    return defaultForms();
  }

  async function getForm(id) {
    const list = await getForms();
    return list.find((f) => f.id === id) || null;
  }

  async function saveForm(form) {
    if (mode === 'firebase') {
      const { id } = form;
      const body = encodeDoc(form);
      delete body.id;
      delete body._seed;
      await db.collection('forms').doc(id).set(body, { merge: false });
      return true;
    }
    const clean = Object.assign({}, form);
    delete clean._seed;
    const list = (await getForms()).map((f) => { const c = Object.assign({}, f); delete c._seed; return c; });
    const i = list.findIndex((f) => f.id === clean.id);
    if (i > -1) list[i] = clean; else list.push(clean);
    return lsSet(KEY.forms, list);
  }

  async function deleteForm(id) {
    if (mode === 'firebase') { await db.collection('forms').doc(id).delete(); return true; }
    const list = (await getForms()).filter((f) => f.id !== id);
    return lsSet(KEY.forms, list);
  }

  /* ---------- 폼 제출 ---------- */
  /* 구글 시트로도 같은 내용을 보낸다.
     실패해도 제출 자체는 성공으로 둔다. 시트는 편의 기능이고,
     정본은 Firestore 이기 때문이다. 학우가 시트 문제로 두 번 쓰게 할 이유가 없다.
     no-cors 로 보내므로 응답은 확인할 수 없다 (Apps Script 의 표준 방식). */
  async function mirrorToSheet(formId, data, formTitle, labels) {
    const url = (window.SITE && window.SITE.sheetWebhookUrl || '').trim();
    if (!url) return;
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          formId: formId,
          formTitle: formTitle || formId,
          submittedAt: new Date().toISOString(),
          data: data,
          labels: labels || {}
        })
      });
    } catch (e) {
      console.warn('[시트] 구글 시트로 보내지 못했습니다. 제출 자체는 정상 접수됐습니다.', e);
    }
  }

  /* 시트 연결을 실제로 확인한다.
     제출은 no-cors 로 보내서 성공 여부를 알 수 없다. 그래서 확인만큼은
     Apps Script 의 doGet 을 <script> 로 불러오는 방식(JSONP)을 쓴다.
     <script> 는 CORS 를 타지 않아 응답을 그대로 읽을 수 있다.
     결과 reason:
       no-url      주소가 비어 있음
       ok          시트에 확인용 줄까지 남김
       script-error 스크립트는 돌았지만 시트를 못 씀 (error 에 이유)
       unreachable  주소에 닿지 못함
       timeout      답이 없거나 우리가 기대한 형식이 아님 */
  function testSheet() {
    return new Promise((resolve) => {
      const url = (window.SITE && window.SITE.sheetWebhookUrl || '').trim();
      if (!url) { resolve({ ok: false, reason: 'no-url' }); return; }

      const cb = '__sheetCheck' + Date.now().toString(36);
      const tag = document.createElement('script');
      let settled = false;

      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        if (tag.parentNode) tag.parentNode.removeChild(tag);
        resolve(result);
      };

      window[cb] = (res) => {
        const ok = !!(res && res.ok);
        finish({
          ok: ok,
          reason: ok ? 'ok' : 'script-error',
          name: res && res.spreadsheet,
          wrote: res && res.wrote,
          error: res && res.error
        });
      };

      const timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), 12000);
      tag.onerror = () => finish({ ok: false, reason: 'unreachable' });
      tag.src = url + (url.indexOf('?') > -1 ? '&' : '?') +
                'callback=' + cb + '&test=1&t=' + Date.now();
      document.head.appendChild(tag);
    });
  }

  async function submit(formId, data, formTitle, labels) {
    const record = {
      formId: String(formId),
      data: data,
      createdAt: new Date().toISOString()
    };
    if (mode === 'firebase') {
      const ref = await db.collection('submissions').add({
        formId: record.formId,
        data: record.data,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      mirrorToSheet(formId, data, formTitle, labels);
      return ref.id;
    }
    const list = lsGet(KEY.submissions, []);
    record.id = uid();
    list.unshift(record);
    lsSet(KEY.submissions, list);
    return record.id;
  }

  /* 정렬은 서버가 아니라 여기서 한다.
     where('formId') + orderBy('createdAt') 조합은 Firestore 에서 복합 색인을
     따로 만들어야 하는데, 학생회 규모(폼당 수백 건)에서는 굳이 필요 없고
     색인 생성이 설치 단계를 하나 더 늘린다. */
  async function listSubmissions(formId) {
    let list;
    if (mode === 'firebase') {
      let q = db.collection('submissions');
      if (formId) q = q.where('formId', '==', formId);
      const snap = await q.limit(1000).get();
      list = snap.docs.map((d) => {
        const v = d.data();
        return { id: d.id, formId: v.formId, data: v.data || {},
                 createdAt: tsToIso(v.createdAt) };
      });
    } else {
      list = lsGet(KEY.submissions, []);
      if (formId) list = list.filter((s) => s.formId === formId);
    }
    return list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async function deleteSubmission(id) {
    if (mode === 'firebase') { await db.collection('submissions').doc(id).delete(); return true; }
    return lsSet(KEY.submissions, lsGet(KEY.submissions, []).filter((s) => s.id !== id));
  }

  /* ---------- 열람실 좌석 ----------
     좌석표는 누구나 볼 수 있어야 하지만, 거기 실명과 학번이 그대로 실리면
     안 된다. 그래서 공개용(seats)에는 가린 이름과 학번 앞 5자리만 넣고,
     실명 · 학과 · 전체 학번은 관리자만 읽는 logs 에 따로 둔다.
     하루가 지나면 날짜 칸이 달라지므로 좌석표는 저절로 비워진다. */

  function seatPath(day) { return db.collection('seatdays').doc(day); }

  /* { '7': { seat, nameMasked, sidHead, createdAt }, ... } 꼴로 돌려준다 */
  async function getSeats(day) {
    if (mode === 'firebase') {
      const snap = await seatPath(day).collection('seats').get();
      const out = {};
      snap.docs.forEach((d) => {
        const v = decodeDoc(d.data());
        out[d.id] = { seat: v.seat, nameMasked: v.nameMasked || '',
                      sidHead: v.sidHead || '', createdAt: tsToIso(d.data().createdAt) };
      });
      return out;
    }
    return (lsGet(KEY.seats, {}) || {})[day] || {};
  }

  /* 예약. 이미 잡힌 자리면 'taken' 을 던진다.
     보안 규칙이 덮어쓰기(update)를 막아두어, 같은 순간에 두 사람이 같은
     자리를 눌러도 뒤에 도착한 쪽만 거부된다 (화면 검사만으로는 못 막는다). */
  async function reserveSeat(day, seat, person) {
    const key = String(seat);
    const pub = {
      seat: Number(seat),
      nameMasked: window.CORE.maskName(person.name),
      sidHead: window.CORE.maskSid(person.sid)
    };
    const full = {
      seat: Number(seat),
      name: String(person.name || '').trim(),
      dept: String(person.dept || '').trim(),
      sid: String(person.sid || '').replace(/\D/g, '')
    };

    if (mode === 'firebase') {
      try {
        await seatPath(day).collection('seats').doc(key).set(
          Object.assign({}, pub, { createdAt: firebase.firestore.FieldValue.serverTimestamp() }));
      } catch (err) {
        if (err && err.code === 'permission-denied') { const e = new Error('taken'); e.code = 'taken'; throw e; }
        throw err;
      }
      /* 좌석을 먼저 잡고 기록을 남긴다. 순서가 반대면 자리를 못 잡았는데
         기록만 남는다. 기록 쪽이 실패해도 예약 자체는 유효하다. */
      try {
        await seatPath(day).collection('logs').doc(key).set(
          Object.assign({}, full, { createdAt: firebase.firestore.FieldValue.serverTimestamp() }));
      } catch (e) {
        console.warn('[열람실] 좌석은 잡혔지만 명단 기록에 실패했습니다.', e);
      }
      return true;
    }

    const all = lsGet(KEY.seats, {}) || {};
    const dayMap = all[day] || {};
    if (dayMap[key]) { const e = new Error('taken'); e.code = 'taken'; throw e; }
    dayMap[key] = Object.assign({}, pub, full, { createdAt: new Date().toISOString() });
    all[day] = dayMap;
    lsSet(KEY.seats, all);
    return true;
  }

  /* 학우가 스스로 자리를 비운다 (kind: 'return' 반납 / 'cancel' 취소).
     로그인이 없으므로 예약할 때 적은 이름 · 학과 · 학번이 그대로여야 통과한다.
     대조는 화면이 아니라 보안 규칙이 서버에서 한다 — 화면 검사만으로는
     아무나 남의 자리를 비울 수 있기 때문이다.
     맞지 않으면 code 가 'mismatch' 인 오류를 던진다. */
  async function releaseSeat(day, seat, person, kind) {
    const key = String(seat);
    const proof = {
      seat: Number(seat),
      name: String(person.name || '').trim(),
      dept: String(person.dept || '').trim(),
      sid: String(person.sid || '').replace(/\D/g, ''),
      kind: kind === 'cancel' ? 'cancel' : 'return'
    };

    if (mode === 'firebase') {
      try {
        await seatPath(day).collection('releases').doc(key).set(
          Object.assign({}, proof, { createdAt: firebase.firestore.FieldValue.serverTimestamp() }));
      } catch (err) {
        if (err && err.code === 'permission-denied') {
          const e = new Error('mismatch'); e.code = 'mismatch'; throw e;
        }
        throw err;
      }
      /* 기록이 남았으니 이제 좌석과 명단을 지운다.
         명단까지 지워야 그 자리를 다른 사람이 다시 예약할 수 있다. */
      await seatPath(day).collection('seats').doc(key).delete();
      try { await seatPath(day).collection('logs').doc(key).delete(); }
      catch (e) { console.warn('[열람실] 명단에서 지우지 못했습니다.', e); }
      return true;
    }

    const all = lsGet(KEY.seats, {}) || {};
    const dayMap = all[day] || {};
    const cur = dayMap[key];
    if (!cur) { const e = new Error('mismatch'); e.code = 'mismatch'; throw e; }
    if (cur.name !== proof.name || cur.dept !== proof.dept || cur.sid !== proof.sid) {
      const e = new Error('mismatch'); e.code = 'mismatch'; throw e;
    }
    const rel = all['releases:' + day] || {};
    rel[key] = Object.assign({}, proof, { createdAt: new Date().toISOString() });
    all['releases:' + day] = rel;
    delete dayMap[key];
    all[day] = dayMap;
    lsSet(KEY.seats, all);
    return true;
  }

  /* 관리자용 — 오늘 비워진 자리 (누가 언제 반납 · 취소했는지) */
  async function listSeatReleases(day) {
    let list;
    if (mode === 'firebase') {
      const snap = await seatPath(day).collection('releases').get();
      list = snap.docs.map((d) => Object.assign({ id: d.id }, d.data(),
                                { createdAt: tsToIso(d.data().createdAt) }));
    } else {
      const rel = (lsGet(KEY.seats, {}) || {})['releases:' + day] || {};
      list = Object.keys(rel).map((k) => Object.assign({ id: k }, rel[k]));
    }
    return list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  /* 관리자용 — 실명 · 학과 · 전체 학번이 담긴 명단 */
  async function listSeatLogs(day) {
    let list;
    if (mode === 'firebase') {
      const snap = await seatPath(day).collection('logs').get();
      list = snap.docs.map((d) => Object.assign({ id: d.id }, d.data(),
                                { createdAt: tsToIso(d.data().createdAt) }));
    } else {
      const dayMap = (lsGet(KEY.seats, {}) || {})[day] || {};
      list = Object.keys(dayMap).map((k) => Object.assign({ id: k }, dayMap[k]));
    }
    return list.sort((a, b) => (a.seat || 0) - (b.seat || 0));
  }

  /* 관리자용 — 자리 비우기 */
  async function cancelSeat(day, seat) {
    const key = String(seat);
    if (mode === 'firebase') {
      await seatPath(day).collection('seats').doc(key).delete();
      try { await seatPath(day).collection('logs').doc(key).delete(); }
      catch (e) { console.warn('[열람실] 명단 기록을 지우지 못했습니다.', e); }
      return true;
    }
    const all = lsGet(KEY.seats, {}) || {};
    if (all[day]) { delete all[day][key]; lsSet(KEY.seats, all); }
    return true;
  }

  /* ---------- 공지 ---------- */
  /* 공지는 전부 가져오고, 예약·보관 판정은 화면에서 한다.
     (예전에는 where('publishAt','<=',now) 로 서버에서 걸렀는데,
      Firestore 가 그런 목록 조회를 거부해서 공개 페이지가 통째로
      막혔다. 자세한 이유는 firestore.rules 의 주석 참고) */
  async function getNotices(opts) {
    const all = !!(opts && opts.all);
    let list = null;
    if (mode === 'firebase') {
      const snap = await db.collection('notices').get();
      const docs = snap.docs.map((d) => Object.assign({ id: d.id }, decodeDoc(d.data())));
      if (docs.length) list = docs;
    } else {
      const stored = lsGet(KEY.notices, null);
      if (stored && stored.length) list = stored;
    }
    if (!list) return null;   // null = 호출한 쪽에서 data/notices.json 으로 넘어가라는 신호
    if (all) return list;
    return list.filter((n) => {
      const t = Date.parse(n.publishAt || '');
      return isNaN(t) || t <= Date.now();
    });
  }

  /* publishAt 이 없으면 '지금부터 공개' 로 채운다.
     날짜순 정렬과 예약 판정이 이 값을 기준으로 하기 때문이다. */
  function withPublishAt(n) {
    const out = Object.assign({}, n);
    if (!out.publishAt) {
      const d = out.date ? new Date(out.date + 'T00:00:00') : new Date();
      out.publishAt = (isNaN(d) ? new Date() : d).toISOString();
    }
    return out;
  }

  async function saveNotice(notice) {
    const n = withPublishAt(notice);
    if (mode === 'firebase') {
      const body = encodeDoc(n);
      delete body.id;
      await db.collection('notices').doc(n.id).set(body, { merge: false });
      return true;
    }
    const list = (await getNotices({ all: true })) || [];
    notice = n;
    const i = list.findIndex((n) => n.id === notice.id);
    if (i > -1) list[i] = notice; else list.unshift(notice);
    return lsSet(KEY.notices, list);
  }

  async function deleteNotice(id) {
    if (mode === 'firebase') { await db.collection('notices').doc(id).delete(); return true; }
    const list = ((await getNotices({ all: true })) || []).filter((n) => n.id !== id);
    return lsSet(KEY.notices, list);
  }

  async function replaceNotices(list) {
    if (mode === 'firebase') {
      const snap = await db.collection('notices').get();
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      list.forEach((raw) => {
        const n = withPublishAt(raw);
        const body = encodeDoc(n);
        delete body.id;
        batch.set(db.collection('notices').doc(n.id), body);
      });
      await batch.commit();
      return true;
    }
    return lsSet(KEY.notices, list.map(withPublishAt));
  }

  window.STORE = {
    init,
    get mode() { return mode; },
    get isFirebase() { return mode === 'firebase'; },
    configured,
    auth: auth$,
    getSite, saveSite, loadSite,
    getLinks, saveLinks,
    getForms, getForm, saveForm, deleteForm,
    submit, listSubmissions, deleteSubmission, testSheet,
    getNotices, saveNotice, deleteNotice, replaceNotices,
    getSeats, reserveSeat, releaseSeat, listSeatLogs, listSeatReleases, cancelSeat
  };
})();
