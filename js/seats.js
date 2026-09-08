/* ============================================================
   seats.js — 열람실 좌석 예약
     · 좌석표는 누구나 보고, 빈 자리를 눌러 예약합니다.
     · 예약된 자리에는 가린 이름과 학번 앞 5자리만 보입니다.
       실명 · 학과 · 전체 학번은 관리자만 볼 수 있는 곳에 따로 저장됩니다.
     · 날짜가 바뀌면 좌석표는 저절로 비워집니다 (날짜별로 나눠 저장).
   ============================================================ */
(function () {
  'use strict';

  const { $, el, toast, seoulNow, maskName, maskSid } = window.CORE;
  const S = window.SITE;
  const ROOM = S.readingRoom || {};

  const ROWS = ROOM.rowNames || ['A', 'B', 'C', 'D', 'E'];
  const PER_ROW = ROOM.perRow || 12;
  const AISLE = ROOM.aisleAfter || 0;
  const TOTAL = ROWS.length * PER_ROW;
  const OPEN = typeof ROOM.openHour === 'number' ? ROOM.openHour : 9;
  const CLOSE = typeof ROOM.closeHour === 'number' ? ROOM.closeHour : 21;

  const MINE_KEY = 'cau-inmun:my-seat';

  let seats = {};        // { '7': { nameMasked, sidHead } }
  let today = '';
  let picking = null;    // 지금 예약하려는 좌석 번호
  let timer = null;

  const two = (n) => String(n).padStart(2, '0');
  const seatRow = (n) => ROWS[Math.floor((n - 1) / PER_ROW)];
  const seatLabel = (n) => seatRow(n) + two(((n - 1) % PER_ROW) + 1) + ' (' + n + '번)';

  /* 예약 시각도 한국 시각으로 적는다.
     브라우저 지역 설정을 따르면 해외에서 볼 때 엉뚱한 시각이 찍힌다. */
  function seoulClock(iso) {
    const t = seoulNow(new Date(iso));
    const h12 = t.hour % 12 === 0 ? 12 : t.hour % 12;
    return (t.hour < 12 ? '오전 ' : '오후 ') + h12 + ':' + two(t.minute);
  }

  /* 지금 예약을 받을 수 있는 시간인가 */
  function roomState() {
    const now = seoulNow();
    if (now.hour < OPEN) return { open: false, why: 'before', now: now };
    if (now.hour >= CLOSE) return { open: false, why: 'after', now: now };
    return { open: true, now: now };
  }

  /* 이 브라우저에서 오늘 이미 예약했는지 */
  function myBooking() {
    try {
      const raw = localStorage.getItem(MINE_KEY);
      if (!raw) return null;
      const v = JSON.parse(raw);
      return v && v.date === today ? v : null;
    } catch (e) { return null; }
  }
  function rememberBooking(v) {
    try { localStorage.setItem(MINE_KEY, JSON.stringify(v)); } catch (e) { /* 무시 */ }
  }

  /* ==========================================================
     머리말 · 상태 안내
     ========================================================== */
  function renderHead() {
    const st = roomState();
    document.title = (ROOM.name || '열람실') + ' 좌석 예약 · ' + S.college;
    $('[data-room-name]').textContent = (ROOM.name || '열람실') + ' 좌석 예약';
    $('[data-room-desc]').textContent =
      (ROOM.place ? ROOM.place + ' · ' : '') +
      '개방 ' + two(OPEN) + ':00–' + two(CLOSE) + ':00 · 좌석 ' + TOTAL + '석 · 매일 초기화';

    const box = $('[data-room-state]');
    box.className = 'banner';
    box.innerHTML = '';
    if (st.open) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.className = 'banner banner--error';
    box.append(
      el('strong', { text: st.why === 'before'
        ? '아직 개방 전입니다. ' : '오늘 예약은 마감되었습니다. ' }),
      st.why === 'before'
        ? '오늘 ' + two(OPEN) + ':00 부터 예약할 수 있습니다.'
        : '내일 ' + two(OPEN) + ':00 에 좌석표가 새로 열립니다.',
      el('br'),
      '지금은 ' + st.now.date + ' ' + two(st.now.hour) + ':' + two(st.now.minute) + ' (한국 시각) 입니다.'
    );
  }

  function renderNotes() {
    const ul = $('[data-room-notes]');
    ul.innerHTML = '';
    (ROOM.notes || []).forEach((t) => ul.appendChild(el('li', { text: t })));
  }

  /* ==========================================================
     좌석표
     ========================================================== */
  function renderMap() {
    const box = $('[data-seatmap]');
    box.innerHTML = '';
    const st = roomState();
    const mine = myBooking();
    let taken = 0;

    ROWS.forEach((rowName, ri) => {
      const row = el('div', { class: 'seatrow' });
      const note = (ROOM.rowNotes || {})[rowName];
      row.appendChild(el('div', { class: 'seatrow__head' }, [
        el('span', { class: 'seatrow__name', text: rowName + '열' }),
        note ? el('span', { class: 'seatrow__note', text: note }) : null
      ]));

      const line = el('div', { class: 'seatrow__seats' });
      for (let i = 1; i <= PER_ROW; i++) {
        if (AISLE && i === AISLE + 1) {
          line.appendChild(el('span', { class: 'seatrow__aisle', 'aria-hidden': 'true' }));
        }
        const n = ri * PER_ROW + i;
        const info = seats[String(n)];
        if (info) taken++;
        line.appendChild(seatButton(n, info, st.open, mine && mine.seat === n));
      }
      row.appendChild(line);
      box.appendChild(row);
    });

    box.appendChild(el('p', { class: 'seatmap__front', text: '↑ ' + (ROWS[0] || 'A') + '열 방향이 창가입니다' }));

    $('[data-seat-count]').textContent =
      '남은 자리 ' + (TOTAL - taken) + '석 / 전체 ' + TOTAL + '석' +
      (mine ? ' · 내 자리 ' + seatLabel(mine.seat) : '');
  }

  function seatButton(n, info, roomOpen, isMine) {
    const label = seatRow(n) + two(((n - 1) % PER_ROW) + 1);

    if (info) {
      /* 예약된 자리 — 색만으로 구분하지 않도록 글자로도 알린다 */
      return el('div', {
        class: 'seat seat--taken' + (isMine ? ' seat--mine' : ''),
        role: 'img',
        'aria-label': seatLabel(n) + ' 예약됨 · ' +
          (info.nameMasked || '') + ' ' + (info.sidHead || '')
      }, [
        el('span', { class: 'seat__no', text: label }),
        el('span', { class: 'seat__who', text: info.nameMasked || '예약됨' }),
        el('span', { class: 'seat__sid', text: info.sidHead || '' })
      ]);
    }

    return el('button', {
      type: 'button',
      class: 'seat seat--free',
      disabled: roomOpen ? null : '',
      'aria-label': seatLabel(n) + ' 빈 자리' + (roomOpen ? ' · 눌러서 예약' : ' · 지금은 예약할 수 없습니다'),
      onclick: () => openForm(n)
    }, [
      el('span', { class: 'seat__no', text: label }),
      el('span', { class: 'seat__free', text: '빈 자리' })
    ]);
  }

  /* ==========================================================
     예약 폼
     ========================================================== */
  function openForm(n) {
    const mine = myBooking();
    if (mine) {
      toast('이미 ' + seatLabel(mine.seat) + ' 을 예약하셨습니다');
      return;
    }
    picking = n;
    $('[data-ticket]').hidden = true;
    const box = $('[data-seat-form]');
    box.hidden = false;
    box.innerHTML = '';

    const nameIn = el('input', { type: 'text', id: 'r-name', maxlength: '20',
      autocomplete: 'name', placeholder: '실명을 적어주세요' });
    const deptIn = el('select', { id: 'r-dept' }, [
      el('option', { value: '', text: '선택해 주세요' })
    ].concat((S.departments || []).map((d) => el('option', { value: d, text: d }))));
    const sidIn = el('input', { type: 'text', id: 'r-sid', inputmode: 'numeric',
      maxlength: '12', autocomplete: 'off', placeholder: '예) 20241234' });

    const err = el('p', { class: 'field__error', hidden: true });

    box.append(el('div', { class: 'admin__panel' }, [
      el('h2', { class: 'ticket__head', text: seatLabel(picking) + ' 예약' }),
      el('p', { class: 'field__help', style: 'margin:-6px 0 16px',
        text: '좌석표에는 가린 이름과 학번 앞 5자리만 보입니다. 나머지는 학생회만 확인합니다.' }),
      el('div', { class: 'field' }, [ el('label', { for: 'r-name', text: '이름' }), nameIn ]),
      el('div', { class: 'field' }, [ el('label', { for: 'r-dept', text: '학과' }), deptIn ]),
      el('div', { class: 'field' }, [
        el('label', { for: 'r-sid', text: '학번' }), sidIn,
        el('p', { class: 'field__help', text: '숫자만 적어주세요. 좌석표에는 앞 5자리만 보입니다.' })
      ]),
      err,
      el('div', { class: 'fcard__actions' }, [
        el('button', { type: 'button', class: 'btn btn--primary', id: 'r-submit',
          text: '이 자리로 예약하기', onclick: () => submit(err) }),
        el('button', { type: 'button', class: 'btn', text: '취소',
          onclick: () => { picking = null; box.hidden = true; box.innerHTML = ''; } })
      ])
    ]));

    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => nameIn.focus(), 300);
  }

  function fail(err, msg) { err.hidden = false; err.textContent = msg; }

  async function submit(err) {
    const name = $('#r-name').value.trim();
    const dept = $('#r-dept').value;
    const sid = $('#r-sid').value.replace(/\D/g, '');

    if (!name) return fail(err, '이름을 적어주세요.');
    if (!dept) return fail(err, '학과를 선택해 주세요.');
    if (sid.length < 6 || sid.length > 10) return fail(err, '학번을 숫자로 정확히 적어주세요.');
    err.hidden = true;

    /* 누르는 사이에 시간이 지났을 수 있으므로 다시 본다 */
    if (!roomState().open) {
      renderHead();
      return fail(err, '지금은 예약을 받지 않는 시간입니다.');
    }

    const btn = $('#r-submit');
    btn.disabled = true; btn.textContent = '예약하는 중…';
    try {
      await STORE.reserveSeat(today, picking, { name: name, dept: dept, sid: sid });
    } catch (e) {
      btn.disabled = false; btn.textContent = '이 자리로 예약하기';
      if (e && e.code === 'taken') {
        await refresh();
        return fail(err, '조금 전에 다른 분이 예약한 자리입니다. 다른 자리를 골라주세요.');
      }
      console.error(e);
      return fail(err, '예약하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }

    const booked = { date: today, seat: picking, name: name, dept: dept, sid: sid,
                     at: new Date().toISOString() };
    rememberBooking(booked);
    $('[data-seat-form]').hidden = true;
    $('[data-seat-form]').innerHTML = '';
    picking = null;
    await refresh();
    showTicket(booked);
  }

  /* ==========================================================
     예약 확인증
     ========================================================== */
  function showTicket(b) {
    const box = $('[data-ticket]');
    box.hidden = false;
    box.innerHTML = '';

    box.appendChild(el('div', { class: 'ticket' }, [
      el('p', { class: 'ticket__label', text: '예약 확인증' }),
      el('p', { class: 'ticket__seat', text: seatLabel(b.seat) }),
      el('dl', { class: 'ticket__rows' }, [
        el('div', null, [el('dt', { text: '이름' }), el('dd', { text: b.name })]),
        el('div', null, [el('dt', { text: '학과' }), el('dd', { text: b.dept })]),
        el('div', null, [el('dt', { text: '학번' }), el('dd', { text: b.sid })]),
        el('div', null, [el('dt', { text: '이용 날짜' }), el('dd', { text: b.date })]),
        el('div', null, [el('dt', { text: '이용 시간' }),
                         el('dd', { text: two(OPEN) + ':00 – ' + two(CLOSE) + ':00' })]),
        el('div', null, [el('dt', { text: '예약한 시각' }),
                         el('dd', { text: seoulClock(b.at) + ' (한국 시각)' })])
      ]),
      el('p', { class: 'ticket__masked',
        text: '좌석표에는 ' + maskName(b.name) + ' · ' + maskSid(b.sid) + ' 로만 보입니다.' }),

      el('div', { class: 'ticket__notes' }, [
        el('h2', { class: 'roomnotes__title', text: '이용 안내' }),
        el('ul', { class: 'roomnotes__list' },
           (ROOM.notes || []).map((t) => el('li', { text: t })))
      ]),

      el('p', { class: 'ticket__foot',
        text: '예약을 바꾸거나 취소하려면 학생회로 알려주세요. 이 화면은 캡처해 두시면 좋습니다.' })
    ]));
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ==========================================================
     불러오기
     ========================================================== */
  async function refresh() {
    const now = seoulNow();
    if (now.date !== today) {          // 자정을 넘겼으면 새 날짜로
      today = now.date;
      try { if (myBooking() === null) $('[data-ticket]').hidden = true; } catch (e) { /* 무시 */ }
    }
    try {
      seats = await STORE.getSeats(today);
    } catch (e) {
      console.error(e);
      const box = $('[data-seatmap]');
      box.innerHTML = '';
      box.appendChild(el('div', { class: 'banner banner--error' }, [
        el('strong', { text: '좌석표를 불러오지 못했습니다. ' }), '잠시 후 새로고침해 주세요.'
      ]));
      return;
    }
    renderHead();
    renderMap();
  }

  /* ---------- 시작 ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    window.CORE.boot();
    today = seoulNow().date;
    renderNotes();
    renderHead();

    await STORE.init();
    await refresh();

    $('[data-refresh]').addEventListener('click', async () => {
      await refresh(); toast('좌석표를 새로 불러왔습니다');
    });

    /* 다른 사람이 잡은 자리가 바로 보이도록 주기적으로 다시 읽는다.
       화면을 보고 있지 않거나 예약 폼을 여는 중이면 건너뛴다. */
    timer = setInterval(() => {
      if (document.hidden || picking !== null) return;
      refresh();
    }, 30000);
    window.addEventListener('pagehide', () => clearInterval(timer));

    const mine = myBooking();
    if (mine) showTicket(mine);
  });
})();
