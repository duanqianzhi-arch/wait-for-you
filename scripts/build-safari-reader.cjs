const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),adapter=fs.readFileSync(path.join(root,'dist/henu-schedule-adapter.js'),'utf8');
const script=`// Paste into Shortcuts: Run JavaScript on Web Page. No network or credential access.
(()=>{
const previous=globalThis.HenuScheduleAdapter;
${adapter}
let result;
try { result=globalThis.HenuScheduleAdapter.extract(document); }
catch (_) { result={errorCode:'not_timetable'}; }
finally { if(previous===undefined)delete globalThis.HenuScheduleAdapter;else globalThis.HenuScheduleAdapter=previous; }
completion(JSON.stringify(result.complete===true?result:{errorCode:'incomplete_timetable',message:'请在学校个人课表的列表页等待全部课程显示，再运行快捷指令。'}));
})();
`;
fs.writeFileSync(path.join(root,'dist/ios-safari-import.js'),script);
