// Website users can get the real Android package without installing Chrome.
const {JSDOM}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dist=path.join(__dirname,'dist');
const dom=new JSDOM(fs.readFileSync(path.join(dist,'index.html'),'utf8'),{url:'https://henu-study.pages.dev/#settings',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
w.scrollTo=()=>{};w.matchMedia=()=>({matches:true});w.CSS={escape:String};
w.document.getElementById('info-dialog').showModal=function(){this.setAttribute('open','');};
for(const file of ['data.js','core.js','flow.js','assets/rough.js','app.js'])w.eval(fs.readFileSync(path.join(dist,file),'utf8'));
try{
 const link=[...w.document.querySelectorAll('a')].find(x=>x.textContent.includes('下载安卓'));
 assert(link,'website must offer an Android APK download');
 assert.equal(link.getAttribute('href'),'./downloads/dengni-xiake-v1.2.2.apk');
 assert.match(link.textContent,/测试版/,'native runtime still needs phone testing');
 w.document.querySelector('[data-action="install"]').click();
 const guide=w.document.getElementById('info-dialog').textContent;
 assert.match(guide,/Safari/);
 assert.match(guide,/自带浏览器/);
 assert(!guide.includes('用 Chrome 打开链接'),'installation must not require Chrome');
 const sw=fs.readFileSync(path.join(dist,'sw.js'),'utf8');
 assert(!/\.apk/.test(sw),'large APK must not be precached');
 console.log('PASS: APK download, test status and Safari / built-in browser guidance');
}finally{w.close();}
