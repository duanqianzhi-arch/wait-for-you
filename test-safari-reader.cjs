const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
assert(fs.existsSync('./dist/ios-safari-import.js'),'Safari needs a real, reusable reading script');
const script=fs.readFileSync('./dist/ios-safari-import.js','utf8');
function read(body,url='https://xk.henu.edu.cn/wsxk/xkjg.ckdgxsxdkchj_data10319.jsp'){
 const dom=new JSDOM(body,{url,runScripts:'outside-only'}),w=dom.window;let text;
 const before=w.document.body.innerHTML;w.completion=value=>text=value;w.fetch=()=>{throw Error('no outbound requests');};Object.defineProperty(w.document,'cookie',{get(){throw Error('no cookie access');}});
 w.eval(script);assert.equal(w.document.body.innerHTML,before,'reader must not modify school forms');assert.equal(w.HenuScheduleAdapter,undefined,'temporary reader must restore the school global');
 dom.window.close();return JSON.parse(text);
}
const headers=['上课班级代码','课程','选课状态','上课时间地点'];
function table(code,schedule){return `<table><tr>${headers.map(h=>'<td>'+h+'</td>').join('')}</tr><tr><td>G${code}</td><td>[${code}]Example</td><td>已选中</td><td>${schedule}</td></tr></table>`;}
const body='<p>河南大学学生个人课表 2026-2027学年第一学期 课程门数：2</p><p>身份文字不得采集</p>'+table(1,'1-18周 五[9-10] Room')+'<p>第1页 共2页</p>'+table(2,'4-18周')+'<p>第2页 共2页</p>';
const raw=read(body);assert.equal(raw.complete,true);assert.equal(raw.rows.length,2);assert(!JSON.stringify(raw).includes('身份文字'));
assert.equal(require('./dist/personal-timetable.js').normalizeImport(raw).timetable.courses[1].unscheduled,true);
assert.equal(read(body.replace('第2页 共2页','')).complete,undefined);assert.equal(read(body,'https://evil.example/report').complete,undefined);assert.equal(read('<input type="password">','https://xk.henu.edu.cn/cas/login.action').complete,undefined);
console.log('PASS: Safari reader merges complete pages locally, preserves unscheduled courses and rejects missing/untrusted pages');
