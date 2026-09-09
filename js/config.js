/* ============================================================
   사이트 설정 파일
   ------------------------------------------------------------
   대부분의 내용은 이 파일만 고치면 바뀝니다. (HTML/CSS 수정 불필요)
   url 을 "" (빈 문자열)로 두면 버튼이 "준비 중"으로 표시됩니다.
   ============================================================ */

const SITE = {
  /* ---- 배포 번호 ----
     html 의 ?v= 값과 반드시 같아야 합니다. js·css·이미지를 고칠 때
     두 곳을 함께 올려주세요. 이 값이 다르면 사이트가 스스로 알아채고
     새 파일을 받아옵니다 (js/core.js 의 checkForUpdate).      */
  APP_VERSION: '20260909a',

  /* ---- 학생회 기본 정보 ---- */
  /* ---- 상단바에 보이는 이름 ----
     넓은 화면에서는 long, 좁은 화면(440px 이하)에서는 short 가 보입니다.
     휴대폰에서는 메뉴와 자리를 다투므로 short 를 짧게 유지하세요. */
  brand: {
    long: '중앙대학교 제15대 인문대학 학생회 ‘연(聯)’',
    short: '제15대 학생회 ‘연(聯)’'
  },

  college: '중앙대학교 인문대학',
  councilTerm: '제15대 학생회',
  councilName: '연',
  tagline: '인문대학의 모든 소식을 한곳에서',
  description: '중앙대학교 인문대학 제15대 학생회 ‘연’ 공식 링크 페이지입니다. 공지사항, 신청 링크, 문의 채널을 한곳에 모았습니다.',

  /* ---- 상단 빠른 실행 버튼 (최대 3개 권장) ---- */
  quickLinks: [
    { label: '인스타그램', icon: 'instagram', url: 'https://www.instagram.com/cau_inmun/' },
    { label: '카카오톡 채널', icon: 'kakao', url: 'https://pf.kakao.com/_iITuX' },
    { label: '열람실 예약', icon: 'clock', url: 'seats.html' },
    { label: '건의함', icon: 'mail', url: 'apply.html?id=suggestion' }
  ],

  /* ---- 링크 모음 (링크트리 본문) ----
     group: 섹션 제목 / items: 그 안의 버튼들
     badge: 버튼 오른쪽에 붙는 작은 라벨 (없으면 생략)              */
  linkGroups: [
    {
      group: '신청 · 참여',
      items: [
        { label: '학생회 건의함', desc: '익명으로 의견을 남겨주세요', url: 'apply.html?id=suggestion', badge: '상시' },
        { label: '사업 신청 폼', desc: '진행 중인 학생회 사업 신청', url: 'apply.html?id=apply' },
        { label: '열람실 좌석 예약', desc: '09시–21시 · 매일 초기화', url: 'seats.html', badge: '상시' },
        { label: '학생회비 납부 안내', desc: '납부 방법과 혜택 안내', url: '' }
      ]
    },
    {
      group: '학사 · 학교',
      items: [
        { label: '인문대학 홈페이지', desc: 'human.cau.ac.kr', url: 'https://human.cau.ac.kr/' },
        { label: '중앙대학교 포털', desc: '수강신청 · 성적 · 증명서', url: 'https://portal.cau.ac.kr/' },
        { label: '중앙대학교 공식 홈페이지', desc: '학사일정 및 공지', url: 'https://www.cau.ac.kr/' }
      ]
    },
    {
      group: '함께 보는 계정',
      items: [
        { label: '인문대학 학생회 인스타그램', desc: '@cau_inmun', url: 'https://www.instagram.com/cau_inmun/' },
        { label: '인문대학 인권위원회', desc: '@humanrights_inmun.cau', url: 'https://www.instagram.com/humanrights_inmun.cau/' },
        { label: '카카오톡 채널', desc: '문의는 이곳으로 편하게', url: 'https://pf.kakao.com/_iITuX' }
      ]
    }
  ],

  /* ---- 학생회 소개 / 국(부서) ---- */
  about: {
    /* TODO: 학생회에서 실제로 쓰는 소개 문구로 바꿔주세요. */
    intro: '인문대학 제15대 학생회 ‘연’은 학우 여러분과 학교 사이를 잇습니다. 한 해 동안 여러분의 목소리가 실제 변화로 이어지도록 움직이겠습니다.',
    /* TODO: 실제 국(부서) 구성에 맞게 고쳐주세요. */
    departments: [
      { name: '집행국', desc: '학생회 운영 총괄과 회의 · 예산 관리' },
      { name: '기획국', desc: '학술제 · 축제 등 인문대 자체 사업 기획' },
      { name: '홍보국', desc: '공지 · SNS 콘텐츠 제작과 소통 창구 운영' },
      { name: '복지국', desc: '학생 복지 사업과 물품 대여 운영' }
    ]
  },

  /* ---- 연락처 / 푸터 ---- */
  contact: {
    /* 줄바꿈(\n)을 넣으면 화면에서도 줄이 나뉩니다. */
    place: '서울특별시 동작구 흑석로 84\n중앙대학교 서울캠퍼스 203관(서라벌홀) 702호',
    email: '',
    instagram: 'https://www.instagram.com/cau_inmun/',
    kakao: 'https://pf.kakao.com/_iITuX'
  },

  /* ---- 공지 카테고리 (색상은 css 의 .tag[data-cat] 와 연결) ---- */
  categories: ['전체', '학사', '행사', '모집', '복지', '일반'],

  /* ---- 인문대학 학과 (폼 선택지에 사용) ---- */
  departments: [
    '국어국문학과', '영어영문학과',
    '유럽문화학부 독일어문학전공', '유럽문화학부 프랑스어문학전공', '유럽문화학부 러시아어문학전공',
    '아시아문화학부 일본어문학전공', '아시아문화학부 중국어문학전공',
    '철학과', '역사학과', '기타 (타 단대 · 복수전공 등)'
  ],

  /* ---- 기본 폼 정의 ----
     Firebase 를 연결하면 관리자 페이지에서 자유롭게 수정할 수 있고,
     그때부터는 이 값 대신 Firestore 의 내용이 쓰입니다.
     type: text | textarea | select | radio | checkbox | email | tel | date | number */
  defaultForms: [
    {
      id: 'suggestion',
      order: 1,
      title: '학생회 건의함',
      description: '인문대학 학생회에 전하고 싶은 의견을 남겨주세요. 이름을 비워두면 익명으로 접수됩니다.',
      submitLabel: '건의 보내기',
      doneMessage: '소중한 의견 감사합니다. 학생회 회의에서 검토한 뒤 필요한 경우 연락드리겠습니다.',
      open: true,
      consent: true,
      fields: [
        { key: 'category', label: '어떤 내용인가요?', type: 'select', required: true,
          options: ['학사 · 수업', '복지 · 시설', '행사 · 사업', '학생회 운영', '기타'] },
        { key: 'content', label: '내용', type: 'textarea', required: true,
          placeholder: '구체적으로 적어주실수록 도움이 됩니다.' },
        { key: 'dept', label: '학과', type: 'select', required: false, useDepartments: true },
        { key: 'name', label: '이름', type: 'text', required: false,
          help: '익명으로 보내려면 비워두세요.' },
        { key: 'contact', label: '답변받을 연락처', type: 'text', required: false,
          help: '이메일 또는 카카오톡 ID. 답변이 필요할 때만 적어주세요.' }
      ]
    },
    {
      id: 'apply',
      order: 2,
      title: '사업 신청',
      description: '학생회가 진행하는 사업 신청을 받습니다. 모집 중인 사업은 공지사항에서 확인해 주세요.',
      submitLabel: '신청하기',
      doneMessage: '신청이 접수되었습니다. 선정 결과는 공지사항과 인스타그램으로 안내드립니다.',
      open: true,
      consent: true,
      fields: [
        { key: 'program', label: '신청할 사업', type: 'text', required: true,
          placeholder: '공지에 안내된 사업 이름을 적어주세요.' },
        { key: 'name', label: '이름', type: 'text', required: true },
        { key: 'studentId', label: '학번', type: 'text', required: true, placeholder: '예) 20251234' },
        { key: 'dept', label: '학과', type: 'select', required: true, useDepartments: true },
        { key: 'contact', label: '연락처', type: 'text', required: true,
          help: '전화번호 또는 카카오톡 ID' },
        { key: 'note', label: '남길 말', type: 'textarea', required: false }
      ]
    },
    {
      id: 'example',
      order: 3,
      title: '[예시] 간담회 사전 질문 받기',
      description: '관리자 페이지의 폼 편집 기능을 보여주기 위한 예시 폼입니다. ' +
                   '항목 유형이 어떻게 보이는지 확인한 뒤, 실제로 쓸 때는 내용을 바꾸거나 폼을 지우세요.',
      submitLabel: '질문 보내기',
      doneMessage: '질문 감사합니다. 간담회 때 정리해서 답변드리겠습니다.',
      open: true,
      consent: true,
      fields: [
        { key: 'topic', label: '어느 분야에 대한 질문인가요?', type: 'radio', required: true,
          options: ['학사 · 커리큘럼', '장학 · 등록금', '시설 · 공간', '학생회 사업'] },
        { key: 'question', label: '질문 내용', type: 'textarea', required: true,
          placeholder: '간담회에서 다뤄주셨으면 하는 내용을 적어주세요.' },
        { key: 'attend', label: '참석 가능한 시간대 (여러 개 선택 가능)', type: 'checkbox', required: false,
          options: ['평일 점심', '평일 오후', '평일 저녁'] },
        { key: 'preferDate', label: '희망 날짜', type: 'date', required: false },
        { key: 'dept', label: '학과', type: 'select', required: false, useDepartments: true },
        { key: 'name', label: '이름', type: 'text', required: false,
          help: '익명으로 보내려면 비워두세요.' }
      ]
    }
  ],

  /* ---- 열람실 좌석 예약 ----
     grid 가 실제 좌석배치도입니다. 숫자는 좌석 번호, 0 은 빈 칸(통로·여백).
     한 줄이 화면의 한 줄이 되고, 열 개수는 모든 줄이 같아야 합니다.
     자리 배치가 바뀌면 이 표만 고치면 화면이 그대로 따라갑니다. */
  readingRoom: {
    name: '인문사회 열람실',
    place: '821호',
    openHour: 8,        // 08시부터 예약 가능
    closeHour: 18,      // 18시가 되면 좌석표가 비워지고 그날 예약이 끝납니다

    topLabel: '창문',
    bottomLabel: '벽',
    doorCol: 12,        // 아래쪽 벽에서 출입문이 있는 열 (0 부터 셈)

    grid: [
      [18, 17, 16, 15, 14, 13,  0, 12, 11, 10,  9,  8,  0,  7],
      [19, 20, 21, 22, 23, 24,  0, 25, 26, 27, 28, 29,  0,  6],
      [ 0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  5],
      [40, 39, 38, 37, 36, 35, 34,  0, 33, 32, 31, 30,  0,  4],
      [41, 42, 43, 44, 45, 46, 47,  0, 48, 49, 50, 51,  0,  3],
      [ 0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  2],
      [60, 59, 58, 57, 56, 55,  0,  0, 54, 53, 52,  0,  0,  1]
    ],

    /* 좌석배치 특이사항. seats 를 적으면 그 자리에 작은 점이 찍히고
       legend 가 좌석표 위 범례에 함께 뜹니다. */
    seatNotes: [
      { text: '1~7번, 52~60번 좌석에는 수납장이 있습니다.',
        legend: '수납장 있음',
        seats: [1, 2, 3, 4, 5, 6, 7, 52, 53, 54, 55, 56, 57, 58, 59, 60] },
      { text: '10 · 11 · 12 · 25 · 26 · 27번 좌석은 드나들 때 12~13번, 24~25번 사이 공간을 이용해 주세요.',
        seats: [10, 11, 12, 25, 26, 27] }
    ],

    notes: [
      '열람실 내 비치된 이용자 명부를 작성한 후 이용 부탁드립니다.',
      '무소음 마우스와 키보드 키스킨 사용은 의무이며, 모든 전자기기는 무음모드로 설정 부탁드립니다.',
      '액체류(물, 음료)를 제외한 음식물 반입을 금지합니다.',
      '창가, 통로 등 자리 외의 공간에 짐을 보관해둘 수 없습니다.',
      '쾌적한 열람실 환경을 위해 사용 후 본인 자리는 직접 정리해주세요.',
      '사석화 금지를 위해 매 평일 아침에 좌석에 남겨진 개인 물품은 정리할 예정입니다.'
    ]
  },

  /* ---- 구글 스프레드시트로 응답 보내기 (선택) ----
     주소를 넣으면 폼 제출이 Firestore 와 함께 구글 시트에도 한 줄씩 쌓입니다.
     구글폼처럼 시트에서 바로 확인·정렬·필터할 수 있습니다.
     만드는 방법은 README 의 '구글 시트로 응답 받기' 를 보세요.
     비워두면 이 기능은 꺼진 채로 아무 영향도 주지 않습니다. */
  sheetWebhookUrl: 'https://script.google.com/macros/s/AKfycbxMs-_CHLg7-IiH0Pm9KUB8O_BQzGOFnB0vl9RKkMCEXJCMKrrhEL6ffrROO8VMKf_j/exec',

  /* ---- 개인정보 수집·이용 동의 문구 ---- */
  consentText: '입력하신 이름 · 학번 · 연락처는 신청 확인과 결과 안내에만 사용하며, ' +
               '해당 사업 종료 후 파기합니다. 동의하지 않으셔도 되지만 그 경우 접수가 어렵습니다.'
};

window.SITE = SITE;

/* 이 파일의 기본값을 그대로 한 벌 남겨둔다.
   관리자에서 '사이트 정보 저장' 을 한 번 누르면 그 내용이 window.SITE 를
   덮어쓰기 때문에, 나중에 이 파일에 버튼을 추가해도 화면에는 나오지 않는다.
   무엇이 새로 생겼는지 관리자 화면에서 짚어주려고 원본을 보관한다. */
window.SITE_DEFAULTS = JSON.parse(JSON.stringify(SITE));
