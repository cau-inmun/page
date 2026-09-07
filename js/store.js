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

  /* ---------- Firebase 준비 ---------- */
  function configured() {
    const c = window.FIREBASE_CONFIG;
    return !!(c && c.apiKey && c.projectId &&
              !/^(여기에|YOUR_|<)/.test(String(c.apiKey)));
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('스크립트를 불러오지 못했습니다: ' + src));
      document.head.appendChild(s);
    });
  }

  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      if (!configured()) { mode = 'local'; return mode; }
      const v = window.FIREBASE_SDK_VERSION || '10.14.1';
      const base = 'https://www.gstatic.com/firebasejs/' + v + '/';
      try {
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
        mode = 'firebase';
      } catch (err) {
        console.warn('[store] Firebase 초기화 실패 — 로컬 모드로 동작합니다.', err);
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
      const list = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
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
      const body = Object.assign({}, form);
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

  async function listSubmissions(formId) {
    if (mode === 'firebase') {
      let q = db.collection('submissions');
      if (formId) q = q.where('formId', '==', formId);
      const snap = await q.orderBy('createdAt', 'desc').limit(500).get();
      return snap.docs.map((d) => {
        const v = d.data();
        const ts = v.createdAt && v.createdAt.toDate ? v.createdAt.toDate() : null;
        return { id: d.id, formId: v.formId, data: v.data || {},
                 createdAt: ts ? ts.toISOString() : '' };
      });
    }
    const list = lsGet(KEY.submissions, []);
    return formId ? list.filter((s) => s.formId === formId) : list;
  }

  async function deleteSubmission(id) {
    if (mode === 'firebase') { await db.collection('submissions').doc(id).delete(); return true; }
    return lsSet(KEY.submissions, lsGet(KEY.submissions, []).filter((s) => s.id !== id));
  }

  /* ---------- 공지 ---------- */
  async function getNotices() {
    if (mode === 'firebase') {
      const snap = await db.collection('notices').get();
      const list = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      if (list.length) return list;
    } else {
      const list = lsGet(KEY.notices, null);
      if (list && list.length) return list;
    }
    return null;   // null = 호출한 쪽에서 data/notices.json 으로 넘어가라는 신호
  }

  async function saveNotice(notice) {
    if (mode === 'firebase') {
      const body = Object.assign({}, notice);
      delete body.id;
      await db.collection('notices').doc(notice.id).set(body, { merge: false });
      return true;
    }
    const list = (await getNotices()) || [];
    const i = list.findIndex((n) => n.id === notice.id);
    if (i > -1) list[i] = notice; else list.unshift(notice);
    return lsSet(KEY.notices, list);
  }

  async function deleteNotice(id) {
    if (mode === 'firebase') { await db.collection('notices').doc(id).delete(); return true; }
    const list = ((await getNotices()) || []).filter((n) => n.id !== id);
    return lsSet(KEY.notices, list);
  }

  async function replaceNotices(list) {
    if (mode === 'firebase') {
      const snap = await db.collection('notices').get();
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      list.forEach((n) => {
        const body = Object.assign({}, n);
        delete body.id;
        batch.set(db.collection('notices').doc(n.id), body);
      });
      await batch.commit();
      return true;
    }
    return lsSet(KEY.notices, list);
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
