(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./personal-timetable.js'):root.PersonalTimetable,typeof module==='object'&&module.exports?require('./henu-excel-import.js'):root.HenuExcelImport);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TimetableUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(model,excelReader){
  'use strict';
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const days=['一','二','三','四','五','六','日'];
  const clone=v=>JSON.parse(JSON.stringify(v));
  function layoutMeetings(entries){
    const result=[];
    for(let day=1;day<=7;day++){
      const sorted=entries.filter(e=>e.meeting.day===day).sort((a,b)=>a.meeting.startPeriod-b.meeting.startPeriod||a.meeting.endPeriod-b.meeting.endPeriod||a.course.key.localeCompare(b.course.key));
      let group=[],end=0;
      const flush=()=>{
        const lanes=[];
        for(const entry of group){let lane=lanes.findIndex(last=>last<entry.meeting.startPeriod);if(lane<0)lane=lanes.length;lanes[lane]=entry.meeting.endPeriod;entry.lane=lane;}
        for(const entry of group)result.push({...entry,lanes:lanes.length});group=[];
      };
      for(const entry of sorted){if(group.length&&entry.meeting.startPeriod>end)flush();if(!group.length)end=0;group.push({...entry});end=Math.max(end,entry.meeting.endPeriod);}
      flush();
    }
    return result;
  }
  function createNativeBridge(browser,name='StudyTimetableBridge'){
    const endpoint=browser[name],pending=new Map(),listeners=new Set();let sequence=0;
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
  function createBrowserBridge(browser){
    const key='henu-personal-timetable-v1';
    return {supported:Boolean(browser),async request(action,payload){
      if(!browser)throw Error('unsupported');
      if(action==='load'){
        const text=browser.localStorage.getItem(key);if(text===null)return null;
        const table=JSON.parse(text);if(!model.validateTimetable(table).ok)throw Error('invalid_saved_timetable');return table;
      }
      if(action==='save'){
        if(!model.validateTimetable(payload).ok)throw Error('invalid_timetable');
        browser.localStorage.setItem(key,JSON.stringify(payload));return clone(payload);
      }
      if(action==='clear'){browser.localStorage.removeItem(key);return null;}
      throw Error('unsupported');
    }};
  }
  function createTimetableUI({core,native,browser,getRoute,renderHost,navigate,toast}){
    const android=native.supported,store=android?native:createBrowserBridge(browser);
    let activeRoute='timetable';
    const state={table:null,loaded:!store.supported,week:1,current:true,busy:false,error:'',preview:null,previewValues:{},editDraft:null,clearConfirm:false,today:core.chinaToday(),zoom:1,widgetChoice:false,widgetHelp:false,webText:'',shortcutText:'',guideOpen:false};
    let pinch=null,suppressCourseUntil=0;
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
    const ready=store.supported?store.request('load').then(acceptTable).catch(()=>{state.error='课表暂时无法读取。请退出后重新打开；已有课表没有被删除。';}).finally(()=>{state.loaded=true;repaint();}):Promise.resolve();
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
      if(!android&&!state.table&&store.supported)return heading('我的课表','Your week, at a glance.')+error()+`<div class="timetable-empty"><img src="assets/ink-dog-time.png" alt="" width="160" height="160"><h2>把课表带到这里</h2><p>从教务系统导出个人课表 .xls，在这里选择文件，核对后保存，不用逐门填写。</p>${button('import','导入我的课表','','primary-button')}<p class="helper">课表只保存在当前浏览器里。请保持同一浏览器／桌面网页入口，清除网站数据会删除课表。</p></div>`;
      if(!state.loaded)return heading('我的课表','正在读取手机里的课表…')+error();
      if(!state.table)return heading('我的课表','把这一周，轻轻展开。')+error()+`<div class="timetable-empty"><img src="assets/ink-dog-time.png" alt="" width="160" height="160"><h2>先把你的课表带过来</h2><p>在学校原网页完成登录，我们读取本学期课表。确认后保存在这台手机上。</p>${button('import','从教务系统导入',state.busy?'disabled':'','primary-button')}<p class="helper">不把账号密码或个人课表上传给开发者。</p></div>`;
      const table=state.table,entries=model.coursesForWeek(table,state.week),actual=currentWeek();
      const start=Date.parse(table.firstMonday+'T00:00:00Z')+(state.week-1)*604800000;
      const dates=days.map((_,i)=>new Date(start+i*86400000).toISOString().slice(0,10));
      const notice=actual<1||actual>table.maxWeek?'今天不在已导入的学期内。':`${core.chinaToday()} · 本周是第 ${actual} 周`;
      const rows=core.PERIODS.map((period,index)=>`<div class="timetable-period" aria-hidden="true" style="grid-row:${index+2};grid-column:1"><b>${index+1}</b><small>${core.clock(period[0])}<br>${core.clock(period[1])}</small></div>${days.map((_,day)=>`<div class="timetable-cell" aria-hidden="true" style="grid-row:${index+2};grid-column:${day+2}"></div>`).join('')}`).join('');
      const blocks=layoutMeetings(entries).map(({course,meeting,lane,lanes})=>{
        const label=`${course.name}，周${days[meeting.day-1]}，${meeting.startPeriod}–${meeting.endPeriod} 节，${core.clock(core.PERIODS[meeting.startPeriod-1][0])}–${core.clock(core.PERIODS[meeting.endPeriod-1][1])}，${meeting.location||'地点待补充'}，点击查看和修改`;
        return button('course',`<b>${escape(course.name)}</b><span>${escape(meeting.location||'地点待补充')}</span>`,`data-course="${escape(course.key)}" aria-label="${escape(label)}" style="grid-column:${meeting.day+1};grid-row:${meeting.startPeriod+1} / ${meeting.endPeriod+2};width:calc(${100/lanes}% - 3px);margin-left:calc(${lane*100/lanes}% + 1px)"`,'timetable-course');
      }).join('');
      const grid=`<div class="timetable-zoom-controls" aria-label="课表缩放"><span>双指缩放 · 点课程可修改</span>${button('zoom-out','−',`aria-label="缩小课表" ${state.zoom<=1?'disabled':''}`)}<output data-timetable-zoom>${Math.round(state.zoom*100)}%</output>${button('zoom-in','+',`aria-label="放大课表" ${state.zoom>=2.2?'disabled':''}`)}${button('zoom-fit','适应屏幕')}</div><div class="timetable-scroll" tabindex="0" role="region" aria-label="第 ${state.week} 周课表，可缩放及滑动"><div class="weekly-timetable" style="--timetable-zoom:${state.zoom}"><span class="timetable-day timetable-corner" aria-hidden="true" style="grid-column:1;grid-row:1">节</span>${days.map((day,i)=>`<div class="timetable-day ${dates[i]===core.chinaToday()?'is-today':''}" style="grid-column:${i+2};grid-row:1">周${day}<small>${dates[i].slice(5).replace('-','/')}</small></div>`).join('')}${rows}${blocks}</div></div>`;
      const unplaced=table.courses.filter(c=>c.unscheduled||c.pendingSchedules.length).map(c=>model.effectiveCourse(table,c));
      const unplacedSection=unplaced.length?`<section class="timetable-other timetable-unplaced" aria-label="线上与未排定课程"><h2>线上／未排定课程（${unplaced.length}）</h2><p class="helper">保留整学期未排定或待核对的安排，具体时间以课程通知为准。</p><div class="timetable-other-list">${unplaced.map(c=>{
        const raw=c.pendingSchedules.join('；'),summary=raw?`学校时间说明：${raw.slice(0,240)}${raw.length>240?'…':''}`:'学校未提供具体上课时间';
        return courseButton(c,`<b>${escape(c.name)}</b><span>${c.unscheduled?'未排定时间':'部分安排待核对'}</span><span>${escape(summary)}</span>`);
      }).join('')}</div></section>`:'';
      const others=table.courses.filter(c=>c.localOnly&&!c.unscheduled&&!c.pendingSchedules.length).map(c=>model.effectiveCourse(table,c));
      const widgetControls=android?`<div class="timetable-widget-controls">${button('widget-choice','添加桌面组件',`aria-expanded="${state.widgetChoice}" ${state.busy?'disabled':''}`)}${state.widgetChoice?`<section aria-label="选择桌面组件"><p>留在桌面，抬眼就能看见。</p><div class="timetable-actions">${button('pin-today','今日课程',state.busy?'disabled':'')}${button('pin-week','本周课表',state.busy?'disabled':'')}</div><p class="helper">今日看下一节课，本周看七天安排。添加后可长按组件调整大小。</p></section>`:''}${state.widgetHelp?'<p role="status" class="helper">也可以长按桌面空白处 → 添加小部件 → 等你下课，选择“今日课程”或“本周课表”。</p>':''}</div>`:'';
      return `<div class="timetable-week-heading"><h1 tabindex="-1">我的课表</h1><div class="timetable-toolbar">${button('previous-week','←',`aria-label="上一周" ${state.week<=1||state.busy?'disabled':''}`)}<strong>第 ${state.week} 周</strong>${button('next-week','→',`aria-label="下一周" ${state.week>=table.maxWeek||state.busy?'disabled':''}`)}${button('current-week','本周',state.busy?'disabled':'')}</div></div>`+error()+`<p class="timetable-date-notice">${notice}</p>${grid}${unplacedSection}${widgetControls}${entries.length?'':'<p class="timetable-no-course">这一周没有已排课的课程。</p>'}${others.length?`<details class="timetable-other"><summary>本地保留的课程（${others.length}）</summary><div class="timetable-other-list">${others.map(c=>courseButton(c)).join('')}</div></details>`:''}<div class="timetable-actions">${button('import','重新同步',state.busy?'disabled':'')}${button('clear','删除个人课表',state.busy?'disabled':'')}</div><p class="helper">学校记录更新后，请主动同步。个人课表独立于右上角的自习校区。</p>${state.clearConfirm?`<section class="timetable-confirm" role="region" aria-label="确认删除个人课表"><p>删除这台手机的个人课表和本地修改？教室收藏会保留。</p>${button('confirm-clear','确认删除',state.busy?'disabled':'')}${button('cancel-clear','取消',state.busy?'disabled':'')}</section>`:''}`;
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
      const noTotal=issues.some(i=>i.kind==='export_no_total'),unknown=issues.filter(i=>i.kind!=='export_no_total').length,unplaced=timetable.courses.filter(c=>c.unscheduled).length;
      const schoolSummary=c=>c.newCourse?`<p class="helper">学校最新记录：${escape(c.newCourse.name)}</p>${c.newCourse.meetings.map(m=>`<p class="helper">周${days[m.day-1]} · ${m.startPeriod}–${m.endPeriod} 节 · 第 ${m.weeks.join(',')} 周 · ${escape(m.location||'地点待补充')}</p>`).join('')}`:'<p class="helper">学校最新记录：这门课程已移除。</p>';
      return heading('确认导入','先看一眼，再把课表留在手机里。')+error()+`<form class="timetable-preview"><p><b>2026—2027 第一学期</b></p><p>${counts.courses} 门课程 · ${counts.meetings} 条安排 · ${counts.missingLocation} 条地点待补充</p><p>${unplaced} 门线上／未排定课程将放在课表底部。</p><details><summary>查看课程名称</summary><ul>${timetable.courses.map(c=>`<li>${escape(c.name)}</li>`).join('')}</ul></details>${state.table?`<label class="field">这次导入<select name="import-mode"><option value="sync">同步当前课表，保护本地修改</option><option value="replace">替换为另一份课表，清除原修改</option></select></label><p class="helper">如果登录了另一个账号，请选择“替换为另一份课表”。</p>`:''}${issues.length?`<label class="timetable-ack"><input type="checkbox" name="ack-issues">${noTotal?'文件未声明总门数，请核对上面的课程数量与名单。':''}${unknown?`有 ${unknown} 条安排未识别，将保留原文字，不放进周课表。`:''}我已核对并确认导入。</label>`:''}${prepared?.conflicts.length?`<div class="timetable-conflicts"><h2>需要你选择的变化</h2><p>同步时逐项选择；替换另一份课表会清除旧修改。</p>${prepared.conflicts.map(c=>`<fieldset><legend>${escape(c.courseName)}</legend><p>${{fields:'学校记录与本地修改都发生了变化。',removed:'学校新课表里没有这门课。',arrangements:'学校改变或拆分了安排，无法可靠对应原修改。'}[c.kind]}</p>${schoolSummary(c)}${c.overrides.map(o=>`<p class="helper">我的修改：${escape(Object.entries(o.patch).map(([k,v])=>({name:'名称',location:'地点',note:'备注',day:'星期',weeks:'教学周',startPeriod:'开始节次',endPeriod:'结束节次'}[k])+': '+String(v)).join('；'))}</p>`).join('')}<label><input type="radio" name="${c.id}" value="keep">${c.kind==='fields'?'保留我的修改':'保留我的原安排与修改'}</label><label><input type="radio" name="${c.id}" value="school">采用学校记录</label></fieldset>`).join('')}</div>`:''}<div class="timetable-actions">${button('save-preview','确认保存',state.busy?'disabled':'','primary-button')}${button('cancel-preview','取消',state.busy?'disabled':'')}</div></form>`;
    }
    function webImport(){
      return heading('导入我的课表','选一个文件，把这一学期带过来。')+error()+`<div class="timetable-actions">${button('back','返回课表')}<a class="secondary-button" href="https://xk.henu.edu.cn/cas/login.action" target="_blank" rel="noopener noreferrer">打开河南大学教务</a></div>
      <ol class="web-import-steps"><li>教务系统进入“个人课表”，选择本学期和“列表”，点右上角“导出”。</li><li>将 .xls 保存到手机“文件”，在这里选择它。</li><li>核对课程数量和线上课，确认后保存。</li></ol>
      <label class="field">选择教务课表文件<input type="file" data-web-excel accept=".xls,application/vnd.ms-excel,text/html" ${state.busy?'disabled':''}></label>
      <p class="helper" role="status">${state.busy?'正在读取文件并识别课程…':'支持河南大学列表导出的 .xls，兼容 UTF-8 和 GBK；不需要安装 Excel。'}</p>
      <p class="helper">线上／未排定课程保留在课表底部。普通 xlsx、截图或 PDF 暂不支持。</p>
      <details class="web-import-advanced" ${state.guideOpen?'open':''}><summary>其他方式：快捷指令 / JSON</summary><ol class="web-import-steps"><li>Safari 登录教务，进入“教学安排 → 个人课表”，切换“列表”，等待全部页面显示。</li><li>共享 → 运行“导入到等你下课”快捷指令，它会复制课表内容。</li><li>回到这里粘贴，查看预览后确认保存。</li></ol><details class="web-shortcut-guide" ${state.guideOpen?'open':''}><summary>首次使用：配置 Safari 快捷指令</summary><p>只需设置一次；当前提供配置说明，还没有可一键安装的签名快捷指令。</p><ol><li>打开苹果“快捷指令”，新建快捷指令，命名“导入到等你下课”。在详情打开“在共享表单中显示”，输入类型选择“Safari 网页”。</li><li>添加“在网页上运行 JavaScript”，网页参数选“快捷指令输入”。点下面按钮复制脚本，将原示例脚本全部替换为它。</li><li>接着添加“拷贝到剪贴板”，内容使用上一步结果。保存后，在 Safari 教务课表页的共享菜单运行它。</li></ol>${button('copy-shortcut','复制读取脚本',state.busy?'disabled':'')}${state.shortcutText?`<label class="field">也可以长按脚本，全选并复制<textarea readonly rows="4">${escape(state.shortcutText)}</textarea></label>`:''}<p class="helper">首次运行时，iPhone 可能要求允许网页脚本。脚本仅提取完整课表，不读取密码或 Cookie，不联网发送课程。<a href="https://support.apple.com/zh-cn/guide/shortcuts/apdb71a01d93/ios" target="_blank" rel="noopener noreferrer">苹果操作说明</a></p></details><label class="field">课表内容<textarea data-web-import rows="6" placeholder="在这里长按，粘贴快捷指令复制的课表" spellcheck="false">${escape(state.webText)}</textarea></label><div class="timetable-actions">${button('paste-web','读取已复制课表',state.busy?'disabled':'')}${button('read-web','生成课表预览',state.busy?'disabled':'','primary-button')}</div><details><summary>也可以选择课表 JSON 文件</summary><label class="field">课表文件<input type="file" data-web-file accept=".json,application/json"></label><p class="helper">选择后点“生成课表预览”。支持本应用读取脚本生成的文件，仅用于本应用读取脚本生成的 JSON。</p></details></details>
      <p class="helper">文件在当前浏览器本地识别，不上传给开发者；确认前不会替换原课表。</p>`;
    }
    function render(route){
      activeRoute=route;
      let markup=route==='timetable/import-web'&&!android?webImport():route==='timetable/import-preview'?preview():route.startsWith('timetable/course/')?detail(route):weekly();
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
      try{const result=await store.request('save',table);acceptTable(result);return true;}
      catch(_){state.error='未保存：手机存储暂时不可用。之前的课表保持原样，请重试。';return false;}
      finally{state.busy=false;repaint();}
    }
    async function perform(action,target){
      if(state.busy)return;
      state.error='';
      if(!android&&action==='paste-web'){
        try{state.webText=await browser.navigator.clipboard.readText();repaint();}
        catch(_){state.error='请在课表内容框里长按，选择“粘贴”，然后生成预览。';repaint();}return;
      }
      if(!android&&action==='copy-shortcut'){
        state.guideOpen=true;state.busy=true;repaint();
        try{
          const response=await browser.fetch('./ios-safari-import.js',{cache:'no-store'});if(!response.ok)throw Error('script_unavailable');
          state.shortcutText=await response.text();
          try{await browser.navigator.clipboard.writeText(state.shortcutText);toast('脚本已复制，请粘贴到快捷指令的网页脚本操作。');}
          catch(_){toast('请长按下方脚本，全选并复制。');}
        }catch(_){state.error='读取脚本暂时无法加载，请联网后再试。';}
        finally{state.busy=false;repaint();}return;
      }
      if(!android&&action==='read-web'){
        let result;try{if(new TextEncoder().encode(state.webText).length>524288)throw Error('too_large');result=model.normalizeImport(JSON.parse(state.webText));}catch(_){result=null;}
        if(!result?.ok){state.error='没有识别到完整的本学期课表。请在学校个人课表“列表”页重新运行快捷指令；已有课表保持原样。';repaint();return;}
        state.preview=result;state.previewValues={};navigate('timetable/import-preview');return;
      }
      if(action==='course'){if(Date.now()>=suppressCourseUntil)navigate('timetable/course/'+encodeURIComponent(target.dataset.course));return;}
      if(action.startsWith('zoom-')){setZoom(action==='zoom-fit'?1:state.zoom+(action==='zoom-in'?.2:-.2),target.ownerDocument);return;}
      if(action==='widget-choice'){state.widgetChoice=!state.widgetChoice;repaint();return;}
      if(action==='pin-today'||action==='pin-week'){
        state.busy=true;state.widgetHelp=false;repaint();
        try{const reply=await native.request('widget',{kind:action==='pin-today'?'today':'week'});if(reply?.requested===true)toast('请在手机桌面确认添加组件。');else state.widgetHelp=true;}
        catch(_){state.widgetHelp=true;toast('暂时无法请求添加，请从桌面小部件菜单添加。');}
        finally{state.busy=false;repaint();}return;
      }
      if(action==='back'||action==='cancel-preview'){state.preview=null;state.editDraft=null;navigate('timetable');return;}
      if(action==='previous-week'||action==='next-week'){state.week=Math.max(1,Math.min(18,state.week+(action==='next-week'?1:-1)));state.current=false;repaint();return;}
      if(action==='current-week'){setCurrent();repaint();return;}
      if(action==='clear'||action==='cancel-clear'){state.clearConfirm=action==='clear';repaint();return;}
      if(action==='import'){
        if(!android){navigate('timetable/import-web');return;}
        state.busy=true;repaint();
        try{await native.request('import');}catch(_){state.busy=false;state.error='无法打开学校登录页，请检查 Android System WebView 或稍后重试。';repaint();}return;
      }
      if(action==='confirm-clear'){
        state.busy=true;repaint();try{await store.request('clear');state.table=null;state.clearConfirm=false;state.preview=null;toast('个人课表已删除。');}
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
      if(target.hasAttribute('data-web-excel')){
        const file=target.files?.[0];if(!file||state.busy)return true;
        state.error='';state.preview=null;
        if(file.size>excelReader.LIMIT){state.error='文件超过 1 MB，请选择教务导出的个人课表 .xls。';repaint();return true;}
        state.busy=true;repaint();
        void (async()=>{
          try{
            const bytes=new Uint8Array(await file.arrayBuffer());
            if((getRoute?getRoute():activeRoute)!=='timetable/import-web')return;
            const result=excelReader.read(bytes,new browser.DOMParser());
            if(!result.ok){state.error=result.message+' 原课表保持不变。';return;}
            state.preview=result.preview;state.previewValues={};navigate('timetable/import-preview');
          }catch(_){state.error='文件没有读完，请重新选择；原课表保持不变。';}
          finally{state.busy=false;repaint();}
        })();return true;
      }
      if(target.hasAttribute('data-web-import')){state.webText=target.value;return true;}
      if(target.hasAttribute('data-web-file')){
        const file=target.files?.[0];if(!file)return true;
        if(file.size>524288){state.error='课表文件太大，请选择完整的课表 JSON 文件。';repaint();return true;}
        void file.text().then(text=>{state.webText=text;repaint();}).catch(()=>{state.error='文件没有读完，请重新选择。';repaint();});return true;
      }
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
    function setZoom(value,document){
      state.zoom=Math.round(Math.max(1,Math.min(2.2,value))*100)/100;
      const grid=document.querySelector('.weekly-timetable');if(!grid)return;
      grid.style.setProperty('--timetable-zoom',String(state.zoom));
      document.querySelector('[data-timetable-zoom]').textContent=Math.round(state.zoom*100)+'%';
      document.querySelector('[data-timetable-action="zoom-out"]').disabled=state.zoom<=1;
      document.querySelector('[data-timetable-action="zoom-in"]').disabled=state.zoom>=2.2;
    }
    function handleTouch(event){
      const scroll=event.target.closest?.('.timetable-scroll');if(!scroll)return false;
      const touches=event.touches,span=()=>Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
      if(event.type==='touchstart'&&touches.length===2){pinch={scroll,span:Math.max(1,span()),zoom:state.zoom};event.preventDefault();return true;}
      if(!pinch)return false;
      if(event.type==='touchmove'&&touches.length===2){event.preventDefault();setZoom(pinch.zoom*span()/pinch.span,scroll.ownerDocument);return true;}
      if(event.type==='touchend'||event.type==='touchcancel'){suppressCourseUntil=Date.now()+400;if(touches.length<2)pinch=null;return true;}
      return false;
    }
    function refreshToday(){const today=core.chinaToday();if(today!==state.today){state.today=today;if(state.current)setCurrent();repaint();}}
    return {ready,render,handleAction,handleInput,handleSubmit,handleBack,refreshToday,handleTouch};
  }
  return {createTimetableUI,createNativeBridge,createBrowserBridge};
});
