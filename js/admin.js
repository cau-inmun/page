/* ============================================================
   admin.js — 관리자 콘솔
     · 공지 관리   · 폼 응답 확인   · 폼 설정   · 링크 관리
   Firebase 가 연결돼 있으면 로그인 후 실시간으로 반영되고,
   아니면 이 브라우저에만 저장되는 미리보기 모드로 동작합니다.
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, el, toast, tagEl, renderMarkdown, formatDate, formatDateTime,
          toLocalInput, fromLocalInput, noticeStatus, formStatus, formVisibility,
          plainText, seoulNow, errorBoxFor } = window.CORE;
  const S = window.SITE;

  let notices = [], forms = [], linkGroups = [], subs = [];
  let editingNoticeId = null;
  let activeFormId = null;

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ==========================================================
     로그인 / 화면 전환
     ========================================================== */
  function showApp(user) {
    $('#login').hidden = true;
    $('#console').hidden = false;

    const who = $('#who');
    who.innerHTML = '';
    if (STORE.isFirebase) {
      who.append(
        el('span', { class: 'pill', text: '서버 연결됨' }),
        el('span', { text: user ? user.email : '' })
      );
      $('#btn-signout').hidden = false;
    } else {
      who.append(
        el('span', { class: 'pill pill--local', text: '미리보기 모드' }),
        el('span', { text: '입력한 내용은 이 브라우저에만 저장됩니다' })
      );
      $('#btn-signout').hidden = true;
    }
    loadAll();
  }

  function showLogin(message) {
    $('#console').hidden = true;
    $('#login').hidden = false;
    const box = $('#login-error');
    box.hidden = !message;
    box.textContent = message || '';
  }

  /* ==========================================================
     데이터 불러오기
     ========================================================== */
  async function loadAll() {
    try {
      const [n, f, l] = await Promise.all([
        STORE.getNotices({ all: true }),
        STORE.getForms(),
        STORE.getLinks()
      ]);
      notices = n || (await fetchSeedNotices());
      forms = f || [];
      linkGroups = l || [];
    } catch (err) {
      console.error(err);
      showLoadError(err);
      return;
    }
    $('#load-error').hidden = true;
    sortNotices();
    renderNoticeList();
    renderFormTabs();
    renderFormSettings();
    renderArchive();
    renderSite();
    renderLinks();
    await loadSubs();
  }

  /* 데이터를 못 읽었을 때, 왜 그런지와 무엇을 해야 하는지를 화면에 남긴다.
     가장 흔한 원인은 로그인은 됐지만 admins 에 등록되지 않은 경우인데,
     이때 '불러오지 못했습니다' 만 띄우면 원인을 알 길이 없다. */
  function showLoadError(err) {
    const code = (err && err.code) || '';
    const user = STORE.auth.user;
    const box = $('#load-error');
    box.hidden = false;
    box.innerHTML = '';

    if (code === 'permission-denied') {
      box.append(
        el('strong', { text: '관리자로 등록되지 않은 계정입니다. ' }),
        '로그인은 됐지만 Firestore 가 데이터 접근을 막았습니다. ',
        el('br'),
        'Firebase 콘솔 → Firestore Database → 데이터 → ',
        el('code', { text: 'admins' }),
        ' 컬렉션에 아래 UID 를 문서 ID 로 하는 문서를 만들어 주세요.'
      );
      if (user) {
        box.append(el('div', { style: 'margin-top:10px' }, [
          el('code', { text: user.uid }),
          el('button', {
            type: 'button', class: 'rowbtn', style: 'margin-left:8px',
            text: 'UID 복사',
            onclick: async () => {
              try { await navigator.clipboard.writeText(user.uid); toast('복사했습니다'); }
              catch (e) { toast('복사 실패. 직접 선택해 주세요'); }
            }
          })
        ]));
      }
      box.append(el('div', { style: 'margin-top:10px' }, [
        el('a', { class: 'btn', href: 'setup.html' }, ['연결 진단 열기'])
      ]));
    } else {
      box.append(
        el('strong', { text: '데이터를 불러오지 못했습니다. ' }),
        code ? `(${code}) ` : '',
        '보안 규칙이 배포되지 않았거나 네트워크 문제일 수 있습니다. ',
        el('a', { href: 'setup.html' }, ['연결 진단']),
        ' 에서 원인을 확인하세요.'
      );
    }
  }

  async function fetchSeedNotices() {
    try {
      const res = await fetch('data/notices.json?v=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return [];
      const j = await res.json();
      return j.notices || [];
    } catch (e) { return []; }
  }

  /* ==========================================================
     탭 1 · 공지
     ========================================================== */
  const nf = {};
  ['title', 'category', 'date', 'pinned', 'summary', 'body', 'image',
   'linkLabel', 'linkUrl', 'publish', 'expire'].forEach((k) => { nf[k] = null; });

  function bindNoticeForm() {
    nf.title = $('#n-title'); nf.category = $('#n-category'); nf.date = $('#n-date');
    nf.pinned = $('#n-pinned'); nf.summary = $('#n-summary'); nf.body = $('#n-body');
    nf.image = $('#n-image'); nf.linkLabel = $('#n-link-label'); nf.linkUrl = $('#n-link-url');
    nf.publish = $('#n-publish'); nf.expire = $('#n-expire');

    S.categories.filter((c) => c !== '전체').forEach((c) =>
      nf.category.appendChild(el('option', { value: c, text: c })));

    Object.values(nf).forEach((f) => f && f.addEventListener('input', previewNotice));
    nf.category.addEventListener('change', previewNotice);
    nf.pinned.addEventListener('change', previewNotice);

    $('#n-save').addEventListener('click', saveNotice);
    $('#n-cancel').addEventListener('click', resetNoticeForm);
    $('#n-clear-samples').addEventListener('click', async () => {
      const before = notices.length;
      const keep = notices.filter((n) => !n.sample);
      if (before === keep.length) { toast('예시 공지가 없습니다'); return; }
      notices = keep;
      await STORE.replaceNotices(notices);
      renderNoticeList();
      toast(`예시 공지 ${before - keep.length}건을 지웠습니다`);
    });
    $('#n-download').addEventListener('click', downloadNoticesJson);
  }

  function slugify(title, date) {
    const base = String(title).toLowerCase()
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/[^가-힣a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 40);
    return (date || new Date().toISOString().slice(0, 10)) + (base ? '-' + base : '');
  }

  function readNotice() {
    const title = nf.title.value.trim();
    const date = nf.date.value || new Date().toISOString().slice(0, 10);
    const body = nf.body.value.trim();
    const links = [];
    if (nf.linkUrl.value.trim()) {
      links.push({ label: nf.linkLabel.value.trim() || '바로가기', url: nf.linkUrl.value.trim() });
    }
    return {
      id: editingNoticeId || slugify(title, date),
      title, category: nf.category.value, date,
      pinned: nf.pinned.checked,
      summary: nf.summary.value.trim() || plainText(body, 90),
      body, image: nf.image.value.trim(), links,
      publishAt: fromLocalInput(nf.publish.value),
      expireAt: fromLocalInput(nf.expire.value),
      archived: !!(editingNoticeId && (notices.find((x) => x.id === editingNoticeId) || {}).archived)
    };
  }

  function fillNotice(n) {
    nf.title.value = n.title || '';
    nf.category.value = n.category || '일반';
    nf.date.value = n.date || '';
    nf.pinned.checked = !!n.pinned;
    nf.summary.value = n.summary || '';
    nf.body.value = n.body || '';
    nf.image.value = n.image || '';
    nf.linkLabel.value = (n.links && n.links[0] && n.links[0].label) || '';
    nf.linkUrl.value = (n.links && n.links[0] && n.links[0].url) || '';
    nf.publish.value = toLocalInput(n.publishAt);
    nf.expire.value = toLocalInput(n.expireAt);
  }

  function resetNoticeForm() {
    editingNoticeId = null;
    fillNotice({ date: new Date().toISOString().slice(0, 10), category: '일반' });
    $('#n-mode').textContent = '새 공지 작성';
    $('#n-save').textContent = '공지 올리기';
    $('#n-cancel').hidden = true;
    previewNotice();
  }

  function previewNotice() {
    const n = readNotice();
    const box = $('#n-preview');
    box.innerHTML = '';
    if (!n.title && !n.body) {
      box.appendChild(el('p', { class: 'linkbtn__desc', text: '제목과 내용을 입력하면 실제 화면 그대로 보여줍니다.' }));
      return;
    }
    box.append(
      el('div', { class: 'article__meta' }, [
        n.pinned ? tagEl('고정', 'pin') : null, tagEl(n.category, null, n.category)
      ]),
      el('h3', { class: 'article__title', text: n.title || '(제목 없음)' }),
      el('div', { class: 'article__sub' }, [formatDate(n.date, { long: true })]),
      el('div', { class: 'prose', html: renderMarkdown(n.body) })
    );
  }

  function sortNotices() {
    notices.sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return String(b.date).localeCompare(String(a.date));
    });
  }

  async function saveNotice() {
    const n = readNotice();
    if (!n.title) { toast('제목을 입력해 주세요'); nf.title.focus(); return; }
    if (!n.body) { toast('내용을 입력해 주세요'); nf.body.focus(); return; }

    if (!editingNoticeId) {
      let id = n.id, k = 2;
      while (notices.some((x) => x.id === id)) id = n.id + '-' + k++;
      n.id = id;
      notices.unshift(n);
    } else {
      const i = notices.findIndex((x) => x.id === editingNoticeId);
      if (i > -1) notices[i] = n; else notices.unshift(n);
    }
    sortNotices();
    try {
      await STORE.saveNotice(n);
      toast(editingNoticeId ? '수정했습니다' : '공지를 올렸습니다');
    } catch (e) { console.error(e); toast('저장하지 못했습니다'); return; }
    renderNoticeList();
    resetNoticeForm();
  }

  function renderNoticeList() {
    const box = $('#n-list');
    box.innerHTML = '';
    if (!notices.length) {
      $('#n-count').textContent = '0건';
      box.appendChild(el('li', { class: 'empty', text: '아직 공지가 없습니다.' }));
      return;
    }
    const counts = { live: 0, scheduled: 0, archived: 0 };
    notices.forEach((n) => { counts[noticeStatus(n)]++; });
    $('#n-count').textContent =
      `게시 중 ${counts.live} · 예약 ${counts.scheduled} · 보관 ${counts.archived}`;

    notices.forEach((n) => {
      const st = noticeStatus(n);
      const when = st === 'scheduled' ? formatDateTime(n.publishAt) + ' 게시 예정'
                 : st === 'archived' && n.expireAt ? formatDateTime(n.expireAt) + ' 보관됨'
                 : n.expireAt ? formatDateTime(n.expireAt) + ' 까지'
                 : '';
      box.appendChild(el('li', { class: 'draft' }, [
        n.pinned && st === 'live' ? tagEl('고정', 'pin') : null,
        st === 'scheduled' ? tagEl('예약', 'scheduled') : null,
        st === 'archived' ? tagEl('보관', 'archived') : null,
        tagEl(n.category, null, n.category),
        el('span', { class: 'draft__title', text: n.title }),
        when ? el('span', { class: 'draft__when', text: when }) : null,
        el('span', { class: 'notice__date', text: n.date }),
        el('button', {
          type: 'button', class: 'draft__btn',
          text: n.archived ? '다시 게시' : '보관',
          title: n.archived ? '보관을 풀고 다시 게시합니다' : '지금 바로 지난 공지로 보냅니다',
          onclick: async () => {
            const next = Object.assign({}, n, { archived: !n.archived });
            if (!next.archived) next.expireAt = '';   // 되살릴 때 만료 시각도 해제
            const i = notices.findIndex((x) => x.id === n.id);
            if (i > -1) notices[i] = next;
            try { await STORE.saveNotice(next); }
            catch (e) { console.error(e); toast('저장하지 못했습니다'); return; }
            renderNoticeList(); renderArchive();
            toast(next.archived ? '보관했습니다' : '다시 게시했습니다');
          }
        }),
        el('button', {
          type: 'button', class: 'draft__btn', text: '수정',
          onclick: () => {
            editingNoticeId = n.id; fillNotice(n);
            $('#n-mode').textContent = '공지 수정';
            $('#n-save').textContent = '수정 내용 저장';
            $('#n-cancel').hidden = false;
            previewNotice();
            $('#panel-notice-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }),
        el('button', {
          type: 'button', class: 'draft__btn', text: '삭제',
          onclick: async () => {
            if (!confirm(`‘${n.title}’ 공지를 지울까요?`)) return;
            notices = notices.filter((x) => x.id !== n.id);
            try { await STORE.deleteNotice(n.id); } catch (e) { console.error(e); }
            if (editingNoticeId === n.id) resetNoticeForm();
            renderNoticeList();
            toast('삭제했습니다');
          }
        })
      ]));
    });
  }

  function downloadNoticesJson() {
    const json = JSON.stringify({
      _readme: '공지 데이터 파일입니다. 관리자 페이지에서 작성 후 이 파일을 교체하세요.',
      notices
    }, null, 2) + '\n';
    download('notices.json', json, 'application/json');
    toast('notices.json 을 내려받았습니다');
  }

  /* ==========================================================
     탭 2 · 폼 응답
     ========================================================== */
  function renderFormTabs() {
    const box = $('#sub-forms');
    box.innerHTML = '';
    if (!forms.length) return;
    if (!activeFormId || !forms.some((f) => f.id === activeFormId)) activeFormId = forms[0].id;

    forms.forEach((f) => {
      box.appendChild(el('button', {
        type: 'button', class: 'filter', 'aria-pressed': String(f.id === activeFormId),
        text: f.title,
        onclick: () => { activeFormId = f.id; renderFormTabs(); loadSubs(); }
      }));
    });
  }

  async function loadSubs() {
    if (!activeFormId) return;
    const box = $('#sub-table');
    box.innerHTML = '<div class="skeleton" style="height:120px"></div>';
    try {
      subs = await STORE.listSubmissions(activeFormId);
    } catch (err) {
      console.error(err);
      box.innerHTML = '';
      box.appendChild(el('div', { class: 'banner banner--error' }, [
        el('strong', { text: '응답을 불러오지 못했습니다. ' }),
        '관리자 권한이 없거나 보안 규칙이 배포되지 않았을 수 있습니다.'
      ]));
      return;
    }
    renderSubs();
  }

  function renderSubs() {
    const box = $('#sub-table');
    const form = forms.find((f) => f.id === activeFormId);
    $('#sub-count').textContent = subs.length + '건';
    box.innerHTML = '';

    if (!subs.length) {
      box.appendChild(el('div', { class: 'empty' }, [
        el('strong', { text: '아직 접수된 응답이 없습니다.' }),
        '학우들이 폼을 제출하면 이곳에 쌓입니다.'
      ]));
      return;
    }

    const cols = form ? form.fields.map((f) => ({ key: f.key, label: f.label })) : [];
    const table = el('table', { class: 'subs' });
    table.appendChild(el('thead', null, [
      el('tr', null,
        [el('th', { text: '접수 시각' })]
          .concat(cols.map((c) => el('th', { text: c.label })))
          .concat([el('th', { text: '' })]))
    ]));

    const tbody = el('tbody');
    subs.forEach((s) => {
      const tds = [el('td', { class: 'when', text: formatWhen(s.createdAt) })];
      cols.forEach((c) => {
        const v = (s.data || {})[c.key] || '';
        tds.push(el('td', { class: String(v).length > 40 ? 'wrap-cell' : '', text: v }));
      });
      tds.push(el('td', null, [
        el('button', {
          type: 'button', class: 'rowbtn', text: '삭제',
          onclick: async () => {
            if (!confirm('이 응답을 지울까요? 되돌릴 수 없습니다.')) return;
            try { await STORE.deleteSubmission(s.id); } catch (e) { console.error(e); toast('삭제 실패'); return; }
            subs = subs.filter((x) => x.id !== s.id);
            renderSubs();
            toast('삭제했습니다');
          }
        })
      ]));
      tbody.appendChild(el('tr', null, tds));
    });
    table.appendChild(tbody);
    box.appendChild(el('div', { class: 'table-wrap' }, [table]));
  }

  function formatWhen(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function exportCsv() {
    const form = forms.find((f) => f.id === activeFormId);
    if (!form || !subs.length) { toast('내보낼 응답이 없습니다'); return; }
    const cols = form.fields.map((f) => f.key);
    const head = ['접수 시각'].concat(form.fields.map((f) => f.label));
    const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = subs.map((s) =>
      [formatWhen(s.createdAt)].concat(cols.map((k) => (s.data || {})[k] || '')).map(esc).join(','));
    /* 엑셀에서 한글이 깨지지 않도록 BOM 을 붙인다 */
    const csv = '﻿' + [head.map(esc).join(',')].concat(rows).join('\r\n') + '\r\n';
    download(`${form.id}-응답-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
    toast('CSV 로 내려받았습니다');
  }

  /* ==========================================================
     탭 3 · 폼 설정
     ========================================================== */
  const FIELD_TYPES = [
    ['text',     '한 줄 입력'],
    ['textarea', '여러 줄 입력'],
    ['select',   '고르기 (드롭다운)'],
    ['radio',    '하나만 고르기'],
    ['checkbox', '여러 개 고르기'],
    ['email',    '이메일'],
    ['tel',      '전화번호'],
    ['date',     '날짜'],
    ['number',   '숫자']
  ];
  const CHOICE_TYPES = ['select', 'radio', 'checkbox'];
  const STATUS_BADGE = {
    open:     ['접수 중', 'pin'],
    upcoming: ['접수 전', 'scheduled'],
    closed:   ['마감', 'archived']
  };
  /* 게시 중이 아니면 접수 상태보다 그 사실이 먼저다.
     '마감' 이라고만 적으면 왜 안 보이는지 알 수 없기 때문. */
  const VISIBILITY_BADGE = {
    scheduled: ['게시 예약', 'scheduled'],
    archived:  ['게시 끝', 'archived']
  };
  const formBadge = (f) => VISIBILITY_BADGE[formVisibility(f)] || STATUS_BADGE[formStatus(f)];

  /* 학우에게 보이는 모습 그대로 그려주는 미리보기.
     실제 폼과 같은 CSS 클래스를 써서 눈으로 바로 확인할 수 있게 한다. */
  function previewField(fd) {
    const opts = fd.useDepartments ? (S.departments || []) : (fd.options || []);
    let input;
    if (fd.type === 'textarea') {
      input = el('textarea', { rows: '3', placeholder: fd.placeholder || '', disabled: '' });
    } else if (fd.type === 'select') {
      input = el('select', { disabled: '' },
        [el('option', { text: fd.placeholder || '선택해 주세요' })]
          .concat(opts.map((o) => el('option', { text: o }))));
    } else if (fd.type === 'radio' || fd.type === 'checkbox') {
      input = el('div', { class: 'choices' }, opts.length
        ? opts.map((o) => el('label', { class: 'choice' }, [
            el('input', { type: fd.type, disabled: '' }), el('span', { text: o })
          ]))
        : [el('p', { class: 'field__help', text: '선택지를 입력하면 여기에 보입니다.' })]);
    } else {
      input = el('input', { type: fd.type || 'text', placeholder: fd.placeholder || '', disabled: '' });
    }
    return el('div', { class: 'field' }, [
      el('label', null, [
        fd.label || '(이름 없음)',
        fd.required ? el('span', { class: 'req', text: '필수' }) : null
      ]),
      fd.help ? el('p', { class: 'field__help', text: fd.help }) : null,
      input
    ]);
  }

  function renderFormSettings() {
    const box = $('#form-editor');
    box.innerHTML = '';

    if (!forms.length) {
      box.appendChild(el('div', { class: 'empty' }, [
        el('strong', { text: '등록된 폼이 없습니다.' }),
        '아래 ‘새 폼 만들기’ 로 시작하세요.'
      ]));
    }

    forms.forEach((form) => {
      const card = el('div', { class: 'fcard' });
      const body = el('div', { class: 'fcard__body', hidden: true });
      let open = false;

      /* ---- 머리말 : 접힌 상태에서도 상태를 알 수 있게 ---- */
      const badge = el('span');
      const summary = el('span', { class: 'fcard__meta' });
      const redrawHead = () => {
        const [label, variant] = formBadge(form);
        badge.innerHTML = '';
        badge.appendChild(tagEl(label, variant));
        summary.textContent = `항목 ${form.fields.length}개`;
        title.textContent = form.title || '(이름 없음)';
      };
      const title = el('span', { class: 'fcard__title' });
      const caret = el('span', { class: 'fcard__caret', text: '▾' });

      const head = el('button', {
        type: 'button', class: 'fcard__head', 'aria-expanded': 'false',
        onclick: () => {
          open = !open;
          body.hidden = !open;
          head.setAttribute('aria-expanded', String(open));
          caret.style.transform = open ? 'rotate(180deg)' : '';
          if (open) redrawPreview();
        }
      }, [caret, title, badge, summary]);

      /* ---- 미리보기 ---- */
      const preview = el('div', { class: 'fpreview' });
      const redrawPreview = () => {
        preview.innerHTML = '';
        preview.append(
          el('p', { class: 'fpreview__label', text: '학우에게 보이는 모습' }),
          el('h4', { class: 'article__title', style: 'font-size:19px', text: form.title || '(이름 없음)' })
        );
        if (form.description) {
          preview.appendChild(el('p', { class: 'form-desc', style: 'margin-bottom:14px', text: form.description }));
        }
        form.fields.forEach((fd) => preview.appendChild(previewField(fd)));
        preview.appendChild(el('button', {
          type: 'button', class: 'btn btn--primary', disabled: '',
          text: form.submitLabel || '제출하기'
        }));
      };

      /* ---- 항목 편집 ---- */
      const fieldsBox = el('div', { class: 'frows' });
      const drawFields = () => {
        fieldsBox.innerHTML = '';
        if (!form.fields.length) {
          fieldsBox.appendChild(el('p', { class: 'field__help', text: '항목이 없습니다. 아래에서 추가하세요.' }));
        }
        form.fields.forEach((fd, i) => {
          const isChoice = CHOICE_TYPES.includes(fd.type);
          const extra = el('div', { class: 'frow__extra' });
          const drawExtra = () => {
            extra.innerHTML = '';
            if (CHOICE_TYPES.includes(fd.type) && !fd.useDepartments) {
              extra.appendChild(el('input', {
                class: 'frow__opts', value: (fd.options || []).join(', '),
                placeholder: '선택지를 쉼표로 구분해 입력  예) 학사, 복지, 행사',
                oninput: (e) => {
                  fd.options = e.target.value.split(',').map((x) => x.trim()).filter(Boolean);
                  redrawPreview();
                }
              }));
            }
            if (fd.useDepartments) {
              extra.appendChild(el('p', { class: 'field__help', style: 'margin:0',
                text: '선택지는 사이트 정보 탭의 ‘학과 목록’ 을 따릅니다.' }));
            }
            extra.appendChild(el('input', {
              class: 'frow__help', value: fd.help || '',
              placeholder: '항목 아래 안내문구 (선택)',
              oninput: (e) => { fd.help = e.target.value; redrawPreview(); }
            }));
          };
          drawExtra();

          fieldsBox.appendChild(el('div', { class: 'frow' }, [
            el('span', { class: 'frow__num', text: String(i + 1).padStart(2, '0') }),
            el('div', { class: 'frow__main' }, [
              el('div', { class: 'frow__top' }, [
                el('input', {
                  class: 'frow__label', value: fd.label || '', placeholder: '항목 이름',
                  oninput: (e) => { fd.label = e.target.value; redrawPreview(); }
                }),
                el('select', {
                  class: 'frow__type',
                  onchange: (e) => { fd.type = e.target.value; drawExtra(); redrawPreview(); }
                }, FIELD_TYPES.map(([v, ko]) =>
                    el('option', { value: v, text: ko, selected: (fd.type || 'text') === v ? '' : null }))),
                el('label', { class: 'check frow__req' }, [
                  el('input', { type: 'checkbox', checked: fd.required ? '' : null,
                    onchange: (e) => { fd.required = e.target.checked; redrawPreview(); } }),
                  '필수'
                ])
              ]),
              extra
            ]),
            el('div', { class: 'frow__tools' }, [
              el('button', { type: 'button', class: 'rowbtn', title: '위로', text: '↑', 'aria-label': '위로 옮기기',
                onclick: () => { if (i > 0) { [form.fields[i-1], form.fields[i]] = [form.fields[i], form.fields[i-1]]; drawFields(); redrawPreview(); } } }),
              el('button', { type: 'button', class: 'rowbtn', title: '아래로', text: '↓', 'aria-label': '아래로 옮기기',
                onclick: () => { if (i < form.fields.length-1) { [form.fields[i+1], form.fields[i]] = [form.fields[i], form.fields[i+1]]; drawFields(); redrawPreview(); } } }),
              el('button', { type: 'button', class: 'rowbtn', title: '삭제', text: '×', 'aria-label': '항목 삭제',
                onclick: () => {
                  if (!confirm(`‘${fd.label || '이름 없음'}’ 항목을 지울까요?`)) return;
                  form.fields.splice(i, 1); drawFields(); redrawHead(); redrawPreview();
                } })
            ])
          ]));
        });
      };
      drawFields();

      /* ---- 기본 정보 ---- */
      /* 게시 기간과 접수 기간은 다른 것이라, 지금 상태를 두 줄로 나눠 보여준다.
         한 줄로 뭉뚱그리면 '왜 안 보이지' 와 '왜 제출이 안 되지' 를 구분할 수 없다. */
      const statusLine = el('p', { class: 'field__help fcard__status', style: 'margin:0 2px' });
      const drawStatus = () => {
        const vis = formVisibility(form);
        const visText = {
          scheduled: form.publishAt
            ? formatDateTime(form.publishAt) + ' 부터 사이트에 보입니다.'
            : '아직 게시 전이라 사이트에 보이지 않습니다.',
          live: '지금 사이트에 게시 중입니다.',
          archived: form.expireAt && !form.archived
            ? formatDateTime(form.expireAt) + ' 에 게시가 끝났습니다. 아카이브 탭에 있습니다.'
            : '내려둔 상태라 사이트에 보이지 않습니다. 아카이브 탭에 있습니다.'
        }[vis];
        const subText = vis !== 'live'
          ? '게시 중이 아니라 접수도 받지 않습니다.'
          : ({ open: '지금 접수 중입니다.', upcoming: '아직 접수 전입니다.',
               closed: '지금은 접수를 받지 않습니다.' })[formStatus(form)];
        statusLine.innerHTML = '';
        statusLine.append('게시 : ' + visText, el('br'), '접수 : ' + subText);
        redrawHead();
      };
      drawStatus();

      const url = 'apply.html?id=' + form.id;
      body.append(
        el('div', { class: 'field' }, [
          el('label', { text: '폼 이름' }),
          el('input', { value: form.title || '', placeholder: '예) 총회 참석 신청',
            oninput: (e) => { form.title = e.target.value; redrawHead(); redrawPreview(); } })
        ]),
        el('div', { class: 'field' }, [
          el('label', { text: '설명' }),
          el('input', { value: form.description || '', placeholder: '폼 위에 보이는 안내문',
            oninput: (e) => { form.description = e.target.value; redrawPreview(); } })
        ]),
        el('div', { class: 'field-row' }, [
          el('div', { class: 'field' }, [
            el('label', { text: '제출 버튼 글자' }),
            el('input', { value: form.submitLabel || '', placeholder: '제출하기',
              oninput: (e) => { form.submitLabel = e.target.value; redrawPreview(); } })
          ]),
          el('div', { class: 'field' }, [
            el('label', { text: '제출 후 안내' }),
            el('input', { value: form.doneMessage || '', placeholder: '접수되었습니다. 감사합니다.',
              oninput: (e) => { form.doneMessage = e.target.value; } })
          ])
        ]),

        el('div', { class: 'schedule' }, [
          el('p', { class: 'schedule__title', text: '게시 기간' }),
          el('p', { class: 'schedule__hint' }, [
            '폼이 사이트에 보이는 기간입니다. 비워두면 계속 게시됩니다. ',
            el('strong', { text: '게시 전에는 주소를 알아도 열리지 않고, 게시가 끝나면 아카이브 탭으로 들어갑니다.' })
          ]),
          el('label', { class: 'check', style: 'margin-bottom:12px' }, [
            el('input', { type: 'checkbox', checked: form.archived ? null : '',
              onchange: (e) => { form.archived = !e.target.checked; drawStatus(); } }),
            '사이트에 게시'
          ]),
          el('div', { class: 'field-row' }, [
            el('div', { class: 'field' }, [
              el('label', { text: '게시 시작' }),
              el('input', { type: 'datetime-local', value: toLocalInput(form.publishAt),
                onchange: (e) => { form.publishAt = fromLocalInput(e.target.value); drawStatus(); } })
            ]),
            el('div', { class: 'field' }, [
              el('label', { text: '게시 종료' }),
              el('input', { type: 'datetime-local', value: toLocalInput(form.expireAt),
                onchange: (e) => { form.expireAt = fromLocalInput(e.target.value); drawStatus(); } })
            ])
          ])
        ]),

        el('div', { class: 'schedule' }, [
          el('p', { class: 'schedule__title', text: '접수 기간' }),
          el('p', { class: 'schedule__hint' }, [
            '비워두면 아래 ‘접수 허용’ 만으로 여닫습니다. 시각을 정하면 그때 자동으로 열리고 닫힙니다. ',
            el('strong', { text: '마감 후에는 서버에서도 제출이 거부됩니다.' })
          ]),
          el('label', { class: 'check', style: 'margin-bottom:12px' }, [
            el('input', { type: 'checkbox', checked: form.open !== false ? '' : null,
              onchange: (e) => { form.open = e.target.checked; drawStatus(); } }),
            '접수 허용'
          ]),
          el('div', { class: 'field-row' }, [
            el('div', { class: 'field' }, [
              el('label', { text: '접수 시작' }),
              el('input', { type: 'datetime-local', value: toLocalInput(form.openAt),
                onchange: (e) => { form.openAt = fromLocalInput(e.target.value); drawStatus(); } })
            ]),
            el('div', { class: 'field' }, [
              el('label', { text: '접수 마감' }),
              el('input', { type: 'datetime-local', value: toLocalInput(form.closeAt),
                onchange: (e) => { form.closeAt = fromLocalInput(e.target.value); drawStatus(); } })
            ])
          ])
        ]),

        statusLine,

        el('div', { class: 'fsection' }, [
          el('p', { class: 'schedule__title', text: '입력 항목' }),
          fieldsBox,
          el('button', {
            type: 'button', class: 'btn', style: 'margin-top:10px', text: '+ 항목 추가',
            onclick: () => {
              form.fields.push({ key: 'f_' + uid(), label: '', type: 'text', required: false });
              drawFields(); redrawHead(); redrawPreview();
            }
          })
        ]),

        preview,

        el('div', { class: 'fcard__actions' }, [
          el('button', {
            type: 'button', class: 'btn btn--primary', text: '이 폼 저장',
            onclick: async () => {
              try { await STORE.saveForm(form); toast('저장했습니다'); renderFormTabs(); }
              catch (e) { console.error(e); toast('저장하지 못했습니다'); }
            }
          }),
          el('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener' }, ['새 창에서 열기']),
          el('button', {
            type: 'button', class: 'btn', text: '공개 주소 복사',
            onclick: async () => {
              const full = new URL(url, location.href).href;
              try { await navigator.clipboard.writeText(full); toast('복사했습니다'); }
              catch (e) { toast(full); }
            }
          }),
          el('button', {
            type: 'button', class: 'rowbtn', style: 'margin-left:auto', text: '폼 삭제',
            onclick: async () => {
              if (!confirm(`‘${form.title}’ 폼을 지울까요?\n` +
                           '이미 접수된 응답은 남지만 새 제출은 받을 수 없게 됩니다.')) return;
              try { await STORE.deleteForm(form.id); }
              catch (e) { console.error(e); toast('삭제하지 못했습니다'); return; }
              forms = forms.filter((f) => f.id !== form.id);
              renderFormSettings(); renderFormTabs();
              toast('폼을 지웠습니다');
            }
          })
        ])
      );

      redrawHead();
      card.append(head, body);
      box.appendChild(card);
    });

    box.appendChild(el('div', { class: 'admin__actions', style: 'margin-top:16px' }, [
      el('button', {
        type: 'button', class: 'btn', text: '+ 새 폼 만들기',
        onclick: async () => {
          const title = prompt('새 폼의 이름을 입력하세요.\n예) 총회 참석 신청');
          if (!title || !title.trim()) return;
          const form = {
            id: 'form-' + uid(), order: forms.length + 1, title: title.trim(),
            description: '', submitLabel: '제출하기',
            doneMessage: '접수되었습니다. 감사합니다.',
            open: false, consent: true,
            fields: [
              { key: 'f_' + uid(), label: '이름', type: 'text', required: true },
              { key: 'f_' + uid(), label: '학과', type: 'select', required: false, useDepartments: true },
              { key: 'f_' + uid(), label: '내용', type: 'textarea', required: true }
            ]
          };
          try { await STORE.saveForm(form); }
          catch (e) { console.error(e); toast('만들지 못했습니다'); return; }
          forms.push(form);
          renderFormSettings(); renderFormTabs();
          toast('폼을 만들었습니다. 항목을 정리한 뒤 ‘접수 허용’ 을 켜세요.');
        }
      }),
      el('button', {
        type: 'button', class: 'btn btn--primary', text: '전체 저장',
        onclick: async () => {
          try {
            for (const f of forms) await STORE.saveForm(f);
            toast('폼 설정을 모두 저장했습니다');
            renderFormTabs();
          } catch (e) { console.error(e); toast('저장하지 못했습니다'); }
        }
      })
    ]));
  }

  /* ==========================================================
     탭 4 · 아카이브 (지난 공지 · 마감된 폼)
     ========================================================== */
  function renderArchive() {
    /* --- 지난 공지 --- */
    const nb = $('#arc-notices');
    nb.innerHTML = '';
    const archived = notices.filter((n) => noticeStatus(n) === 'archived');
    $('#arc-notice-count').textContent = archived.length + '건';

    if (!archived.length) {
      nb.appendChild(el('li', { class: 'empty' }, [
        el('strong', { text: '지난 공지가 없습니다.' }),
        '게시 기간이 끝나거나 보관한 공지가 이곳에 모입니다.'
      ]));
    } else {
      archived.forEach((n) => {
        nb.appendChild(el('li', { class: 'draft' }, [
          tagEl(n.category, null, n.category),
          el('a', {
            class: 'draft__title', href: 'notice.html?id=' + encodeURIComponent(n.id),
            target: '_blank', rel: 'noopener', title: '새 창에서 열기', text: n.title
          }),
          el('span', { class: 'draft__when',
            text: n.expireAt ? formatDateTime(n.expireAt) + ' 보관' : n.date }),
          el('button', {
            type: 'button', class: 'draft__btn', text: '다시 게시',
            onclick: async () => {
              const next = Object.assign({}, n, { archived: false, expireAt: '' });
              const i = notices.findIndex((x) => x.id === n.id);
              if (i > -1) notices[i] = next;
              try { await STORE.saveNotice(next); }
              catch (e) { console.error(e); toast('저장하지 못했습니다'); return; }
              renderNoticeList(); renderArchive();
              toast('다시 게시했습니다');
            }
          }),
          el('button', {
            type: 'button', class: 'draft__btn', text: '삭제',
            onclick: async () => {
              if (!confirm(`‘${n.title}’ 공지를 완전히 지울까요?\n되돌릴 수 없습니다.`)) return;
              notices = notices.filter((x) => x.id !== n.id);
              try { await STORE.deleteNotice(n.id); } catch (e) { console.error(e); }
              renderNoticeList(); renderArchive();
              toast('삭제했습니다');
            }
          })
        ]));
      });
    }

    /* --- 지난 폼 (게시가 끝났거나 접수가 마감된 것) --- */
    const fb = $('#arc-forms');
    fb.innerHTML = '';
    /* 게시가 끝난 폼은 formStatus 도 'closed' 라 이 한 줄로 둘 다 걸린다.
       (게시 전인 폼은 'upcoming' 이라 여기 오지 않는다 — 아직 지난 것이 아니므로) */
    const closed = forms.filter((f) => formStatus(f) === 'closed');
    $('#arc-form-count').textContent = closed.length + '건';

    if (!closed.length) {
      fb.appendChild(el('li', { class: 'empty' }, [
        el('strong', { text: '지난 폼이 없습니다.' }),
        '게시 기간이 끝나거나 접수가 마감된 폼이 이곳에 모입니다.'
      ]));
      return;
    }
    closed.forEach((f) => {
      const down = formVisibility(f) === 'archived';   // 게시가 끝난 것인지, 접수만 마감된 것인지
      fb.appendChild(el('li', { class: 'draft' }, [
        tagEl(down ? '게시 끝' : '마감', 'archived'),
        el('a', {
          class: 'draft__title', href: 'apply.html?id=' + encodeURIComponent(f.id),
          target: '_blank', rel: 'noopener', title: '새 창에서 열기', text: f.title
        }),
        el('span', { class: 'draft__when', text: down
          ? (f.expireAt && !f.archived ? formatDateTime(f.expireAt) + ' 게시 종료' : '내려둠')
          : (f.closeAt ? formatDateTime(f.closeAt) + ' 마감' : '접수 중지') }),
        el('button', {
          type: 'button', class: 'draft__btn', text: '응답 보기',
          onclick: () => {
            activeFormId = f.id;
            $('.tab[data-tab="subs"]').click();
            renderFormTabs();
            loadSubs();
          }
        }),
        el('button', {
          type: 'button', class: 'draft__btn', text: down ? '다시 게시' : '다시 열기',
          onclick: async () => {
            const next = down
              ? Object.assign({}, f, { archived: false, expireAt: '' })
              : Object.assign({}, f, { open: true, closeAt: '' });
            const i = forms.findIndex((x) => x.id === f.id);
            if (i > -1) forms[i] = next;
            try { await STORE.saveForm(next); }
            catch (e) { console.error(e); toast('저장하지 못했습니다'); return; }
            renderFormSettings(); renderFormTabs(); renderArchive();
            toast(down ? '다시 게시했습니다' : '접수를 다시 열었습니다');
          }
        })
      ]));
    });
  }

  /* ==========================================================
     탭 5 · 사이트 정보
     ========================================================== */
  function textField(label, value, help, onInput, opts) {
    const input = el((opts && opts.multiline) ? 'textarea' : 'input', {
      value: value || '', placeholder: (opts && opts.placeholder) || '',
      rows: (opts && opts.multiline) ? '3' : null,
      oninput: (e) => onInput(e.target.value)
    });
    if (opts && opts.multiline) input.value = value || '';
    return el('div', { class: 'field' }, [
      el('label', { text: label }),
      help ? el('p', { class: 'field__help', text: help }) : null,
      input
    ]);
  }

  function renderSite() {
    const box = $('#site-editor');
    box.innerHTML = '';

    /* 저장 버튼이 실제로 쓸 작업본 — 저장 전까지 원본을 건드리지 않는다 */
    const d = {
      brand: Object.assign({ long: '', short: '' }, S.brand || {}),
      college: S.college, councilTerm: S.councilTerm, councilName: S.councilName,
      tagline: S.tagline, description: S.description,
      quickLinks: JSON.parse(JSON.stringify(S.quickLinks || [])),
      about: JSON.parse(JSON.stringify(S.about || { intro: '', departments: [] })),
      contact: JSON.parse(JSON.stringify(S.contact || {})),
      categories: (S.categories || []).slice(),
      departments: (S.departments || []).slice(),
      consentText: S.consentText
    };

    /* --- 이름 · 제목 --- */
    box.appendChild(el('div', { class: 'editor-group' }, [
      el('p', { class: 'schedule__title', style: 'margin-bottom:10px', text: '이름과 제목' }),
      textField('상단바 이름 (긴 버전)', d.brand.long,
        '넓은 화면에서 보입니다.', (v) => { d.brand.long = v; }),
      textField('상단바 이름 (짧은 버전)', d.brand.short,
        '휴대폰 등 좁은 화면에서 보입니다. 메뉴와 자리를 다투므로 짧게 유지하세요.',
        (v) => { d.brand.short = v; }),
      textField('대학 이름', d.college, '홈 상단과 푸터에 나옵니다.', (v) => { d.college = v; }),
      el('div', { class: 'field-row' }, [
        textField('기수', d.councilTerm, '예) 제15대 학생회', (v) => { d.councilTerm = v; }),
        textField('학생회 이름', d.councilName, '예) 연', (v) => { d.councilName = v; })
      ]),
      textField('한 줄 소개', d.tagline, '홈 제목 아래 문구', (v) => { d.tagline = v; }),
      textField('공유 미리보기 문구', d.description,
        '카카오톡 · 검색 결과에 나오는 설명', (v) => { d.description = v; }, { multiline: true })
    ]));

    /* --- 상단 빠른 버튼 --- */
    const quickBox = el('div');
    const drawQuick = () => {
      quickBox.innerHTML = '';
      d.quickLinks.forEach((q, i) => {
        quickBox.appendChild(el('div', { class: 'editor-row' }, [
          el('input', { value: q.label || '', placeholder: '버튼 이름',
            oninput: (e) => { q.label = e.target.value; } }),
          el('select', { onchange: (e) => { q.icon = e.target.value; } },
            ['instagram', 'kakao', 'mail', 'clock', 'link'].map((t) =>
              el('option', { value: t, text: t, selected: (q.icon || 'link') === t ? '' : null }))),
          el('input', { value: q.url || '', placeholder: 'https://… (비우면 준비 중)',
            oninput: (e) => { q.url = e.target.value; } }),
          el('div', { class: 'editor-row__tools' }, [
            el('button', { type: 'button', class: 'rowbtn', title: '위로', text: '↑', 'aria-label': '위로 옮기기',
              onclick: () => { if (i > 0) { [d.quickLinks[i-1], d.quickLinks[i]] = [d.quickLinks[i], d.quickLinks[i-1]]; drawQuick(); } } }),
            el('button', { type: 'button', class: 'rowbtn', text: '삭제',
              onclick: () => { d.quickLinks.splice(i, 1); drawQuick(); drawMissing(); } })
          ])
        ]));
      });
      quickBox.appendChild(el('button', {
        type: 'button', class: 'btn', text: '+ 버튼 추가',
        onclick: () => { d.quickLinks.push({ label: '새 버튼', icon: 'link', url: '' }); drawQuick(); }
      }));
    };
    /* js/config.js 에 기본으로 들어 있는데 저장된 설정에는 없는 버튼을 짚어준다.
       '사이트 정보 저장' 을 한 번 누르면 그때의 목록이 통째로 저장되므로,
       나중에 코드에 버튼이 추가돼도 화면에는 나오지 않는다.
       그때마다 학생회가 손으로 다시 만들어야 하는 것을 덜어주는 안내다. */
    const missingBox = el('div');
    const drawMissing = () => {
      missingBox.innerHTML = '';
      const defs = (window.SITE_DEFAULTS && window.SITE_DEFAULTS.quickLinks) || [];
      const have = new Set(d.quickLinks.map((q) => String(q.url || '').trim()));
      const missing = defs.filter((q) => q.url && !have.has(String(q.url).trim()));
      if (!missing.length) return;
      missingBox.appendChild(el('div', { class: 'banner', style: 'margin-bottom:12px' }, [
        el('strong', { text: '기본 설정에 있는데 여기엔 없는 버튼이 있습니다. ' }),
        '아래를 누르면 같은 자리에 넣어드립니다. 넣은 뒤 ',
        el('strong', { text: '사이트 정보 저장' }), ' 을 눌러주세요.',
        el('div', { style: 'margin-top:10px; display:flex; gap:8px; flex-wrap:wrap' },
          missing.map((q) => el('button', {
            type: 'button', class: 'btn', text: '+ ' + q.label,
            onclick: () => {
              /* 기본 목록에서의 순서를 그대로 살려 끼워 넣는다 */
              const at = defs.indexOf(q);
              const before = defs.slice(0, at).map((x) => String(x.url || '').trim());
              let pos = d.quickLinks.length;
              for (let i = 0; i < d.quickLinks.length; i++) {
                if (!before.includes(String(d.quickLinks[i].url || '').trim())) { pos = i; break; }
              }
              d.quickLinks.splice(pos, 0, JSON.parse(JSON.stringify(q)));
              drawQuick(); drawMissing();
              toast('‘' + q.label + '’ 을 넣었습니다. 사이트 정보 저장을 눌러주세요');
            }
          })))
      ]));
    };

    drawQuick();
    drawMissing();
    box.appendChild(el('div', { class: 'editor-group' }, [
      el('p', { class: 'schedule__title', text: '상단 빠른 버튼' }),
      el('p', { class: 'schedule__hint', text: '홈 로고 아래 동그란 버튼들입니다. 주소를 비우면 ‘준비 중’ 으로 보입니다.' }),
      missingBox,
      quickBox
    ]));

    /* --- 학생회 소개 --- */
    const deptBox = el('div');
    const drawDepts = () => {
      deptBox.innerHTML = '';
      (d.about.departments || []).forEach((dep, i) => {
        deptBox.appendChild(el('div', { class: 'editor-row' }, [
          el('input', { value: dep.name || '', placeholder: '국 이름',
            oninput: (e) => { dep.name = e.target.value; } }),
          el('input', { value: dep.desc || '', placeholder: '하는 일',
            oninput: (e) => { dep.desc = e.target.value; } }),
          el('span'),
          el('div', { class: 'editor-row__tools' }, [
            el('button', { type: 'button', class: 'rowbtn', text: '삭제',
              onclick: () => { d.about.departments.splice(i, 1); drawDepts(); } })
          ])
        ]));
      });
      deptBox.appendChild(el('button', {
        type: 'button', class: 'btn', text: '+ 국 추가',
        onclick: () => { d.about.departments.push({ name: '', desc: '' }); drawDepts(); }
      }));
    };
    drawDepts();
    box.appendChild(el('div', { class: 'editor-group' }, [
      el('p', { class: 'schedule__title', style: 'margin-bottom:10px', text: '학생회 소개' }),
      textField('소개 글', d.about.intro, '', (v) => { d.about.intro = v; }, { multiline: true }),
      deptBox
    ]));

    /* --- 연락처 --- */
    box.appendChild(el('div', { class: 'editor-group' }, [
      el('p', { class: 'schedule__title', style: 'margin-bottom:10px', text: '연락처 (푸터)' }),
      textField('주소', d.contact.place,
        '줄을 나누고 싶은 곳에서 엔터를 치세요. 화면에도 그대로 나뉩니다.',
        (v) => { d.contact.place = v; }, { multiline: true }),
      el('div', { class: 'field-row' }, [
        textField('인스타그램 주소', d.contact.instagram, '', (v) => { d.contact.instagram = v; }),
        textField('카카오톡 채널 주소', d.contact.kakao, '', (v) => { d.contact.kakao = v; })
      ]),
      textField('이메일', d.contact.email, '비워두면 푸터에 표시되지 않습니다.', (v) => { d.contact.email = v; })
    ]));

    /* --- 목록형 설정 --- */
    box.appendChild(el('div', { class: 'editor-group' }, [
      el('p', { class: 'schedule__title', style: 'margin-bottom:10px', text: '선택지 목록' }),
      textField('공지 분류', d.categories.join(', '),
        '쉼표로 구분합니다. ‘전체’ 는 그대로 두세요.',
        (v) => { d.categories = v.split(',').map((x) => x.trim()).filter(Boolean); }),
      textField('학과 목록', d.departments.join(', '),
        '폼의 ‘학과’ 선택지로 쓰입니다. 쉼표로 구분합니다.',
        (v) => { d.departments = v.split(',').map((x) => x.trim()).filter(Boolean); },
        { multiline: true }),
      textField('개인정보 동의 문구', d.consentText, '폼 아래 동의 칸에 나옵니다.',
        (v) => { d.consentText = v; }, { multiline: true })
    ]));

    box.appendChild(el('div', { class: 'admin__actions', style: 'margin-top:14px' }, [
      el('button', {
        type: 'button', class: 'btn btn--primary', text: '사이트 정보 저장',
        onclick: async () => {
          try {
            await STORE.saveSite(d);
            toast('저장했습니다. 홈을 새로고침하면 반영됩니다.');
            renderSite();
          } catch (e) { console.error(e); toast('저장하지 못했습니다'); }
        }
      }),
      el('button', { type: 'button', class: 'btn', text: '되돌리기', onclick: renderSite })
    ]));
  }

  /* ==========================================================
     탭 5 · 링크
     ========================================================== */
  function renderLinks() {
    const box = $('#link-editor');
    box.innerHTML = '';

    linkGroups.forEach((g, gi) => {
      const rows = el('div');
      const draw = () => {
        rows.innerHTML = '';
        g.items.forEach((it, ii) => {
          rows.appendChild(el('div', { class: 'editor-row' }, [
            el('input', { value: it.label || '', placeholder: '버튼 이름',
              oninput: (e) => { it.label = e.target.value; } }),
            el('input', { value: it.desc || '', placeholder: '설명 (선택)',
              oninput: (e) => { it.desc = e.target.value; } }),
            el('input', { value: it.url || '', placeholder: 'https://… (비우면 준비 중)',
              oninput: (e) => { it.url = e.target.value; } }),
            el('div', { class: 'editor-row__tools' }, [
              el('button', { type: 'button', class: 'rowbtn', title: '위로', text: '↑', 'aria-label': '위로 옮기기',
                onclick: () => { if (ii > 0) { [g.items[ii-1], g.items[ii]] = [g.items[ii], g.items[ii-1]]; draw(); } } }),
              el('button', { type: 'button', class: 'rowbtn', title: '아래로', text: '↓', 'aria-label': '아래로 옮기기',
                onclick: () => { if (ii < g.items.length-1) { [g.items[ii+1], g.items[ii]] = [g.items[ii], g.items[ii+1]]; draw(); } } }),
              el('button', { type: 'button', class: 'rowbtn', text: '삭제',
                onclick: () => { g.items.splice(ii, 1); draw(); } })
            ])
          ]));
        });
        rows.appendChild(el('button', {
          type: 'button', class: 'btn', text: '+ 링크 추가',
          onclick: () => { g.items.push({ label: '새 링크', desc: '', url: '' }); draw(); }
        }));
      };
      draw();

      box.appendChild(el('div', { class: 'editor-group' }, [
        el('div', { class: 'editor-group__head' }, [
          el('input', { value: g.group || '', placeholder: '묶음 이름',
            oninput: (e) => { g.group = e.target.value; } }),
          el('button', { type: 'button', class: 'rowbtn', text: '묶음 삭제',
            onclick: () => {
              if (!confirm(`‘${g.group}’ 묶음을 통째로 지울까요?`)) return;
              linkGroups.splice(gi, 1); renderLinks();
            } })
        ]),
        rows
      ]));
    });

    box.appendChild(el('div', { class: 'admin__actions', style: 'margin-top:14px' }, [
      el('button', { type: 'button', class: 'btn', text: '+ 묶음 추가',
        onclick: () => { linkGroups.push({ group: '새 묶음', items: [] }); renderLinks(); } }),
      el('button', { type: 'button', class: 'btn btn--primary', text: '링크 저장',
        onclick: async () => {
          try { await STORE.saveLinks(linkGroups); toast('링크를 저장했습니다'); }
          catch (e) { console.error(e); toast('저장하지 못했습니다'); }
        } })
    ]));
  }

  /* ==========================================================
     공통
     ========================================================== */
  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------- 구글 시트 연결 확인 ---------- */
  /* 제출은 응답을 읽을 수 없는 방식(no-cors)으로 보내기 때문에,
     시트에 안 쌓일 때 원인을 짐작만 하게 된다. 이 버튼은 STORE.testSheet 로
     실제 결과를 받아와 무엇을 고쳐야 하는지까지 화면에 적어준다. */
  async function checkSheet() {
    const box = $('#sheet-result');
    const btn = $('#sheet-test');
    box.hidden = false;
    box.className = 'banner';
    box.style.marginBottom = '14px';
    box.textContent = '확인하는 중…';
    btn.disabled = true;

    const r = await STORE.testSheet();
    btn.disabled = false;
    box.innerHTML = '';

    const say = (ok, title, lines) => {
      box.className = 'banner ' + (ok ? 'banner--ok' : 'banner--error');
      box.style.marginBottom = '14px';
      box.append(el('strong', { text: title }));
      lines.forEach((t) => box.append(el('br'), document.createTextNode(t)));
    };

    if (r.reason === 'ok') {
      say(true, '연결됐습니다. ', [
        r.name ? '스프레드시트: ' + r.name : '',
        r.wrote ? '확인용으로 ‘' + r.wrote + '’ 에 한 줄 남겼습니다. 시트에서 보이면 정상입니다.' : ''
      ].filter(Boolean));
      return;
    }
    if (r.reason === 'no-url') {
      say(false, '시트 주소가 비어 있습니다. ', [
        'js/config.js 의 sheetWebhookUrl 에 Apps Script 웹 앱 주소를 넣어주세요.'
      ]);
      return;
    }
    if (r.reason === 'script-error') {
      say(false, '스크립트는 열렸지만 시트에 쓰지 못했습니다. ', [
        r.error ? '이유: ' + r.error : '',
        '시트에서 「확장 프로그램 → Apps Script」 로 만든 스크립트인지 확인해 주세요.'
      ].filter(Boolean));
      return;
    }
    if (r.reason === 'unreachable') {
      say(false, '시트 주소에 닿지 못했습니다. ', [
        '주소가 …/exec 로 끝나는지, 인터넷 연결이 되는지 확인해 주세요.'
      ]);
      return;
    }
    say(false, '답이 오지 않았습니다. ', [
      '아래 두 가지 중 하나일 가능성이 큽니다.',
      '① 배포의 ‘액세스 권한’ 이 ‘모든 사용자’ 가 아님',
      '② docs/google-sheet-webhook.gs 최신 내용을 붙여넣고 다시 배포하지 않음',
      '(배포 → 배포 관리 → 연필 → 버전 ‘새 버전’ → 배포. 주소는 그대로입니다)'
    ]);
  }

  /* ==========================================================
     탭 · 열람실 좌석
     좌석표에 실리는 것은 가린 이름과 학번 앞 5자리뿐이라,
     누가 어느 자리에 앉았는지는 이 표에서만 확인할 수 있다.
     ========================================================== */
  let seatLogs = [], seatReleases = [], seatOrphans = [];

  function seatDay() {
    const v = $('#seat-date').value;
    return v || seoulNow().date;
  }

  async function loadSeats() {
    const box = $('#seat-table');
    box.innerHTML = '<div class="skeleton" style="height:120px"></div>';
    try {
      const day = seatDay();
      const [logs, rels, orphans] = await Promise.all([
        STORE.listSeatLogs(day), STORE.listSeatReleases(day), STORE.listOrphanSeats(day)
      ]);
      seatLogs = logs; seatReleases = rels; seatOrphans = orphans;
    } catch (err) {
      console.error(err);
      box.innerHTML = '';
      box.appendChild(errorBoxFor(err, '좌석 명단을 불러오지 못했습니다.'));
      $('#seat-releases').innerHTML = '';
      $('#seat-count').textContent = '';
      $('#seat-rel-count').textContent = '';
      return;
    }
    renderOrphans();
    renderSeats();
    renderSeatReleases();
  }

  function renderSeats() {
    const box = $('#seat-table');
    box.innerHTML = '';
    $('#seat-count').textContent = seatLogs.length + '석 사용 중';

    if (!seatLogs.length) {
      box.appendChild(el('div', { class: 'empty' }, [
        el('strong', { text: '지금 쓰는 자리가 없습니다.' }),
        '학우들이 좌석을 예약하면 이곳에 쌓입니다.'
      ]));
      return;
    }

    const head = ['좌석', '이름', '학과', '학번', '전화번호', '예약 시각', ''];
    const table = el('table', { class: 'table' });
    table.appendChild(el('thead', null, [
      el('tr', null, head.map((h) => el('th', { text: h })))
    ]));

    const tbody = el('tbody');
    seatLogs.forEach((r) => {
      tbody.appendChild(el('tr', null, [
        el('td', { text: String(r.seat || r.id) + '번' }),
        el('td', { text: r.name || '' }),
        el('td', { text: r.dept || '' }),
        el('td', { text: r.sid || '' }),
        el('td', { text: telText(r.tel) }),
        el('td', { text: r.createdAt ? formatDateTime(r.createdAt) : '' }),
        el('td', null, [
          el('button', {
            type: 'button', class: 'rowbtn', text: '자리 비우기',
            onclick: async () => {
              if (!confirm(`${r.seat || r.id}번 자리를 비울까요?\n` +
                           `${r.name || ''} 학우의 예약이 지워지고, 그 자리는 다시 예약할 수 있게 됩니다.`)) return;
              try { await STORE.cancelSeat(seatDay(), r.seat || r.id); }
              catch (e) { console.error(e); toast('비우지 못했습니다'); return; }
              await loadSeats();
              toast('자리를 비웠습니다');
            }
          })
        ])
      ]));
    });
    table.appendChild(tbody);
    box.appendChild(el('div', { class: 'table-wrap' }, [table]));
  }

  /* 좌석표에는 잡혀 있는데 명단에 기록이 없는 자리.
     예약 순간 기록 쓰기가 막히면 생긴다 (보안 규칙이 예전 것이었다든지).
     그 자리는 학우가 스스로 반납 · 취소할 수 없으므로 여기서 치워줘야 한다. */
  function renderOrphans() {
    const box = $('#seat-orphan');
    box.innerHTML = '';
    box.hidden = !seatOrphans.length;
    if (!seatOrphans.length) return;

    box.appendChild(el('div', { class: 'banner banner--error', style: 'margin-bottom:14px' }, [
      el('strong', { text: '기록이 없는 자리가 ' + seatOrphans.length + '곳 있습니다. ' }),
      '좌석표에는 잡혀 있는데 누가 앉았는지가 저장되지 않았습니다. ',
      '그 자리는 학우가 스스로 반납 · 취소할 수 없으니 여기서 비워주세요.',
      el('div', { style: 'margin-top:10px; display:flex; gap:8px; flex-wrap:wrap' },
        seatOrphans.map((o) => el('button', {
          type: 'button', class: 'btn',
          text: o.id + '번 비우기' + (o.nameMasked ? ' (' + o.nameMasked + ')' : ''),
          onclick: async () => {
            if (!confirm(`${o.id}번 자리를 비울까요?`)) return;
            try { await STORE.cancelSeat(seatDay(), o.id); }
            catch (e) { console.error(e); toast('비우지 못했습니다'); return; }
            await loadSeats();
            toast(o.id + '번 자리를 비웠습니다');
          }
        })))
    ]));
  }

  /* 화면에는 '반납' 과 '자리 변경' 두 가지만 있다.
     서버에는 규칙이 받아주는 'return' / 'cancel' 로 저장되고,
     'cancel' 이 자리 변경을 뜻한다 (규칙을 다시 배포하지 않으려는 선택). */
  const RELEASE_WORD = { return: '반납', cancel: '자리 변경' };

  /* 010-1234-5678 처럼 보기 좋게 */
  function telText(v) {
    const d = String(v || '').replace(/\D/g, '');
    if (d.length === 11) return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
    if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
    if (d.length === 9)  return d.slice(0, 2) + '-' + d.slice(2, 5) + '-' + d.slice(5);
    return d;
  }

  function renderSeatReleases() {
    const box = $('#seat-releases');
    box.innerHTML = '';
    $('#seat-rel-count').textContent = seatReleases.length + '건';

    if (!seatReleases.length) {
      box.appendChild(el('div', { class: 'empty' }, [
        el('strong', { text: '아직 비워진 자리가 없습니다.' }),
        '학우가 반납하거나 취소하면 이곳에 남습니다.'
      ]));
      return;
    }

    const table = el('table', { class: 'table' });
    table.appendChild(el('thead', null, [
      el('tr', null, ['좌석', '이름', '학과', '학번', '방식', '비운 시각']
        .map((h) => el('th', { text: h })))
    ]));
    const tbody = el('tbody');
    seatReleases.forEach((r) => {
      tbody.appendChild(el('tr', null, [
        el('td', { text: String(r.seat || r.id) + '번' }),
        el('td', { text: r.name || '' }),
        el('td', { text: r.dept || '' }),
        el('td', { text: r.sid || '' }),
        el('td', null, [tagEl(RELEASE_WORD[r.kind] || r.kind || '', 
                              r.kind === 'cancel' ? 'archived' : null)]),
        el('td', { text: r.createdAt ? formatDateTime(r.createdAt) : '' })
      ]));
    });
    table.appendChild(tbody);
    box.appendChild(el('div', { class: 'table-wrap' }, [table]));
  }

  function exportSeatCsv() {
    if (!seatLogs.length) { toast('내보낼 예약이 없습니다'); return; }
    const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const head = ['좌석', '이름', '학과', '학번', '전화번호', '예약 시각'];
    const rows = seatLogs.map((r) => [r.seat || r.id, r.name, r.dept, r.sid, telText(r.tel),
      r.createdAt ? formatWhen(r.createdAt) : ''].map(esc).join(','));
    const csv = '\ufeff' + [head.map(esc).join(',')].concat(rows).join('\r\n') + '\r\n';
    download(`열람실-${seatDay()}.csv`, csv, 'text/csv;charset=utf-8');
    toast('CSV 로 내려받았습니다');
  }

  function bindTabs() {
    const tabs = $$('.tab');
    tabs.forEach((t) => t.addEventListener('click', () => {
      tabs.forEach((x) => x.setAttribute('aria-selected', String(x === t)));
      $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== t.dataset.tab; });
      if (t.dataset.tab === 'subs') loadSubs();
      if (t.dataset.tab === 'archive') renderArchive();
      if (t.dataset.tab === 'seats') loadSeats();
    }));
  }

  /* ---------- 시작 ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    window.CORE.boot();
    bindTabs();
    bindNoticeForm();
    $('#sub-csv').addEventListener('click', exportCsv);
    $('#sub-refresh').addEventListener('click', () => { loadSubs(); toast('새로고침했습니다'); });
    $('#sheet-test').addEventListener('click', checkSheet);
    $('#seat-date').value = seoulNow().date;
    $('#seat-date').addEventListener('change', loadSeats);
    $('#seat-today').addEventListener('click', () => {
      $('#seat-date').value = seoulNow().date; loadSeats();
    });
    $('#seat-refresh').addEventListener('click', () => { loadSeats(); toast('새로고침했습니다'); });
    $('#seat-csv').addEventListener('click', exportSeatCsv);

    await STORE.init();

    if (!STORE.isFirebase) { showApp(null); resetNoticeForm(); return; }

    $('#btn-signout').addEventListener('click', async () => {
      await STORE.auth.signOut();
      showLogin('');
    });

    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#login-btn');
      btn.disabled = true; btn.textContent = '확인 중…';
      try {
        await STORE.auth.signIn($('#login-email').value.trim(), $('#login-pw').value);
      } catch (err) {
        const map = {
          'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않습니다.',
          'auth/user-not-found': '등록되지 않은 계정입니다.',
          'auth/wrong-password': '비밀번호가 맞지 않습니다.',
          'auth/too-many-requests': '시도가 너무 잦습니다. 잠시 후 다시 해주세요.'
        };
        showLogin(map[err.code] || ('로그인하지 못했습니다. (' + (err.code || err.message) + ')'));
      } finally {
        btn.disabled = false; btn.textContent = '로그인';
      }
    });

    STORE.auth.onChange((user) => {
      if (user) { showApp(user); resetNoticeForm(); }
      else showLogin('');
    });
  });
})();
