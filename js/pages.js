/* ============================================================
   pages.js — 페이지별 렌더링 (body[data-page] 로 분기)
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, el, icon, loadNotices, noticeCard, renderMarkdown,
          formatDate, formatDateTime, noticeStatus, safeUrl, isExternal,
          tagEl, toast, revealOnScroll } = window.CORE;

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

  // Cached/default shortcuts are usable while the saved configuration loads.
  function renderQuickLinks() {
    const quick = $('[data-quick]');
    if (!quick) return;
    quick.innerHTML = '';
    (S.quickLinks || []).forEach((q) => {
      const url = safeUrl(q.url);
      const children = [
        el('span', { class: 'chip__icon', html: icon(q.icon), 'aria-hidden': 'true' }),
        el('span', { class: 'chip__label', text: q.label })
      ];
      if (!url) children.push(el('span', { class: 'chip__soon', text: '준비 중' }));
      quick.appendChild(url
        ? el('a', { class: 'chip', href: url,
            target: isExternal(url) ? '_blank' : null,
            rel: isExternal(url) ? 'noopener noreferrer' : null }, children)
        : el('span', { class: 'chip is-disabled' }, children));
    });
  }

  /* ==========================================================
     1) 홈
     ========================================================== */
  function renderTagline() {
    const title = $('[data-site="tagline"]');
    if (!title || !S.tagline) return;
    // Keep the council's two-line slogan even when the saved value has no newline.
    // Other slogans still respect line breaks entered in the site editor.
    const value = S.tagline.trim().replace(/학문을\s*잇다,\s*인문의\s*가치를\s*잇다/, '학문을 잇다,\n인문의 가치를 잇다');
    title.replaceChildren(...value.split(/\r?\n/).filter((line) => line.trim()).map((line) =>
      el('span', { class: 'welcome__line', text: line.trim() })));
  }

  async function initHome() {
    renderTagline();
    renderQuickLinks();
    /* 저장된 사이트 정보를 먼저 반영한다 (없으면 config.js 기본값) */
    if (window.STORE) { try { await STORE.init(); } catch (e) {} }

    /* 기본 텍스트 */
    $$('[data-site="college"]').forEach((n) => { n.textContent = S.college; });
    renderTagline();
    $$('[data-site="council"]').forEach((n) => { n.textContent = S.councilTerm; });
    $$('[data-site="name"]').forEach((n) => { n.textContent = S.councilName; });
    document.title = `${S.college} ${S.councilTerm} ‘${S.councilName}’`;
    const metaDesc = $('meta[name="description"]');
    if (metaDesc && S.description) metaDesc.setAttribute('content', S.description);

    renderQuickLinks();

    /* 링크 모음 — 서버에 등록된 게 있으면 그걸, 없으면 config.js 기본값 */
    const linkWrap = $('[data-links]');
    if (linkWrap) {
      let groups = S.linkGroups;
      if (window.STORE) {
        try { await STORE.init(); groups = await STORE.getLinks(); }
        catch (err) { console.warn('[링크] 서버에서 불러오지 못해 기본값을 씁니다.', err); }
      }
      linkWrap.innerHTML = '';
      groups.forEach((g, i) => {
        linkWrap.appendChild(el('section', { class: 'linkgroup reveal', 'aria-labelledby': `link-group-${i}` }, [
          el('h2', { class: 'directory-title linkgroup__title', id: `link-group-${i}`, text: g.group }),
          el('ul', { class: 'links' }, g.items.map((it) => el('li', null, [linkButton(it)])))
        ]));
      });
    }

    /* 학생회 소개 */
    const aboutIntro = $('[data-about-intro]');
    if (aboutIntro) aboutIntro.textContent = S.about.intro;

    /* 집행부 · 국 — 관리자에서 저장한 구성이 있으면 그것이 쓰인다
       (store 의 SITE_KEYS 에 about 이 들어 있어 서버 값이 config.js 를 덮는다) */
    const depts = $('[data-depts]');
    if (depts) {
      const list = (S.about && S.about.departments) || [];
      depts.innerHTML = '';
      if (!list.length) {
        depts.replaceWith(emptyBox('집행부 구성을 준비하고 있습니다.',
          '정해지는 대로 이곳에 올라갑니다.'));
      } else {
        list.forEach((d) => {
          depts.appendChild(el('li', { class: 'dept reveal' }, [
            el('div', { class: 'dept__name', text: d.name }),
            el('div', { class: 'dept__desc', text: d.desc })
          ]));
        });
      }
    }

    /* 사업 · 행사 — 아직 자료가 없다.
       TODO: js/config.js 에 programs: [{ title, when, desc, url }] 를 넣으면
             이 자리에 카드로 뜹니다. 없는 행사를 지어내지 않으려고 비워 둡니다. */
    const programs = $('[data-programs]');
    if (programs) {
      const list = (S.programs || []);
      programs.innerHTML = '';
      if (!list.length) {
        programs.appendChild(emptyBox('올해 사업 · 행사를 준비하고 있습니다.',
          '일정이 정해지면 이곳과 공지사항에 함께 올리겠습니다.'));
      } else {
        programs.appendChild(el('ul', { class: 'cards' }, list.map((p) =>
          el('li', { class: 'card reveal' }, [
            p.when ? el('div', { class: 'card__when', text: p.when }) : null,
            el('div', { class: 'card__title', text: p.title }),
            p.desc ? el('div', { class: 'card__desc', text: p.desc }) : null
          ]))));
      }
    }

    /* 인문대학 학과 — 누르면 각 학과 홈페이지로 간다.
       주소가 비어 있으면 링크 대신 그냥 이름만 보여준다 (죽은 링크를
       누르게 하지 않는다). */
    const majors = $('[data-majors]');
    if (majors) {
      majors.innerHTML = '';
      (S.majors || []).forEach((m) => {
        const url = safeUrl(m.url);
        majors.appendChild(el('li', { class: 'reveal' }, [
          url
            ? el('a', { class: 'major', href: url,
                        target: isExternal(url) ? '_blank' : null,
                        rel: isExternal(url) ? 'noopener noreferrer' : null }, [
                el('span', { class: 'major__name', text: m.name }),
                el('span', { class: 'major__arrow', 'aria-hidden': 'true', text: '↗' })
              ])
            : el('span', { class: 'major is-plain', text: m.name })
        ]));
      });
    }

    /* 푸터 */
    const place = $('[data-contact-place]');
    if (place) {
      /* 설정의 줄바꿈을 그대로 살린다. textContent 로 넣어 이스케이프는 유지 */
      place.innerHTML = '';
      String(S.contact.place || '').split('\n').forEach((line, i) => {
        if (i) place.appendChild(document.createElement('br'));
        place.appendChild(document.createTextNode(line));
      });
    }
    const fLinks = $('[data-footer-links]');
    if (fLinks && S.contact.instagram) {
      fLinks.appendChild(el('a', {
        href: S.contact.instagram, target: '_blank', rel: 'noopener noreferrer', text: '인스타그램'
      }));
    }
    if (fLinks && S.contact.kakao) {
      fLinks.appendChild(el('a', {
        href: S.contact.kakao, target: '_blank', rel: 'noopener noreferrer', text: '카카오톡 채널'
      }));
    }
    if (fLinks && S.contact.email) {
      fLinks.appendChild(el('a', { href: 'mailto:' + S.contact.email, text: '이메일 문의' }));
    }

    /* 최근 공지 */
    const box = $('[data-recent]');
    if (box) {
      try {
        const list = (await loadNotices()).filter((n) => noticeStatus(n) === 'live');
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

    if (window.STORE) { try { await STORE.init(); } catch (e) {} }
    let all = [];
    const params = new URLSearchParams(location.search);
    let cat = params.get('cat') || '전체';
    let view = params.get('view') === 'archive' ? 'archive' : 'live';
    let query = '';

    try {
      all = await loadNotices();
    } catch (err) {
      box.innerHTML = '';
      box.appendChild(errorBox(err.message));
      return;
    }

    /* 예약 중인 공지는 공개 목록에서 아예 뺀다 */
    all = all.filter((n) => noticeStatus(n) !== 'scheduled');

    const inView = () => all.filter((n) =>
      view === 'archive' ? noticeStatus(n) === 'archived' : noticeStatus(n) === 'live');

    /* 현재 / 지난 공지 전환 */
    const seg = $('[data-view]');
    if (seg) {
      [['live', '현재 공지'], ['archive', '지난 공지']].forEach(([v, label]) => {
        seg.appendChild(el('button', {
          type: 'button', class: 'seg', 'aria-pressed': String(v === view), 'data-v': v,
          text: label,
          onclick: () => {
            view = v;
            $$('.seg', seg).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
            const u = new URL(location.href);
            if (v === 'live') u.searchParams.delete('view'); else u.searchParams.set('view', v);
            history.replaceState(null, '', u);
            buildFilters();
            render();
          }
        }));
      });
    }

    /* 실제 사용된 카테고리만 노출 */
    const filters2 = filters;
    function buildFilters() {
      if (!filters2) return;
      const pool = inView();
      const used = ['전체'].concat(
        S.categories.filter((c) => c !== '전체' && pool.some((n) => n.category === c))
      );
      if (!used.includes(cat)) cat = '전체';
      filters2.innerHTML = '';
      used.forEach((c) => {
        filters2.appendChild(el('button', {
          type: 'button', class: 'filter', 'aria-pressed': String(c === cat), 'data-cat': c, text: c,
          onclick: () => {
            cat = c;
            $$('.filter', filters2).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === c)));
            const u = new URL(location.href);
            if (c === '전체') u.searchParams.delete('cat'); else u.searchParams.set('cat', c);
            history.replaceState(null, '', u);
            render();
          }
        }));
      });
    }
    buildFilters();

    if (input) {
      input.addEventListener('input', () => { query = input.value.trim().toLowerCase(); render(); });
    }

    function render() {
      const list = inView().filter((n) => {
        if (cat !== '전체' && n.category !== cat) return false;
        if (!query) return true;
        return (n.title + ' ' + n.summary + ' ' + n.body).toLowerCase().includes(query);
      });

      if (count) count.textContent = `${list.length}건`;

      box.innerHTML = '';
      if (!list.length) {
        box.appendChild(el('li', null, [
          query
            ? emptyBox('검색 결과가 없습니다.', `‘${query}’ 와 일치하는 공지를 찾지 못했습니다.`)
            : view === 'archive'
              ? emptyBox('보관된 공지가 없습니다.', '게시 기간이 끝난 공지가 이곳에 모입니다.')
              : emptyBox('해당하는 공지가 없습니다.', '다른 분류를 선택해 보세요.')
        ]));
        return;
      }
      list.forEach((n) => box.appendChild(el('li', null, [noticeCard(n)])));
      /* 카드는 여기서 만들어진다. core 의 boot() 가 부르는 revealOnScroll()
         은 그보다 먼저 돌아서 이 카드들을 못 본다. 부르지 않으면 카드가
         흐린 채로 영영 남는다 — 실제로 그렇게 만들어 놓고 한동안 몰랐다. */
      revealOnScroll(box);
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
      root.appendChild(el('h1', { class: 'article__title', text: '공지를 불러오지 못했습니다' }));
      root.appendChild(errorBox(err.message));
      return;
    }

    /* 예약 중인 공지는 주소를 알아도 열리지 않게 한다 */
    list = list.filter((x) => noticeStatus(x) !== 'scheduled');

    const idx = list.findIndex((n) => n.id === id);
    const n = list[idx];

    if (!n) {
      document.title = '공지를 찾을 수 없습니다 · ' + S.college;
      root.innerHTML = '';
      root.appendChild(el('h1', { class: 'article__title', text: '공지를 찾을 수 없습니다' }));
      root.appendChild(emptyBox('찾으시는 공지가 없습니다.', '삭제되었거나 주소가 잘못되었을 수 있습니다.'));
      const more = $('[data-adjacent]');
      if (more) more.appendChild(el('a', { class: 'btn', href: 'notices.html' }, ['전체 공지 보기']));
      return;
    }

    document.title = n.title + ' · ' + S.college + ' ' + S.councilTerm;
    const desc = $('meta[name="description"]');
    if (desc) desc.setAttribute('content', n.summary || n.title);

    const status = noticeStatus(n);

    root.innerHTML = '';
    root.appendChild(el('div', { class: 'article__meta' }, [
      n.pinned && status === 'live' ? tagEl('고정', 'pin') : null,
      status === 'archived' ? tagEl('지난 공지', 'archived') : null,
      tagEl(n.category, null, n.category),
      n.sample ? tagEl('예시 데이터', 'sample') : null
    ]));
    root.appendChild(el('h1', { class: 'article__title', text: n.title }));
    root.appendChild(el('div', { class: 'article__sub' }, [
      el('time', { datetime: n.date, text: formatDate(n.date, { long: true }) }),
      el('span', { text: S.councilTerm + ' ‘' + S.councilName + '’' })
    ]));

    if (status === 'archived') {
      root.appendChild(el('div', { class: 'banner', style: 'margin-top:18px' }, [
        el('strong', { text: '게시 기간이 끝난 공지입니다. ' }),
        n.expireAt
          ? formatDateTime(n.expireAt, { year: true }) + ' 에 보관되었습니다. 내용이 현재와 다를 수 있습니다.'
          : '내용이 현재와 다를 수 있습니다.'
      ]));
    }

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
