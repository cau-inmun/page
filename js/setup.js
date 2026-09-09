/* ============================================================
   setup.js — 연결 진단
   Firebase 설정이 제대로 됐는지 항목별로 점검하고,
   막힌 지점마다 무엇을 해야 하는지 알려줍니다.
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, el } = window.CORE;
  const C = window.FIREBASE_CONFIG || {};

  const box = () => $('#checks');
  let rows = 0;

  function row(state, title, detail, fix) {
    const mark = { ok: '✓', fail: '✕', warn: '!', skip: '–' }[state];
    const node = el('li', { class: 'check-row check-row--' + state }, [
      el('span', { class: 'check-row__mark', 'aria-hidden': 'true', text: mark }),
      el('div', { class: 'check-row__body' }, [
        el('div', { class: 'check-row__title', text: title }),
        detail ? el('div', { class: 'check-row__detail', text: detail }) : null,
        fix ? el('div', { class: 'check-row__fix' }, [
          el('strong', { text: '해야 할 일 : ' }), fix
        ]) : null
      ])
    ]);
    box().appendChild(node);
    rows++;
    return state;
  }

  const has = (v) => !!(v && String(v).trim() && !/^(여기에|YOUR_|<)/.test(String(v)));

  async function run() {
    box().innerHTML = '';

    /* ---- 먼저 : 사이트 파일이 최신인지 ----
       브라우저가 예전 js 를 들고 있으면 함수가 없어서 실패하는데,
       화면에는 권한 문제처럼 보인다. 실제로 그렇게 헤맨 적이 있어
       Firebase 를 보기도 전에 이것부터 짚는다. */
    const NEED = ['getSeats', 'reserveSeat', 'releaseSeat', 'listSeatLogs',
                  'listSeatReleases', 'cancelSeat', 'probeSeatRules'];
    const mine = (window.SITE && window.SITE.APP_VERSION) || '(없음)';
    let latest = '';
    try {
      const res = await fetch('js/config.js?fresh=' + Date.now(), { cache: 'no-store' });
      const m = (await res.text()).match(/APP_VERSION:\s*'([^']+)'/);
      latest = m ? m[1] : '';
    } catch (e) { /* 못 읽으면 배포 번호 비교는 건너뛴다 */ }

    const lacking = NEED.filter((k) => typeof (window.STORE || {})[k] !== 'function');
    if (latest && latest !== mine) {
      row('fail', '먼저 · 사이트 파일 최신 여부',
        `이 화면은 ${mine} 인데 서버에는 ${latest} 가 올라가 있습니다.`,
        '브라우저가 예전 화면을 들고 있습니다. 윈도우는 Ctrl+Shift+R, ' +
        '맥은 Cmd+Shift+R 로 강제 새로고침하세요. 휴대폰은 브라우저를 완전히 닫았다 여세요. ' +
        '아래 항목들이 실패해도 먼저 이것부터 해결해야 합니다.');
    } else if (lacking.length) {
      row('fail', '먼저 · 사이트 파일 최신 여부',
        '예전 파일을 쓰고 있습니다. 없는 기능: ' + lacking.join(', '),
        '브라우저가 옛 js 를 캐시에 들고 있습니다. 윈도우는 Ctrl+Shift+R, ' +
        '맥은 Cmd+Shift+R 로 강제 새로고침하세요. 휴대폰은 브라우저를 완전히 닫았다 여세요. ' +
        '그래도 그대로면 GitHub Pages 배포가 아직 안 끝났을 수 있으니 1~2분 뒤 다시 보세요. ' +
        '아래 항목들이 실패해도 먼저 이것부터 해결해야 합니다.');
    } else {
      row('ok', '먼저 · 사이트 파일 최신 여부',
        '배포 번호 ' + mine + ' · 열람실 기능까지 모두 들어 있습니다.', '');
    }

    /* ---- 1. 설정값 ---- */
    const missing = [];
    if (!has(C.apiKey)) missing.push('apiKey');
    if (!has(C.projectId)) missing.push('projectId');
    if (!has(C.authDomain)) missing.push('authDomain');

    if (missing.length) {
      row('fail', '1. 설정값 입력',
        '아직 비어 있는 값: ' + missing.join(', '),
        'js/firebase-config.js 를 열어 Firebase 콘솔의 firebaseConfig 값을 채우고 커밋하세요. ' +
        '(콘솔 → ⚙️ 프로젝트 설정 → 내 앱 → 웹 앱)');
      row('skip', '2~11. 나머지 점검', '설정값이 있어야 진행할 수 있습니다.', '');
      finish();
      return;
    }
    row('ok', '1. 설정값 입력', `프로젝트 ${C.projectId}`, '');

    /* ---- 2. SDK ---- */
    let mode;
    try {
      mode = await STORE.init();
    } catch (e) {
      row('fail', '2. Firebase SDK 불러오기', String(e.message || e),
        '인터넷 연결을 확인하세요. 학교 방화벽이 gstatic.com 을 막는 경우도 있습니다.');
      finish(); return;
    }
    if (mode !== 'firebase') {
      row('fail', '2. Firebase SDK 불러오기',
        'SDK 를 불러오지 못해 미리보기 모드로 동작 중입니다.',
        '브라우저 콘솔(F12)의 빨간 오류 메시지를 확인하세요.');
      finish(); return;
    }
    row('ok', '2. Firebase SDK 불러오기', 'v' + (window.FIREBASE_SDK_VERSION || ''), '');

    /* ---- 3. Firestore 읽기 ---- */
    try {
      await firebase.firestore().collection('forms').limit(1).get();
      row('ok', '3. Firestore 연결', '데이터베이스를 읽을 수 있습니다.', '');
    } catch (e) {
      const code = e.code || '';
      if (code === 'permission-denied') {
        row('fail', '3. Firestore 연결', '연결은 됐지만 규칙이 읽기를 막고 있습니다. (permission-denied)',
          '저장소의 firestore.rules 내용을 콘솔 → Firestore Database → 규칙 에 붙여넣고 게시하세요.');
      } else if (code === 'unavailable' || code === 'not-found' || code === 'failed-precondition') {
        row('fail', '3. Firestore 연결', `Firestore 에 닿지 못했습니다. (${code})`,
          '⚠ Firestore Database 를 아직 만들지 않았을 가능성이 큽니다. ' +
          '콘솔 → 빌드 → Firestore Database → 데이터베이스 만들기 → 프로덕션 모드 → 위치 asia-northeast3(서울). ' +
          'Realtime Database 는 이 사이트가 쓰지 않으므로 따로 만들어야 합니다.');
      } else {
        row('fail', '3. Firestore 연결', String(code || e.message || e), '콘솔(F12) 오류 메시지를 확인하세요.');
      }
      finish(); return;
    }

    /* ---- 4. 공개 공지 조회 ---- */
    try {
      await firebase.firestore().collection('notices').limit(1).get();
      row('ok', '4. 공개 공지 조회', '학우들이 공지를 읽을 수 있습니다.', '');
    } catch (e) {
      row('fail', '4. 공개 공지 조회', String(e.code || e.message || e),
        '저장소의 firestore.rules 를 콘솔 → Firestore Database → 규칙 에 다시 붙여넣고 게시하세요. ' +
        'notices 규칙이 allow read: if true 여야 합니다.');
    }

    /* ---- 5. 폼 정의 ---- */
    try {
      const snap = await firebase.firestore().collection('forms').get();
      if (snap.empty) {
        row('warn', '5. 폼 등록', '아직 등록된 폼이 없습니다. 지금은 js/config.js 의 기본 폼이 보입니다.',
          '관리자 → 폼 설정 → 폼 설정 저장 을 한 번 누르면 기본 폼이 서버에 등록됩니다. ' +
          '이걸 해야 실제 접수가 시작됩니다.');
      } else {
        row('ok', '5. 폼 등록', `${snap.size}개 등록됨`, '');
      }
    } catch (e) {
      row('fail', '5. 폼 등록', String(e.code || e.message || e), '');
    }

    /* ---- 6. 로그인 / 관리자 등록 ---- */
    const user = firebase.auth().currentUser;
    if (!user) {
      row('warn', '6. 관리자 로그인', '로그인하지 않은 상태입니다.',
        '아래 로그인 칸으로 관리자 계정을 넣어보세요. 여기서 로그인해야 7번까지 점검됩니다.');
      showLogin();
    } else {
      row('ok', '6. 관리자 로그인', user.email, '');
      try {
        const doc = await firebase.firestore().collection('admins').doc(user.uid).get();
        if (doc.exists) {
          row('ok', '7. 관리자 권한', 'admins 에 등록된 계정입니다.', '');
        } else {
          row('fail', '7. 관리자 권한', `admins 컬렉션에 이 계정의 UID 가 없습니다.`,
            `콘솔 → Firestore Database → 데이터 → admins 컬렉션에 문서 ID 가 아래 UID 인 문서를 만드세요. ` +
            `UID: ${user.uid}`);
        }
      } catch (e) {
        row('fail', '7. 관리자 권한', String(e.code || e.message || e),
          '규칙이 배포되지 않았을 수 있습니다.');
      }
      $('#uid-line').hidden = false;
      $('#uid-value').textContent = user.uid;
    }

    /* ---- 9. 좌석표 읽기 (누구나) ---- */
    const today = window.CORE.seoulNow().date;
    try {
      const snap = await firebase.firestore()
        .collection('seatdays').doc(today).collection('seats').get();
      row('ok', '9. 좌석표 읽기', `오늘(${today}) 예약된 자리 ${snap.size}석`, '');
    } catch (e) {
      row('fail', '9. 좌석표 읽기', String(e.code || e.message || e),
        '저장소의 firestore.rules 를 콘솔 → Firestore Database → 규칙 에 다시 붙여넣고 게시하세요. ' +
        'seatdays 규칙이 통째로 빠져 있으면 열람실이 하나도 동작하지 않습니다. ' +
        '붙여넣은 뒤 게시 버튼이 실제로 성공했는지(빨간 오류가 없었는지) 확인하세요.');
    }

    /* ---- 10. 좌석 명단 읽기 (관리자) ---- */
    if (!user) {
      row('skip', '10. 좌석 명단 읽기', '로그인해야 점검할 수 있습니다.', '');
    } else {
      try {
        const snap = await firebase.firestore()
          .collection('seatdays').doc(today).collection('logs').get();
        row('ok', '10. 좌석 명단 읽기', `${snap.size}건 (관리자 → 열람실 탭에서 보입니다)`, '');
      } catch (e) {
        row('fail', '10. 좌석 명단 읽기', String(e.code || e.message || e),
          '규칙의 seatdays/{day}/logs 부분이 배포되지 않았습니다. ' +
          'firestore.rules 를 다시 붙여넣고 게시하세요.');
      }
    }

    /* ---- 11. 도메인 ---- */
    row('warn', '11. 승인된 도메인', `지금 이 페이지의 주소: ${location.hostname}`,
      `Firebase 콘솔 → Authentication → Settings → 승인된 도메인 에 ` +
      `'${location.hostname}' 가 있어야 로그인이 됩니다. localhost 는 기본 포함입니다.`);

    finish();
  }

  function showLogin() {
    const f = $('#setup-login');
    f.hidden = false;
    f.onsubmit = async (e) => {
      e.preventDefault();
      const err = $('#setup-login-error');
      err.hidden = true;
      try {
        await firebase.auth().signInWithEmailAndPassword(
          $('#su-email').value.trim(), $('#su-pw').value);
        run();
      } catch (ex) {
        err.hidden = false;
        err.textContent = ({
          'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않습니다.',
          'auth/user-not-found': '등록되지 않은 계정입니다. 콘솔 → Authentication → Users 에서 계정을 만드세요.',
          'auth/wrong-password': '비밀번호가 맞지 않습니다.',
          'auth/operation-not-allowed': 'Authentication 의 이메일/비밀번호 로그인이 꺼져 있습니다. 콘솔에서 켜주세요.',
          'auth/unauthorized-domain': `이 도메인(${location.hostname})이 승인되지 않았습니다. 콘솔 → Authentication → Settings → 승인된 도메인 에 추가하세요.`
        })[ex.code] || (ex.code || ex.message);
      }
    };
  }

  function finish() {
    const fails = $$('.check-row--fail', box()).length;
    const banner = $('#verdict');
    banner.hidden = false;
    if (fails === 0) {
      banner.className = 'banner';
      banner.innerHTML = '';
      banner.append(el('strong', { text: '연결이 정상입니다. ' }),
        '관리자 페이지에서 공지와 폼을 관리할 수 있습니다.');
    } else {
      banner.className = 'banner banner--error';
      banner.innerHTML = '';
      banner.append(el('strong', { text: `해결할 항목이 ${fails}개 있습니다. ` }),
        '아래에서 ✕ 표시된 항목의 ‘해야 할 일’ 을 따라 하세요.');
    }
  }


  document.addEventListener('DOMContentLoaded', () => {
    window.CORE.boot();
    $('#btn-recheck').addEventListener('click', run);
    run();
  });
})();
