const assert = require('node:assert/strict');
const fs = require('node:fs');
const file = './dist/personal-timetable.js';
const api = fs.existsSync(file) ? require(file) : {};
assert.equal(typeof api.normalizeImport, 'function', 'automatic personal timetable parser is missing');
const stamp = '2026-10-08T08:00:00.000Z';
const raw = {
  adapterVersion:'henu-list-1', semester:'2026-2027-1', declaredCourseCount:10, complete:true,
  rows:Array.from({length:10},(_,i)=>({
    courseText:`[${10000000+i}]示例课程${i+1}`, teachingGroupCode:`G${i}-001`, selectionStatus:'选中',
    scheduleText:i<5 ? `1-18周 三[3-5] 示例教学楼${i+1}01(96)` : [5,7,9].includes(i) ? '1-9周 二[3-4] ；10-18周 四[9-10]' : '1-18周 五[6-8]'
  }))
};
const result = api.normalizeImport(raw,stamp);
assert.equal(result.ok,true);
assert.deepEqual(result.counts,{courses:10,meetings:13,missingLocation:8});
assert.deepEqual(result.issues,[]);
assert.equal(api.validateTimetable(result.timetable).ok,true);
assert.equal(api.weekForDate(result.timetable,'2026-10-03'),5);
assert.equal(api.coursesForWeek(result.timetable,9).filter(x=>x.course.name==='示例课程6')[0].meeting.day,2);
assert.equal(api.coursesForWeek(result.timetable,10).filter(x=>x.course.name==='示例课程6')[0].meeting.day,4);
assert.throws(()=>api.weekForDate(result.timetable,'2026-02-30'));
function one(scheduleText,courseText='[12345678]测试课程') {
  return {...raw,declaredCourseCount:1,rows:[{courseText,teachingGroupCode:'T-001',selectionStatus:'选中',scheduleText}]};
}
for(const [text,want,day,start,end,location] of [
  ['1-6周(单) 一[1-2] 示例楼101',[1,3,5],1,1,2,'示例楼101'],
  ['1-6(双)周 二[3-4]',[2,4,6],2,3,4,''],
  ['2-8周（双） 三【5】 示例室',[2,4,6,8],3,5,5,'示例室'],
  ['1-4,7,9-12周 四[11-13]',[1,2,3,4,7,9,10,11,12],4,11,13,''],
  [' 3，5，7 周 日［2－3］ 地点 ',[3,5,7],7,2,3,'地点'],
  ['3周 五[6]',[3],5,6,6,'']
]) {
  const parsed=api.normalizeImport(one(text),stamp);
  assert.equal(parsed.ok,true,text);
  assert.deepEqual(parsed.issues,[],text);
  const m=parsed.timetable.courses[0].meetings[0];
  assert.deepEqual(m.weeks,want,text);
  assert.deepEqual([m.day,m.startPeriod,m.endPeriod,m.location],[day,start,end,location]);
}
for(const text of ['未知周次 三[1-2]','0-18周 一[1-2]','1-19周 一[1-2]','1-18周 一[0-2]','1-18周 一[3-2]','1-18周 一[12-14]']) {
  const parsed=api.normalizeImport(one(text),stamp);
  assert.equal(parsed.ok,true);
  assert.equal(parsed.issues.length,1,text);
  assert.equal(parsed.timetable.courses[0].meetings.length,0,text);
  assert.equal(parsed.timetable.courses[0].unscheduled,true,text);
}
const unscheduled=api.normalizeImport(one('未排课'),stamp);
assert.equal(unscheduled.timetable.courses[0].unscheduled,true);
assert.equal(api.coursesForWeek(unscheduled.timetable,5).length,0);
const html=api.normalizeImport(one('1-18周 三[1-2]','[12345678]<script>课程</script>'),stamp);
assert.equal(html.timetable.courses[0].name,'<script>课程</script>');
assert.equal(api.normalizeImport({...raw,complete:false},stamp).ok,false);
assert.equal(api.normalizeImport({...raw,declaredCourseCount:11},stamp).ok,false);
assert.equal(api.normalizeImport({...raw,semester:'2025-2026-2'},stamp).ok,false);
assert.equal(api.normalizeImport(one('1-18周 一[1-2]','[12345678]'+ '课'.repeat(121)),stamp).ok,false);
assert.equal(api.normalizeImport({...raw,rows:[...raw.rows,raw.rows[0]],declaredCourseCount:11},stamp).ok,false);
for(const mutate of [
  t=>t.courses[0].meetings[0].weeks=[0,1],
  t=>t.courses[0].meetings[0].day='3',
  t=>t.courses[0].meetings[0].location='地'.repeat(241),
  t=>t.overrides=[{courseKey:t.courses[0].key,meetingKey:null,baseSnapshot:{},patch:{__proto__:{x:1},evil:'x'}}]
]) {
  const t=JSON.parse(JSON.stringify(result.timetable)); mutate(t);
  assert.equal(api.validateTimetable(t).ok,false);
}
assert.equal(typeof api.applyEdit,'function','editable personal timetable API is missing');
const original=result.timetable,c=original.courses[0],m=c.meetings[0];
const changed=api.applyEdit(original,c.key,m.key,{location:'我的教室',note:'带电脑'});
for(const mutate of [t=>t.overrides[0].baseSnapshot={},t=>t.overrides[0].patch.name='不可用字段',t=>t.courses[0].localOnly='true',t=>t.courses[0].unexpected='not allowed']){
  const invalid=JSON.parse(JSON.stringify(changed));mutate(invalid);assert.equal(api.validateTimetable(invalid).ok,false,'native-compatible schema must reject malformed edits');
}
assert.equal(api.coursesForWeek(changed,5).find(x=>x.course.key===c.key).meeting.location,'我的教室');
assert.equal(original.overrides.length,0);
assert.equal(changed.courses[0].meetings[0].location,'示例教学楼101(96)');
assert.equal(api.validateTimetable(changed).ok,true);
assert.equal(api.restoreEdit(changed,c.key,m.key).overrides.length,0);
assert.throws(()=>api.applyEdit(original,c.key,m.key,{startPeriod:6,endPeriod:3}));
const renamed=api.applyEdit(changed,c.key,null,{name:'我的课程名'});
assert.equal(api.coursesForWeek(renamed,5).find(x=>x.course.key===c.key).course.name,'我的课程名');
const identical=api.prepareSync(changed,result.timetable);
assert.deepEqual(identical.conflicts,[]);
assert.equal(identical.draft.courses.length,10);
assert.equal(identical.draft.overrides.length,1);
const schoolChanged=JSON.parse(JSON.stringify(result.timetable));schoolChanged.courses[0].meetings[0].location='学校更新的教室';
const conflict=api.prepareSync(changed,schoolChanged);
assert.equal(conflict.conflicts.length,1);
assert.throws(()=>api.resolveSync(conflict,{}));
const kept=api.resolveSync(conflict,{[conflict.conflicts[0].id]:'keep'});
assert.equal(api.coursesForWeek(kept,5).find(x=>x.course.key===c.key).meeting.location,'我的教室');
const accepted=api.resolveSync(conflict,{[conflict.conflicts[0].id]:'school'});
assert.equal(api.coursesForWeek(accepted,5).find(x=>x.course.key===c.key).meeting.location,'学校更新的教室');
const moved=JSON.parse(JSON.stringify(schoolChanged));moved.courses[0].meetings[0]={...moved.courses[0].meetings[0],key:'new-key',day:6};
const moveConflict=api.prepareSync(changed,moved);assert.equal(moveConflict.conflicts.length,1);
assert.equal(api.coursesForWeek(api.resolveSync(moveConflict,{[moveConflict.conflicts[0].id]:'keep'}),5).filter(x=>x.course.key===c.key).length,1);
const keptMoved=api.resolveSync(moveConflict,{[moveConflict.conflicts[0].id]:'keep'});
assert.equal(typeof api.restoreCourse,'function','retained arrangements require restore to latest school baseline');
const restoredMoved=api.restoreCourse(keptMoved,c.key);
assert.equal(restoredMoved.courses.find(x=>x.key===c.key).meetings[0].day,6);
assert.equal(restoredMoved.courses.find(x=>x.key===c.key).meetings[0].location,'学校更新的教室');
assert.equal(api.prepareSync(keptMoved,moved).conflicts.length,0,'same school source must not repeat a resolved arrangement conflict');
const split=JSON.parse(JSON.stringify(moved));split.courses[0].meetings.push({...split.courses[0].meetings[0],key:'split-second',day:7});
assert.equal(api.prepareSync(changed,split).conflicts[0].kind,'arrangements');
assert.equal(api.prepareSync(kept,schoolChanged).conflicts.length,0,'accepted keep decision must update sync baseline');
const removed=JSON.parse(JSON.stringify(result.timetable));removed.courses.splice(0,1);
const removal=api.prepareSync(changed,removed);assert.equal(removal.conflicts.length,1);
const retained=api.resolveSync(removal,{[removal.conflicts[0].id]:'keep'});assert.equal(retained.courses.length,10);assert.equal(retained.courses.find(x=>x.key===c.key).localOnly,true);
assert.equal(api.restoreCourse(retained,c.key).courses.length,9,'restoring latest school deletion must remove the retained local course');
assert.equal(api.replaceWithNewTable(schoolChanged).overrides.length,0);
console.log('PASS: personal timetable parsing, edits, restore, safe resync, changed/moved/deleted conflicts');
