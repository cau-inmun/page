/* ============================================================
   사이트 설정 파일
   ------------------------------------------------------------
   대부분의 내용은 이 파일만 고치면 바뀝니다. (HTML/CSS 수정 불필요)
   url 을 "" (빈 문자열)로 두면 버튼이 "준비 중"으로 표시됩니다.
   ============================================================ */

const SITE = {
  /* ---- 학생회 기본 정보 ---- */
  college: '중앙대학교 인문대학',
  councilTerm: '제15대 학생회',
  councilName: '역',
  tagline: '인문대학의 모든 소식을 한곳에서',
  description: '중앙대학교 인문대학 제15대 학생회 ‘역’ 공식 링크 페이지입니다. 공지사항, 신청 링크, 문의 채널을 한곳에 모았습니다.',

  /* ---- 상단 빠른 실행 버튼 (최대 3개 권장) ---- */
  quickLinks: [
    { label: '인스타그램', icon: 'instagram', url: 'https://www.instagram.com/cau_inmun/' },
    { label: '카카오톡 채널', icon: 'kakao', url: '' },
    { label: '건의함', icon: 'mail', url: '' }
  ],

  /* ---- 링크 모음 (링크트리 본문) ----
     group: 섹션 제목 / items: 그 안의 버튼들
     badge: 버튼 오른쪽에 붙는 작은 라벨 (없으면 생략)              */
  linkGroups: [
    {
      group: '신청 · 참여',
      items: [
        { label: '학생회 건의함', desc: '익명으로 의견을 남겨주세요', url: '', badge: '상시' },
        { label: '사업 신청 폼', desc: '진행 중인 학생회 사업 신청', url: '' },
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
        { label: '인문대학 인권위원회', desc: '@humanrights_inmun.cau', url: 'https://www.instagram.com/humanrights_inmun.cau/' }
      ]
    }
  ],

  /* ---- 학생회 소개 / 국(부서) ---- */
  about: {
    /* TODO: 학생회에서 실제로 쓰는 소개 문구로 바꿔주세요. */
    intro: '인문대학 제15대 학생회 ‘역’은 학우 여러분과 학교 사이를 잇습니다. 한 해 동안 여러분의 목소리가 실제 변화로 이어지도록 움직이겠습니다.',
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
    kakao: ''
  },

  /* ---- 공지 카테고리 (색상은 css 의 .tag--* 와 연결) ---- */
  categories: ['전체', '학사', '행사', '모집', '복지', '일반']
};

window.SITE = SITE;
