(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HenuScheduleAdapter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const HOST='xk.henu.edu.cn', HOME='/frame/homes.action', MENU='/frame/jw/teacherstudentmenu.jsp', PERSONAL='/student/xkjg.wdkb.jsp', REPORT='/wsxk/xkjg.ckdgxsxdkchj_data10319.jsp';
  const trim=value=>String(value||'').replace(/\s+/g,'').trim();
  function safeURL(value){
    try{const url=new URL(value);return url.protocol==='https:'&&url.hostname===HOST&&!url.username&&!url.password&&(!url.port||url.port==='443')&&![...url.pathname.split('/')].includes('..')?url:null;}catch(_){return null;}
  }
  function role(url){
    if(!url)return null;
    if(url.pathname===HOME)return 'home';
    if(url.pathname===MENU&&url.searchParams.get('menucode')==='S203')return 'menu';
    if(url.pathname===PERSONAL)return 'personal';
    if(url.pathname===REPORT)return 'report';
    return null;
  }
  function findDocument(root,wanted,depth=0){
    if(!root||depth>4)return null;
    const current=role(safeURL(root.URL));
    if(!current)return null;
    if(current===wanted)return root;
    const next={home:'menu',menu:'personal',personal:'report'}[current];
    if(!next)return null;
    for(const frame of root.querySelectorAll('iframe,frame')){
      try{
        const src=role(safeURL(new URL(frame.getAttribute('src')||'',root.URL).href));
        const child=frame.contentDocument;
        if(src===next&&child&&role(safeURL(child.URL))===next){const found=findDocument(child,wanted,depth+1);if(found)return found;}
      }catch(_){}
    }
    return null;
  }
  function importRoot(root){return root&&['home','personal','report'].includes(role(safeURL(root.URL)));}
  function prepare(root){
    if(!importRoot(root))return {stage:'unsupported-page'};
    if(role(safeURL(root.URL))==='report')return {stage:'reading'};
    const personal=findDocument(root,'personal');
    if(personal){
      const list=personal.querySelector('#cxfs_lb');
      if(!list)return {stage:'waiting-personal'};
      if(!list.checked){list.click();return {stage:'selecting-list'};}
      return {stage:'reading'};
    }
    if(role(safeURL(root.URL))==='home'){
      // The school rejects a direct top-level personal URL. Use its own verified menu.
      const desk=root.querySelector('#frmDesk');
      try{if(desk&&role(safeURL(new URL(desk.getAttribute('src')||'',root.URL).href))==='menu')return {stage:'waiting-personal'};}catch(_){}
      const candidates=Array.from(root.querySelectorAll('#collapseJW [data-code="S203"]')).filter(el=>/教学安排/.test(el.textContent||''));
      const menu=candidates.find(el=>{
        for(let node=el;node&&node.nodeType===1;node=node.parentElement){
          if(node.hidden||node.getAttribute('aria-hidden')==='true')return false;
          const style=node.ownerDocument.defaultView?.getComputedStyle(node);
          if(style?.display==='none'||style?.visibility==='hidden')return false;
        }
        return true;
      })||candidates[0]; // On phones the sidebar may be collapsed; the same menu handler still applies.
      if(menu){menu.click();return {stage:'opening-menu'};}
    }
    return {stage:'waiting-personal'};
  }
  function extract(root){
    const doc=importRoot(root)?findDocument(root,'report'):null;
    if(!doc||!doc.body)return {errorCode:'not_timetable'};
    // Only minimal course fields leave this document; no HTML, account fields or URLs.
    const content=doc.body.textContent||'';
    if(!content.includes('河南大学学生个人课表'))return {errorCode:'unrecognized_table'};
    const semesters=Array.from(content.matchAll(/(\d{4})\s*[-—－]\s*(\d{4})\s*学年\s*第\s*([一二三])\s*学期/g));
    if(!semesters.length||semesters.some(semester=>semester[1]!=='2026'||semester[2]!=='2027'||semester[3]!=='一'))return {errorCode:'unsupported_semester'};
    const counts=Array.from(content.matchAll(/课程门数\s*[:：]\s*(\d+)/g));
    const pages=content.match(/共\s*(\d+)\s*页/);
    if(!counts.length||!pages)return {errorCode:'incomplete_table',diagnostics:{check:'report_footer'}};
    const declared=Number(counts[0][1]),pageCount=Number(pages[1]);
    if(!Number.isSafeInteger(declared)||declared<0||declared>500||counts.some(count=>Number(count[1])!==declared))return {errorCode:'incomplete_table',diagnostics:{check:'course_count'}};
    const footers=Array.from(content.matchAll(/第\s*(\d+)\s*页\s*共\s*(\d+)\s*页/g));
    const pageNumbers=new Set(footers.map(footer=>Number(footer[1])));
    if(!Number.isSafeInteger(pageCount)||pageCount<1||pageCount>100||footers.length!==pageCount||pageNumbers.size!==pageCount||footers.some(footer=>Number(footer[2])!==pageCount||Number(footer[1])<1||Number(footer[1])>pageCount))return {errorCode:'incomplete_table',diagnostics:{check:'page_count',...(Number.isSafeInteger(pageCount)&&pageCount>=0&&pageCount<=100?{pageCount}:{}),declaredCourseCount:declared}};
    const required=['课程','上课班级代码','选课状态','上课时间地点'];
    let matches=[];
    for(const table of doc.querySelectorAll('table')){
      const header=table.rows[0];if(!header)continue;
      const cells=Array.from(header.cells).map(c=>trim(c.textContent));
      if(required.every(name=>cells.filter(v=>v===name).length===1))matches.push({table,cells});
    }
    if(matches.length!==1&&matches.length!==pageCount)return {errorCode:'unrecognized_table'};
    const rows=[];
    for(const match of matches){
      let cells=match.cells;
      const index=name=>cells.indexOf(name);
      for(const row of Array.from(match.table.rows).slice(1)){
        const rowCells=Array.from(row.cells).map(cell=>trim(cell.textContent));
        if(required.every(name=>rowCells.filter(value=>value===name).length===1)){cells=rowCells;continue;}
        if(required.some(name=>!row.cells[index(name)]))return {errorCode:'incomplete_table'};
        const value=name=>row.cells[index(name)]?.textContent?.trim();
        if(!value('课程'))return {errorCode:'incomplete_table'};
        const status=value('选课状态');
        if(!['选中','已选中'].includes(status))return {errorCode:'unsupported_selection_status'};
        rows.push({courseText:value('课程'),teachingGroupCode:value('上课班级代码'),selectionStatus:'选中',scheduleText:value('上课时间地点')||''});
      }
    }
    if(rows.length!==declared||rows.length>500)return {errorCode:'incomplete_table',diagnostics:{check:'course_count',declaredCourseCount:declared,...(rows.length<=500?{readCourseCount:rows.length}:{})}};
    return {adapterVersion:'henu-list-2',semester:'2026-2027-1',declaredCourseCount:rows.length,complete:true,rows};
  }
  return {extract,prepare};
});
