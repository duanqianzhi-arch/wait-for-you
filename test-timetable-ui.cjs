const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),model=require('./dist/personal-timetable.js'),core=require('./dist/core.js');
const tick=()=>new Promise(r=>setTimeout(r,15));
async function run(){
  assert(fs.existsSync(path.join(__dirname,'dist/timetable-ui.js')),'personal timetable UI is missing');
  const {createTimetableUI,createNativeBridge}=require('./dist/timetable-ui.js');
  const raw={adapterVersion:'fixture',semester:'2026-2027-1',complete:true,declaredCourseCount:1,rows:[{courseText:'[1234]<script>课程</script>',teachingGroupCode:'anonymous',selectionStatus:'选中',scheduleText:'1-18周 四[11-13]'}]};
  const sample=model.normalizeImport(raw).timetable;
  const dom=new JSDOM('<main></main>',{url:'https://appassets.androidplatform.net/assets/www/index.html'}),host=dom.window.document.querySelector('main');
  let saved=null,listener,failSave=false,imports=0,route='timetable',today='2026-10-08',pinSupported=true;const pinKinds=[],toasts=[];
  const native={supported:true,subscribe:fn=>{listener=fn;},request:async(action,payload)=>{
    if(action==='load')return saved;
    if(action==='import'){imports++;return null;}
    if(action==='save'){if(failSave)throw Error('storage_error');saved=JSON.parse(JSON.stringify(payload));return saved;}
    if(action==='clear'){saved=null;return null;}
    if(action==='widget'){pinKinds.push(payload.kind);return {requested:pinSupported};}
  }};
  let ui;const render=()=>{host.innerHTML=ui.render(route);};
  ui=createTimetableUI({core:{...core,chinaToday:()=>today},native,renderHost:render,navigate:r=>{route=r;render();},toast:s=>toasts.push(s)});
  await ui.ready;render();
  function click(action){const b=host.querySelector(`[data-timetable-action="${action}"]`);assert(b,action);assert.equal(ui.handleAction(b),true);return tick();}
  assert(host.textContent.includes('从教务系统导入'));await click('import');assert.equal(imports,1);
  listener({event:'import-ready',payload:raw});await tick();assert.equal(route,'timetable/import-preview');assert.equal(saved,null);
  assert.equal(host.querySelector('script'),null);assert(host.textContent.includes('<script>课程</script>'));
  await click('cancel-preview');assert.equal(saved,null);
  listener({event:'import-ready',payload:raw});await tick();await click('save-preview');assert.equal(saved.courses.length,1);
  assert.equal(route,'timetable');assert(host.textContent.includes('第 6 周'));assert(host.textContent.includes('19:10'));assert(host.textContent.includes('21:40'));assert(host.textContent.includes('地点待补充'));
  await click('widget-choice');await click('pin-today');assert.deepEqual(pinKinds,['today']);assert(toasts.at(-1).includes('确认'));assert(!toasts.at(-1).includes('已添加'));
  pinSupported=false;await click('pin-week');assert.deepEqual(pinKinds,['today','week']);assert(host.textContent.includes('长按桌面'));pinSupported=true;
  const spanning=host.querySelector('[data-timetable-action="course"]');
  assert.equal(spanning.style.gridRow,'12 / 15','11–13 period course must occupy all three rows');
  assert.equal(host.querySelector('[data-timetable-action="zoom-out"]').disabled,true);
  for(let i=0;i<7;i++)await click('zoom-in');
  assert.equal(host.querySelector('.weekly-timetable').style.getPropertyValue('--timetable-zoom'),'2.2');
  assert.equal(host.querySelector('[data-timetable-action="zoom-in"]').disabled,true);
  await click('next-week');assert.equal(host.querySelector('.weekly-timetable').style.getPropertyValue('--timetable-zoom'),'2.2');await click('current-week');
  await click('zoom-fit');assert.equal(host.querySelector('.weekly-timetable').style.getPropertyValue('--timetable-zoom'),'1');
  await click('next-week');assert(host.textContent.includes('第 7 周'));await click('current-week');assert(host.textContent.includes('第 6 周'));
  today='2026-10-12';ui.refreshToday();assert(host.textContent.includes('第 7 周'));await click('previous-week');today='2026-10-19';ui.refreshToday();assert(host.textContent.includes('第 6 周'),'manual week choice survives midnight refresh');today='2026-10-08';await click('current-week');
  await click('course');assert(route.startsWith('timetable/course/'));assert.equal(ui.handleBack(),true);assert.equal(route,'timetable');await click('course');
  const form=host.querySelector('form');form.elements.namedItem('location-0').value='<img src=x onerror=alert(1)>';
  form.elements.namedItem('note-0').value='带电脑';ui.handleSubmit(form);await tick();assert.equal(saved.overrides.length,1);assert.equal(host.querySelector('img[src="x"]'),null);
  const old=JSON.stringify(saved);failSave=true;host.querySelector('form').elements.namedItem('location-0').value='不能保存';ui.handleSubmit(host.querySelector('form'));await tick();assert.equal(JSON.stringify(saved),old);assert(host.textContent.includes('未保存'));assert.equal(host.querySelector('form').elements.namedItem('location-0').value,'不能保存','failed save must preserve draft input');failSave=false;
  await click('restore');assert.equal(saved.overrides.length,0);
  const edited=model.applyEdit(saved,saved.courses[0].key,saved.courses[0].meetings[0].key,{location:'修正的教室'});saved=edited;
  const ui2=createTimetableUI({core:{...core,chinaToday:()=> '2026-10-08'},native,renderHost:()=>{host.innerHTML=ui2.render(route);},navigate:r=>{route=r;host.innerHTML=ui2.render(route);},toast:()=>{}});
  await ui2.ready;ui=ui2;route='timetable';render();assert(host.textContent.includes('修正的教室'));
  const fresh={...raw,rows:raw.rows.map(r=>({...r,scheduleText:'1-18周 四[11-13] 学校新教室'}))};
  listener({event:'import-ready',payload:fresh});await tick();assert(host.textContent.includes('学校新教室'),'conflict preview must show the new school arrangement');await click('save-preview');assert.equal(saved.overrides.length,1,'unresolved conflicts must not overwrite');assert(host.textContent.includes('选择'));
  host.querySelector('input[value="keep"]').checked=true;await click('save-preview');assert.equal(model.coursesForWeek(saved,6)[0].meeting.location,'修正的教室');
  listener({event:'import-ready',payload:fresh});await tick();host.querySelector('select[name="import-mode"]').value='replace';failSave=true;await click('save-preview');assert.equal(host.querySelector('select[name="import-mode"]').value,'replace','failed replacement must preserve account mode');failSave=false;await click('save-preview');assert.equal(saved.overrides.length,0);
  await click('clear');assert(saved);await click('cancel-clear');assert(saved);await click('clear');await click('confirm-clear');assert.equal(saved,null);
  const overlaps=model.normalizeImport({...raw,declaredCourseCount:3,rows:[
    {...raw.rows[0],courseText:'[1]两节课程',teachingGroupCode:'one',scheduleText:'1-18周 一[1-2] 教室101'},
    {...raw.rows[0],courseText:'[2]三节课程',teachingGroupCode:'two',scheduleText:'1-18周 一[1-3] 教室102'},
    {...raw.rows[0],courseText:'[3]交叉课程',teachingGroupCode:'three',scheduleText:'1-18周 一[2-5] 教室103'}]}).timetable;
  saved=overlaps;route='timetable';ui=createTimetableUI({core:{...core,chinaToday:()=>today},native,renderHost:render,navigate:r=>{route=r;render();},toast:()=>{}});await ui.ready;render();
  const blocks=[...host.querySelectorAll('.timetable-course')];assert.equal(blocks.length,3);
  assert.deepEqual(blocks.map(b=>b.style.gridRow),['2 / 4','2 / 5','3 / 7']);
  assert.equal(new Set(blocks.map(b=>b.style.marginLeft)).size,3,'three overlapping classes need distinct lanes');
  assert(blocks.every(b=>b.getAttribute('aria-label').includes('节')));
  const touch=(type,x)=>({type,target:host.querySelector('.timetable-scroll'),touches:x.map(n=>({clientX:n,clientY:100})),preventDefault(){this.prevented=true;}});
  const single=touch('touchstart',[20]);assert.equal(ui.handleTouch(single),false);assert(!single.prevented,'single-finger scrolling remains native');
  const start=touch('touchstart',[20,120]);assert.equal(ui.handleTouch(start),true);assert(start.prevented);
  ui.handleTouch(touch('touchmove',[20,220]));assert.equal(host.querySelector('.weekly-timetable').style.getPropertyValue('--timetable-zoom'),'2');
  ui.handleTouch(touch('touchend',[]));await click('course');assert.equal(route,'timetable','pinch must not click a class on release');
  // Week-only records stay visible below the grid, without pretending they have fixed periods.
  const withOnline=model.normalizeImport({...raw,declaredCourseCount:3,rows:[
    raw.rows[0],
    {...raw.rows[0],courseText:'[401]示例线上课甲',teachingGroupCode:'online-a',scheduleText:'4-18周'},
    {...raw.rows[0],courseText:'[402]示例线上课乙',teachingGroupCode:'online-b',scheduleText:''}
  ]}).timetable;
  saved=model.applyEdit(withOnline,withOnline.courses[1].key,null,{name:'我修改的线上课名'});
  route='timetable';ui=createTimetableUI({core:{...core,chinaToday:()=>today},native,renderHost:render,navigate:r=>{route=r;render();},toast:()=>{}});await ui.ready;render();
  const unplaced=host.querySelector('[aria-label="线上与未排定课程"]');
  assert(unplaced,'week-only courses must have their own visible section');
  assert.equal(unplaced.closest('details'),null,'these courses must not be hidden in a collapsed disclosure');
  assert.equal(host.querySelector('.timetable-scroll').nextElementSibling,unplaced,'place the records directly below the weekly grid');
  assert.equal(unplaced.querySelectorAll('[data-timetable-action="course"]').length,2);
  assert.equal(host.querySelectorAll('.weekly-timetable [data-timetable-action="course"]').length,1,'do not invent a grid slot for either online course');
  assert(unplaced.textContent.includes('我修改的线上课名')&&unplaced.textContent.includes('4-18周'));
  assert(unplaced.textContent.includes('未排定时间'),'missing time must stay explicit rather than becoming a timetable conflict');
  assert(!unplaced.textContent.includes('示例课程1'));
  ui.handleAction(unplaced.querySelector('[data-timetable-action="course"]'));await tick();
  assert(route.startsWith('timetable/course/'));assert(host.querySelector('form'));
  assert.equal(ui.handleBack(),true);render();assert(host.querySelector('[aria-label="线上与未排定课程"]'));
  saved=sample;route='timetable';ui=createTimetableUI({core:{...core,chinaToday:()=>today},native,renderHost:render,navigate:r=>{route=r;render();},toast:()=>{}});await ui.ready;render();
  assert.equal(host.querySelector('[aria-label="线上与未排定课程"]'),null,'do not add an empty online section to fully scheduled timetables');
  const web=createTimetableUI({core,browser:dom.window,native:{supported:false},renderHost:()=>{},navigate:()=>{},toast:()=>{}});assert(web.render('timetable').includes('浏览器'));assert(web.render('timetable').includes('data-timetable-action="import"'));
  // Exercise the real request-ID client: unrelated replies cannot settle a write.
  const messages=[],browser={StudyTimetableBridge:{postMessage:s=>messages.push(JSON.parse(s))}};
  const bridge=createNativeBridge(browser);let event;bridge.subscribe(e=>event=e);
  const p=bridge.request('load');const id=messages[0].id;
  browser.StudyTimetableBridge.onmessage({data:JSON.stringify({id:'other',ok:true,payload:sample})});
  browser.StudyTimetableBridge.onmessage({data:JSON.stringify({id,ok:true,payload:sample})});assert.equal((await p).courses.length,1);
  browser.StudyTimetableBridge.onmessage({data:JSON.stringify({event:'import-cancelled',payload:null})});assert.equal(event.event,'import-cancelled');
  // Run the complete app shell, checking nav state and unchanged campus behavior.
  const html=fs.readFileSync(path.join(__dirname,'dist/index.html'),'utf8').replace('data-classroom-app>','data-classroom-app data-native-app="1.0.1">');
  const shell=new JSDOM(html,{url:'https://appassets.androidplatform.net/assets/www/index.html#timetable',runScripts:'outside-only',pretendToBeVisual:true});
  const w=shell.window;w.scrollTo=()=>{};w.CSS={escape:String};w.matchMedia=()=>({matches:true});
  w.StudyTimetableBridge={postMessage:message=>{const request=JSON.parse(message);queueMicrotask(()=>w.StudyTimetableBridge.onmessage({data:JSON.stringify({id:request.id,ok:true,payload:request.action==='load'?sample:null})}));}};
  for(const file of ['data.js','core.js','flow.js','assets/rough.js','personal-timetable.js','henu-excel-import.js','timetable-ui.js','app.js'])w.eval(fs.readFileSync(path.join(__dirname,'dist',file),'utf8'));
  await tick();assert.equal(w.document.querySelectorAll('[data-nav]').length,3,'bottom navigation must have three sections');
  assert.equal(w.document.querySelector('[data-nav="timetable"]').getAttribute('aria-current'),'page');
  const top=w.document.querySelector('.app-header').innerHTML;
  w.document.querySelector('[data-timetable-action="course"]').click();await tick();assert(w.location.hash.startsWith('#timetable/course/'));
  assert.equal(w.document.querySelector('[data-nav="timetable"]').getAttribute('aria-current'),'page');assert.equal(w.document.querySelector('.app-header').innerHTML,top);
  assert.equal(w.ClassroomNative.handleBack(),true);await tick();assert.equal(w.location.hash,'#timetable');
  w.document.querySelector('#info-dialog').close=()=>{};
  w.document.querySelector('#info-dialog').showModal=()=>{};w.document.querySelector('[data-action="campus"]').click();
  w.document.querySelector('[data-campus="明伦校区"]').click();assert.equal(w.document.querySelector('#header-campus').textContent,'明伦校区');assert(w.document.querySelector('[data-timetable-action="course"]'),'campus must not filter personal courses');
  w.StudyTimetableBridge.onmessage({data:JSON.stringify({event:'import-ready',payload:raw})});await tick();
  const mode=w.document.querySelector('select[name="import-mode"]');mode.value='replace';mode.dispatchEvent(new w.Event('change',{bubbles:true}));
  w.document.querySelector('[data-action="campus"]').click();w.document.querySelector('[data-campus="金明校区"]').click();
  assert.equal(w.document.querySelector('select[name="import-mode"]').value,'replace','campus rerender must preserve replacement choices');
  shell.window.close();
  dom.window.close();console.log('PASS: timetable import confirmation/cancel, weekly view, safe editing, save failures, resync choices, new table, clear, bridge IDs');
}
run().catch(e=>{console.error(e);process.exit(1);});
