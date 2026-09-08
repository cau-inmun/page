/* ============================================================
   core.js — 공통 유틸 / 데이터 로딩 / 렌더링 헬퍼
   ============================================================ */
(function () {
  'use strict';

  const DATA_URL = 'data/notices.json';

  /* ---------- DOM 헬퍼 ---------- */
  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      }
    }
    for (const c of [].concat(children || [])) {
      if (c === null || c === undefined || c === false) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* ---------- 안전한 URL 판별 ----------
     · javascript:, data: 같은 위험한 스킴은 링크로 만들지 않는다.
     · 'human.cau.ac.kr' 처럼 스킴을 생략한 외부 주소는 https 를 붙인다.
     · 'apply.html?id=suggestion' 같은 사이트 안 경로는 그대로 둔다.
       (예전에는 이런 상대 경로를 거부해서 '준비 중' 으로 표시했고,
        'apply.html' 은 'https://apply.html' 이라는 없는 주소로 바꿨다) */
  function safeUrl(raw) {
    const url = String(raw || '').trim();
    if (!url) return '';

    // 스킴이 있으면 허용 목록에 있는 것만 통과
    if (/^[a-z][a-z0-9+.\-]*:/i.test(url)) {
      return /^(https?|mailto|tel):/i.test(url) ? url : '';
    }

    // 경로·앵커·질의로 시작하면 사이트 안 주소
    if (/^(\/|\.\/|\.\.\/|#|\?)/.test(url)) return url;

    // 도메인처럼 생겼고 파일 이름이 아니면 외부 주소로 보고 https 를 붙인다
    const path = url.split(/[?#]/)[0];
    const looksLikeDomain = /^[\w-]+(\.[\w-]+)+(\/|$)/.test(url);
    const looksLikeFile = /\.(html?|php|aspx?|jsp|pdf|png|jpe?g|gif|svg|webp|json|css|js)$/i.test(path);
    if (looksLikeDomain && !looksLikeFile) return 'https://' + url;

    // 나머지는 사이트 안의 상대 경로
    return url;
  }

  const isExternal = (url) => /^https?:/i.test(url) && !url.startsWith(location.origin);

  /* ---------- 날짜 ---------- */
  function formatDate(iso, opts) {
    const d = new Date(String(iso) + (String(iso).length === 10 ? 'T00:00:00' : ''));
    if (isNaN(d)) return String(iso || '');
    const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    if (opts && opts.long) {
      const week = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
      return `${y}년 ${m}월 ${day}일 (${week})`;
    }
    return `${y}.${String(m).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
  }

  function relativeDate(iso) {
    const d = new Date(String(iso) + (String(iso).length === 10 ? 'T00:00:00' : ''));
    if (isNaN(d)) return '';
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days < 0) return '예정';
    if (days === 0) return '오늘';
    if (days === 1) return '어제';
    if (days < 7) return `${days}일 전`;
    return '';
  }

  /* ---------- 예약 · 보관 판정 ----------
     정적 사이트라 서버 스케줄러가 없다. 대신 '읽는 시점'에
     공개 여부를 판정한다. 시각은 ISO 8601 문자열로 다룬다. */

  /* datetime-local 입력값(현지 시각) → ISO 문자열 */
  function fromLocalInput(v) {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d) ? '' : d.toISOString();
  }

  /* ISO 문자열 → datetime-local 입력값(현지 시각) */
  function toLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
           `T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  /* 사람이 읽는 일시 — 예) 9월 10일(수) 오후 2:00 */
  function formatDateTime(iso, opts) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const week = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    const h = d.getHours();
    const ampm = h < 12 ? '오전' : '오후';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const time = `${ampm} ${h12}:${String(d.getMinutes()).padStart(2, '0')}`;
    const head = (opts && opts.year)
      ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일(${week})`
      : `${d.getMonth() + 1}월 ${d.getDate()}일(${week})`;
    return `${head} ${time}`;
  }

  /* ---------- 오류를 사람 말로 ----------
     화면에 '규칙이 배포되지 않았을 수 있습니다' 만 띄우면, 원인이 전혀
     다를 때 엉뚱한 곳을 고치게 된다. 실제로 그런 일이 있었다 —
     브라우저가 예전 js 파일을 들고 있어 함수가 없었는데, 화면에는
     권한 문제라고 떴다. 그래서 종류를 갈라 보여준다. */
  function describeError(err) {
    const code = (err && err.code) || '';
    const msg = String((err && err.message) || err || '');

    if (/is not a function|undefined is not|없는 함수/i.test(msg)) {
      return {
        kind: 'stale',
        title: '브라우저가 예전 파일을 들고 있습니다. ',
        text: '새로고침하면 해결됩니다. 윈도우는 Ctrl+Shift+R, 맥은 Cmd+Shift+R, ' +
              '휴대폰은 브라우저를 완전히 닫았다 열어보세요.',
        detail: msg
      };
    }
    if (code === 'permission-denied') {
      return {
        kind: 'denied',
        title: '권한이 없습니다. ',
        text: '관리자로 등록되지 않았거나 보안 규칙이 배포되지 않았습니다. ' +
              '연결 진단(setup.html)에서 어디가 막혔는지 확인하세요.',
        detail: code
      };
    }
    if (code === 'unavailable' || /network|offline/i.test(msg)) {
      return { kind: 'network', title: '서버에 닿지 못했습니다. ',
               text: '잠시 후 다시 시도해 주세요.', detail: code || msg };
    }
    return { kind: 'other', title: '문제가 생겼습니다. ',
             text: '아래 내용을 학생회 담당자에게 알려주세요.',
             detail: (code ? code + ' — ' : '') + msg };
  }

  /* 오류 상자를 그린다 (원인과 실제 메시지를 함께) */
  function errorBoxFor(err, what) {
    const d = describeError(err);
    return el('div', { class: 'banner banner--error' }, [
      el('strong', { text: (what ? what + ' ' : '') + d.title }),
      d.text,
      el('div', { style: 'margin-top:8px' }, [
        el('code', { style: 'font-size:11.5px; word-break:break-all', text: d.detail })
      ])
    ]);
  }

  /* ---------- 한국 시각 ----------
     열람실은 '오늘' 과 '09~21시' 를 기준으로 도는데, 보는 사람의 시계나
     시간대가 어긋나면 날짜가 하루 밀린다. 그래서 브라우저 지역 설정과
     무관하게 언제나 서울 시각으로 계산한다. */
  function seoulNow(when) {
    const d = when || new Date();
    try {
      const parts = {};
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul', hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }).formatToParts(d).forEach((p) => { parts[p.type] = p.value; });
      if (parts.year && parts.hour !== undefined) {
        return {
          date: parts.year + '-' + parts.month + '-' + parts.day,
          hour: Number(parts.hour) % 24,      // 자정을 24 로 주는 엔진이 있다
          minute: Number(parts.minute)
        };
      }
    } catch (e) { /* Intl 이 시간대를 모르면 아래로 */ }
    /* 대비책 — UTC 에 9시간을 더한다 (한국은 서머타임이 없어 항상 +9) */
    const k = new Date(d.getTime() + 9 * 3600 * 1000);
    const p2 = (n) => String(n).padStart(2, '0');
    return {
      date: k.getUTCFullYear() + '-' + p2(k.getUTCMonth() + 1) + '-' + p2(k.getUTCDate()),
      hour: k.getUTCHours(), minute: k.getUTCMinutes()
    };
  }

  /* 이름 가운데를 가린다. 홍길동 → 홍*동 / 남궁민수 → 남**수 / 김민 → 김* */
  function maskName(v) {
    const s = String(v || '').trim();
    if (s.length <= 1) return s;
    if (s.length === 2) return s[0] + '*';
    return s[0] + '*'.repeat(s.length - 2) + s[s.length - 1];
  }

  /* 학번은 앞 5자리만 남긴다. 20241234 → 20241 */
  function maskSid(v) {
    return String(v || '').replace(/\D/g, '').slice(0, 5);
  }

  const ts = (iso) => { const t = Date.parse(iso || ''); return isNaN(t) ? null : t; };

  /* 게시 상태 — 'scheduled' 게시 전 / 'live' 게시 중 / 'archived' 내려감
     공지와 폼이 같은 규칙을 쓴다. publishAt 전이면 예약, expireAt 이 지났거나
     archived 가 켜져 있으면 보관. */
  function scheduleStatus(o, now) {
    const at = now || Date.now();
    if (o.archived) return 'archived';
    const pub = ts(o.publishAt);
    if (pub !== null && pub > at) return 'scheduled';
    const exp = ts(o.expireAt);
    if (exp !== null && exp <= at) return 'archived';
    return 'live';
  }

  /* 공지 상태 — 'scheduled' 예약 / 'live' 게시 중 / 'archived' 보관 */
  function noticeStatus(n, now) { return scheduleStatus(n, now); }

  /* 폼 게시 상태 — 공지와 같은 규칙.
     '접수 기간' 과는 별개다. 게시 기간은 폼이 사이트에 보이는지,
     접수 기간은 그 폼이 응답을 받는지를 정한다. */
  function formVisibility(f, now) { return scheduleStatus(f, now); }

  /* 폼 접수 상태 — 'upcoming' 접수 전 / 'open' 접수 중 / 'closed' 마감
     게시되지 않은 폼은 접수도 열리지 않는다. 게시가 끝났는데 접수만
     열려 있는 상태를 만들지 않기 위해서다. */
  function formStatus(f, now) {
    const at = now || Date.now();
    const vis = formVisibility(f, at);
    if (vis === 'archived') return 'closed';
    if (vis === 'scheduled') return 'upcoming';
    if (f.open === false) return 'closed';
    const o = ts(f.openAt);
    if (o !== null && o > at) return 'upcoming';
    const c = ts(f.closeAt);
    if (c !== null && c <= at) return 'closed';
    return 'open';
  }

  const NOTICE_STATUS_LABEL = { scheduled: '예약', live: '게시 중', archived: '보관' };

  /* ---------- 아주 작은 마크다운 렌더러 ----------
     HTML 을 먼저 이스케이프한 뒤 제한된 문법만 다시 살립니다.
     지원: ## 소제목 / - 목록 / 1. 목록 / **굵게** / *기울임*
           [글자](주소) / > 인용 / --- 구분선                  */
  function renderMarkdown(src) {
    const text = String(src || '').replace(/\r\n?/g, '\n').trim();
    if (!text) return '';

    const inline = (s) => escapeHtml(s)
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
        const url = safeUrl(href.replace(/&amp;/g, '&'));
        if (!url) return escapeHtml(label);
        const ext = isExternal(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${escapeHtml(url)}"${ext}>${label}</a>`;
      })
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

    const out = [];
    const lines = text.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (!line.trim()) { i++; continue; }

      if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

      if (/^#{2,4}\s+/.test(line)) {
        out.push(`<h3>${inline(line.replace(/^#{2,4}\s+/, ''))}</h3>`);
        i++; continue;
      }

      if (/^>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
        out.push(`<blockquote>${inline(buf.join('\n')).replace(/\n/g, '<br>')}</blockquote>`);
        continue;
      }

      if (/^\s*[-*•]\s+/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
          buf.push(`<li>${inline(lines[i].replace(/^\s*[-*•]\s+/, ''))}</li>`); i++;
        }
        out.push(`<ul>${buf.join('')}</ul>`);
        continue;
      }

      if (/^\s*\d+[.)]\s+/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
          buf.push(`<li>${inline(lines[i].replace(/^\s*\d+[.)]\s+/, ''))}</li>`); i++;
        }
        out.push(`<ol>${buf.join('')}</ol>`);
        continue;
      }

      const para = [];
      while (i < lines.length && lines[i].trim() &&
             !/^(#{2,4}\s|>\s?|---+\s*$)/.test(lines[i]) &&
             !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        para.push(lines[i]); i++;
      }
      out.push(`<p>${inline(para.join('\n')).replace(/\n/g, '<br>')}</p>`);
    }

    return out.join('\n');
  }

  function plainText(src, limit) {
    const t = String(src || '')
      .replace(/\[([^\]\n]+)\]\([^)]*\)/g, '$1')
      .replace(/[#>*`_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return limit && t.length > limit ? t.slice(0, limit).trim() + '…' : t;
  }

  /* ---------- 공지 데이터 ---------- */
  let cache = null;

  async function loadNotices() {
    if (cache) return cache;

    /* 서버(Firestore)에 공지가 있으면 그쪽을 쓰고,
       없으면 저장소의 data/notices.json 으로 넘어간다. */
    let source = null;
    if (window.STORE) {
      try {
        await STORE.init();
        source = await STORE.getNotices();
      } catch (err) {
        console.warn('[공지] 서버에서 불러오지 못해 파일로 대체합니다.', err);
      }
    }
    if (!source) {
      const res = await fetch(DATA_URL + '?v=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('공지 데이터를 불러오지 못했습니다 (' + res.status + ')');
      const json = await res.json();
      source = Array.isArray(json) ? json : json.notices || [];
    }

    const list = source
      .filter((n) => n && n.title)
      .map((n, idx) => ({
        id: String(n.id || 'notice-' + idx),
        title: String(n.title),
        category: String(n.category || '일반'),
        date: String(n.date || ''),
        pinned: !!n.pinned,
        sample: !!n.sample,
        summary: String(n.summary || plainText(n.body, 90)),
        body: String(n.body || ''),
        image: safeUrl(n.image),
        publishAt: String(n.publishAt || ''),
        expireAt: String(n.expireAt || ''),
        archived: !!n.archived,
        links: (n.links || [])
          .map((l) => ({ label: String(l.label || '바로가기'), url: safeUrl(l.url) }))
          .filter((l) => l.url)
      }));

    list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return String(b.date).localeCompare(String(a.date));
    });

    cache = list;
    return list;
  }

  /* ---------- 아이콘 ---------- */
  const ICONS = {
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.6" cy="6.4" r="1.05" fill="currentColor" stroke="none"/></svg>',
    kakao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.6c-4.8 0-8.7 3-8.7 6.7 0 2.4 1.6 4.5 4.1 5.7l-.9 3.4a.4.4 0 0 0 .6.44l4-2.6c.3.03.6.05.9.05 4.8 0 8.7-3 8.7-6.7S16.8 3.6 12 3.6Z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="3"/><path d="m3.5 7 7.6 5.3a1.6 1.6 0 0 0 1.8 0L20.5 7"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13.6a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.3 1.3"/><path d="M14 10.4a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.3-1.3"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15.5V3.8"/><path d="m8 7.5 4-3.7 4 3.7"/><path d="M5.5 12.5v6a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-6"/></svg>'
  };
  const icon = (name) => ICONS[name] || ICONS.link;

  /* ---------- 태그 / 배지 ---------- */
  function tagEl(text, variant, cat) {
    const n = el('span', { class: 'tag' + (variant ? ' tag--' + variant : ''), text });
    if (cat) n.dataset.cat = cat;
    return n;
  }

  /* ---------- 공지 카드 ---------- */
  function noticeCard(n) {
    const status = noticeStatus(n);
    const meta = el('div', { class: 'notice__meta' }, [
      n.pinned && status === 'live' ? tagEl('고정', 'pin') : null,
      status === 'scheduled' ? tagEl('예약', 'scheduled') : null,
      status === 'archived' ? tagEl('지난 공지', 'archived') : null,
      tagEl(n.category, null, n.category),
      n.sample ? tagEl('예시 데이터', 'sample') : null,
      el('span', { class: 'notice__date', text: formatDate(n.date) + (relativeDate(n.date) ? ' · ' + relativeDate(n.date) : '') })
    ]);

    return el('a', { class: 'notice', href: 'notice.html?id=' + encodeURIComponent(n.id) }, [
      meta,
      el('div', { class: 'notice__title', text: n.title }),
      n.summary ? el('div', { class: 'notice__summary', text: n.summary }) : null
    ]);
  }

  /* ---------- 토스트 ---------- */
  let toastTimer;
  function toast(message) {
    let node = $('.toast');
    if (!node) { node = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(node); }
    node.textContent = message;
    node.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('is-on'), 2200);
  }

  /* ---------- 스크롤 등장 애니메이션 ---------- */
  function revealOnScroll(root) {
    const targets = $$('.reveal', root || document);
    if (!('IntersectionObserver' in window) || !targets.length) {
      targets.forEach((t) => t.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e, idx) => {
        if (!e.isIntersecting) return;
        e.target.style.transitionDelay = Math.min(idx * 60, 240) + 'ms';
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .06 });
    targets.forEach((t) => io.observe(t));

    /* 안전장치 — 어떤 이유로든 옵저버가 동작하지 않아도 본문은 반드시 보이게 한다 */
    setTimeout(() => targets.forEach((t) => {
      if (!t.classList.contains('is-in')) { t.style.transitionDelay = '0ms'; t.classList.add('is-in'); }
    }), 1200);
  }

  /* ---------- 상단바 그림자 ---------- */
  function stickyHeader() {
    const bar = $('.topbar');
    if (!bar) return;
    const onScroll = () => bar.classList.toggle('is-stuck', window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- 로고 fallback ---------- */
  function initLogos() {
    $$('[data-logo]').forEach((box) => {
      const img = $('img', box);
      if (!img) return;
      const fallback = () => {
        img.remove();
        box.classList.add('is-fallback');
        if (!$('.logo-fallback', box)) {
          box.appendChild(el('span', { class: 'logo-fallback', 'aria-hidden': 'true', text: (window.SITE && SITE.councilName) || '연' }));
        }
      };
      if (img.complete && img.naturalWidth === 0) fallback();
      img.addEventListener('error', fallback, { once: true });
    });
  }

  /* ---------- 웹폰트 로딩 점검 ----------
     글꼴이 안 보일 때 원인을 바로 알 수 있도록 콘솔에 알려준다.
     (실패해도 시스템 글꼴로 정상 표시되므로 화면에는 영향 없음) */
  function checkFonts() {
    if (!document.fonts || !document.fonts.ready) return;
    /* 애플 기기에서는 운영체제의 San Francisco 를 쓰므로 확인할 것이 없다.
       확인이 필요한 쪽은 그 대역으로 쓰는 프리텐다드뿐이다. */
    const want = [
      ['Pretendard Variable', '프리텐다드']
    ];
    document.fonts.ready.then(() => setTimeout(() => {
      /* check() 만으로는 부족하다. @font-face 규칙 자체가 등록되지 않으면
         (예: fonts.css 의 @import 가 실패한 경우) 브라우저가 시스템 글꼴로
         대체하면서 check() 가 true 를 돌려준다. 규칙 등록 여부도 함께 본다. */
      const registered = new Set();
      try { document.fonts.forEach((ff) => registered.add(ff.family.replace(/^["']|["']$/g, ''))); }
      catch (e) { /* 순회를 지원하지 않으면 이 검사만 건너뛴다 */ }

      const missing = want.filter(([family]) => {
        if (registered.size && !registered.has(family)) return true;
        try { return !document.fonts.check('700 16px "' + family + '"', '가'); }
        catch (e) { return false; }
      });
      if (!missing.length) return;
      console.warn(
        '[글꼴] 불러오지 못했습니다: ' + missing.map((m) => m[1]).join(', ') +
        '\n맥 · 아이폰에서는 운영체제의 San Francisco 를 쓰므로 화면에 차이가 없습니다.' +
        '\n윈도우 · 안드로이드에서만 시스템 글꼴로 바뀝니다.' +
        '\ncss/fonts.css 의 주소가 만료됐다면 아래에서 최신 코드를 가져와 교체하세요.' +
        '\n  프리텐다드  https://github.com/orioncactus/pretendard'
      );
    }, 400));
  }

  /* 상단바 이름을 설정값으로 채운다.
     HTML 에 기본 문구가 들어 있어 JS 가 없어도 보이고,
     관리자에서 이름을 바꾸면 이 함수가 덮어쓴다. */
  function applyBrand() {
    const b = (window.SITE && window.SITE.brand) || null;
    if (b) {
      $$('.topbar__name--long').forEach((n) => { if (b.long) n.textContent = b.long; });
      $$('.topbar__name--short').forEach((n) => { if (b.short) n.textContent = b.short; });
    }
    fitBrandName();
  }

  /* 상단바 이름을 자리에 맞춰 고른다.
     긴 이름 → 안 들어가면 짧은 이름 → 그것도 안 들어가면 감춘다.
     화면 폭 기준(중단점)으로 하지 않는 이유: 메뉴가 하나 늘거나 이름이
     길어지면 들어가는 폭이 달라지는데, 그때마다 중단점을 고쳐야 한다.
     실제로 메뉴에 '열람실' 을 넣자 긴 이름이 '중앙대학교 제15대 …' 로
     잘렸다. 재서 고르면 그런 일이 생기지 않는다. */
  function fitBrandName() {
    $$('.topbar__name').forEach((box) => {
      const brand = box.closest('.topbar__brand');
      const inner = box.closest('.topbar__inner');
      if (!brand || !inner) return;

      /* 이름 칸에 실제로 남는 폭을 직접 센다.
         box.scrollWidth 로는 알 수 없다 — 이미 잘린 폭을 그대로 돌려준다. */
      const nav = $('.nav', inner);
      const mark = $('.topbar__mark', brand);
      const gapOf = (el) => {
        const cs = getComputedStyle(el);
        return parseFloat(cs.columnGap || cs.gap) || 0;
      };
      /* clientWidth 에는 좌우 안쪽 여백이 포함된다. 그걸 빼지 않으면
         남는 폭을 40px 쯤 넉넉하게 잡아 이름이 잘린다. */
      const ics = getComputedStyle(inner);
      let avail = inner.clientWidth
                - parseFloat(ics.paddingLeft) - parseFloat(ics.paddingRight);
      if (nav) avail -= nav.getBoundingClientRect().width + gapOf(inner);
      if (mark) avail -= mark.getBoundingClientRect().width + gapOf(brand);
      avail -= 1;   // 반올림 여유

      const long = $('.topbar__name--long', box);
      const short = $('.topbar__name--short', box);
      const fits = (el) => el && textWidth(box, el.textContent) <= avail;

      box.classList.remove('is-short', 'is-hidden');
      if (short) {
        if (fits(long)) return;
        box.classList.add('is-short');
        if (fits(short)) return;
      } else if (textWidth(box, box.textContent) <= avail) {
        return;
      }
      box.classList.add('is-hidden');
    });
  }

  /* 글자가 실제로 몇 px 인지. 화면 밖에 같은 글꼴로 한 번 그려 재는 방식이라
     잘림 여부와 상관없이 정확하다. */
  function textWidth(ref, text) {
    const cs = getComputedStyle(ref);
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;white-space:nowrap';
    probe.style.fontFamily = cs.fontFamily;
    probe.style.fontSize = cs.fontSize;
    probe.style.fontWeight = cs.fontWeight;
    probe.style.fontStyle = cs.fontStyle;
    probe.style.letterSpacing = cs.letterSpacing;
    probe.textContent = String(text || '');
    document.body.appendChild(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return w;
  }

  /* 창 크기가 바뀌면 다시 고른다 (연달아 오는 이벤트는 한 번으로 묶는다) */
  function watchBrandFit() {
    let t = null;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(fitBrandName, 120);
    });
    /* 글꼴이 늦게 도착하면 글자 폭이 달라진다 */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fitBrandName).catch(() => {});
    }
  }

  /* ---------- 새 배포 스스로 받아오기 ----------
     GitHub Pages 는 파일을 한동안 캐시에 둔다. js·css·이미지에는 ?v= 를
     붙여 해결했지만, 정작 html 자체에는 붙일 수가 없다. 그래서 html 이
     옛것으로 남으면 그 안에 적힌 ?v= 도 옛것이라 모든 파일이 옛것이 된다.
     실제로 이 때문에 '고쳤는데 화면이 그대로' 가 여러 번 있었다.

     그래서 서버의 config.js 를 캐시를 건너뛰고 한 번 읽어 배포 번호를
     견줘본다. 다르면 주소에 표시를 붙여 새로 받아온다 (한 세션에 한 번).
     한 번 받아왔는데도 여전히 다르면, 그때는 사람이 손봐야 하므로
     화면에 알린다. */
  const RELOAD_KEY = 'cau-inmun:reloaded-for';

  async function checkForUpdate() {
    const mine = (window.SITE && window.SITE.APP_VERSION) || '';
    if (!mine || !window.fetch) return;

    let latest = '';
    try {
      const res = await fetch('js/config.js?fresh=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return;
      const m = (await res.text()).match(/APP_VERSION:\s*'([^']+)'/);
      latest = m ? m[1] : '';
    } catch (e) { return; }          // 못 읽으면 조용히 넘어간다
    if (!latest || latest === mine) return;

    let tried = '';
    try { tried = sessionStorage.getItem(RELOAD_KEY) || ''; } catch (e) { /* 무시 */ }
    if (tried !== latest) {
      try { sessionStorage.setItem(RELOAD_KEY, latest); } catch (e) { /* 무시 */ }
      const u = new URL(location.href);
      u.searchParams.set('_v', latest);
      location.replace(u.toString());
      return;
    }
    staleBanner(mine, latest);
  }

  function staleBanner(mine, latest) {
    if ($('#stale-bar')) return;
    document.body.insertBefore(el('div', {
      id: 'stale-bar', class: 'banner banner--error',
      style: 'position:sticky; top:0; z-index:60; border-radius:0; text-align:center'
    }, [
      el('strong', { text: '새 버전이 있는데 예전 화면이 열려 있습니다. ' }),
      '윈도우는 Ctrl+Shift+R, 맥은 Cmd+Shift+R 로 새로고침해 주세요. ',
      el('code', { text: mine + ' → ' + latest })
    ]), document.body.firstChild);
  }

  /* ---------- 공통 초기화 ---------- */
  function boot() {
    /* 먼저 config.js 기본값으로 그려두고 (JS 지연에도 빈 자리가 없게),
       저장된 설정을 불러온 뒤 한 번 더 덮어쓴다.
       STORE.init() 안에서 관리자가 저장한 이름을 가져오기 때문에,
       이 두 번째 호출이 없으면 상단바가 계속 기본값으로 남는다. */
    applyBrand();
    if (window.STORE) {
      STORE.init().then(applyBrand).catch(() => {});
    }
    checkForUpdate();
    watchBrandFit();
    stickyHeader();
    initLogos();
    revealOnScroll();
    checkFonts();
  }

  window.CORE = {
    $, $$, el, escapeHtml, safeUrl, isExternal,
    formatDate, relativeDate, formatDateTime, toLocalInput, fromLocalInput,
    seoulNow, maskName, maskSid, describeError, errorBoxFor,
    noticeStatus, formStatus, formVisibility, NOTICE_STATUS_LABEL,
    renderMarkdown, plainText,
    loadNotices, icon, ICONS, tagEl, noticeCard, toast, revealOnScroll, applyBrand, fitBrandName, checkForUpdate, boot
  };
})();
