/* The home only reads public branding. Lists and Firebase SDKs belong to detail pages. */
(function () {
  'use strict';
  const { $, $$, el, safeUrl, applyBrand } = window.CORE;
  const S = window.SITE;
  const cacheKey = 'cau-inmun:home-cache';
  const keys = ['brand', 'college', 'councilTerm', 'councilName', 'tagline', 'description', 'contact'];

  function apply(value) {
    if (!value || typeof value !== 'object') return;
    keys.forEach((key) => { if (value[key] != null) S[key] = value[key]; });
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
    const contact = S.contact || {};
    $('[data-contact-place]').textContent = contact.place || '';
    const links = $('[data-footer-links]');
    links.replaceChildren(el('a', { href: 'notices.html', text: '공지사항' }));
    [['instagram', '인스타그램'], ['kakao', '카카오톡 채널'], ['email', '이메일 문의']].forEach(([key, label]) => {
      const url = safeUrl(key === 'email' && contact[key] ? 'mailto:' + contact[key] : contact[key]);
      if (url) links.appendChild(el('a', { href: url, text: label, target: '_blank', rel: 'noopener noreferrer' }));
    });
  }

  function decode(value) {
    if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, decode(v)]));
    if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return Number(value.doubleValue);
    if ('booleanValue' in value) return value.booleanValue;
    if ('stringValue' in value) return value.stringValue;
    return null;
  }

  async function refreshBranding() {
    const config = window.FIREBASE_CONFIG || {};
    if (!config.projectId) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      // Public document, subject to the same Firestore read rules as the SDK.
      const url = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(config.projectId) + '/databases/(default)/documents/config/site';
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
    refreshBranding();
  });
})();
