const {JSDOM}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const page=path.join(__dirname,'dist/android-update.html');
assert(fs.existsSync(page),'a real online update page is required');
const html=fs.readFileSync(page,'utf8');
for(const [query,expected] of [['1','有新版本'],['4','已经是最新版'],['5','无需降级'],['oops','下载安卓 App'],['','下载安卓 App']]){
 const dom=new JSDOM(html,{url:'https://henu-study.pages.dev/android-update.html'+(query?'?versionCode='+query:''),runScripts:'dangerously'});
 assert.match(dom.window.document.querySelector('h1').textContent,new RegExp(expected));
 assert.equal(dom.window.document.querySelector('#download').getAttribute('href'),'./downloads/dengni-xiake-v1.1.1.apk');
 if(query==='5') assert(dom.window.document.querySelector('#download').hidden,'do not recommend downgrading');
 dom.window.close();
}
console.log('PASS: update page compares old/current/newer/invalid versions and links the signed APK');
