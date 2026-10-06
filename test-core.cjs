const assert=require('node:assert/strict');
const core=require('./dist/core.js');
global.window={};require('./dist/data.js');
const data=window.CLASSROOM_DATA;
assert.equal(data.rooms.length,246);
assert.equal(data.counts.events,3722);
assert(!data.rooms.some(r=>r.campus.includes('郑州')));
assert.deepEqual(core.dateInfo('2026-10-03').week,5);
assert.equal(core.dateInfo('2026-10-03').day,6);
assert.equal(core.dateInfo('2026-10-04').week,5);
assert.equal(core.dateInfo('2026-10-05').week,6);
assert.equal(core.dateInfo('2026-08-31').week,1);
assert.equal(core.chinaToday(new Date('2026-10-03T16:01:00Z')),'2026-10-04');
assert.throws(()=>core.dateInfo('2026-02-30'));
assert.throws(()=>core.recommend(data,{campus:'金明校区',date:'2026-10-03',start:'15:00',end:'14:00'}));
assert.throws(()=>core.recommend(data,{campus:'金明校区',date:'2027-01-18',start:'14:00',end:'16:00'}));
const defaults={date:'2026-10-03',start:'14:05',end:'16:40',mode:'low'};
assert.equal(core.recommend(data,{...defaults,campus:'明伦校区'}).results.length,91);
assert.equal(core.recommend(data,{...defaults,campus:'金明校区'}).results.length,132);
assert.equal(core.recommend(data,{...defaults,campus:'金明校区',mode:'high'}).results[0].room.floor,5);
assert.equal(core.recommend(data,{...defaults,campus:'金明校区',keyword:'5203'}).results[0].room.floor,2);
const picked=data.rooms.find(r=>r.name==='金明综合楼5203');
assert.equal(core.recommend(data,{...defaults,campus:'金明校区',favorites:[picked.id]}).results[0].room.id,picked.id);
const synthetic={maxWeek:20,rooms:[{id:'r',name:'测试101',campus:'测试',building:'测试楼',floor:1,events:[{day:1,weeks:[5,7],start:1,end:2,session:'regular'}]}]};
const odd={campus:'测试',date:'2026-09-28',start:'08:00',end:'09:40',mode:'low'};
assert.equal(core.recommend(synthetic,odd).results.length,0);
assert.equal(core.recommend(synthetic,{...odd,date:'2026-10-05'}).results.length,1);
assert.equal(core.recommend(synthetic,{...odd,start:'09:40',end:'10:00'}).results.length,1);
assert.equal(core.recommend(synthetic,{...odd,start:'09:39',end:'10:00'}).results.length,0);
synthetic.rooms[0].events=[{day:1,weeks:[5],start:1,end:2,session:'noon'}];
assert.equal(core.recommend(synthetic,{...odd,start:'13:00',end:'13:30'}).results.length,0);
assert.equal(core.recommend(synthetic,{...odd,start:'14:00',end:'14:05'}).results.length,1);
assert.deepEqual(core.freeIntervals([{start:480,end:600},{start:550,end:700}]),[{start:700,end:1300}]);

// 对照导入的周次和节次逐间核验全部已导入教学周、7天、13节，而不是只检查示例结果。
let comparisons=0;
for(let week=1;week<=data.maxWeek;week++)for(let day=1;day<=7;day++){
  for(const room of data.rooms){
    const timeline=core.dayEvents(room,week,day);
    for(let section=1;section<=13;section++){
      const expected=room.events.some(e=>e.session==='regular'&&e.day===day&&e.weeks.includes(week)&&e.start<=section&&e.end>=section);
      const [start,end]=core.PERIODS[section-1];
      const actual=timeline.some(e=>e.start<end&&e.end>start);
      assert.equal(actual,expected,`${room.id} 第${week}周 星期${day} 第${section}节`);
      comparisons++;
    }
  }
}
console.log(JSON.stringify({rooms:data.rooms.length,events:data.counts.events,sectionComparisons:comparisons,checks:'日期、周次、单双周、中午、冲突边界、偏好排序、完整节次对照均通过'}));
