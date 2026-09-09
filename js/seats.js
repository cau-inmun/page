/* ============================================================
   seats.js — 열람실 좌석 예약
     · 좌석표는 누구나 보고, 빈 자리를 눌러 예약합니다.
     · 예약된 자리에는 '예약됨' 만 보입니다. 누가 앉았는지는 싣지 않습니다.
       이름 · 학과 · 학번 · 전화번호는 관리자만 볼 수 있는 곳에 따로 저장됩니다.
     · 날짜가 바뀌면 좌석표는 저절로 비워집니다 (날짜별로 나눠 저장).
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, el, toast, seoulNow, describeError, errorBoxFor, countUp } = window.CORE;
  const S = window.SITE;
  const ROOM = S.readingRoom || {};

  const GRID = ROOM.grid || [];
  const COLS = GRID.length ? GRID[0].length : 0;
  const SEATS = GRID.reduce((a, row) => a.concat(row.filter((n) => n > 0)), []);
  const TOTAL = SEATS.length;
  const OPEN = typeof ROOM.openHour === 'number' ? ROOM.openHour : 8;
  const CLOSE = typeof ROOM.closeHour === 'number' ? ROOM.closeHour : 18;
  const SEAT_NOTES = ROOM.seatNotes || [];

  /* 좌석 번호 → 그 자리에 붙는 안내들 */
  const noteMap = {};
  SEAT_NOTES.forEach((note, i) => {
    (note.seats || []).forEach((n) => { (noteMap[n] = noteMap[n] || []).push(i); });
  });

  const MINE_KEY = 'cau-inmun:my-seat';

  let seats = {};        // { '7': { seat, createdAt } } — 누가 앉았는지는 담기지 않는다
  let today = '';
  let picking = null;    // 지금 예약하려는 좌석 번호
  let moving = null;     // 자리 변경 중일 때 이어 쓸 내용
  let timer = null;

  const two = (n) => String(n).padStart(2, '0');
  const seatLabel = (n) => n + '번';

  /* 예약 시각도 한국 시각으로 적는다.
     브라우저 지역 설정을 따르면 해외에서 볼 때 엉뚱한 시각이 찍힌다. */
  /* 010-1234-5678 처럼 보기 좋게 */
  function formatTel(v) {
    const d = String(v || '').replace(/\D/g, '');
    if (d.length === 11) return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
    if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
    if (d.length === 9)  return d.slice(0, 2) + '-' + d.slice(2, 5) + '-' + d.slice(5);
    return d;
  }

  function seoulClock(iso) {
    const t = seoulNow(new Date(iso));
    const h12 = t.hour % 12 === 0 ? 12 : t.hour % 12;
    return (t.hour < 12 ? '오전 ' : '오후 ') + h12 + ':' + two(t.minute);
  }

  /* 지금 예약을 받을 수 있는 시간인가 */
  /* 예약할 때 고를 수 있는 학과 */
  function deptOptions() {
    return (S.departments || []).filter((d) => !/^기타/.test(d));
  }

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
  function forgetBooking() {
    try { localStorage.removeItem(MINE_KEY); } catch (e) { /* 무시 */ }
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
        : two(CLOSE) + ':00 에 좌석표가 비워졌습니다. 내일 ' + two(OPEN) + ':00 에 새로 열립니다.',
      el('br'),
      '지금은 ' + st.now.date + ' ' + two(st.now.hour) + ':' + two(st.now.minute) + ' (한국 시각) 입니다.'
    );
  }

  function renderNotes() {
    const ul = $('[data-room-notes]');
    ul.innerHTML = '';
    (ROOM.notes || []).forEach((t) => ul.appendChild(el('li', { text: t })));

    /* 좌석배치 특이사항 */
    const sec = $('[data-seat-notes]');
    const list = $('[data-seat-notes-list]');
    list.innerHTML = '';
    SEAT_NOTES.forEach((n) => { if (n.text) list.appendChild(el('li', { text: n.text })); });
    sec.hidden = !list.children.length;

    /* 점이 찍히는 안내는 좌석표 범례에도 올린다 */
    const legend = $('[data-legend]');
    $$('.legend--note', legend).forEach((x) => x.remove());
    SEAT_NOTES.forEach((n) => {
      if (!n.legend) return;
      legend.appendChild(el('span', { class: 'legend legend--note' }, [
        el('span', { class: 'legend__dot', 'aria-hidden': 'true' }), n.legend
      ]));
    });
  }

  /* ==========================================================
     좌석표
     ========================================================== */
  function renderMap() {
    const box = $('[data-seatmap]');
    box.innerHTML = '';
    const st = roomState();
    const mine = myBooking();
    /* 마감 시각이 지나면 좌석표를 비운 채로 보여준다.
       그날 자리는 그때 정리되므로, 남아 있는 이름을 계속 띄우면
       아직 누가 앉아 있는 것처럼 보인다. 기록은 관리자 화면에 남는다. */
    const reset = !st.open && st.why === 'after';
    let taken = 0;

    const cols = `repeat(${COLS}, var(--seat-w))`;
    /* '창문' 은 옆으로 밀어도 늘 보이도록 스크롤 영역 밖에 둔다 */
    box.appendChild(el('p', { class: 'roomband roomband--window',
      text: ROOM.topLabel || '창문' }));

    const map = el('div', { class: 'seatmap__scroll' });
    const inner = el('div', { class: 'seatmap__room' });

    const grid = el('div', { class: 'seatgrid', style: 'grid-template-columns:' + cols });
    GRID.forEach((row) => {
      row.forEach((n) => {
        if (!n) { grid.appendChild(el('span', { class: 'seat-gap', 'aria-hidden': 'true' })); return; }
        const info = reset ? null : seats[String(n)];
        if (info) taken++;
        grid.appendChild(seatButton(n, info, st.open, mine && mine.seat === n));
      });
    });
    inner.appendChild(grid);

    /* 아래쪽 벽과 출입문 */
    const doorCol = typeof ROOM.doorCol === 'number' ? ROOM.doorCol : -1;
    const wall = el('div', { class: 'roomband roomband--wall', style: 'grid-template-columns:' + cols });
    const wallText = ROOM.bottomLabel || '벽';
    if (doorCol >= 0 && doorCol < COLS) {
      if (doorCol > 0) wall.appendChild(el('span', { class: 'roomband__seg',
        style: `grid-column: 1 / ${doorCol + 1}`, text: wallText }));
      wall.appendChild(el('span', { class: 'roomband__seg roomband__seg--door',
        style: `grid-column: ${doorCol + 1}`, text: '출입문' }));
      if (doorCol < COLS - 1) wall.appendChild(el('span', { class: 'roomband__seg',
        style: `grid-column: ${doorCol + 2} / -1`, text: wallText }));
    } else {
      wall.appendChild(el('span', { class: 'roomband__seg', style: 'grid-column: 1 / -1', text: wallText }));
    }
    inner.appendChild(wall);

    map.appendChild(inner);
    box.appendChild(map);
    box.appendChild(el('p', { class: 'seatmap__hint',
      text: '좌석표가 화면보다 넓으면 옆으로 밀어서 보세요.' }));

    /* 남은 자리 수만 따로 세어 올린다. 자리를 잡거나 비웠을 때 어느
       숫자가 달라졌는지 눈이 먼저 찾아가도록 하는 것이 목적이라,
       숫자가 안 바뀌면 아무 일도 일어나지 않는다. */
    const countBox = $('[data-seat-count]');
    countBox.innerHTML = '';
    if (reset) {
      countBox.textContent = '오늘 이용이 끝났습니다 · 좌석 ' + TOTAL + '석';
    } else {
      const num = el('span', { class: 'seatcount__num' });
      const left = TOTAL - taken;
      const had = countBox.dataset.left;          /* 이전에 그린 적이 있는가 */
      num.dataset.countValue = had || String(left);
      countBox.append('남은 자리 ', num, '석 / 전체 ' + TOTAL + '석' +
        (mine ? ' · 내 자리 ' + seatLabel(mine.seat) : ''));
      /* 첫 화면에서는 그냥 그 숫자를 보여준다. 0 부터 굴려 올리면
         아무 일도 없었는데 뭔가 일어난 것처럼 보이고, 읽으려는 순간
         숫자가 아직 굴러가고 있다. 세어 올리는 것은 '방금 달라졌다'를
         알리려는 것이므로, 달라진 적이 있을 때만 한다. */
      if (had === undefined) num.textContent = String(left);
      else countUp(num, left);
      countBox.dataset.left = String(left);
    }
  }

  function seatButton(n, info, roomOpen, isMine) {
    const marks = noteMap[n] || [];
    const noteText = marks.map((i) => SEAT_NOTES[i].legend)
                          .filter(Boolean).join(' · ');
    const dot = marks.some((i) => SEAT_NOTES[i].legend)
      ? el('span', { class: 'seat__dot', 'aria-hidden': 'true' }) : null;

    if (info) {
      /* 예약된 자리 — 누가 앉았는지는 싣지 않는다. '찼다' 는 사실만 알린다.
         색만으로 구분하면 색을 못 가리는 분에게 아무 정보가 아니므로
         글자로도 적는다.
         누르면 반납 창이 열린다 (예약할 때 적은 정보를 다시 넣어야 한다).
         다른 기기에서도 자기 자리를 비울 수 있도록 좌석표에서 바로 연다. */
      return el('button', {
        type: 'button',
        class: 'seat seat--taken' + (isMine ? ' seat--mine' : ''),
        disabled: roomOpen ? null : '',
        'aria-label': seatLabel(n) + (isMine ? ' 내 자리' : ' 예약됨') +
          (noteText ? ' · ' + noteText : '') +
          (roomOpen ? (isMine ? ' · 반납하거나 자리를 바꾸려면 누르세요'
                              : ' · 본인 자리라면 눌러서 반납할 수 있습니다') : ''),
        onclick: () => openRelease(n)
      }, [
        dot,
        el('span', { class: 'seat__no', text: String(n) }),
        el('span', { class: 'seat__state', text: isMine ? '내 자리' : '예약됨' })
      ]);
    }

    return el('button', {
      type: 'button',
      class: 'seat seat--free',
      disabled: roomOpen ? null : '',
      'aria-label': seatLabel(n) + ' 빈 자리' + (noteText ? ' · ' + noteText : '') +
        (roomOpen ? ' · 눌러서 예약' : ' · 지금은 예약할 수 없습니다'),
      onclick: () => openForm(n)
    }, [
      dot,
      el('span', { class: 'seat__no', text: String(n) }),
      el('span', { class: 'seat__free', text: '빈 자리' })
    ]);
  }

  /* ==========================================================
     예약 폼
     ========================================================== */
  function openForm(n) {
    const mine = myBooking();
    if (mine) {
      toast('이미 ' + seatLabel(mine.seat) + ' 을 예약하셨습니다. 옮기시려면 먼저 그 자리를 비워주세요');
      openRelease(mine.seat);
      return;
    }
    picking = n;
    $('[data-ticket]').hidden = true;
    const box = $('[data-seat-form]');
    box.hidden = false;
    box.innerHTML = '';

    const pre = moving || {};   // 자리 변경 중이면 적었던 내용을 그대로 채운다
    const nameIn = el('input', { type: 'text', id: 'r-name', maxlength: '20',
      value: pre.name || '', autocomplete: 'name', placeholder: '실명을 적어주세요' });
    /* 인문대학 열람실이므로 '기타 (타 단대 · 복수전공 등)' 는 뺀다.
       비우기 쪽 목록은 그대로 둔다 — 이 항목이 있던 때 예약한 자리를
       본인이 못 비우게 되면 안 되기 때문이다. */
    const deptIn = el('select', { id: 'r-dept' }, [
      el('option', { value: '', text: '선택해 주세요' })
    ].concat(deptOptions().map((d) =>
      el('option', { value: d, text: d, selected: pre.dept === d ? '' : null }))));
    const sidIn = el('input', { type: 'text', id: 'r-sid', inputmode: 'numeric',
      value: pre.sid || '', maxlength: '12', autocomplete: 'off', placeholder: '예) 20241234' });
    const telIn = el('input', { type: 'tel', id: 'r-tel', inputmode: 'tel',
      value: pre.tel || '', maxlength: '16', autocomplete: 'tel', placeholder: '예) 010-1234-5678' });

    const err = el('p', { class: 'field__error', hidden: true });

    box.append(el('div', { class: 'admin__panel' }, [
      el('h2', { class: 'ticket__head',
        text: seatLabel(picking) + (moving ? ' 로 옮기기' : ' 예약') }),
      moving ? el('p', { class: 'field__help', style: 'margin:-6px 0 10px' }, [
        el('strong', { text: '앞 자리는 비워졌습니다. ' }),
        '적으셨던 내용을 그대로 채워뒀으니 확인만 하고 눌러주세요.'
      ]) : null,
      el('p', { class: 'field__help', style: 'margin:-6px 0 16px',
        text: '좌석표에는 좌석 번호만 뜹니다. 적어주신 내용은 학생회만 볼 수 있고, ' +
              '다른 이용자에게는 보이지 않습니다.' }),
      el('div', { class: 'field' }, [ el('label', { for: 'r-name', text: '이름' }), nameIn ]),
      el('div', { class: 'field' }, [ el('label', { for: 'r-dept', text: '학과' }), deptIn ]),
      el('div', { class: 'field' }, [
        el('label', { for: 'r-sid', text: '학번' }), sidIn,
        el('p', { class: 'field__help', text: '숫자만 적어주세요. 자리를 비울 때 그대로 다시 넣으셔야 합니다.' })
      ]),
      el('div', { class: 'field' }, [
        el('label', { for: 'r-tel', text: '전화번호' }), telIn,
        el('p', { class: 'field__help', text: '자리 관련 연락이 필요할 때만 씁니다. 자리를 비울 때는 묻지 않습니다.' })
      ]),
      err,
      el('div', { class: 'fcard__actions' }, [
        el('button', { type: 'button', class: 'btn btn--primary', id: 'r-submit',
          text: moving ? '이 자리로 옮기기' : '이 자리로 예약하기', onclick: () => submit(err) }),
        el('button', { type: 'button', class: 'btn', text: '그만두기',
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
    const tel = $('#r-tel').value.replace(/\D/g, '');

    if (!name) return fail(err, '이름을 적어주세요.');
    if (!dept) return fail(err, '학과를 선택해 주세요.');
    if (sid.length < 6 || sid.length > 10) return fail(err, '학번을 숫자로 정확히 적어주세요.');
    if (tel.length < 9 || tel.length > 11) return fail(err, '전화번호를 숫자로 정확히 적어주세요. 예) 01012345678');
    err.hidden = true;

    /* 누르는 사이에 시간이 지났을 수 있으므로 다시 본다 */
    if (!roomState().open) {
      renderHead();
      return fail(err, '지금은 예약을 받지 않는 시간입니다.');
    }

    const btn = $('#r-submit');
    btn.disabled = true; btn.textContent = '예약하는 중…';
    let outcome = true;
    try {
      outcome = await STORE.reserveSeat(today, picking, { name: name, dept: dept, sid: sid, tel: tel });
    } catch (e) {
      btn.disabled = false; btn.textContent = '이 자리로 예약하기';
      if (e && e.code === 'taken') {
        await refresh();
        return fail(err, '조금 전에 다른 분이 예약한 자리입니다. 다른 자리를 골라주세요.');
      }
      console.error(e);
      const d = describeError(e);
      return fail(err, '예약하지 못했습니다. ' + d.title + d.text);
    }

    const booked = { date: today, seat: picking, name: name, dept: dept, sid: sid, tel: tel,
                     at: new Date().toISOString(), noLog: outcome === 'no-log' };
    rememberBooking(booked);
    moving = null;
    $('[data-seat-form]').hidden = true;
    $('[data-seat-form]').innerHTML = '';
    picking = null;
    await refresh();
    showTicket(booked);
  }

  /* ==========================================================
     자리 비우기 — 반납 · 취소
     로그인이 없으므로 예약할 때 적은 이름 · 학과 · 학번으로 본인을 가린다.
     대조는 서버(보안 규칙)가 한다. 여기서 맞춰보는 것만으로는
     아무나 남의 자리를 비울 수 있기 때문이다.
     ========================================================== */
  function openRelease(n) {
    picking = null;
    const mine = myBooking();
    const isMine = mine && mine.seat === n;

    const box = $('[data-seat-form]');
    box.hidden = false;
    box.innerHTML = '';

    const nameIn = el('input', { type: 'text', id: 'x-name', maxlength: '20',
      value: isMine ? mine.name : '', placeholder: '예약할 때 적은 이름' });
    const deptIn = el('select', { id: 'x-dept' }, [
      el('option', { value: '', text: '선택해 주세요' })
    ].concat((S.departments || []).map((d) =>
      el('option', { value: d, text: d, selected: isMine && mine.dept === d ? '' : null }))));
    const sidIn = el('input', { type: 'text', id: 'x-sid', inputmode: 'numeric', maxlength: '12',
      value: isMine ? mine.sid : '', placeholder: '예약할 때 적은 학번' });
    const err = el('p', { class: 'field__error', hidden: true });

    box.append(el('div', { class: 'admin__panel' }, [
      el('h2', { class: 'ticket__head', text: seatLabel(n) + ' 자리 비우기' }),
      el('p', { class: 'field__help', style: 'margin:-6px 0 16px',
        text: isMine
          ? '예약하실 때 적으신 내용입니다. 그대로 두고 아래에서 골라주세요.'
          : '예약할 때 적은 이름 · 학과 · 학번을 그대로 넣어야 비울 수 있습니다.' }),
      el('div', { class: 'field' }, [ el('label', { for: 'x-name', text: '이름' }), nameIn ]),
      el('div', { class: 'field' }, [ el('label', { for: 'x-dept', text: '학과' }), deptIn ]),
      el('div', { class: 'field' }, [ el('label', { for: 'x-sid', text: '학번' }), sidIn ]),
      err,
      el('p', { class: 'field__help', style: 'margin:4px 0 0' }, [
        el('strong', { text: '반납' }), ' — 이 자리를 비웁니다. 곧바로 다른 학우가 예약할 수 있게 됩니다.',
        el('br'),
        el('strong', { text: '자리 변경' }), ' — 이 자리를 비우고 이어서 새 자리를 고릅니다.'
      ]),
      el('div', { class: 'fcard__actions' }, [
        el('button', { type: 'button', class: 'btn btn--primary', id: 'x-return',
          text: '반납하기', onclick: () => release(n, 'return', err) }),
        el('button', { type: 'button', class: 'btn', id: 'x-move',
          text: '자리 변경하기', onclick: () => release(n, 'move', err) }),
        el('button', { type: 'button', class: 'rowbtn', style: 'margin-left:auto', text: '닫기',
          onclick: () => { box.hidden = true; box.innerHTML = ''; } })
      ])
    ]));

    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => (isMine ? $('#x-return') : nameIn).focus(), 300);
  }

  async function release(n, kind, err) {
    const name = $('#x-name').value.trim();
    const dept = $('#x-dept').value;
    const sid = $('#x-sid').value.replace(/\D/g, '');
    const moveTo = kind === 'move';
    const word = moveTo ? '변경' : '반납';

    if (!name || !dept || !sid) return fail(err, '이름 · 학과 · 학번을 모두 넣어주세요.');
    err.hidden = true;

    /* 서버가 거부하는 이유는 여러 가지인데 화면에는 하나로만 보였다.
       미리 알 수 있는 것은 여기서 갈라 정확히 알려준다. */
    if (!roomState().open) {
      renderHead();
      return fail(err, '지금은 개방 시간이 아닙니다. ' + two(OPEN) + ':00~' + two(CLOSE) + ':00 에만 비울 수 있습니다.');
    }
    if (!seats[String(n)]) {
      await refresh();
      $('[data-seat-form]').hidden = true;
      $('[data-seat-form]').innerHTML = '';
      toast('이미 비워진 자리입니다. 새로 예약하실 수 있습니다');
      return;
    }

    const btns = [$('#x-return'), $('#x-move')];
    btns.forEach((b) => { b.disabled = true; });
    $(moveTo ? '#x-move' : '#x-return').textContent = word + '하는 중…';

    /* 서버에는 'return' / 'cancel' 두 가지만 저장한다. 규칙이 그 둘만 받는데,
       규칙을 다시 배포하게 하지 않으려고 '변경' 을 'cancel' 로 적는다.
       관리자 화면은 이 값을 '변경' 으로 읽어준다. */
    try {
      await STORE.releaseSeat(today, n, { name: name, dept: dept, sid: sid },
                              moveTo ? 'cancel' : 'return');
    } catch (e) {
      btns.forEach((b) => { b.disabled = false; });
      $('#x-return').textContent = '반납하기';
      $('#x-move').textContent = '자리 변경하기';
      if (e && e.code === 'mismatch') {
        showWhyBlocked(n, name, sid, err);
        return;
      }
      console.error(e);
      const d = describeError(e);
      return fail(err, word + '하지 못했습니다. ' + d.title + d.text);
    }

    const mine = myBooking();
    /* 변경이면 다음 자리에 그대로 쓸 수 있도록 적은 내용을 들고 있는다 */
    moving = moveTo ? { name: name, dept: dept, sid: sid, tel: (mine && mine.tel) || '' } : null;
    if (mine && mine.seat === n) forgetBooking();
    $('[data-seat-form]').hidden = true;
    $('[data-seat-form]').innerHTML = '';
    $('[data-ticket]').hidden = true;
    await refresh();

    if (moveTo) {
      toast(seatLabel(n) + ' 을 비웠습니다. 이어서 새 자리를 골라주세요');
      $('[data-map-section]').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    toast(seatLabel(n) + ' 을 반납했습니다');
  }

  /* 서버는 '거부' 라고만 알려주고 무엇이 어긋났는지는 말해주지 않는다.
     예전에는 좌석표에 실린 가린 이름과 학번 앞자리로 어디가 틀렸는지
     짚어주려 했는데, 두 가지가 잘못됐다.
       · 가린 값끼리 맞았다고 원래 값이 맞는 것은 아니다
         (홍길동 과 홍민동 은 둘 다 홍*동 이다). 그런데 '이름은 맞습니다'
         라고 단정해 학우가 엉뚱한 곳을 고치게 만들었다.
       · 그러자고 공개되는 문서에 가린 이름과 학번을 담아야 했다.
         지금은 담지 않으므로 대조할 것도 없다.
     그래서 확인한 것만 말한다 — 셋 중 하나가 다르다는 사실까지다. */
  function showWhyBlocked(n, name, sid, err) {
    const mine = myBooking();

    err.hidden = false;
    err.innerHTML = '';

    /* 예약은 됐는데 명단 기록이 남지 않은 자리라면, 무엇을 적어도 통과할 수
       없다. 서버가 대조할 기록 자체가 없기 때문이다. 이 브라우저에서 예약한
       자리라면 그 사실을 알고 있으니 헛수고를 시키지 않는다. */
    if (mine && mine.seat === n && mine.noLog) {
      err.append(
        el('strong', { text: '이 자리는 예약 기록이 서버에 저장되지 않았습니다. ' }),
        '자리는 잡혔지만, 대조할 기록이 없어 스스로는 비울 수 없습니다. ' +
        '학생회에 ' + seatLabel(n) + ' 이라고 알려주시면 비워드립니다.'
      );
      return;
    }

    err.append(
      el('strong', { text: '예약할 때 적으신 것과 하나 이상 다릅니다. ' }),
      '어느 것이 다른지는 여기서 알 수 없습니다. 셋 다 다시 확인해 주세요.',
      el('ul', { class: 'roomnotes__list', style: 'margin:8px 0 0; padding-left:18px' }, [
        el('li', { text: '이름 — 띄어쓰기까지 그대로' }),
        el('li', { text: '학과 — 예약할 때 고른 것과 같은 항목인지' }),
        el('li', { text: '학번 — ' + (sid.length ? sid.length + '자리를 넣으셨습니다' : '숫자만') }),
        el('li', { class: 'field__help', text: '전화번호는 대조하지 않습니다.' })
      ]),
      el('span', { class: 'field__help', style: 'display:block; margin-top:8px',
        text: '학생회에 ' + seatLabel(n) + ' 이라고 알려주시면 예약할 때 적은 내용을 ' +
              '확인해 드리거나 자리를 비워드립니다.' })
    );
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
        b.tel ? el('div', null, [el('dt', { text: '전화번호' }), el('dd', { text: formatTel(b.tel) })]) : null,
        el('div', null, [el('dt', { text: '이용 날짜' }), el('dd', { text: b.date })]),
        el('div', null, [el('dt', { text: '이용 시간' }),
                         el('dd', { text: two(OPEN) + ':00 – ' + two(CLOSE) + ':00' })]),
        el('div', null, [el('dt', { text: '예약한 시각' }),
                         el('dd', { text: seoulClock(b.at) + ' (한국 시각)' })])
      ]),
      el('p', { class: 'ticket__masked',
        text: '좌석표에는 좌석 번호만 뜹니다. 이름 · 학과 · 학번 · 전화번호는 ' +
              '학생회만 볼 수 있고 다른 이용자에게는 보이지 않습니다.' }),

      el('div', { class: 'ticket__notes' }, [
        el('h2', { class: 'roomnotes__title', text: '이용 안내' }),
        el('ul', { class: 'roomnotes__list' },
           (ROOM.notes || []).map((t) => el('li', { text: t })))
      ]),

      el('div', { class: 'fcard__actions', style: 'margin-top:16px' }, [
        el('button', { type: 'button', class: 'btn', text: '자리 반납 · 변경',
          onclick: () => openRelease(b.seat) })
      ]),
      b.noLog ? el('p', { class: 'field__error', style: 'margin-top:12px' }, [
        el('strong', { text: '예약 정보가 서버에 저장되지 않았습니다. ' }),
        '자리는 잡혔지만 스스로 반납 · 취소할 수 없습니다. 학생회에 알려주세요.'
      ]) : null,
      el('p', { class: 'ticket__foot',
        text: '이 화면은 캡처해 두시면 좋습니다. 자리를 비울 때는 위 단추를 누르고 ' +
              '예약할 때 적으신 이름 · 학과 · 학번을 그대로 넣어주세요.' })
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
    let loaded;
    try {
      loaded = await STORE.getSeats(today);
    } catch (e) {
      console.error(e);
      const box = $('[data-seatmap]');
      box.innerHTML = '';
      box.appendChild(errorBoxFor(e, '좌석표를 불러오지 못했습니다.'));
      return;
    }
    seats = loaded;

    /* 내 예약이 서버에서 사라졌으면(학생회가 자리를 비웠거나 하면) 이 기기의
       기억도 지운다. 그러지 않으면 확인증은 그대로 떠 있는데 반납을 누르면
       '이미 비워진 자리' 라고만 나와 아무것도 할 수 없게 된다. */
    const mine = myBooking();
    if (mine && !seats[String(mine.seat)]) {
      forgetBooking();
      $('[data-ticket]').hidden = true;
      $('[data-ticket]').innerHTML = '';
      if (roomState().open) toast(seatLabel(mine.seat) + ' 예약이 해제되었습니다');
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

    /* 마감 뒤에는 확인증도 내린다 — 그날 이용이 끝났기 때문 */
    const mine = myBooking();
    if (mine && roomState().open) showTicket(mine);
  });
})();
