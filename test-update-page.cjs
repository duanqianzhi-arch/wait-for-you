const {JSDOM}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const page=path.join(__dirname,'dist/android-update.html');
assert(fs.existsSync(page),'a real online update page is required');
const html=fs.readFileSync(page,'utf8');
for(const [query,expected] of [['1','有新版本'],['4','有新版本'],['5','有新版本'],['6','有新版本'],['7','有新版本'],['8','有新版本'],['9','有新版本'],['10','已经是最新版'],['11','无需降级'],['oops','下载安卓 App'],['','下载安卓 App']]){
 const dom=new JSDOM(html,{url:'https://henu-study.pages.dev/android-update.html'+(query?'?versionCode='+query:''),runScripts:'dangerously'});
 assert.match(dom.window.document.querySelector('h1').textContent,new RegExp(expected));
 assert.equal(dom.window.document.querySelector('#download').getAttribute('href'),'./downloads/dengni-xiake-v1.2.4.apk');
 if(query==='11') assert(dom.window.document.querySelector('#download').hidden,'do not recommend downgrading');
 dom.window.close();
}
{
 const timers=[];
 const dom=new JSDOM(html,{url:'https://henu-study.pages.dev/android-update.html',runScripts:'dangerously',beforeParse(window){window.setTimeout=(callback,delay)=>{timers.push({callback,delay});return timers.length;};}});
 const document=dom.window.document,link=document.querySelector('#download');
 function click(){
  let prevented;
  link.addEventListener('click',event=>{prevented=event.defaultPrevented;event.preventDefault();},{once:true});
  link.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true}));
  return prevented;
 }
 assert.equal(click(),false,'the first tap must keep the native anchor download');
 const feedback=document.querySelector('#download-feedback');
 assert(feedback,'download taps must get immediate visible feedback');
 assert.equal(feedback.getAttribute('role'),'status');
 assert.match(feedback.textContent,/已请求下载/);
 assert.doesNotMatch(feedback.textContent,/下载成功|下载完成|正在下载|已开始下载/,'the page cannot observe browser download success');
 assert.equal(click(),true,'rapid repeated taps must not request multiple APKs');
 assert(timers.some(timer=>timer.delay>=3000&&timer.delay<=6000),'download retry should become available soon');
 timers.forEach(timer=>timer.callback());
 assert.equal(click(),false,'a later explicit retry must still work');
 dom.window.close();
}
console.log('PASS: update page compares versions, preserves native downloading and gives honest tap feedback');
