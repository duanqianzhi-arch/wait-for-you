(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClassroomCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY = 86400000;
  const FIRST_MONDAY = Date.UTC(2026, 7, 31);
  const PERIODS = [
    [480,525],[535,580],[600,645],[655,700],[705,750],
    [845,890],[900,945],[955,1000],[1020,1065],[1075,1120],
    [1150,1195],[1205,1250],[1255,1300]
  ];
  function dateInfo(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('请选择有效日期。');
    const parts=value.split('-').map(Number);
    const stamp=Date.UTC(parts[0],parts[1]-1,parts[2]);
    const date=new Date(stamp);
    if (date.toISOString().slice(0,10)!==value) throw new Error('请选择有效日期。');
    const day=date.getUTCDay() || 7;
    return {week:Math.floor((stamp-FIRST_MONDAY)/DAY/7)+1, day, stamp};
  }
  function chinaToday(now=new Date()) {
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
    const find=t=>parts.find(p=>p.type===t).value;
    return `${find('year')}-${find('month')}-${find('day')}`;
  }
  function minutes(value) {
    if (!/^\d{2}:\d{2}$/.test(value || '')) throw new Error('请选择有效的开始和结束时间。');
    const [h,m]=value.split(':').map(Number);
    if (h>23 || m>59) throw new Error('时间格式有误。');
    return h*60+m;
  }
  function clock(n) { return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`; }
  function eventInterval(event) {
    if (event.session==='noon') {
      // 作息表只确认了完整的中午1—2节；如有单节安排，保守覆盖整个中午时段。
      return {start:750,end:840};
    }
    if (!PERIODS[event.start-1] || !PERIODS[event.end-1]) throw new Error('课表中存在未确认的节次。');
    return {start:PERIODS[event.start-1][0],end:PERIODS[event.end-1][1]};
  }
  function dayEvents(room,week,day) {
    return room.events.filter(e=>e.day===day && e.weeks.includes(week)).map(e=>({...e,firstSection:e.start,lastSection:e.end,...eventInterval(e)})).sort((a,b)=>a.start-b.start || a.end-b.end);
  }
  function mergeIntervals(events) {
    const merged=[];
    for (const event of [...events].sort((a,b)=>a.start-b.start)) {
      const last=merged[merged.length-1];
      if (last && event.start<=last.end) last.end=Math.max(last.end,event.end);
      else merged.push({start:event.start,end:event.end});
    }
    return merged;
  }
  function freeIntervals(events,start=480,end=1300) {
    const free=[];let cursor=start;
    for(const busy of mergeIntervals(events)) {
      if(busy.end<=start || busy.start>=end)continue;
      if(busy.start>cursor)free.push({start:cursor,end:Math.min(end,busy.start)});
      cursor=Math.max(cursor,busy.end);
    }
    if(cursor<end)free.push({start:cursor,end});
    return free;
  }
  function roomEnabled(room) {return !/曾宪梓/.test(`${room.building} ${room.name}`);}
  function buildingRank(room) {
    if(room.campus!=='金明校区')return 0;
    if(/金明综合楼|7号教学楼|七号教学楼/.test(room.building))return 0;
    return /计算机大楼/.test(room.building)?2:1;
  }
  function recommend(data,options) {
    const info=dateInfo(options.date);
    if(info.week<1 || info.week>data.maxWeek) throw new Error(`这个日期不在已导入学期的第1—${data.maxWeek}周内。`);
    const start=minutes(options.start),end=minutes(options.end);
    if(start>=end)throw new Error('结束时间需要晚于开始时间，暂不支持跨天查询。');
    const day=options.scheduleDay ? Number(options.scheduleDay) : info.day;
    if(!Number.isInteger(day) || day<1 || day>7)throw new Error('课表星期有误。');
    const mode=options.mode || 'balanced';
    if(!['low','balanced','high'].includes(mode))throw new Error('请选择推荐偏好。');
    const favorites=new Set(options.favorites || []);
    const campusRooms=data.rooms.filter(r=>r.campus===options.campus&&roomEnabled(r));
    if(!campusRooms.length)throw new Error('请选择已导入的校区。');
    const query=(options.keyword || '').trim().toLocaleLowerCase();
    const candidates=campusRooms.filter(r=>(!options.building || r.building===options.building) && (!query || `${r.name} ${r.building}`.toLocaleLowerCase().includes(query)) && (!options.onlyFavorites || favorites.has(r.id)));
    const floors={};
    for(const room of campusRooms) {
      (floors[room.building] ||= []).push(room.floor);
    }
    let busyCount=0;
    const results=[];
    for(const room of candidates) {
      const events=dayEvents(room,info.week,day);
      if(events.some(e=>e.start<end && e.end>start)){busyCount++;continue;}
      const buildingFloors=floors[room.building];
      const midpoint=(Math.min(...buildingFloors)+Math.max(...buildingFloors))/2;
      const floorRank=mode==='low' ? room.floor : mode==='high' ? -room.floor : Math.abs(room.floor-midpoint);
      const previous=events.filter(e=>e.end<=start).pop();
      const next=events.find(e=>e.start>=end);
      results.push({room,events,favorite:favorites.has(room.id),buildingRank:buildingRank(room),floorRank,availableStart:previous ? previous.end : 480,availableEnd:next ? next.start : 1300,nextClass:next ? next.start : null});
    }
    results.sort((a,b)=>a.buildingRank-b.buildingRank || Number(b.favorite)-Number(a.favorite) || a.floorRank-b.floorRank || (b.availableEnd-b.availableStart)-(a.availableEnd-a.availableStart) || a.room.name.localeCompare(b.room.name,'zh-CN',{numeric:true}));
    return {...info,scheduleDay:day,start,end,campusTotal:campusRooms.length,candidateCount:candidates.length,busyCount,results};
  }
  return {dateInfo,chinaToday,minutes,clock,eventInterval,dayEvents,mergeIntervals,freeIntervals,recommend,roomEnabled,PERIODS};
});
