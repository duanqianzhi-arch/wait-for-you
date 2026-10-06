(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ClassroomFlow = factory();
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const MIN = 480, MAX = 1300;
  function minutes(value) {
    if (!/^\d{2}:\d{2}$/.test(value || '')) return NaN;
    const [hour, minute] = value.split(':').map(Number);
    return hour < 24 && minute < 60 ? hour * 60 + minute : NaN;
  }
  function clock(value) {
    return `${String(Math.floor(value / 60)).padStart(2,'0')}:${String(value % 60).padStart(2,'0')}`;
  }
  function timeError(start, end) {
    const a = minutes(start), b = minutes(end);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return '请填写完整的开始和结束时间。';
    if (a < MIN || b > MAX || a > MAX || b < MIN) return '请选择 08:00—21:40 内的自习时间。';
    if (a >= b) return '结束时间要晚于开始时间。';
    return '';
  }
  function moveBoundary(start, end, field, value) {
    let a = minutes(start), b = minutes(end);
    if (!Number.isFinite(a)) a = MIN;
    if (!Number.isFinite(b)) b = MAX;
    a = Math.max(MIN, Math.min(MAX - 1, a));
    b = Math.max(MIN + 1, Math.min(MAX, b));
    const target = Math.round(Number(value));
    if (!Number.isFinite(target)) return {start:clock(a), end:clock(Math.max(a + 1, b))};
    if (field === 'start') {
      a = Math.max(MIN, Math.min(MAX - 1, target));
      if (a >= b) b = a + 1;
    } else if (field === 'end') {
      b = Math.max(MIN + 1, Math.min(MAX, target));
      if (b <= a) a = b - 1;
    }
    return {start:clock(a), end:clock(b)};
  }
  function tearOutcome(start, end, distance, cancelled=false) {
    if (cancelled || !Number.isFinite(Number(distance)) || Number(distance) < 96) return 'stay';
    return timeError(start,end) ? 'invalid' : 'advance';
  }
  return {timeError, moveBoundary, tearOutcome};
});
