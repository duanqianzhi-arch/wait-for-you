(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./personal-timetable.js'):root.PersonalTimetable);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TimetableUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(model){
  'use strict';
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const days=['一','二','三','四','五','六','日'];
  const clone=v=>JSON.parse(JSON.stringify(v));
  function createNativeBridge(browser){
    const endpoint=browser.StudyTimetableBridge,pending=new Map(),listeners=new Set();let sequence=0;
    const supported=Boolean(endpoint&&typeof endpoint.postMessage==='function');
    if(supported)endpoint.onmessage=event=>{
      let reply;try{reply=JSON.parse(event.data);}catch(_){return;}
      if(reply.event){for(const listener of listeners)listener(reply);return;}
      const job=pending.get(reply.id);if(!job)return;clearTimeout(job.timer);pending.delete(reply.id);
      if(reply.ok)job.resolve(reply.payload);else job.reject(Error(reply.errorCode||'native_error'));
    };
    return {supported,subscribe:fn=>{listeners.add(fn);return ()=>listeners.delete(fn);},request(action,payload){
      if(!supported)return Promise.reject(Error('unsupported'));
      const id='timetable-'+(++sequence);
      return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{pending.delete(id);reject(Error('native_timeout'));},15000);
        pending.set(id,{resolve,reject,timer});
        try{endpoint.postMessage(JSON.stringify({id,action,...(payload===undefined?{}:{payload})}));}
        catch(error){clearTimeout(timer);pending.delete(id);reject(error);}
      });
    }};
  }
  function createTimetableUI({core,native,renderHost,navigate,toast}){
    let activeRoute='timetable';
    const state={table:null,loaded:!native.supported,week:1,current:true,busy:false,error:'',preview:null,previewValues:{},editDraft:null,clearConfirm:false,today:core.chinaToday()};
    const button=(action,label,extra='',cls='secondary-button')=>`<button type="button" class="${cls}" data-timetable-action="${action}" ${extra}>${label}</button>`;
    const courseButton=(course,body=escape(course.name),cls='timetable-course')=>button('course',body,`data-course="${escape(course.key)}"`,cls);
    const heading=(title,subtitle)=>`<header class="page-heading"><h1 tabindex="-1">${title}</h1><p>${subtitle}</p></header>`;
    const error=()=>state.error?`<p class="error" role="alert">${escape(state.error)}</p>`:'';
    const repaint=()=>renderHost();
    function currentWeek(){return state.table?model.weekForDate(state.table,core.chinaToday()):1;}
    function setCurrent(){state.week=Math.max(1,Math.min(18,currentWeek()));state.current=true;}
    function acceptTable(table){
      if(table!==null&&!model.validateTimetable(table).ok)throw Error('invalid_saved_timetable');
      state.table=table;if(state.current)setCurrent();
    }
    const ready=native.supported?native.request('load').then(acceptTable).catch(()=>{state.error='课表暂时无法读取。请退出后重新打开；已有课表没有被删除。';}).finally(()=>{state.loaded=true;repaint();}):Promise.resolve();
    native.subscribe?.(message=>{
      state.busy=false;
      if(message.event==='import-ready'){
        const result=model.normalizeImport(message.payload);
        if(!result.ok){state.error='没有识别到完整的本学期课表，已有课表保持原样。';repaint();return;}
        state.preview=result;state.previewValues={};state.error='';navigate('timetable/import-preview');
      }else if(message.event==='import-error'){state.error='课表读取失败，请稍后重试。已有课表保持原样。';repaint();}
      else if(message.event==='import-cancelled'){state.error='';repaint();toast('已取消导入，已有课表保持原样。');}
    });
    function weekly(){
      if(!native.supported)return heading('我的课表','Your week, at a glance.')+`<div class="timetable-empty"><img src="assets/ink-dog-time.png" alt="" width="160" height="160"><h2>在安卓新版中查看个人课表</h2><p>当前浏览器支持自习查询。自动导入需要包含个人课表功能的安卓新版，由你在学校原网页登录后读取。</p><p>个人课表保存在手机里。网页版暂不接入学校登录。</p></div>`;
      if(!state.loaded)return heading('我的课表','正在读取手机里的课表…')+error();
      if(!state.table)return heading('我的课表','把这一周，轻轻展开。')+error()+`<div class="timetable-empty"><img src="assets/ink-dog-time.png" alt="" width="160" height="160"><h2>先把你的课表带过来</h2><p>在学校原网页完成登录，我们读取本学期课表。确认后保存在这台手机上。</p>${button('import','从教务系统导入',state.busy?'disabled':'','primary-button')}<p class="helper">不把账号密码或个人课表上传给开发者。</p></div>`;
      const table=state.table,entries=model.coursesForWeek(table,state.week),actual=currentWeek();
      const start=Date.parse(table.firstMonday+'T00:00:00Z')+(state.week-1)*604800000;
      const dates=days.map((_,i)=>new Date(start+i*86400000).toISOString().slice(0,10));
      const notice=actual<1||actual>table.maxWeek?'今天不在已导入的学期内。':`${core.chinaToday()} · 本周是第 ${actual} 周`;
      const rows=core.PERIODS.map((period,index)=>`<tr><th scope="row"><b>${index+1}</b><small>${core.clock(period[0])}<br>${core.clock(period[1])}</small></th>${days.map((_,day)=>`<td>${entries.filter(e=>e.meeting.day===day+1&&e.meeting.startPeriod===index+1).map(({course,meeting})=>courseButton(course,`<b>${escape(course.name)}</b><small>${meeting.startPeriod}–${meeting.endPeriod} 节 · ${core.clock(core.PERIODS[meeting.startPeriod-1][0])}–${core.clock(core.PERIODS[meeting.endPeriod-1][1])}</small><span>${escape(meeting.location||'地点待补充')}</span>${table.overrides.some(o=>o.courseKey===course.key)?'<small>有本地修改</small>':''}`)).join('')}</td>`).join('')}</tr>`).join('');
      const others=table.courses.filter(c=>c.unscheduled||c.pendingSchedules.length||c.localOnly);
      return heading('我的课表','Your week, at a glance.')+error()+`<div class="timetable-toolbar">${button('previous-week','←',`aria-label="上一周" ${state.week<=1||state.busy?'disabled':''}`)}<strong>第 ${state.week} 周</strong>${button('next-week','→',`aria-label="下一周" ${state.week>=table.maxWeek||state.busy?'disabled':''}`)}${button('current-week','本周',state.busy?'disabled':'')}</div><p class="helper">${notice} · 左右滑动查看整周，点课程可修改。</p><div class="timetable-scroll" tabindex="0" role="region" aria-label="周课表，可左右滑动"><table class="weekly-timetable"><caption class="sr-only">第 ${state.week} 周课程安排</caption><thead><tr><th scope="col">节次</th>${days.map((day,i)=>`<th scope="col" ${dates[i]===core.chinaToday()?'class="is-today"':''}>周${day}<small>${dates[i].slice(5).replace('-','/')}</small></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>${entries.length?'':'<p class="timetable-no-course">这一周没有已排课的课程。</p>'}${others.length?`<details class="timetable-other"><summary>待完善或本地保留的课程（${others.length}）</summary><div class="timetable-other-list">${others.map(c=>courseButton(c)).join('')}</div></details>`:''}<div class="timetable-actions">${button('import','重新同步',state.busy?'disabled':'')}${button('clear','删除个人课表',state.busy?'disabled':'')}</div><p class="helper">学校记录更新后，请主动同步。个人课表独立于右上角的自习校区。</p>${state.clearConfirm?`<section class="timetable-confirm" role="region" aria-label="确认删除个人课表"><p>删除这台手机的个人课表和本地修改？教室收藏会保留。</p>${button('confirm-clear','确认删除',state.busy?'disabled':'')}${button('cancel-clear','取消',state.busy?'disabled':'')}</section>`:''}`;
    }
    function detail(route){
      let key;try{key=decodeURIComponent(route.slice('timetable/course/'.length));}catch(_){key='';}
      const original=state.table?.courses.find(c=>c.key===key);
      if(!original)return heading('课程详情',state.loaded?'这门课程不在当前课表里。':'正在读取课表…')+button('back','返回课表')+error();
      const course=model.effectiveCourse(state.table,original);
      const draft=state.editDraft?.key===key?state.editDraft.values:{};
      const field=(label,name,value,max)=>`<label class="field">${label}<input name="${name}" value="${escape(draft[name]??value)}" maxlength="${max}"></label>`;
      const periods=(name,value)=>`<select name="${name}" aria-label="${name.startsWith('start')?'开始':'结束'}节次">${core.PERIODS.map((p,i)=>`<option value="${i+1}" ${i+1===Number(draft[name]??value)?'selected':''}>第 ${i+1} 节 · ${core.clock(p[name.startsWith('start')?0:1])}</option>`).join('')}</select>`;
      return button('back','← 我的课表')+heading(escape(course.name),'修改只保存在手机上，不改变学校记录。')+error()+`<form class="timetable-edit" data-timetable-form data-course="${escape(key)}">${field('课程名称','name',course.name,120)}${field('课程备注','course-note',course.note||'',1000)}${course.meetings.map((m,i)=>`<fieldset><legend>安排 ${i+1}</legend><label class="field">星期<select name="day-${i}">${days.map((d,n)=>`<option value="${n+1}" ${Number(draft['day-'+i]??m.day)===n+1?'selected':''}>星期${d}</option>`).join('')}</select></label><div class="timetable-period-fields">${periods('start-'+i,m.startPeriod)}${periods('end-'+i,m.endPeriod)}</div>${field('教学周（例如 1,3,5 或 1-18）','weeks-'+i,m.weeks.join(','),120)}${field('教室地点','location-'+i,m.location,240)}${field('这次安排的备注','note-'+i,m.note||'',1000)}<p class="helper">学校地点：${escape(original.meetings[i].location||'尚未填写')}</p></fieldset>`).join('')}${course.unscheduled?'<p class="helper">学校尚未排出可识别的上课时间，暂不放进周课表；安排更新后请重新同步。</p>':''}${course.pendingSchedules.length?`<section class="timetable-pending"><h2>尚未识别的安排</h2><p>以下原文字仍保留，未放进周课表，请以学校记录为准。</p>${course.pendingSchedules.map(s=>`<p>${escape(s)}</p>`).join('')}</section>`:''}${course.localOnly?'<p class="helper">这门课的原安排由你在同步时保留，需要核对学校最新记录。</p>':''}<div class="timetable-actions"><button type="submit" class="primary-button" ${state.busy?'disabled':''}>保存修改</button>${button('restore','恢复学校记录',`data-course="${escape(key)}" ${state.busy?'disabled':''}`)}${button('back','取消',state.busy?'disabled':'')}</div></form>`;
    }
    function preview(){
      if(!state.preview)return heading('确认导入','没有待保存的课表。')+button('back','返回课表');
      const {timetable,counts,issues}=state.preview,prepared=state.table?model.prepareSync(state.table,timetable):null;
      const schoolSummary=c=>c.newCourse?`<p class="helper">学校最新记录：${escape(c.newCourse.name)}</p>${c.newCourse.meetings.map(m=>`<p class="helper">周${days[m.day-1]} · ${m.startPeriod}–${m.endPeriod} 节 · 第 ${m.weeks.join(',')} 周 · ${escape(m.location||'地点待补充')}</p>`).join('')}`:'<p class="helper">学校最新记录：这门课程已移除。</p>';
      return heading('确认导入','先看一眼，再把课表留在手机里。')+error()+`<form class="timetable-preview"><p><b>2026—2027 第一学期</b></p><p>${counts.courses} 门课程 · ${counts.meetings} 条安排 · ${counts.missingLocation} 条地点待补充</p><details><summary>查看课程名称</summary><ul>${timetable.courses.map(c=>`<li>${escape(c.name)}</li>`).join('')}</ul></details>${state.table?`<label class="field">这次导入<select name="import-mode"><option value="sync">同步当前课表，保护本地修改</option><option value="replace">替换为另一份课表，清除原修改</option></select></label><p class="helper">如果登录了另一个账号，请选择“替换为另一份课表”。</p>`:''}${issues.length?`<label class="timetable-ack"><input type="checkbox" name="ack-issues">有 ${issues.length} 条安排未识别。我知道它们不会出现在周课表里，可在课程详情查看原文字。</label>`:''}${prepared?.conflicts.length?`<div class="timetable-conflicts"><h2>需要你选择的变化</h2><p>同步时逐项选择；替换另一份课表会清除旧修改。</p>${prepared.conflicts.map(c=>`<fieldset><legend>${escape(c.courseName)}</legend><p>${{fields:'学校记录与本地修改都发生了变化。',removed:'学校新课表里没有这门课。',arrangements:'学校改变或拆分了安排，无法可靠对应原修改。'}[c.kind]}</p>${schoolSummary(c)}${c.overrides.map(o=>`<p class="helper">我的修改：${escape(Object.entries(o.patch).map(([k,v])=>({name:'名称',location:'地点',note:'备注',day:'星期',weeks:'教学周',startPeriod:'开始节次',endPeriod:'结束节次'}[k])+': '+String(v)).join('；'))}</p>`).join('')}<label><input type="radio" name="${c.id}" value="keep">${c.kind==='fields'?'保留我的修改':'保留我的原安排与修改'}</label><label><input type="radio" name="${c.id}" value="school">采用学校记录</label></fieldset>`).join('')}</div>`:''}<div class="timetable-actions">${button('save-preview','确认保存',state.busy?'disabled':'','primary-button')}${button('cancel-preview','取消',state.busy?'disabled':'')}</div></form>`;
    }
    function render(route){
      activeRoute=route;
      let markup=route==='timetable/import-preview'?preview():route.startsWith('timetable/course/')?detail(route):weekly();
      if(route==='timetable/import-preview'){
        if(state.previewValues['import-mode']==='replace')markup=markup.replace('<option value="replace">','<option value="replace" selected>');
        if(state.previewValues['ack-issues'])markup=markup.replace('name="ack-issues">','name="ack-issues" checked>');
        for(const [id,value] of Object.entries(state.previewValues))if(/^conflict-\d+$/.test(id)&&['keep','school'].includes(value))markup=markup.replace(`name="${id}" value="${value}">`,`name="${id}" value="${value}" checked>`);
      }
      if(route.startsWith('timetable/course/')&&state.table){
        let key='';try{key=decodeURIComponent(route.slice('timetable/course/'.length));}catch(_){}
        const retained=state.table.courses.find(c=>c.key===key&&c.localOnly);
        if(retained)markup+=`<section class="timetable-pending"><h2>学校最新记录</h2>${retained.schoolRecord?`<p>恢复学校记录会采用以下最新安排：</p>${retained.schoolRecord.meetings.map(m=>`<p>周${days[m.day-1]} · ${m.startPeriod}–${m.endPeriod} 节 · 第 ${m.weeks.join(',')} 周 · ${escape(m.location||'地点待补充')}</p>`).join('')}`:'<p>学校最新课表已移除这门课。恢复学校记录会移除这台手机上的保留课程及其修改。</p>'}</section>`;
      }
      return `<section class="page timetable-page" data-page="timetable" aria-busy="${state.busy}">${markup}</section>`;
    }
    async function save(table){
      state.busy=true;state.error='';repaint();
      try{const result=await native.request('save',table);acceptTable(result);return true;}
      catch(_){state.error='未保存：手机存储暂时不可用。之前的课表保持原样，请重试。';return false;}
      finally{state.busy=false;repaint();}
    }
    async function perform(action,target){
      if(state.busy)return;
      state.error='';
      if(action==='course'){navigate('timetable/course/'+encodeURIComponent(target.dataset.course));return;}
      if(action==='back'||action==='cancel-preview'){state.preview=null;state.editDraft=null;navigate('timetable');return;}
      if(action==='previous-week'||action==='next-week'){state.week=Math.max(1,Math.min(18,state.week+(action==='next-week'?1:-1)));state.current=false;repaint();return;}
      if(action==='current-week'){setCurrent();repaint();return;}
      if(action==='clear'||action==='cancel-clear'){state.clearConfirm=action==='clear';repaint();return;}
      if(action==='import'){
        state.busy=true;repaint();
        try{await native.request('import');}catch(_){state.busy=false;state.error='无法打开学校登录页，请检查 Android System WebView 或稍后重试。';repaint();}return;
      }
      if(action==='confirm-clear'){
        state.busy=true;repaint();try{await native.request('clear');state.table=null;state.clearConfirm=false;state.preview=null;toast('个人课表已删除。');}
        catch(_){state.error='删除失败，已有课表保持原样。';}finally{state.busy=false;repaint();}return;
      }
      if(action==='restore'){
        const restored=model.restoreCourse(state.table,target.dataset.course);
        state.editDraft=null;if(await save(restored))toast('已恢复这门课的学校记录。');return;
      }
      if(action==='save-preview'){
        const form=target.closest('form'),values=new form.ownerDocument.defaultView.FormData(form);
        state.previewValues=Object.fromEntries(values);
        if(state.preview.issues.length&&!values.has('ack-issues')){state.error='请先确认未识别安排的提示。';repaint();return;}
        let draft;
        try{draft=state.table&&values.get('import-mode')!=='replace'?model.resolveSync(model.prepareSync(state.table,state.preview.timetable),Object.fromEntries(values)):model.replaceWithNewTable(state.preview.timetable);}
        catch(_){state.error='请为每一项变化选择保留我的修改或采用学校记录。';repaint();return;}
        if(await save(draft)){state.preview=null;navigate('timetable');toast('课表已保存，可以离线查看。');}
      }
    }
    function handleAction(target){if(!target.dataset.timetableAction)return false;void perform(target.dataset.timetableAction,target).catch(()=>{state.busy=false;state.error='操作未完成，请重试。';repaint();});return true;}
    function handleInput(target){
      const form=target.closest('form');if(!form)return false;
      const values=()=>Object.fromEntries(new form.ownerDocument.defaultView.FormData(form));
      if(form.classList.contains('timetable-preview')){state.previewValues=values();return true;}
      if(form.hasAttribute('data-timetable-form')){state.editDraft={key:form.dataset.course,values:values()};return true;}
      return false;
    }
    function parseWeeks(value){
      const weeks=new Set();for(const part of value.replace(/，/g,',').replace(/\s/g,'').split(',')){
        const match=part.match(/^(\d+)(?:-(\d+))?$/);if(!match)throw Error('invalid_weeks');
        const start=Number(match[1]),end=Number(match[2]||match[1]);if(start<1||end>18||end<start)throw Error('invalid_weeks');
        for(let w=start;w<=end;w++)weeks.add(w);
      }return [...weeks].sort((a,b)=>a-b);
    }
    function handleSubmit(form){
      if(!form.hasAttribute('data-timetable-form'))return false;if(state.busy)return true;
      const values=new form.ownerDocument.defaultView.FormData(form),key=form.dataset.course,course=state.table.courses.find(c=>c.key===key);
      state.editDraft={key,values:Object.fromEntries(values)};
      try{
        let draft=state.table;
        const edit=(meetingKey,patch)=>{
          const current=meetingKey===null?model.effectiveCourse(state.table,course):model.effectiveCourse(state.table,course).meetings.find(m=>m.key===meetingKey);
          const changes=Object.fromEntries(Object.entries(patch).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(current[k]??'')));
          if(Object.keys(changes).length)draft=model.applyEdit(draft,key,meetingKey,changes);
        };
        edit(null,{name:values.get('name').trim(),note:values.get('course-note')});
        course.meetings.forEach((m,i)=>edit(m.key,{day:Number(values.get('day-'+i)),startPeriod:Number(values.get('start-'+i)),endPeriod:Number(values.get('end-'+i)),weeks:parseWeeks(values.get('weeks-'+i)),location:values.get('location-'+i),note:values.get('note-'+i)}));
        void save(draft).then(ok=>{if(ok){state.editDraft=null;repaint();toast('修改已保存在这台手机上。');}});
      }catch(_){state.error='未保存：请检查名称、教学周和节次，结束节次不能早于开始节次。';repaint();}
      return true;
    }
    function handleBack(){if(state.preview||state.clearConfirm||activeRoute.startsWith('timetable/course/')){state.preview=null;state.clearConfirm=false;state.editDraft=null;navigate('timetable');return true;}return false;}
    function refreshToday(){const today=core.chinaToday();if(today!==state.today){state.today=today;if(state.current)setCurrent();repaint();}}
    return {ready,render,handleAction,handleInput,handleSubmit,handleBack,refreshToday};
  }
  return {createTimetableUI,createNativeBridge};
});
