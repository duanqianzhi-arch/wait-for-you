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
    if(!/2026\s*[-—－]\s*2027\s*学年第一学期/.test(content))return {errorCode:'unsupported_semester'};
    const count=content.match(/课程门数\s*[:：]\s*(\d+)/);
    const pages=content.match(/共\s*(\d+)\s*页/);
    if(!count||!pages||Number(pages[1])!==1)return {errorCode:'incomplete_table'};
    const required=['课程','上课班级代码','选课状态','上课时间地点'];
    let matches=[];
    for(const table of doc.querySelectorAll('table')){
      const header=table.rows[0];if(!header)continue;
      const cells=Array.from(header.cells).map(c=>trim(c.textContent));
      if(required.every(name=>cells.filter(v=>v===name).length===1))matches.push({table,cells});
    }
    if(matches.length!==1)return {errorCode:'unrecognized_table'};
    const {table,cells}=matches[0],index=name=>cells.indexOf(name),rows=[];
    for(const row of Array.from(table.rows).slice(1)){
      if(required.some(name=>!row.cells[index(name)]))return {errorCode:'incomplete_table'};
      const value=name=>row.cells[index(name)]?.textContent?.trim();
      if(!value('课程'))return {errorCode:'incomplete_table'};
      const status=value('选课状态');
      if(status!=='选中')return {errorCode:'unsupported_selection_status'};
      rows.push({courseText:value('课程'),teachingGroupCode:value('上课班级代码'),selectionStatus:status,scheduleText:value('上课时间地点')||''});
    }
    if(rows.length!==Number(count[1])||rows.length>500)return {errorCode:'incomplete_table'};
    return {adapterVersion:'henu-list-1',semester:'2026-2027-1',declaredCourseCount:rows.length,complete:true,rows};
  }
  return {extract,prepare};
});
