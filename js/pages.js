/* ============================================================
   pages.js — 공지 목록과 상세 화면
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, el, icon, loadNotices, noticeCard, renderMarkdown,
          formatDate, formatDateTime, noticeStatus, linkButton,
          tagEl, toast, revealOnScroll } = window.CORE;

  const S = window.SITE;

  /* ---------- 공통: 빈 상태 / 오류 ---------- */
  const emptyBox = (title, sub) =>
    el('div', { class: 'empty' }, [el('strong', { text: title }), sub || '']);

  const errorBox = (msg) =>
    el('div', { class: 'banner banner--error' }, [
      el('strong', { text: '공지를 불러오지 못했습니다. ' }), msg
    ]);

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
      const actual = [...new Set(pool.map((n) => n.category).filter(Boolean))];
      const preferred = (S.categories || []).filter((c) => c !== '전체' && actual.includes(c));
      const used = ['전체', ...preferred, ...actual.filter((c) => !preferred.includes(c))];
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
    const page = document.body.dataset.page;
    if (page === 'notices') initNoticeList();
    else if (page === 'notice')  initNoticeDetail();
  });
})();
