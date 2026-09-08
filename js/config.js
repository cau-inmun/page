/* ============================================================
   사이트 설정 파일
   ------------------------------------------------------------
   대부분의 내용은 이 파일만 고치면 바뀝니다. (HTML/CSS 수정 불필요)
   url 을 "" (빈 문자열)로 두면 버튼이 "준비 중"으로 표시됩니다.
   ============================================================ */

const SITE = {
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
    place: '서울특별시 동작구 흑석로 84 중앙대학교 서울캠퍼스 203관(서라벌홀)',
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

  /* ---- 개인정보 수집·이용 동의 문구 ---- */
  consentText: '입력하신 이름 · 학번 · 연락처는 신청 확인과 결과 안내에만 사용하며, ' +
               '해당 사업 종료 후 파기합니다. 동의하지 않으셔도 되지만 그 경우 접수가 어렵습니다.'
};

window.SITE = SITE;
