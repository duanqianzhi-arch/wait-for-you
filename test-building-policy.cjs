const assert=require('node:assert/strict');
const core=require('./dist/core.js');
const room=(id,building,floor,events=[])=>({id,name:building+id,campus:'金明校区',building,floor,events});
const data={maxWeek:20,rooms:[room('a','计算机大楼',1),room('b','金明综合楼3',5),room('c','7号教学楼',4),room('z','曾宪梓楼',1)]};
const query={campus:'金明校区',date:'2026-10-05',start:'14:05',end:'16:40'};
for(const mode of ['low','balanced','high']){
  const q=core.recommend(data,{...query,mode,favorites:['a','b','z']});
  assert.deepEqual(q.results.map(x=>x.room.id),['b','c','a'],'楼栋优先；首选组内喜欢优先；计算机大楼即使喜欢也放在后备组');
  assert.equal(q.campusTotal,3,'曾宪梓楼从可用教室总数中移除');
  assert.equal(core.recommend(data,{...query,mode,keyword:'曾宪梓'}).results.length,0,'搜索或喜欢不能重新加入被移除的楼');
}
data.rooms[1].events=[{day:1,weeks:[6],start:6,end:8,session:'regular'}];
assert.deepEqual(core.recommend(data,{...query,mode:'low',favorites:['b']}).results.map(x=>x.room.id),['c','a'],'首选且喜欢的教室有课时仍被排除');

global.window={};require('./dist/data.js');
const actual=window.CLASSROOM_DATA;
for(const mode of ['low','balanced','high']){
  const q=core.recommend(actual,{...query,date:'2026-10-03',mode});
  assert(!q.results.some(x=>x.room.name.includes('曾宪梓')));
  const computers=q.results.map((x,i)=>x.room.building==='计算机大楼'?i:-1).filter(i=>i>=0);
  const preferred=q.results.map((x,i)=>/金明综合楼|7号教学楼/.test(x.room.building)?i:-1).filter(i=>i>=0);
  assert(computers.length>0&&preferred.length>0);
  assert(Math.min(...computers)>Math.max(...preferred),'真实课表中计算机大楼位于所有首选教学楼之后');
}
assert.equal(core.recommend(actual,{...query,mode:'low'}).campusTotal,142);
assert.equal(core.recommend(actual,{...query,campus:'明伦校区',mode:'low'}).campusTotal,93);
console.log('曾宪梓楼移除、首选楼栋、后备计算机楼、喜欢与有课过滤：通过');
