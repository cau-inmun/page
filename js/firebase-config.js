/* ============================================================
   Firebase 설정
   ------------------------------------------------------------
   중앙대학교 인문대학 학생회 Firebase 프로젝트(cau-inmun) 설정입니다.
   Firebase 콘솔 → ⚙️ 프로젝트 설정 → 내 앱 → 웹 앱의 값 그대로입니다.

   ※ 이 값들은 비밀이 아닙니다.
     Firebase 웹 앱은 설계상 이 설정을 브라우저에 그대로 내려보냅니다.
     누구나 개발자도구로 볼 수 있는 값이라, 공개 저장소에 두는 것이 정상입니다.
     실제 보안은 firestore.rules 의 보안 규칙이 담당합니다.
     → 규칙을 배포하지 않으면 제출 내용이 그대로 노출됩니다. 반드시 배포하세요.

   연결이 안 될 때는 setup.html 을 열면 어디서 막혔는지 알려줍니다.
   ============================================================ */

window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBEDpLyJ5R3VBrjb8yk2GdMrDu-PxyTwLg',
  authDomain: 'cau-inmun.firebaseapp.com',
  projectId: 'cau-inmun',
  storageBucket: 'cau-inmun.firebasestorage.app',
  messagingSenderId: '957344560058',
  appId: '1:957344560058:web:f16276d2179f115ea6a383',

  /* 아래 둘은 이 사이트가 쓰지 않습니다. 콘솔 설정과 맞춰두기 위해서만 적어둡니다.
     databaseURL  — Realtime Database. 이 사이트는 Firestore 를 씁니다.
     measurementId — Google 애널리틱스. 애널리틱스 SDK 를 불러오지 않습니다. */
  databaseURL: 'https://cau-inmun-default-rtdb.asia-southeast1.firebasedatabase.app',
  measurementId: 'G-DVF7ESNKYP'
};

/* Firebase JS SDK 버전. 새 버전으로 올리려면 이 값만 바꾸세요. */
window.FIREBASE_SDK_VERSION = '10.14.1';
