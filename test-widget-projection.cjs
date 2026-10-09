const assert=require('node:assert/strict'),model=require('./dist/personal-timetable.js');
for(const v of require('./test-fixtures/widget-projection.json')){
  assert.equal(model.validateTimetable(v.table).ok,true,v.name);
  const week=model.weekForDate(v.table,v.date),day=new Date(v.date+'T00:00:00Z').getUTCDay()||7;
  const entries=model.coursesForWeek(v.table,week).filter(e=>e.meeting.day===day).map(({course,meeting:m})=>({courseKey:course.key,name:course.name,location:m.location,day:m.day,startPeriod:m.startPeriod,endPeriod:m.endPeriod}));
  assert.deepEqual({week,pending:v.table.courses.some(c=>c.unscheduled||c.pendingSchedules.length>0),entries},v.expected,v.name);
}
console.log('PASS: shared widget vectors match effective personal timetable');
