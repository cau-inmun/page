/* ============================================================
   admin.js — 공지 작성 도구
   서버 없이 동작합니다. 작성한 공지는 브라우저에 임시 저장되고,
   최종적으로 data/notices.json 파일로 내려받아 저장소에 커밋합니다.
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, el, loadNotices, renderMarkdown, formatDate, plainText, toast, tagEl } = window.CORE;
  const S = window.SITE;
  const STORAGE_KEY = 'cau-inmun-notices-draft';

  let notices = [];
  let editingId = null;

  /* ---------- 저장소 ---------- */
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notices)); } catch (e) { /* 사생활 보호 모드 등 */ }
  }
  function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /* ---------- 유틸 ---------- */
  function slugify(title, date) {
    const base = String(title)
      .toLowerCase()
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/[^가-힣a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    return (date || new Date().toISOString().slice(0, 10)) + (base ? '-' + base : '');
  }

  function uniqueId(id, ignore) {
    let out = id, n = 2;
    while (notices.some((x) => x.id === out && x.id !== ignore)) out = id + '-' + n++;
    return out;
  }

  function sortNotices() {
    notices.sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return String(b.date).localeCompare(String(a.date));
    });
  }

  function toJson() {
    return JSON.stringify({
      _readme: '공지 데이터 파일입니다. admin.html 에서 작성 후 이 파일을 통째로 교체하세요.',
      notices: notices
    }, null, 2) + '\n';
  }

  /* ---------- 폼 ---------- */
  const form = {
    title:    $('#f-title'),
    category: $('#f-category'),
    date:     $('#f-date'),
    pinned:   $('#f-pinned'),
    summary:  $('#f-summary'),
    body:     $('#f-body'),
    image:    $('#f-image'),
    linkLabel:$('#f-link-label'),
    linkUrl:  $('#f-link-url')
  };

  function readForm() {
    const title = form.title.value.trim();
    const date  = form.date.value || new Date().toISOString().slice(0, 10);
    const body  = form.body.value.trim();
    const links = [];
    if (form.linkUrl.value.trim()) {
      links.push({ label: form.linkLabel.value.trim() || '바로가기', url: form.linkUrl.value.trim() });
    }
    return {
      id: editingId || uniqueId(slugify(title, date)),
      title,
      category: form.category.value,
      date,
      pinned: form.pinned.checked,
      summary: form.summary.value.trim() || plainText(body, 90),
      body,
      image: form.image.value.trim(),
      links
    };
  }

  function fillForm(n) {
    form.title.value = n.title || '';
    form.category.value = n.category || '일반';
    form.date.value = n.date || '';
    form.pinned.checked = !!n.pinned;
    form.summary.value = n.summary || '';
    form.body.value = n.body || '';
    form.image.value = n.image || '';
    form.linkLabel.value = (n.links && n.links[0] && n.links[0].label) || '';
    form.linkUrl.value = (n.links && n.links[0] && n.links[0].url) || '';
  }

  function resetForm() {
    editingId = null;
    fillForm({ date: new Date().toISOString().slice(0, 10), category: '일반' });
    $('#form-mode').textContent = '새 공지 작성';
    $('#btn-save').textContent = '목록에 추가';
    $('#btn-cancel').hidden = true;
    preview();
  }

  /* ---------- 미리보기 ---------- */
  function preview() {
    const n = readForm();
    const box = $('#preview');
    box.innerHTML = '';
    if (!n.title && !n.body) {
      box.appendChild(el('p', { class: 'linkbtn__desc', text: '제목과 내용을 입력하면 이곳에 실제 화면 그대로 미리보기가 표시됩니다.' }));
      return;
    }
    box.appendChild(el('div', { class: 'article__meta' }, [
      n.pinned ? tagEl('고정', 'pin') : null,
      tagEl(n.category, null, n.category)
    ]));
    box.appendChild(el('h3', { class: 'article__title', text: n.title || '(제목 없음)' }));
    box.appendChild(el('div', { class: 'article__sub' }, [formatDate(n.date, { long: true })]));
    box.appendChild(el('div', { class: 'prose', html: renderMarkdown(n.body) }));
  }

  /* ---------- 목록 ---------- */
  function renderList() {
    const box = $('#draft-list');
    box.innerHTML = '';
    $('#draft-count').textContent = notices.length + '건';

    if (!notices.length) {
      box.appendChild(el('li', { class: 'empty', text: '아직 공지가 없습니다.' }));
      return;
    }

    notices.forEach((n, i) => {
      box.appendChild(el('li', { class: 'draft' }, [
        n.pinned ? tagEl('고정', 'pin') : null,
        tagEl(n.category, null, n.category),
        el('span', { class: 'draft__title', text: n.title }),
        el('span', { class: 'notice__date', text: n.date }),
        el('button', { type: 'button', class: 'draft__btn', title: '위로 이동', text: '↑',
          onclick: () => { if (i > 0) { [notices[i-1], notices[i]] = [notices[i], notices[i-1]]; save(); renderList(); output(); } } }),
        el('button', { type: 'button', class: 'draft__btn', title: '아래로 이동', text: '↓',
          onclick: () => { if (i < notices.length-1) { [notices[i+1], notices[i]] = [notices[i], notices[i+1]]; save(); renderList(); output(); } } }),
        el('button', { type: 'button', class: 'draft__btn', text: '수정',
          onclick: () => {
            editingId = n.id;
            fillForm(n);
            $('#form-mode').textContent = '공지 수정';
            $('#btn-save').textContent = '수정 내용 저장';
            $('#btn-cancel').hidden = false;
            preview();
            $('#panel-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
          } }),
        el('button', { type: 'button', class: 'draft__btn', text: '삭제',
          onclick: () => {
            if (!confirm(`‘${n.title}’ 공지를 목록에서 지울까요?`)) return;
            notices.splice(i, 1);
            if (editingId === n.id) resetForm();
            save(); renderList(); output();
            toast('삭제했습니다');
          } })
      ]));
    });
  }

  function output() { $('#json-out').value = toJson(); }

  /* ---------- 동작 ---------- */
  function bind() {
    Object.values(form).forEach((f) => f && f.addEventListener('input', preview));
    form.category.addEventListener('change', preview);
    form.pinned.addEventListener('change', preview);

    $('#btn-save').addEventListener('click', () => {
      const n = readForm();
      if (!n.title) { toast('제목을 입력해 주세요'); form.title.focus(); return; }
      if (!n.body)  { toast('내용을 입력해 주세요'); form.body.focus(); return; }

      if (editingId) {
        const i = notices.findIndex((x) => x.id === editingId);
        if (i > -1) notices[i] = n; else notices.unshift(n);
        toast('수정했습니다');
      } else {
        n.id = uniqueId(slugify(n.title, n.date));
        notices.unshift(n);
        toast('목록에 추가했습니다');
      }
      sortNotices();
      save(); renderList(); output(); resetForm();
    });

    $('#btn-cancel').addEventListener('click', resetForm);

    $('#btn-copy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(toJson());
        toast('JSON 을 복사했습니다');
      } catch (e) {
        $('#json-out').select();
        toast('복사 실패 — 직접 선택해 복사해 주세요');
      }
    });

    $('#btn-download').addEventListener('click', () => {
      const blob = new Blob([toJson()], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: 'notices.json' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('notices.json 을 내려받았습니다');
    });

    $('#btn-reload').addEventListener('click', async () => {
      if (!confirm('현재 사이트에 올라가 있는 공지를 다시 불러옵니다. 저장하지 않은 작업은 사라집니다. 계속할까요?')) return;
      await loadFromSite(true);
      toast('사이트 공지를 불러왔습니다');
    });

    $('#btn-clear-samples').addEventListener('click', () => {
      const before = notices.length;
      notices = notices.filter((n) => !n.sample);
      if (before === notices.length) { toast('예시 공지가 없습니다'); return; }
      save(); renderList(); output();
      toast(`예시 공지 ${before - notices.length}건을 지웠습니다`);
    });
  }

  async function loadFromSite(force) {
    try {
      const list = await loadNotices();
      notices = JSON.parse(JSON.stringify(list)).map((n) => {
        const o = { id: n.id, title: n.title, category: n.category, date: n.date,
                    pinned: n.pinned, summary: n.summary, body: n.body,
                    image: n.image || '', links: n.links || [] };
        if (n.sample) o.sample = true;
        return o;
      });
      save();
    } catch (e) {
      if (force) toast('불러오기에 실패했습니다');
      notices = [];
    }
    renderList(); output();
  }

  /* ---------- 시작 ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    window.CORE.boot();

    /* 분류 선택지 채우기 */
    S.categories.filter((c) => c !== '전체').forEach((c) => {
      form.category.appendChild(el('option', { value: c, text: c }));
    });

    bind();

    const draft = restore();
    if (draft && draft.length) {
      notices = draft;
      renderList(); output();
      $('#restore-note').hidden = false;
    } else {
      await loadFromSite(false);
    }

    resetForm();
  });
})();
