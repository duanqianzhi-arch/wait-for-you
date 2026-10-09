(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./personal-timetable.js'):root.PersonalTimetable);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.HenuExcelImport=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(model){
  'use strict';
  const LIMIT=1048576,required=['上课班级代码','课程','选课状态','上课时间地点'];
  const allowed=new Set(['html','body','table','thead','tbody','tfoot','tr','td','th','br','p','div','span','font','h1','h2','h3','h4','h5','h6']);
  const plain=s=>s.replace(/[<>]/g,c=>c==='<'?'&lt;':'&gt;');
  const compact=s=>s.replace(/\s/g,'');
  // Rebuild only inert text/table markup. Original attributes, URLs and executable tags never enter a browser document.
  function sanitize(html){
    let output='',blocked='';
    for(const token of html.match(/<!--[\s\S]*?-->|<[^>]*>|[^<]+|</g)||[]){
      if(token.startsWith('<!--'))continue;
      const match=/^<\s*(\/?)\s*([a-z][\w:-]*)\b/i.exec(token),tag=match?.[2].toLowerCase();
      if(blocked){if(match?.[1]&&tag===blocked)blocked='';continue;}
      if(match&&!match[1]&&['script','style'].includes(tag)){blocked=tag;continue;}
      if(!match){output+=plain(token);continue;}
      if(!allowed.has(tag))continue;
      let spans='';
      if(!match[1]&&['td','th'].includes(tag))for(const attr of ['colspan','rowspan']){
        const value=new RegExp('\\b'+attr+'\\s*=\\s*["\']?(\\d+)','i').exec(token)?.[1];
        if(value&&Number(value)>0&&Number(value)<=500)spans+=` ${attr}="${Number(value)}"`;
      }
      output+=`<${match[1]}${tag}${spans}>`;
    }
    return output;
  }
  function cellText(cell,segments=false){
    function visit(node){
      if(node.nodeType===3)return node.nodeValue;
      if(node.nodeType!==1)return '';
      if(node.tagName==='BR')return segments?';':' ';
      return [...node.childNodes].map(visit).join('')+(segments&&['P','DIV'].includes(node.tagName)?';':'');
    }
    return visit(cell).replace(/\u00a0/g,' ').trim();
  }
  function completeMarkup(html){
    const stack=[];let roots=0,bodies=0;
    for(const tag of html.matchAll(/<(\/?)(html|body|table|tr|td|th)\b[^>]*>/gi)){
      const name=tag[2].toLowerCase();
      if(tag[1]){if(stack.pop()!==name)return false;}
      else{if(name==='html')roots++;if(name==='body')bodies++;stack.push(name);}
    }
    return roots===1&&bodies===1&&stack.length===0;
  }
  function read(bytes,parser){
    const fail=message=>({ok:false,message});
    try{
      if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>LIMIT)return fail('课表文件为空或超过 1 MB，请重新导出个人课表。');
      const prefix=new TextDecoder('latin1').decode(bytes.subarray(bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf?3:0,2500));
      if(!/^\s*(?:\ufeff)?(?:<!doctype\s+html|<html\b)/i.test(prefix))return fail('请选择河南大学个人课表“列表 → 导出”得到的 .xls 文件；暂不支持普通 xlsx、截图或 PDF。');
      const encoding=/charset\s*=\s*["']?([\w-]+)/i.exec(prefix)?.[1]?.toLowerCase()||'utf-8';
      if(!['utf-8','utf8','gbk','gb2312','gb18030'].includes(encoding))return fail('课表文件编码暂不支持，请从教务系统重新导出。');
      const html=sanitize(new TextDecoder(encoding,{fatal:true}).decode(bytes));
      if(!completeMarkup(html))return fail('导出文件未完整结束或表格结构损坏，请重新下载完整课表。');
      const doc=parser.parseFromString(html,'text/html');
      const content=doc.body.textContent||'';
      if(!compact(content).includes('河南大学学生个人课表'))return fail('这不是河南大学学生个人课表导出文件。');
      const semesters=[...content.matchAll(/(\d{4})\s*[-—－]\s*(\d{4})\s*学年\s*第\s*([一二三])\s*学期/g)];
      if(!semesters.length||semesters.some(m=>m[1]!=='2026'||m[2]!=='2027'||m[3]!=='一'))return fail('当前支持 2026—2027 学年第一学期，请导出对应学期。');
      const rows=[];let found=0;
      for(const table of doc.querySelectorAll('table')){
        let columns=null;
        for(const row of table.rows){
          const cells=[...row.cells],names=cells.map(c=>compact(cellText(c)));
          if(required.every(name=>names.filter(n=>n===name).length===1)){columns=names;found++;continue;}
          if(!columns)continue;
          if(cells.every(c=>!compact(cellText(c))))continue;
          if(cells.length!==columns.length||cells.some(c=>c.colSpan!==1||c.rowSpan!==1))return fail('课程表格有缺列或合并行，请重新导出完整的列表课表。');
          const value=(name,segments=false)=>cellText(cells[columns.indexOf(name)],segments);
          if(!['选中','已选中'].includes(compact(value('选课状态'))))return fail('课表包含未确认的选课状态，请核对后重新导出。');
          rows.push({courseText:value('课程').replace(/\s+/g,' '),teachingGroupCode:compact(value('上课班级代码')),selectionStatus:'选中',scheduleText:value('上课时间地点',true)});
          if(rows.length>500)return fail('课程数量超出支持范围。');
        }
      }
      if(!found)return fail('没有找到课程、教学班代码、选课状态和上课时间地点列，请导出列表课表。');
      const counts=[...content.matchAll(/课程门数\s*[:：]\s*(\d+)/g)].map(m=>Number(m[1]));
      if((!counts.length&&!rows.length)||counts.some(n=>n!==rows.length))return fail('文件课程数与学校声明不一致，请重新导出完整课表。');
      const preview=model.normalizeImport({adapterVersion:'henu-excel-html-1',semester:'2026-2027-1',complete:true,declaredCourseCount:rows.length,rows});
      if(!preview.ok)return fail('课程字段缺失或重复，未替换原课表，请重新导出。');
      if(!counts.length)preview.issues.push({kind:'export_no_total',row:0,segment:0});
      return {ok:true,preview};
    }catch(_){return fail('文件无法完整读取，请重新选择教务导出的 .xls；原课表保持不变。');}
  }
  return {read,sanitize,LIMIT};
});
