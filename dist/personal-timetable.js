(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PersonalTimetable=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SEMESTER='2026-2027-1', FIRST_MONDAY='2026-08-31', MAX_WEEK=18, MAX_BYTES=512*1024;
  const DAYS={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':7,'天':7};
  const fields=new Set(['name','location','note','day','weeks','startPeriod','endPeriod']);
  const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
  const text=(v,max,empty=true)=>typeof v==='string'&&v.length<=max&&(empty||v.trim().length>0);
  const clone=v=>JSON.parse(JSON.stringify(v));
  function byteSize(value){
    const s=JSON.stringify(value);let size=0;
    for(const ch of s) {const cp=ch.codePointAt(0);size+=cp<128?1:cp<2048?2:cp<65536?3:4;}
    return size;
  }
  function withinSize(v){try{return byteSize(v)<=MAX_BYTES;}catch(_){return false;}}
  function validWeeks(v){return Array.isArray(v)&&v.length>0&&v.length<=MAX_WEEK&&v.every((n,i)=>integer(n,1,MAX_WEEK)&&(i===0||n>v[i-1]));}
  function parseWeeks(value){
    let parity=0;
    value=value.replace(/\s/g,'').replace(/[（【]/g,'(').replace(/[）】]/g,')').replace(/，/g,',').replace(/[－—–~～]/g,'-');
    const marker=value.match(/\(?([单双])\)?/g)||[];
    if(marker.length>1)throw Error('ambiguous_week');
    if(marker.length){parity=marker[0].includes('单')?1:2;value=value.replace(marker[0],'');}
    value=value.replace(/周$/,'');
    if(!/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(value))throw Error('unknown_week');
    const weeks=new Set();
    for(const part of value.split(',')){
      const [start,endValue]=part.split('-').map(Number),end=endValue===undefined?start:endValue;
      if(!integer(start,1,MAX_WEEK)||!integer(end,start,MAX_WEEK))throw Error('invalid_week');
      for(let n=start;n<=end;n++)if(!parity||(parity===1?n%2===1:n%2===0))weeks.add(n);
    }
    if(!weeks.size)throw Error('empty_week');
    return [...weeks].sort((a,b)=>a-b);
  }
  function parseMeeting(value,index){
    value=value.trim().replace(/[［【]/g,'[').replace(/[］】]/g,']').replace(/[－—–]/g,'-');
    const m=value.match(/^(.+?)\s*([一二三四五六日天])\s*\[\s*(\d+)(?:\s*-\s*(\d+))?\s*\]\s*(.*)$/);
    if(!m)throw Error('unknown_schedule');
    const weeks=parseWeeks(m[1]),day=DAYS[m[2]],startPeriod=Number(m[3]),endPeriod=Number(m[4]||m[3]),location=m[5].trim();
    if(!integer(startPeriod,1,13)||!integer(endPeriod,startPeriod,13)||!text(location,240))throw Error('invalid_period_or_location');
    return {key:`d${day}-p${startPeriod}_${endPeriod}-w${weeks.join('_')}-n${index}`,day,weeks,startPeriod,endPeriod,location};
  }
  function normalizeImport(raw,importedAt=new Date().toISOString()){
    const fail=kind=>({ok:false,timetable:null,issues:[{kind,row:0,segment:0}],counts:{courses:0,meetings:0,missingLocation:0}});
    if(!isObject(raw)||!withinSize(raw)||raw.complete!==true||raw.semester!==SEMESTER||!Array.isArray(raw.rows)||raw.rows.length>500||raw.declaredCourseCount!==raw.rows.length||!text(raw.adapterVersion,64,false))return fail('incomplete_or_invalid_import');
    const courses=[],issues=[],keys=new Set();let meetings=0,missingLocation=0;
    for(let i=0;i<raw.rows.length;i++){
      const row=raw.rows[i];
      if(!isObject(row)||!text(row.courseText,200,false)||!text(row.teachingGroupCode,128,false)||!text(row.scheduleText,10000)||row.selectionStatus!=='选中')return fail('invalid_course_fields');
      const match=row.courseText.trim().match(/^\[([A-Za-z0-9._-]{1,64})\]\s*(.+)$/s);
      if(!match||!text(match[2],120,false))return fail('invalid_course_name_or_code');
      const code=match[1],name=match[2].trim(),key=[SEMESTER,code,row.teachingGroupCode].map(encodeURIComponent).join(':');
      if(keys.has(key))return fail('duplicate_course');
      keys.add(key);
      const course={key,code,teachingGroupCode:row.teachingGroupCode,name,meetings:[],pendingSchedules:[],unscheduled:false};
      const segments=row.scheduleText.split(/[；;]/).map(s=>s.trim()).filter(Boolean);
      for(let n=0;n<segments.length;n++){
        if(/^(未排课|未安排|待定)$/.test(segments[n]))continue;
        try{const meeting=parseMeeting(segments[n],n);course.meetings.push(meeting);meetings++;if(!meeting.location)missingLocation++;}
        catch(error){course.pendingSchedules.push(segments[n]);issues.push({kind:error.message,row:i+1,segment:n+1});}
      }
      course.unscheduled=course.meetings.length===0;courses.push(course);
    }
    const timetable={schemaVersion:1,school:'henu',semester:SEMESTER,firstMonday:FIRST_MONDAY,maxWeek:MAX_WEEK,timezone:'Asia/Shanghai',importedAt,adapterVersion:raw.adapterVersion,revision:1,courses,overrides:[]};
    if(meetings>2000||!validateTimetable(timetable).ok)return fail('invalid_timetable');
    return {ok:true,timetable,issues,counts:{courses:courses.length,meetings,missingLocation}};
  }
  function validateTimetable(value){
    const errors=[];
    if(!isObject(value)||!withinSize(value))return {ok:false,errors:['invalid_size_or_shape']};
    if(value.schemaVersion!==1||value.school!=='henu'||value.semester!==SEMESTER||value.firstMonday!==FIRST_MONDAY||value.maxWeek!==MAX_WEEK||value.timezone!=='Asia/Shanghai'||!text(value.adapterVersion,64,false)||!text(value.importedAt,64,false)||!Number.isFinite(Date.parse(value.importedAt))||!integer(value.revision,1,2147483647))errors.push('invalid_metadata');
    if(!Array.isArray(value.courses)||value.courses.length>500||!Array.isArray(value.overrides)||value.overrides.length>2500)return {ok:false,errors:[...errors,'invalid_collections']};
    const keys=new Set(),byKey=new Map();let meetingCount=0;
    for(const c of value.courses){
      if(!isObject(c)||!text(c.key,400,false)||!text(c.code,64,false)||!text(c.teachingGroupCode,128,false)||!text(c.name,120,false)||keys.has(c.key)||!Array.isArray(c.meetings)||typeof c.unscheduled!=='boolean'||c.unscheduled!==(c.meetings.length===0)){errors.push('invalid_course');continue;}
      keys.add(c.key);byKey.set(c.key,c);
      if(!Array.isArray(c.pendingSchedules)||c.pendingSchedules.some(s=>!text(s,10000,false)))errors.push('invalid_pending_schedule');
      const mKeys=new Set();
      for(const m of c.meetings){
        meetingCount++;
        if(!isObject(m)||!text(m.key,400,false)||mKeys.has(m.key)||!integer(m.day,1,7)||!validWeeks(m.weeks)||!integer(m.startPeriod,1,13)||!integer(m.endPeriod,m.startPeriod,13)||!text(m.location,240))errors.push('invalid_meeting');
        if(m)mKeys.add(m.key);
      }
    }
    if(meetingCount>2000)errors.push('too_many_meetings');
    const overrideKeys=new Set();
    for(const o of value.overrides){
      if(!isObject(o)||!byKey.has(o.courseKey)||!(o.meetingKey===null||byKey.get(o.courseKey).meetings.some(m=>m.key===o.meetingKey))||!isObject(o.patch)||!isObject(o.baseSnapshot)){errors.push('invalid_override');continue;}
      const key=JSON.stringify([o.courseKey,o.meetingKey]);
      if(overrideKeys.has(key))errors.push('duplicate_override');overrideKeys.add(key);
      for(const k of Object.getOwnPropertyNames(o.patch)){
        const v=o.patch[k];
        if(!fields.has(k)||(k==='name'&&!text(v,120,false))||(k==='location'&&!text(v,240))||(k==='note'&&!text(v,1000))||(k==='day'&&!integer(v,1,7))||(k==='weeks'&&!validWeeks(v))||(['startPeriod','endPeriod'].includes(k)&&!integer(v,1,13)))errors.push('invalid_patch');
        if(o.meetingKey===null&&!['name','note'].includes(k))errors.push('invalid_course_patch');
      }
      if(o.meetingKey!==null){const meeting=byKey.get(o.courseKey).meetings.find(m=>m.key===o.meetingKey),effective={...meeting,...o.patch};if(effective.endPeriod<effective.startPeriod)errors.push('invalid_effective_period');}
    }
    return {ok:errors.length===0,errors};
  }
  function weekForDate(timetable,date){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw Error('invalid_date');
    const stamp=Date.parse(date+'T00:00:00Z');
    if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==date)throw Error('invalid_date');
    return Math.floor((stamp-Date.parse(timetable.firstMonday+'T00:00:00Z'))/604800000)+1;
  }
  function effectiveCourse(timetable,course){
    const c=clone(course);
    for(const o of timetable.overrides.filter(o=>o.courseKey===course.key)){
      if(o.meetingKey===null)Object.assign(c,o.patch);
      else {const meeting=c.meetings.find(m=>m.key===o.meetingKey);if(meeting)Object.assign(meeting,o.patch);}
    }
    return c;
  }
  function coursesForWeek(timetable,week){
    if(!integer(week,1,timetable.maxWeek))return [];
    const out=[];
    for(const original of timetable.courses){const course=effectiveCourse(timetable,original);for(const meeting of course.meetings)if(meeting.weeks.includes(week))out.push({course,meeting});}
    return out.sort((a,b)=>a.meeting.day-b.meeting.day||a.meeting.startPeriod-b.meeting.startPeriod||a.course.name.localeCompare(b.course.name));
  }
  return {normalizeImport,validateTimetable,coursesForWeek,weekForDate,effectiveCourse};
});
