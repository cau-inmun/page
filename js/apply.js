/* ============================================================
   apply.js — 공개 폼 페이지
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, el, icon, toast, formStatus, formatDateTime } = window.CORE;
  const S = window.SITE;

  let form = null;
  let sending = false;

  /* ---------- 필드 하나 그리기 ---------- */
  function fieldNode(f, idx) {
    const id = 'f-' + (f.key || idx);
    const options = f.useDepartments ? (S.departments || []) : (f.options || []);
    let input;

    switch (f.type) {
      case 'textarea':
        input = el('textarea', { id, name: f.key, rows: '5', placeholder: f.placeholder || '' });
        break;

      case 'select':
        input = el('select', { id, name: f.key },
          [el('option', { value: '', text: f.placeholder || '선택해 주세요' })]
            .concat(options.map((o) => el('option', { value: o, text: o }))));
        break;

      case 'radio':
        input = el('div', { class: 'choices', role: 'radiogroup', 'aria-labelledby': id + '-label' },
          options.map((o, i) => el('label', { class: 'choice' }, [
            el('input', { type: 'radio', name: f.key, value: o, id: id + '-' + i }),
            el('span', { text: o })
          ])));
        break;

      case 'checkbox':
        input = el('div', { class: 'choices', role: 'group', 'aria-labelledby': id + '-label' },
          options.map((o, i) => el('label', { class: 'choice' }, [
            el('input', { type: 'checkbox', name: f.key, value: o, id: id + '-' + i }),
            el('span', { text: o })
          ])));
        break;

      default:
        input = el('input', {
          id, name: f.key, type: f.type || 'text',
          placeholder: f.placeholder || '',
          inputmode: f.type === 'number' ? 'numeric' : null,
          autocomplete: f.key === 'name' ? 'name' : (f.type === 'email' ? 'email' : 'off')
        });
    }

    if (f.required && input.tagName !== 'DIV') input.required = true;

    return el('div', { class: 'field', 'data-key': f.key, 'data-type': f.type || 'text' }, [
      el('label', { id: id + '-label', for: input.tagName === 'DIV' ? null : id }, [
        f.label,
        f.required ? el('span', { class: 'req', text: '필수', 'aria-label': '필수 항목' }) : null
      ]),
      f.help ? el('p', { class: 'field__help', text: f.help }) : null,
      input,
      el('p', { class: 'field__error', hidden: true, role: 'alert' })
    ]);
  }

  /* ---------- 값 읽기 ---------- */
  function readValue(f, root) {
    const wrap = $(`.field[data-key="${CSS.escape(f.key)}"]`, root);
    if (!wrap) return '';
    if (f.type === 'checkbox') {
      return $$('input:checked', wrap).map((i) => i.value);
    }
    if (f.type === 'radio') {
      const hit = $('input:checked', wrap);
      return hit ? hit.value : '';
    }
    const input = $('input, textarea, select', wrap);
    return input ? input.value.trim() : '';
  }

  function setError(key, message, root) {
    const wrap = $(`.field[data-key="${CSS.escape(key)}"]`, root);
    if (!wrap) return;
    const box = $('.field__error', wrap);
    wrap.classList.toggle('has-error', !!message);
    box.textContent = message || '';
    box.hidden = !message;
  }

  /* ---------- 제출 ---------- */
  async function handleSubmit(root) {
    if (sending) return;

    const values = {};
    let firstBad = null;

    form.fields.forEach((f) => {
      const v = readValue(f, root);
      const empty = Array.isArray(v) ? v.length === 0 : !v;
      if (f.required && empty) {
        setError(f.key, '이 항목을 입력해 주세요.', root);
        if (!firstBad) firstBad = f.key;
      } else {
        setError(f.key, '', root);
        if (!empty) values[f.key] = Array.isArray(v) ? v.join(', ') : v.slice(0, 2000);
      }
    });

    if (form.consent) {
      const agreed = $('#f-consent', root).checked;
      const box = $('#consent-error', root);
      box.hidden = agreed;
      if (!agreed) { if (!firstBad) firstBad = '__consent'; }
    }

    if (firstBad) {
      const target = firstBad === '__consent'
        ? $('#f-consent', root)
        : $(`.field[data-key="${CSS.escape(firstBad)}"] input, .field[data-key="${CSS.escape(firstBad)}"] textarea, .field[data-key="${CSS.escape(firstBad)}"] select`, root);
      if (target) { target.focus(); target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      toast('입력하지 않은 항목이 있습니다');
      return;
    }

    /* 스팸 방지용 숨김 필드 — 사람이면 비어 있다 */
    if ($('#f-website', root).value) return;

    /* 페이지를 오래 열어둔 사이 마감됐을 수 있으니 보내기 직전에 다시 확인 */
    if (formStatus(form) !== 'open') {
      const box = $('[data-form-error]');
      box.hidden = false;
      box.innerHTML = '';
      box.append(el('strong', { text: '접수가 마감되었습니다. ' }),
                 '페이지를 새로고침하면 현재 상태를 볼 수 있습니다.');
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const btn = $('#btn-submit', root);
    sending = true;
    btn.disabled = true;
    btn.textContent = '보내는 중…';

    try {
      await STORE.submit(form.id, values, form.title);
      showDone();
    } catch (err) {
      console.error(err);
      sending = false;
      btn.disabled = false;
      btn.textContent = form.submitLabel || '제출하기';
      const box = $('[data-form-error]');
      box.hidden = false;
      box.innerHTML = '';
      box.append(
        el('strong', { text: '제출하지 못했습니다. ' }),
        '잠시 후 다시 시도해 주세요. 계속 안 되면 인스타그램 DM으로 알려주시면 도와드리겠습니다.'
      );
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function showDone() {
    const root = $('[data-form-root]');
    root.innerHTML = '';
    root.appendChild(el('div', { class: 'done' }, [
      el('div', { class: 'done__mark', 'aria-hidden': 'true', text: '✓' }),
      el('h2', { class: 'done__title', text: '제출되었습니다' }),
      el('p', { class: 'done__text', text: form.doneMessage || '접수되었습니다. 감사합니다.' }),
      el('div', { class: 'share', style: 'justify-content:center' }, [
        el('a', { class: 'btn btn--primary', href: './' }, ['홈으로']),
        el('a', { class: 'btn', href: 'notices.html' }, ['공지사항 보기'])
      ])
    ]));
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- 폼 목록 (id 없이 들어온 경우) ---------- */
  function renderList(forms) {
    const root = $('[data-form-root]');
    root.innerHTML = '';
    $('[data-form-title]').textContent = '신청 · 건의';
    $('[data-form-desc]').textContent = '작성할 폼을 선택해 주세요.';

    /* 마감된 폼은 목록에서 감추고, 접수 전인 폼은 시작 시각과 함께 보여준다 */
    const notReady = (f) => STORE.isFirebase && f._seed;
    const shown = forms.filter((f) => formStatus(f) !== 'closed' || notReady(f));
    if (!shown.length) {
      root.appendChild(el('div', { class: 'empty' }, [
        el('strong', { text: '지금은 열려 있는 폼이 없습니다.' }),
        '새 신청이 열리면 공지사항으로 알려드립니다.'
      ]));
      return;
    }
    root.appendChild(el('ul', { class: 'links' }, shown.map((f) => {
      const st = formStatus(f);
      const upcoming = st === 'upcoming' || notReady(f);
      return el('li', null, [
        el('a', {
          class: 'linkbtn' + (upcoming ? ' is-disabled' : ''),
          href: upcoming ? '#' : 'apply.html?id=' + encodeURIComponent(f.id),
          'aria-disabled': upcoming ? 'true' : null,
          tabindex: upcoming ? '-1' : null
        }, [
          el('div', { class: 'linkbtn__body' }, [
            el('div', { class: 'linkbtn__label' }, [
              f.title,
              upcoming ? el('span', { class: 'badge badge--soon', text: '접수 전' }) : null,
              !upcoming && f.closeAt ? el('span', { class: 'badge', text: '접수 중' }) : null
            ]),
            el('div', { class: 'linkbtn__desc', text: notReady(f)
              ? '접수 준비 중입니다'
              : (upcoming && f.openAt
                  ? formatDateTime(f.openAt) + ' 접수 시작'
                  : (f.description || '')) })
          ]),
          el('span', { class: 'linkbtn__arrow', html: icon('arrow') })
        ])
      ]);
    })));
  }

  /* ---------- 폼 그리기 ---------- */
  function renderForm(root) {
    document.title = form.title + ' · 중앙대학교 인문대학 학생회';
    $('[data-form-title]').textContent = form.title;
    $('[data-form-desc]').textContent = form.description || '';

    root.innerHTML = '';

    /* 서버에 등록되지 않은 폼은 제출이 서버에서 거부된다.
       다 채운 뒤에 실패하지 않도록 아예 폼을 그리지 않는다. */
    if (STORE.isFirebase && form._seed) {
      root.appendChild(el('div', { class: 'empty' }, [
        el('strong', { text: '아직 접수 준비 중입니다.' }),
        '준비가 끝나면 공지사항과 인스타그램으로 알려드립니다.'
      ]));
      console.warn(
        '[폼] 이 폼이 아직 Firestore 에 등록되지 않았습니다.\n' +
        '관리자 페이지 → 폼 설정 → 맨 아래 ‘폼 설정 저장’ 을 한 번 누르면 접수가 시작됩니다.');
      return;
    }

    const status = formStatus(form);

    if (status === 'upcoming') {
      root.appendChild(el('div', { class: 'empty' }, [
        el('strong', { text: '아직 접수 전입니다.' }),
        (form.openAt ? formatDateTime(form.openAt, { year: true }) + ' 부터 접수를 시작합니다.' : '')
      ]));
      return;
    }

    if (status === 'closed') {
      root.appendChild(el('div', { class: 'empty' }, [
        el('strong', { text: '접수가 마감되었습니다.' }),
        (form.closeAt
          ? formatDateTime(form.closeAt, { year: true }) + ' 에 마감되었습니다. 결과는 공지사항으로 안내드립니다.'
          : '접수가 다시 열리면 공지사항과 인스타그램으로 알려드립니다.')
      ]));
      return;
    }

    /* 마감이 정해져 있으면 상단에 안내 */
    if (form.closeAt) {
      root.appendChild(el('div', { class: 'window' }, [
        el('span', { class: 'window__icon', html: icon('clock'), 'aria-hidden': 'true' }),
        el('span', null, [
          el('strong', { text: formatDateTime(form.closeAt, { year: true }) }),
          ' 까지 접수합니다.'
        ])
      ]));
    }

    if (!STORE.isFirebase) {
      root.appendChild(el('div', { class: 'banner', style: 'margin-bottom:18px' }, [
        el('strong', { text: '미리보기 모드입니다. ' }),
        '아직 서버가 연결되지 않아 제출 내용이 이 브라우저에만 저장됩니다. ' +
        '실제 접수를 받으려면 Firebase 연결이 필요합니다.'
      ]));
    }

    const body = el('div');
    form.fields.forEach((f, i) => body.appendChild(fieldNode(f, i)));

    /* 스팸 방지 숨김 필드 */
    body.appendChild(el('div', { class: 'hp', 'aria-hidden': 'true' }, [
      el('label', { for: 'f-website', text: '이 칸은 비워두세요' }),
      el('input', { id: 'f-website', name: 'website', type: 'text', tabindex: '-1', autocomplete: 'off' })
    ]));

    if (form.consent) {
      body.appendChild(el('div', { class: 'consent' }, [
        el('p', { class: 'consent__text', text: S.consentText || '' }),
        el('label', { class: 'check' }, [
          el('input', { id: 'f-consent', type: 'checkbox' }),
          '개인정보 수집 · 이용에 동의합니다.'
        ]),
        el('p', { class: 'field__error', id: 'consent-error', hidden: true, role: 'alert',
                  text: '동의하셔야 제출할 수 있습니다.' })
      ]));
    }

    body.appendChild(el('div', { class: 'banner banner--error', 'data-form-error': '', hidden: true }));

    body.appendChild(el('div', { class: 'share' }, [
      el('button', {
        type: 'button', id: 'btn-submit', class: 'btn btn--primary',
        text: form.submitLabel || '제출하기',
        onclick: () => handleSubmit(root)
      })
    ]));

    root.appendChild(body);

    /* 입력하면 그 항목의 오류 표시를 지운다 */
    root.addEventListener('input', (e) => {
      const wrap = e.target.closest('.field');
      if (wrap && wrap.classList.contains('has-error')) setError(wrap.dataset.key, '', root);
      if (e.target.id === 'f-consent') $('#consent-error', root).hidden = e.target.checked;
    });
  }

  /* ---------- 시작 ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    window.CORE.boot();
    await STORE.init();

    const root = $('[data-form-root]');
    const id = new URLSearchParams(location.search).get('id');

    let forms = [];
    try {
      forms = await STORE.getForms();
    } catch (err) {
      root.innerHTML = '';
      root.appendChild(el('div', { class: 'banner banner--error' }, [
        el('strong', { text: '폼을 불러오지 못했습니다. ' }), '잠시 후 다시 시도해 주세요.'
      ]));
      return;
    }

    if (!id) { renderList(forms); return; }

    form = forms.find((f) => f.id === id);
    if (!form) {
      root.innerHTML = '';
      root.appendChild(el('div', { class: 'empty' }, [
        el('strong', { text: '폼을 찾을 수 없습니다.' }),
        '주소가 잘못되었거나 접수가 끝난 폼일 수 있습니다.'
      ]));
      $('[data-form-title]').textContent = '신청 · 건의';
      return;
    }
    renderForm(root);
  });
})();
