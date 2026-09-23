/* 학사·학과 링크와 학생회 소개: 기본 내용을 즉시 그린 뒤 공개 설정만 가볍게 읽는다. */
(function () {
  'use strict';

  const { $, el, icon, linkButton, safeUrl, isExternal, applyBrand,
          renderFooter, decodeFirestore } = window.CORE;
  const S = window.SITE;
  const siteCacheKey = 'cau-inmun:site-cache';
  const linksCacheKey = 'cau-inmun:links-cache';
  const siteKeys = ['brand', 'college', 'councilTerm', 'councilName', 'description',
                    'quickLinks', 'quickLinksSeen', 'about', 'contact', 'categories'];

  function cached(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function remember(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 저장 불가 시 기본값 사용 */ }
  }

  function applySite(value) {
    if (!value || typeof value !== 'object') return;
    siteKeys.forEach((key) => {
      if (value[key] !== undefined && value[key] !== null) S[key] = value[key];
    });
    /* 관리자에 저장된 빠른 링크가 있어도 새 기본 링크는 한 번만 추가한다. */
    const defaults = (window.SITE_DEFAULTS || {}).quickLinks || [];
    const links = (S.quickLinks || []).slice();
    const have = new Set(links.map((item) => item.url));
    const seen = new Set(value.quickLinksSeen || links.map((item) => item.url));
    defaults.forEach((item) => {
      if (item.url && !have.has(item.url) && !seen.has(item.url)) links.push(item);
    });
    S.quickLinks = links;
  }

  function renderQuickLinks() {
    const root = $('[data-quick]');
    if (!root) return;
    root.replaceChildren(...(S.quickLinks || []).map((item) => {
      const url = safeUrl(item.url);
      const children = [
        el('span', { class: 'chip__icon', html: icon(item.icon), 'aria-hidden': 'true' }),
        el('span', { class: 'chip__label', text: item.label })
      ];
      if (!url) children.push(el('span', { class: 'chip__soon', text: '준비 중' }));
      const external = url && isExternal(url);
      return url
        ? el('a', { class: 'chip', href: url, target: external ? '_blank' : null,
            rel: external ? 'noopener noreferrer' : null }, children)
        : el('span', { class: 'chip is-disabled' }, children);
    }));
  }

  function renderGroups(groups) {
    const root = $('[data-links]');
    if (!root) return;
    root.replaceChildren(...(groups || []).map((group, index) =>
      el('section', { class: 'linkgroup', 'aria-labelledby': `link-group-${index}` }, [
        el('h2', { class: 'directory-title linkgroup__title', id: `link-group-${index}`, text: group.group }),
        el('ul', { class: 'links' }, (group.items || []).map((item) => el('li', null, [linkButton(item)])))
      ])));
  }

  function majorLink(item, child) {
    const url = safeUrl(item.url);
    const classes = 'major' + (child ? ' major--child' : '') + (!url ? ' is-plain' : '');
    const children = [
      el('span', { class: 'major__name', text: item.name }),
      url ? el('span', { class: 'major__arrow', 'aria-hidden': 'true', text: '↗' }) : null
    ];
    if (!url) return el('span', { class: classes }, children);
    const external = isExternal(url);
    return el('a', { class: classes, href: url, target: external ? '_blank' : null,
      rel: external ? 'noopener noreferrer' : null }, children);
  }

  function renderMajors() {
    const root = $('[data-majors]');
    if (!root) return;
    root.replaceChildren(...(S.majors || []).map((item) => {
      const children = item.children;
      if (!Array.isArray(children) || !children.length) {
        return el('li', { class: 'major-item' }, [majorLink(item, false)]);
      }
      return el('li', { class: 'major-item' }, [
        el('details', { class: 'major-group' }, [
          el('summary', { class: 'major major--summary' }, [
            el('span', { class: 'major__name', text: item.name }),
            el('span', { class: 'major__chevron', 'aria-hidden': 'true', text: '⌄' })
          ]),
          el('ul', { class: 'major-children' }, children.map((child) =>
            el('li', null, [majorLink(child, true)])))
        ])
      ]);
    }));
  }

  function renderAbout() {
    const intro = $('[data-about-intro]');
    if (intro) intro.textContent = (S.about || {}).intro || '';

    const depts = $('[data-depts]');
    if (depts) {
      const items = (S.about || {}).departments || [];
      depts.replaceChildren(...(items.length ? items.map((item) =>
        el('li', { class: 'dept' }, [
          el('div', { class: 'dept__name', text: item.name }),
          el('div', { class: 'dept__desc', text: item.desc })
        ])) : [el('li', { class: 'empty', text: '집행부 구성을 준비하고 있습니다.' })]));
    }

    const programs = $('[data-programs]');
    if (programs) {
      const items = S.programs || [];
      programs.replaceChildren(...(items.length ? [el('ul', { class: 'cards' }, items.map((item) =>
        el('li', { class: 'card' }, [
          item.when ? el('div', { class: 'card__when', text: item.when }) : null,
          el('div', { class: 'card__title', text: item.title }),
          item.desc ? el('div', { class: 'card__desc', text: item.desc }) : null
        ])))] : [el('div', { class: 'empty' }, [
          el('strong', { text: '올해 사업 · 행사를 준비하고 있습니다.' }),
          '일정이 정해지면 이곳과 공지사항에 함께 올리겠습니다.'
        ])]));
    }
  }

  function renderSite() {
    applyBrand();
    renderFooter();
    renderQuickLinks();
    renderAbout();
    const page = document.body.dataset.page;
    if (page === 'links' || page === 'about') {
      document.title = `${page === 'links' ? '학사 · 학과 링크' : '학생회 소개'} · ${S.college}`;
      const meta = $('meta[name="description"]');
      if (meta && S.description) meta.content = S.description;
    }
  }

  async function readPublicConfig(name, fields) {
    const project = (window.FIREBASE_CONFIG || {}).projectId;
    if (!project) return null;
    const query = new URLSearchParams();
    fields.forEach((field) => query.append('mask.fieldPaths', field));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/config/${name}?${query}`;
      const response = await fetch(url, { signal: controller.signal });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const doc = await response.json();
      return decodeFirestore({ mapValue: { fields: doc.fields || {} } });
    } finally { clearTimeout(timeout); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    applySite(cached(siteCacheKey) || cached('cau-inmun:site'));
    window.CORE.boot();
    renderSite();
    renderMajors();

    const savedLinks = cached(linksCacheKey) || cached('cau-inmun:links');
    renderGroups(Array.isArray(savedLinks) ? savedLinks : S.linkGroups);

    readPublicConfig('site', siteKeys).then((value) => {
      if (!value) return;
      applySite(value);
      remember(siteCacheKey, value);
      renderSite();
    }).catch(() => { /* 기본값이나 최근 저장값을 계속 보여준다. */ });

    if ($('[data-links]')) {
      readPublicConfig('links', ['groups']).then((value) => {
        if (!value || !Array.isArray(value.groups) || !value.groups.length) return;
        remember(linksCacheKey, value.groups);
        renderGroups(value.groups);
      }).catch(() => { /* 연결이 끊겨도 링크 기본값은 바로 사용할 수 있다. */ });
    }
  });
})();
