// Exercise the actual Java device-test scripts against the real frontend.
// This verifies test sequencing/idempotence, never claims Android rendering.
const {JSDOM}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dist=path.join(__dirname,'dist');
const java=fs.readFileSync(path.join(__dirname,'android/app/src/androidTest/java/cn/henu/study/waitforclass/OfflineAppTest.java'),'utf8');
const body=java.split('void queryAndFavoritesSurviveRelaunch()')[1].split('@Test')[0].split('        try(ActivityScenario')[1];
const steps=[...body.matchAll(/(js|waitFor)\(scenario,"((?:[^"\\]|\\.)*)"\)/g)].map(m=>({kind:m[1],expression:JSON.parse('"'+m[2]+'"')}));
const pause=()=>new Promise(resolve=>setTimeout(resolve,10));
function create(saved={},animation=false){
 const html=fs.readFileSync(path.join(dist,'index.html'),'utf8').replace('data-classroom-app>','data-classroom-app data-native-app="1.0.0">');
 const dom=new JSDOM(html,{url:'https://appassets.androidplatform.net/assets/www/index.html#home',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.localStorage.setItem('henu-classroom-preferences-v1',JSON.stringify(saved));
 w.scrollTo=()=>{};w.matchMedia=()=>({matches:!animation});w.CSS={escape:String};
 Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent;}});
 const dialog=w.document.getElementById('info-dialog');dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>{dialog.removeAttribute('open');dialog.dispatchEvent(new w.Event('close'));};
 let finish;
 w.Element.prototype.animate=()=>({finished:new Promise(resolve=>{finish=resolve;})});
 for(const file of ['data.js','core.js','flow.js','assets/rough.js','app.js'])w.eval(fs.readFileSync(path.join(dist,file),'utf8'));
 return {dom,w,finish:()=>finish()};
}
async function testAnimationWait(){
 const fixture=create({},true),{w,dom}=fixture;
 try{
  w.document.querySelector('#time-form').requestSubmit();await pause();
  assert(w.document.querySelector('.tear-overlay'),'a real transition must be active');
  const predicate=steps.find(s=>s.kind==='waitFor'&&s.expression.includes('tear-overlay')).expression;
  assert.equal(w.eval(predicate),false,'device test must not proceed while tear animation blocks submission');
  fixture.finish();await pause();
  assert.equal(w.eval(predicate),true,'device test must proceed after animation finishes');
 }finally{dom.window.close();}
}
async function runFixture(saved,check){
 const {w,dom}=create(saved);
 try{
  for(const step of steps){await pause();if(step.kind==='waitFor')assert.equal(w.eval(step.expression),true,step.expression);else w.eval(step.expression);}
  await pause();check(w);
 }finally{dom.window.close();}
}
async function main(){
 const cases=[
  ['wait for tear transition',testAnimationWait],
  ['independent campus and preference',()=>runFixture({campus:'明伦校区',mode:'high'},w=>{assert.equal(w.document.getElementById('header-campus').textContent,'金明校区');assert.match(w.document.getElementById('app-main').textContent,/57 间无课/);assert.match(w.document.getElementById('app-main').textContent,/中等楼层/);})],
  ['favorite survives repeated device tests',()=>runFixture({campus:'金明校区',mode:'balanced',favorites:['金明校区/7号教学楼7305']},w=>assert.equal(w.document.querySelector('[data-favorite]').getAttribute('aria-pressed'),'true'))]
 ];
 let failed=0;
 for(const [name,test]of cases){try{await test();console.log('PASS: '+name);}catch(error){failed++;console.error('FAIL: '+name+' — '+error.message);}}
 if(failed)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
