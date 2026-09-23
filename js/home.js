/* Small public previews only: no Firebase SDK, article bodies, images or form fields. */
(function () {
  'use strict';
  const { $, $$, el, applyBrand, renderFooter } = window.CORE;
  const S = window.SITE;
  const cacheKey = 'cau-inmun:home-cache';
  const keys = ['brand', 'college', 'councilTerm', 'councilName', 'tagline', 'description', 'contact', 'homeNotices', 'homeForms'];

  function apply(value) {
    if (!value || typeof value !== 'object') return;
    keys.forEach((key) => { if (value[key] !== undefined && (value[key] !== null || key === 'homeNotices' || key === 'homeForms')) S[key] = value[key]; });
  }

  function render() {
    applyBrand();
    $$('[data-site="college"]').forEach((n) => { n.textContent = S.college; });
    $$('[data-site="council"]').forEach((n) => { n.textContent = S.councilTerm; });
    $$('[data-site="name"]').forEach((n) => { n.textContent = S.councilName; });
    const text = String(S.tagline || '').trim().replace(/학문을\s*잇다,\s*인문의\s*가치를\s*잇다/, '학문을 잇다,\n인문의 가치를 잇다');
    $('[data-site="tagline"]').replaceChildren(...text.split(/\r?\n/).filter(Boolean).map((line) =>
      el('span', { class: 'welcome__line', text: line })));
    document.title = `${S.college} ${S.councilTerm} ‘${S.councilName}’`;
    $('meta[name="description"]').content = S.description || '';
    renderFooter();
  }

  function decode(value) {
    if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, decode(v)]));
    if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return Number(value.doubleValue);
    if ('booleanValue' in value) return value.booleanValue;
    if ('timestampValue' in value) return value.timestampValue;
    if ('stringValue' in value) return value.stringValue;
    return null;
  }

  const base = 'https://firestore.googleapis.com/v1/projects/' +
    encodeURIComponent((window.FIREBASE_CONFIG || {}).projectId || '') + '/databases/(default)/documents/';
  const previewFields = ['title', 'date', 'category', 'publishAt', 'expireAt', 'archived', 'open', 'openAt', 'closeAt', 'order'];

  async function read(path, fields, params = {}) {
    const query = new URLSearchParams(params);
    fields.forEach((key) => query.append('mask.fieldPaths', key));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(base + path + '?' + query, { signal: controller.signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.json();
    } finally { clearTimeout(timeout); }
  }

  async function previews(collection, selected) {
    const docs = Array.isArray(selected)
      ? await Promise.all([...new Set(selected.filter((id) => typeof id === 'string' && id))].slice(0, 3).map(async (id) => {
          try { return await read(collection + '/' + encodeURIComponent(id), previewFields); }
          catch (error) { if (error.message === 'HTTP 404') return null; throw error; }
        }))
      : (await read(collection, previewFields, { pageSize: '6', orderBy: collection === 'notices' ? 'date desc' : 'order asc' })).documents || [];
    return docs.filter(Boolean).map((doc) => Object.assign(
      decode({ mapValue: { fields: doc.fields || {} } }), { id: doc.name.split('/').pop() }
    )).filter((item) => window.CORE.noticeStatus(item) === 'live').slice(0, 3);
  }

  async function renderPreviews() {
    await Promise.all(['notices', 'forms'].map(async (collection) => {
      const box = $('[data-home-' + collection + ']');
      try {
        const items = await previews(collection, S[collection === 'notices' ? 'homeNotices' : 'homeForms']);
        const isNotice = collection === 'notices';
        box.replaceChildren(...items.map((item) => el('a', {
          class: 'home-preview', href: (isNotice ? 'notice.html?id=' : 'apply.html?id=') + encodeURIComponent(item.id)
        }, [
          el('span', { class: 'home-preview__meta', text: isNotice ? (item.category || '공지') + (item.date ? ' · ' + item.date : '') : ({ open: '접수 중', upcoming: '접수 예정', closed: '접수 마감' })[window.CORE.formStatus(item)] }),
          el('strong', { text: item.title || '(제목 없음)' }),
          el('span', { class: 'home-preview__arrow', 'aria-hidden': 'true', text: '↗' })
        ])));
        if (!items.length) box.appendChild(el('p', { class: 'home-highlights__empty', text: '현재 메인에 표시할 항목이 없습니다. 전체 보기에서 확인해 주세요.' }));
      } catch (e) {
        box.replaceChildren(el('p', { class: 'home-highlights__empty', text: '목록을 불러오지 못했습니다. 전체 보기에서 다시 확인해 주세요.' }));
      }
    }));
  }

  async function refreshBranding() {
    const config = window.FIREBASE_CONFIG || {};
    if (!config.projectId) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      // Public document, subject to the same Firestore read rules as the SDK.
      const url = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(config.projectId) + '/databases/(default)/documents/config/site?' + keys.map((key) => 'mask.fieldPaths=' + encodeURIComponent(key)).join('&');
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return;
      const doc = await response.json();
      const value = decode({ mapValue: { fields: doc.fields || {} } });
      apply(value);
      render();
      try { localStorage.setItem(cacheKey, JSON.stringify(value)); } catch (e) {}
    } catch (e) {
      // Navigation and cached/default branding remain usable offline.
    } finally { clearTimeout(timeout); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    try { apply(JSON.parse(localStorage.getItem('cau-inmun:site-cache'))); } catch (e) {}
    try { apply(JSON.parse(localStorage.getItem(cacheKey))); } catch (e) {}
    window.CORE.boot();
    render();
    refreshBranding().finally(renderPreviews);
  });
})();
