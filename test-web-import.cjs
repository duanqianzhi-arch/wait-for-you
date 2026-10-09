const assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const uiAPI=require('./dist/timetable-ui.js'),core=require('./dist/core.js');
const model=require('./dist/personal-timetable.js');
const raw={adapterVersion:'henu-list-2',semester:'2026-2027-1',declaredCourseCount:1,complete:true,rows:[{courseText:'[12345678]Example',teachingGroupCode:'G1',selectionStatus:'选中',scheduleText:'1-18周 五[9-10] Room'}]};
async function run(){
 assert.equal(typeof uiAPI.createBrowserBridge,'function','web users need a local timetable store');
 const dom=new JSDOM('<main id="host"></main>',{url:'https://henu-study.pages.dev/#timetable'}),w=dom.window,host=w.document.querySelector('main');
 const bridge=uiAPI.createBrowserBridge(w),table=model.normalizeImport(raw).timetable;
 assert.equal(await bridge.request('load'),null);await bridge.request('save',table);
 assert.deepEqual(await uiAPI.createBrowserBridge(w).request('load'),table);
 const before=w.localStorage.getItem('henu-personal-timetable-v1');
 await assert.rejects(bridge.request('save',{...table,password:'forbidden'}));assert.equal(w.localStorage.getItem('henu-personal-timetable-v1'),before);
 await bridge.request('clear');assert.equal(await bridge.request('load'),null);
 let route='timetable',ui;const render=()=>host.innerHTML=ui.render(route);
 ui=uiAPI.createTimetableUI({core:{...core,chinaToday:()=> '2026-10-09'},native:{supported:false},browser:w,renderHost:render,navigate:r=>{route=r;render();},toast:()=>{}});
 await ui.ready;render();assert(!host.textContent.includes('在安卓新版'));assert(host.textContent.includes('导入'));
 async function click(action){const target=host.querySelector('[data-timetable-action="'+action+'"]');assert(target,action);ui.handleAction(target);await new Promise(r=>setTimeout(r,5));}
 await click('import');assert.equal(route,'timetable/import-web');
 w.fetch=async()=>({ok:true,text:async()=> 'completion("example");'});Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async()=>{throw Error('Safari gesture lost');}},configurable:true});
 host.querySelector('.web-shortcut-guide').open=true;await click('copy-shortcut');
 assert(host.querySelector('.web-shortcut-guide').open,'manual copy fallback must remain visible after Safari denies clipboard writing');assert(host.querySelector('.web-shortcut-guide textarea').value.includes('completion'));
 const field=host.querySelector('[data-web-import]');assert(field);field.value=JSON.stringify(raw);ui.handleInput(field);await click('read-web');
 assert.equal(route,'timetable/import-preview');assert.equal(await bridge.request('load'),null,'preview must not save');
 await click('save-preview');assert.equal((await bridge.request('load')).courses.length,1);assert(host.textContent.includes('Example'));
 assert(!host.textContent.includes('添加桌面组件'),'web must not expose Android widget controls');
 await click('course');const form=host.querySelector('form');form.elements.namedItem('location-0').value='Edited room';ui.handleSubmit(form);await new Promise(r=>setTimeout(r,5));
 assert.equal(model.coursesForWeek(await bridge.request('load'),6)[0].meeting.location,'Edited room');
 route='timetable/import-web';render();host.querySelector('[data-web-import]').value='{"password":"never store"}';ui.handleInput(host.querySelector('[data-web-import]'));await click('read-web');
 assert.equal(route,'timetable/import-web');assert(host.textContent.includes('完整'));assert.equal((await bridge.request('load')).courses.length,1);
 w.localStorage.setItem('henu-classroom-preferences-v1','favorites');route='timetable';render();await click('clear');await click('confirm-clear');assert.equal(await bridge.request('load'),null);assert.equal(w.localStorage.getItem('henu-classroom-preferences-v1'),'favorites');
 dom.window.close();console.log('PASS: browser import preview, save/reopen, edits, invalid input preservation, clear and no widgets');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
