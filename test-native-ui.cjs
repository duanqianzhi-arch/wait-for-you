// Catches Android incorrectly trying network/SW installation instead of using bundled data.
const {JSDOM} = require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dist=path.join(__dirname,'dist');
async function run(){
  const html=fs.readFileSync(path.join(dist,'index.html'),'utf8').replace('data-classroom-app>','data-classroom-app data-native-app="1.2.1">');
  const dom=new JSDOM(html,{url:'https://appassets.androidplatform.net/assets/www/index.html#settings',runScripts:'outside-only',pretendToBeVisual:true});
  const win=dom.window;
  win.scrollTo=()=>{};win.matchMedia=()=>({matches:true});win.CSS={escape:x=>String(x)};
  let registrationCalls=0;
  Object.defineProperty(win.navigator,'serviceWorker',{value:{register:async()=>{registrationCalls++;return {};},ready:Promise.resolve({})}});
  win.caches={keys:async()=>[]};
  for(const file of ['data.js','core.js','flow.js','assets/rough.js','app.js'])win.eval(fs.readFileSync(path.join(dist,file),'utf8'));
  await new Promise(r=>setTimeout(r,20));
  try{
    const text=win.document.getElementById('app-main').textContent;
    assert.equal(registrationCalls,0,'native APK must never register a service worker');
    assert.match(text,/安卓版本\s*1\.2\.1/);
    assert(!text.includes('离线课表'),'remove the offline status row');
    const update=win.document.querySelector('a[href*="android-update.html"]');
    assert(update,'installed app must offer a real update check');
    assert.match(update.href,/versionCode=7/);
    assert.equal(win.document.querySelector('[data-action="install"]'),null,'already installed app must not offer installation again');
    assert(!/导入课表|在线更新|即将上线/.test(text));
    assert.equal(typeof win.ClassroomNative?.handleBack,'function','APK needs a native back handler');
    win.location.hash='home';await new Promise(r=>setTimeout(r,20));
    assert.equal(win.ClassroomNative.handleBack(),false,'home lets Android close the app');
    win.location.hash='preferences';await new Promise(r=>setTimeout(r,20));
    assert.equal(win.ClassroomNative.handleBack(),true,'back must stay inside app on later steps');
    await new Promise(r=>setTimeout(r,20));
    assert.equal(win.location.hash,'#home');
    const dialog=win.document.getElementById('info-dialog');
    dialog.close=()=>{dialog.removeAttribute('open');dialog.dispatchEvent(new win.Event('close'));};
    dialog.setAttribute('open','');
    assert.equal(win.ClassroomNative.handleBack(),true);
    assert.equal(dialog.open,false);
    console.log('PASS: native settings, bundled offline mode, no redundant installation/unfinished controls');
  }finally{win.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
