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
    forms: 'cau-inmun:forms',
    submissions: 'cau-inmun:submissions',
    notices: 'cau-inmun:notices'
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
      if (!configured()) { mode = 'local'; return mode; }
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

  /* ---------- 링크 ---------- */
  async function getLinks() {
    if (mode === 'firebase') {
      const snap = await db.collection('config').doc('links').get();
      const groups = snap.exists ? (snap.data().groups || []) : [];
      if (groups.length) return groups;
    } else {
      const groups = lsGet(KEY.links, null);
      if (groups && groups.length) return groups;
    }
    /* 아직 등록된 게 없으면 js/config.js 의 기본값을 쓴다 */
    return (window.SITE && window.SITE.linkGroups) || [];
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
  function defaultForms() {
    return (window.SITE && window.SITE.defaultForms) || [];
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
      await db.collection('forms').doc(id).set(body, { merge: false });
      return true;
    }
    const list = await getForms();
    const i = list.findIndex((f) => f.id === form.id);
    if (i > -1) list[i] = form; else list.push(form);
    return lsSet(KEY.forms, list);
  }

  async function deleteForm(id) {
    if (mode === 'firebase') { await db.collection('forms').doc(id).delete(); return true; }
    const list = (await getForms()).filter((f) => f.id !== id);
    return lsSet(KEY.forms, list);
  }

  /* ---------- 폼 제출 ---------- */
  async function submit(formId, data) {
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

  /* ---------- 공지 ---------- */
  /* opts.all = true  → 예약분 포함 전체 (관리자 전용)
     기본값        → 이미 공개된 것만. 보안 규칙과 짝을 이루는 조건이라
                      이 where 절을 빼면 공개 사용자의 조회가 거부된다. */
  async function getNotices(opts) {
    const all = !!(opts && opts.all);
    if (mode === 'firebase') {
      let snap;
      if (all) {
        snap = await db.collection('notices').get();
      } else {
        snap = await db.collection('notices')
          .where('publishAt', '<=', firebase.firestore.Timestamp.now())
          .get();
      }
      const list = snap.docs.map((d) => Object.assign({ id: d.id }, decodeDoc(d.data())));
      if (list.length) return list;
    } else {
      const list = lsGet(KEY.notices, null);
      if (list && list.length) {
        return all ? list : list.filter((n) => {
          const t = Date.parse(n.publishAt || '');
          return isNaN(t) || t <= Date.now();
        });
      }
    }
    return null;   // null = 호출한 쪽에서 data/notices.json 으로 넘어가라는 신호
  }

  /* publishAt 은 반드시 있어야 한다.
     공개 조회가 where('publishAt','<=',now) 로 걸리기 때문에,
     값이 없는 문서는 아예 목록에 잡히지 않는다. */
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
    getLinks, saveLinks,
    getForms, getForm, saveForm, deleteForm,
    submit, listSubmissions, deleteSubmission,
    getNotices, saveNotice, deleteNotice, replaceNotices
  };
})();
