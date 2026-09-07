/* ============================================================
   Firebase 설정
   ------------------------------------------------------------
   ▸ 지금 상태: apiKey 와 appId 가 비어 있어 '미리보기 모드'로 동작합니다.
     두 값만 채우면 폼 접수 · 관리자 로그인이 켜집니다.

   ▸ 두 값 얻는 법 (1분)
       Firebase 콘솔 → 프로젝트 개요 옆 ⚙️ → 프로젝트 설정
       → 아래로 스크롤 → '내 앱' → 웹 앱의 firebaseConfig 에서 복사
       (웹 앱이 없으면 </> 아이콘을 눌러 먼저 앱을 하나 등록하세요)

   ▸ projectId · authDomain 은 프로젝트 이름에서 정해지므로 미리 채워뒀습니다.
     콘솔 값과 다르면 콘솔 쪽이 맞으니 그대로 덮어쓰세요.

   ※ 이 값들은 비밀이 아닙니다. 웹 앱에 공개되는 게 정상이며,
     실제 보안은 firestore.rules 의 보안 규칙이 담당합니다.
     반드시 README 대로 규칙을 배포하세요.
   ============================================================ */

window.FIREBASE_CONFIG = {
  /* ↓↓↓ 콘솔에서 복사해 채워야 하는 값 ↓↓↓ */
  apiKey: '',                                  // 예) AIzaSy...  ← 필수
  appId: '',                                   // 예) 1:123456789:web:abc...

  /* ↓↓↓ 프로젝트 이름에서 정해지는 값 (이미 채워둠) ↓↓↓ */
  projectId: 'cau-inmun',
  authDomain: 'cau-inmun.firebaseapp.com',

  /* ↓↓↓ 이 사이트에서는 쓰지 않지만 콘솔 값과 맞춰두면 좋은 값 ↓↓↓ */
  storageBucket: '',                           // 파일 업로드를 쓰지 않으므로 비워둬도 됨
  messagingSenderId: '',                       // 푸시 알림을 쓰지 않으므로 비워둬도 됨

  /* Realtime Database 주소.
     이 사이트는 Firestore 를 쓰므로 동작에는 영향이 없습니다.
     콘솔 설정과 맞춰두기 위해서만 적어둡니다. */
  databaseURL: 'https://cau-inmun-default-rtdb.asia-southeast1.firebasedatabase.app'
};

/* Firebase JS SDK 버전. 새 버전으로 올리려면 이 값만 바꾸세요. */
window.FIREBASE_SDK_VERSION = '10.14.1';
