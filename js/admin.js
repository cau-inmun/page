/* ============================================================
   admin.js — 관리자 콘솔
     · 공지 관리   · 폼 응답 확인   · 폼 설정   · 링크 관리
   Firebase 가 연결돼 있으면 로그인 후 실시간으로 반영되고,
   아니면 이 브라우저에만 저장되는 미리보기 모드로 동작합니다.
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, el, toast, tagEl, renderMarkdown, formatDate, formatDateTime,
          toLocalInput, fromLocalInput, noticeStatus, formStatus, plainText } = window.CORE;
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
      toast('데이터를 불러오지 못했습니다');
      return;
    }
    sortNotices();
    renderNoticeList();
    renderFormTabs();
    renderFormSettings();
    renderLinks();
    await loadSubs();
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
            renderNoticeList();
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
  function renderFormSettings() {
    const box = $('#form-editor');
    box.innerHTML = '';
    if (!forms.length) {
      box.appendChild(el('div', { class: 'empty', text: '등록된 폼이 없습니다.' }));
      return;
    }

    forms.forEach((form) => {
      const statusLine = el('p', { class: 'field__help', style: 'margin:10px 0 0' });
      const drawStatus = () => {
        const st = formStatus(form);
        const label = { open: '지금 접수 중입니다.',
                        upcoming: '아직 접수 전입니다.',
                        closed: '지금은 접수를 받지 않습니다.' }[st];
        statusLine.textContent = '현재 상태 — ' + label;
      };
      drawStatus();

      const fieldsBox = el('div');
      const drawFields = () => {
        fieldsBox.innerHTML = '';
        form.fields.forEach((fd, i) => {
          fieldsBox.appendChild(el('div', { class: 'editor-row' }, [
            el('input', { value: fd.label || '', placeholder: '항목 이름',
              oninput: (e) => { fd.label = e.target.value; } }),
            el('select', {
              onchange: (e) => { fd.type = e.target.value; }
            }, ['text', 'textarea', 'select', 'radio', 'checkbox', 'email', 'tel', 'date', 'number']
                 .map((t) => el('option', { value: t, text: t, selected: (fd.type || 'text') === t ? '' : null }))),
            el('input', {
              value: (fd.options || []).join(', '),
              placeholder: '선택지 (쉼표로 구분)',
              oninput: (e) => { fd.options = e.target.value.split(',').map((x) => x.trim()).filter(Boolean); }
            }),
            el('div', { class: 'editor-row__tools' }, [
              el('label', { class: 'check', style: 'font-size:12px' }, [
                el('input', { type: 'checkbox', checked: fd.required ? '' : null,
                  onchange: (e) => { fd.required = e.target.checked; } }),
                '필수'
              ]),
              el('button', { type: 'button', class: 'rowbtn', text: '삭제',
                onclick: () => { form.fields.splice(i, 1); drawFields(); } })
            ])
          ]));
        });
        fieldsBox.appendChild(el('button', {
          type: 'button', class: 'btn', text: '+ 항목 추가',
          onclick: () => {
            form.fields.push({ key: 'f_' + uid(), label: '새 항목', type: 'text', required: false });
            drawFields();
          }
        }));
      };
      drawFields();

      box.appendChild(el('div', { class: 'editor-group' }, [
        el('div', { class: 'editor-group__head' }, [
          el('input', { value: form.title, placeholder: '폼 이름',
            oninput: (e) => { form.title = e.target.value; } }),
          el('label', { class: 'check', style: 'font-size:12.5px;white-space:nowrap' }, [
            el('input', { type: 'checkbox', checked: form.open !== false ? '' : null,
              onchange: (e) => { form.open = e.target.checked; drawStatus(); } }),
            '접수 허용'
          ])
        ]),
        el('input', { value: form.description || '', placeholder: '폼 설명',
          style: 'margin-bottom:10px', oninput: (e) => { form.description = e.target.value; } }),

        el('div', { class: 'schedule' }, [
          el('p', { class: 'schedule__title', text: '접수 기간' }),
          el('p', { class: 'schedule__hint' }, [
            '비워두면 ‘접수 중’ 체크만으로 여닫습니다. 시각을 정하면 그때 자동으로 열리고 닫힙니다. ',
            el('strong', { text: '마감 후에는 서버에서도 제출이 거부됩니다.' })
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
          ]),
          statusLine
        ]),

        el('p', { class: 'field__help', text: '공개 주소 — apply.html?id=' + form.id }),
        fieldsBox
      ]));
    });

    box.appendChild(el('div', { class: 'admin__actions', style: 'margin-top:14px' }, [
      el('button', { type: 'button', class: 'btn btn--primary', text: '폼 설정 저장',
        onclick: async () => {
          try {
            for (const f of forms) await STORE.saveForm(f);
            toast('폼 설정을 저장했습니다');
            renderFormTabs();
          } catch (e) { console.error(e); toast('저장하지 못했습니다'); }
        } })
    ]));
  }

  /* ==========================================================
     탭 4 · 링크
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
              el('button', { type: 'button', class: 'rowbtn', title: '위로', text: '↑',
                onclick: () => { if (ii > 0) { [g.items[ii-1], g.items[ii]] = [g.items[ii], g.items[ii-1]]; draw(); } } }),
              el('button', { type: 'button', class: 'rowbtn', title: '아래로', text: '↓',
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

  function bindTabs() {
    const tabs = $$('.tab');
    tabs.forEach((t) => t.addEventListener('click', () => {
      tabs.forEach((x) => x.setAttribute('aria-selected', String(x === t)));
      $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== t.dataset.tab; });
      if (t.dataset.tab === 'subs') loadSubs();
    }));
  }

  /* ---------- 시작 ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    window.CORE.boot();
    bindTabs();
    bindNoticeForm();
    $('#sub-csv').addEventListener('click', exportCsv);
    $('#sub-refresh').addEventListener('click', () => { loadSubs(); toast('새로고침했습니다'); });

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
