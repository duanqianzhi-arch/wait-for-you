const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const modulePath = path.join(__dirname, 'dist/flow.js');
const flow = fs.existsSync(modulePath) ? require(modulePath) : {};
assert.equal(typeof flow.timeError, 'function', '需要校验自习时间，避免无效时段进入下一步');

// 输入的无效时间必须被拦截，而非悄悄查询其他时间。
for (const [start, end] of [['16:40','14:05'], ['14:05','14:05'], ['', '16:40'], ['24:00','16:40'], ['07:59','16:40'], ['14:05','21:41']]) {
  assert.ok(flow.timeError(start, end), `${start}—${end} 应拦截`);
}
for (const [start, end] of [['08:00','21:40'], ['09:41','09:42'], ['14:05','16:40']]) {
  assert.equal(flow.timeError(start, end), '', `${start}—${end} 应通过`);
}

// 单独拖动任一端点越过另一端时，保持拖动的位置，并带动另一端。
assert.deepEqual(flow.moveBoundary('14:05','16:40','start',1020), {start:'17:00', end:'17:01'});
assert.deepEqual(flow.moveBoundary('14:05','16:40','end',780), {start:'12:59', end:'13:00'});
assert.deepEqual(flow.moveBoundary('14:05','16:40','start',1299), {start:'21:39', end:'21:40'});
assert.deepEqual(flow.moveBoundary('14:05','16:40','end',481), {start:'08:00', end:'08:01'});
assert.deepEqual(flow.moveBoundary('09:41','16:40','end',1081), {start:'09:41', end:'18:01'});
// 清空输入后，拖动滑块仍能恢复一个有效时段。
assert.deepEqual(flow.moveBoundary('','16:40','start',600), {start:'10:00', end:'16:40'});
assert.deepEqual(flow.moveBoundary('14:05','','end',900), {start:'14:05', end:'15:00'});
console.log('时间校验、滑块跨越、边界与精确分钟同步：通过');

assert.equal(typeof flow.tearOutcome, 'function', '撕页手势需要区分轻触、取消和真正向下拉动');
assert.equal(flow.tearOutcome('14:05','16:40',12), 'stay', '轻触纸角不应换页');
assert.equal(flow.tearOutcome('14:05','16:40',-120), 'stay', '向上拉不应撕下纸页');
assert.equal(flow.tearOutcome('14:05','16:40',120,true), 'stay', '系统取消手势不应换页');
assert.equal(flow.tearOutcome('17:00','16:40',120), 'invalid', '撕页不应绕过时间校验');
assert.equal(flow.tearOutcome('','16:40',120), 'invalid', '空时间不能借手势进入下一步');
assert.equal(flow.tearOutcome('14:05','16:40',120), 'advance');
assert.equal(flow.tearOutcome('08:00','21:40',120), 'advance');
console.log('撕页轻触、取消、方向和时间门控：通过');
