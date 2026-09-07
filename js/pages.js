/* ============================================================
   pages.js — 페이지별 렌더링 (body[data-page] 로 분기)
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, el, icon, loadNotices, noticeCard, renderMarkdown,
          formatDate, safeUrl, isExternal, tagEl, toast, revealOnScroll } = window.CORE;

  const S = window.SITE;

  /* ---------- 공통: 링크 버튼 ---------- */
  function linkButton(item) {
    const url = safeUrl(item.url);
    const ready = !!url;

    const label = el('div', { class: 'linkbtn__label' }, [
      item.label,
      item.badge && ready ? el('span', { class: 'badge', text: item.badge }) : null,
      !ready ? el('span', { class: 'badge badge--soon', text: '준비 중' }) : null
    ]);

    const attrs = ready
      ? { class: 'linkbtn', href: url, target: isExternal(url) ? '_blank' : null,
          rel: isExternal(url) ? 'noopener noreferrer' : null }
      : { class: 'linkbtn is-disabled', href: '#', 'aria-disabled': 'true', tabindex: '-1' };

    return el('a', attrs, [
      el('div', { class: 'linkbtn__body' }, [
        label,
        item.desc ? el('div', { class: 'linkbtn__desc', text: item.desc }) : null
      ]),
      el('span', { class: 'linkbtn__arrow', html: icon('arrow') })
    ]);
  }

  /* ---------- 공통: 빈 상태 / 오류 ---------- */
  const emptyBox = (title, sub) =>
    el('div', { class: 'empty' }, [el('strong', { text: title }), sub || '']);

  const errorBox = (msg) =>
    el('div', { class: 'banner banner--error' }, [
      el('strong', { text: '공지를 불러오지 못했습니다. ' }), msg
    ]);

  /* ==========================================================
     1) 홈
     ========================================================== */
  async function initHome() {
    /* 기본 텍스트 */
    const setText = (sel, value) => { const n = $(sel); if (n && value) n.textContent = value; };
    setText('[data-site="college"]', S.college);
    setText('[data-site="tagline"]', S.tagline);
    $$('[data-site="council"]').forEach((n) => { n.textContent = S.councilTerm; });
    $$('[data-site="name"]').forEach((n) => { n.textContent = S.councilName; });

    /* 빠른 실행 칩 */
    const quick = $('[data-quick]');
    if (quick) {
      S.quickLinks.forEach((q) => {
        const url = safeUrl(q.url);
        const node = url
          ? el('a', { class: 'chip', href: url, target: isExternal(url) ? '_blank' : null,
                      rel: isExternal(url) ? 'noopener noreferrer' : null },
              [el('span', { html: icon(q.icon), 'aria-hidden': 'true' }), q.label])
          : el('span', { class: 'chip is-disabled' }, [
              el('span', { html: icon(q.icon), 'aria-hidden': 'true' }),
              q.label,
              el('span', { class: 'chip__soon', text: '준비 중' })
            ]);
        quick.appendChild(node);
      });
    }

    /* 링크 모음 */
    const linkWrap = $('[data-links]');
    if (linkWrap) {
      S.linkGroups.forEach((g) => {
        linkWrap.appendChild(el('div', { class: 'linkgroup reveal' }, [
          el('h3', { class: 'linkgroup__title', text: g.group }),
          el('ul', { class: 'links' }, g.items.map((it) => el('li', null, [linkButton(it)])))
        ]));
      });
    }

    /* 학생회 소개 */
    const aboutIntro = $('[data-about-intro]');
    if (aboutIntro) aboutIntro.textContent = S.about.intro;
    const depts = $('[data-depts]');
    if (depts) {
      S.about.departments.forEach((d) => {
        depts.appendChild(el('li', { class: 'dept' }, [
          el('div', { class: 'dept__name', text: d.name }),
          el('div', { class: 'dept__desc', text: d.desc })
        ]));
      });
    }

    /* 푸터 */
    const place = $('[data-contact-place]');
    if (place) place.textContent = S.contact.place;
    const fLinks = $('[data-footer-links]');
    if (fLinks && S.contact.instagram) {
      fLinks.appendChild(el('a', {
        href: S.contact.instagram, target: '_blank', rel: 'noopener noreferrer', text: '인스타그램'
      }));
    }
    if (fLinks && S.contact.email) {
      fLinks.appendChild(el('a', { href: 'mailto:' + S.contact.email, text: '이메일 문의' }));
    }

    /* 최근 공지 */
    const box = $('[data-recent]');
    if (box) {
      try {
        const list = await loadNotices();
        box.innerHTML = '';
        if (!list.length) {
          box.appendChild(emptyBox('아직 등록된 공지가 없습니다.', '새 소식이 올라오면 이곳에 표시됩니다.'));
        } else {
          list.slice(0, 4).forEach((n) => box.appendChild(el('li', null, [noticeCard(n)])));
        }
      } catch (err) {
        box.innerHTML = '';
        box.appendChild(errorBox(err.message));
      }
    }

    revealOnScroll();
  }

  /* ==========================================================
     2) 공지 목록
     ========================================================== */
  async function initNoticeList() {
    const box    = $('[data-list]');
    const filters= $('[data-filters]');
    const input  = $('[data-search]');
    const count  = $('[data-count]');
    if (!box) return;

    let all = [];
    let cat = new URLSearchParams(location.search).get('cat') || '전체';
    let query = '';

    try {
      all = await loadNotices();
    } catch (err) {
      box.innerHTML = '';
      box.appendChild(errorBox(err.message));
      return;
    }

    /* 실제 사용된 카테고리만 노출 */
    const used = ['전체'].concat(
      S.categories.filter((c) => c !== '전체' && all.some((n) => n.category === c))
    );
    if (!used.includes(cat)) cat = '전체';

    if (filters) {
      used.forEach((c) => {
        filters.appendChild(el('button', {
          type: 'button', class: 'filter', 'aria-pressed': String(c === cat), 'data-cat': c, text: c,
          onclick: () => {
            cat = c;
            $$('.filter', filters).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === c)));
            const u = new URL(location.href);
            if (c === '전체') u.searchParams.delete('cat'); else u.searchParams.set('cat', c);
            history.replaceState(null, '', u);
            render();
          }
        }));
      });
    }

    if (input) {
      input.addEventListener('input', () => { query = input.value.trim().toLowerCase(); render(); });
    }

    function render() {
      const list = all.filter((n) => {
        if (cat !== '전체' && n.category !== cat) return false;
        if (!query) return true;
        return (n.title + ' ' + n.summary + ' ' + n.body).toLowerCase().includes(query);
      });

      if (count) count.textContent = `${list.length}건`;

      box.innerHTML = '';
      if (!list.length) {
        box.appendChild(el('li', null, [
          emptyBox(query ? '검색 결과가 없습니다.' : '해당하는 공지가 없습니다.',
                   query ? `‘${query}’ 와 일치하는 공지를 찾지 못했습니다.` : '다른 분류를 선택해 보세요.')
        ]));
        return;
      }
      list.forEach((n) => box.appendChild(el('li', null, [noticeCard(n)])));
    }

    render();
  }

  /* ==========================================================
     3) 공지 상세
     ========================================================== */
  async function initNoticeDetail() {
    const root = $('[data-article]');
    if (!root) return;

    const id = new URLSearchParams(location.search).get('id');
    let list;
    try {
      list = await loadNotices();
    } catch (err) {
      root.innerHTML = '';
      root.appendChild(errorBox(err.message));
      return;
    }

    const idx = list.findIndex((n) => n.id === id);
    const n = list[idx];

    if (!n) {
      document.title = '공지를 찾을 수 없습니다 · ' + S.college;
      root.innerHTML = '';
      root.appendChild(emptyBox('공지를 찾을 수 없습니다.', '삭제되었거나 주소가 잘못되었을 수 있습니다.'));
      const more = $('[data-adjacent]');
      if (more) more.appendChild(el('a', { class: 'btn', href: 'notices.html' }, ['전체 공지 보기']));
      return;
    }

    document.title = n.title + ' · ' + S.college + ' ' + S.councilTerm;
    const desc = $('meta[name="description"]');
    if (desc) desc.setAttribute('content', n.summary || n.title);

    root.innerHTML = '';
    root.appendChild(el('div', { class: 'article__meta' }, [
      n.pinned ? tagEl('고정', 'pin') : null,
      tagEl(n.category, null, n.category),
      n.sample ? tagEl('예시 데이터', 'sample') : null
    ]));
    root.appendChild(el('h1', { class: 'article__title', text: n.title }));
    root.appendChild(el('div', { class: 'article__sub' }, [
      el('time', { datetime: n.date, text: formatDate(n.date, { long: true }) }),
      el('span', { text: S.councilTerm + ' ‘' + S.councilName + '’' })
    ]));

    if (n.image) {
      root.appendChild(el('figure', { class: 'article__hero' }, [
        el('img', { src: n.image, alt: n.title + ' 안내 이미지', loading: 'lazy' })
      ]));
    }

    root.appendChild(el('div', { class: 'prose', html: renderMarkdown(n.body) }));

    if (n.links.length) {
      root.appendChild(el('div', { class: 'attachments' }, [
        el('div', { class: 'attachments__title', text: '관련 링크' }),
        el('ul', { class: 'links' }, n.links.map((l) =>
          el('li', null, [linkButton({ label: l.label, url: l.url, desc: '' })])))
      ]));
    }

    /* 공유 */
    const share = el('div', { class: 'share' });
    share.appendChild(el('button', {
      type: 'button', class: 'btn btn--primary',
      onclick: async () => {
        const data = { title: n.title, text: n.summary, url: location.href };
        try {
          if (navigator.share) { await navigator.share(data); return; }
          await navigator.clipboard.writeText(location.href);
          toast('링크를 복사했습니다');
        } catch (e) { /* 사용자가 취소한 경우 무시 */ }
      }
    }, [el('span', { html: icon('share'), 'aria-hidden': 'true' }), '공유하기']));
    share.appendChild(el('a', { class: 'btn', href: 'notices.html' }, ['전체 공지']));
    root.appendChild(share);

    /* 이전 / 다음 */
    const adj = $('[data-adjacent]');
    if (adj) {
      const prev = list[idx - 1];
      const next = list[idx + 1];
      if (prev) adj.appendChild(noticeCard(prev));
      if (next) adj.appendChild(noticeCard(next));
    }
  }

  /* ---------- 부팅 ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    window.CORE.boot();
    const page = document.body.dataset.page;
    if (page === 'home')        initHome();
    else if (page === 'notices') initNoticeList();
    else if (page === 'notice')  initNoticeDetail();
  });
})();
