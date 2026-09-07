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
     javascript:, data: 등 위험한 스킴은 링크로 만들지 않습니다. */
  function safeUrl(raw) {
    const url = String(raw || '').trim();
    if (!url) return '';
    if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
    if (/^(\/|\.\/|\.\.\/|#)/.test(url)) return url;
    if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(url)) return 'https://' + url; // 'human.cau.ac.kr' 처럼 스킴 생략 허용
    return '';
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
    const res = await fetch(DATA_URL + '?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('공지 데이터를 불러오지 못했습니다 (' + res.status + ')');
    const json = await res.json();
    const list = (Array.isArray(json) ? json : json.notices || [])
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
    const meta = el('div', { class: 'notice__meta' }, [
      n.pinned ? tagEl('고정', 'pin') : null,
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
          box.appendChild(el('span', { class: 'logo-fallback', 'aria-hidden': 'true', text: (window.SITE && SITE.councilName) || '역' }));
        }
      };
      if (img.complete && img.naturalWidth === 0) fallback();
      img.addEventListener('error', fallback, { once: true });
    });
  }

  /* ---------- 공통 초기화 ---------- */
  function boot() {
    stickyHeader();
    initLogos();
    revealOnScroll();
  }

  window.CORE = {
    $, $$, el, escapeHtml, safeUrl, isExternal,
    formatDate, relativeDate, renderMarkdown, plainText,
    loadNotices, icon, ICONS, tagEl, noticeCard, toast, revealOnScroll, boot
  };
})();
