#!/usr/bin/env node
/* ============================================================
   firestore.rules 붙여넣기 전 점검
   ------------------------------------------------------------
   실행:  node docs/check-firestore-rules.js

   왜 있는가
     규칙 파일은 학생회가 Firebase 콘솔에 붙여넣어 게시한다.
     그런데 콘솔은 잘못된 규칙을 '게시하지 않고' 만다 — 옛 규칙이
     그대로 살아 있는 채로. 그래서 붙여넣고 나서도 화면에서는
     아무 일도 없어 보이지만, 실제로는 예전 규칙이 돌고 있다.

     실제로 이 일이 났다. 개방 시간을 08~18시로 고치면서 그 옆에
     있던 releasedAfterBooking · matchesBooking 정의를 함께 지웠고,
     호출부만 남아 규칙이 게시되지 않았다. 그 뒤로 학우가 자리를
     반납할 때마다 '예약할 때 적으신 내용과 다릅니다' 가 떴다.
     무엇을 적어도 통과할 수 없었는데, 화면은 사람 탓을 하고 있었다.

     그 종류의 사고는 눈으로는 잘 안 잡힌다. 그래서 기계에 맡긴다.
   ============================================================ */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'firestore.rules');
const src = fs.readFileSync(FILE, 'utf8');

/* 주석과 문자열은 검사에서 뺀다 — 그 안의 괄호에 속지 않도록 */
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\/\/[^\n]*/g, ' ')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''");

/* 규칙 언어가 원래 주는 것들 (내장 함수 · 메서드 · 형변환) */
const BUILTIN = new Set([
  'exists', 'existsAfter', 'get', 'getAfter', 'debug',
  'string', 'int', 'float', 'bool', 'timestamp', 'duration', 'path', 'latlng',
  'keys', 'values', 'size', 'hasOnly', 'hasAll', 'hasAny',
  'matches', 'split', 'join', 'trim', 'lower', 'upper', 'replace',
  'toMillis', 'toBase64', 'toHexString', 'toUtf8',
  'year', 'month', 'day', 'hours', 'minutes', 'seconds', 'nanos',
  'date', 'time', 'dayOfWeek', 'dayOfYear',
  'diff', 'value', 'abs', 'ceil', 'floor', 'round', 'pow', 'sqrt', 'isSqrt',
  'concat', 'removeAll', 'union', 'intersection', 'difference', 'range',
  'lowerBound', 'upperBound', 'affectedKeys', 'in', 'is'
]);

const defined = new Set();
for (const m of code.matchAll(/\bfunction\s+([A-Za-z_]\w*)\s*\(/g)) defined.add(m[1]);

const problems = [];

/* --- (1) 정의 없이 부르는 함수 --- */
const calls = new Map();                       // 이름 → 처음 나온 줄
for (const m of code.matchAll(/(^|[^\w.$])([A-Za-z_]\w*)\s*\(/g)) {
  const name = m[2];
  if (BUILTIN.has(name) || defined.has(name)) continue;
  if (name === 'function' || name === 'if' || name === 'return') continue;
  if (!calls.has(name)) calls.set(name, code.slice(0, m.index).split('\n').length);
}
for (const [name, line] of calls) {
  problems.push(`${line}행: ${name}() 을 부르는데 정의가 없습니다. ` +
                `콘솔이 게시를 거부하고 옛 규칙이 그대로 남습니다.`);
}

/* --- (2) 부르는 곳이 없는 함수 (지우다 만 흔적) --- */
for (const name of defined) {
  const used = new RegExp('(^|[^\\w.$])' + name + '\\s*\\(', 'g');
  let n = 0;
  for (const _ of code.matchAll(used)) n++;
  if (n <= 1) problems.push(`${name}() 은 정의만 있고 쓰이지 않습니다.`);
}

/* --- (3) 함수 인자 개수가 맞는지 --- */
const arity = new Map();
for (const m of code.matchAll(/\bfunction\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/g)) {
  arity.set(m[1], m[2].trim() ? m[2].split(',').length : 0);
}
for (const [name, want] of arity) {
  for (const m of code.matchAll(new RegExp('(^|[^\\w.$])' + name + '\\s*\\(', 'g'))) {
    const open = m.index + m[0].length - 1;
    let depth = 0, end = -1;
    for (let i = open; i < code.length; i++) {
      if (code[i] === '(') depth++;
      else if (code[i] === ')') { depth--; if (!depth) { end = i; break; } }
    }
    if (end < 0) continue;
    const inner = code.slice(open + 1, end);
    if (/^\s*$/.test(inner) && want === 0) continue;
    const got = splitTop(inner).length;
    if (/\bfunction\s+$/.test(code.slice(0, m.index + m[0].length - name.length - 1))) continue;
    if (got !== want) {
      const line = code.slice(0, m.index).split('\n').length;
      problems.push(`${line}행: ${name}() 에 인자 ${got}개를 넘겼지만 ${want}개를 받습니다.`);
    }
  }
}

/* --- (4) 괄호 · 중괄호 짝 --- */
for (const [open, close, what] of [['{', '}', '중괄호'], ['(', ')', '괄호'], ['[', ']', '대괄호']]) {
  const a = (code.match(new RegExp('\\' + open, 'g')) || []).length;
  const b = (code.match(new RegExp('\\' + close, 'g')) || []).length;
  if (a !== b) problems.push(`${what} 짝이 맞지 않습니다 (${open} ${a}개, ${close} ${b}개).`);
}

/* --- (5) 반드시 있어야 할 것 --- */
/* 이 둘은 원본에서 본다 — 위에서 문자열을 '' 로 지웠기 때문이다 */
if (!/rules_version\s*=\s*'2'/.test(src)) problems.push("맨 위 rules_version = '2' 가 없습니다.");
if (!/match\s*\/\{document=\*\*\}/.test(code)) problems.push('맨 끝 전체 차단 규칙이 없습니다.');

/* 쉼표로 나누되 괄호 · 대괄호 안의 쉼표는 세지 않는다 */
function splitTop(s) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && !depth) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter((x) => x !== '');
}

if (problems.length) {
  console.error('\n❌ firestore.rules 에 문제가 있습니다. 이대로 붙여넣으면');
  console.error('   콘솔이 게시를 거부하고, 예전 규칙이 그대로 돌아갑니다.\n');
  problems.forEach((p) => console.error('   · ' + p));
  console.error('');
  process.exit(1);
}

console.log('✅ firestore.rules — 함수 ' + defined.size + '개, 빠진 정의 없음. 게시해도 됩니다.');
console.log('   (문법만 본 것입니다. 게시 뒤에는 실제로 예약 → 반납까지 한 번 해보세요.)');
