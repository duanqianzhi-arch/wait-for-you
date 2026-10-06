(function () {
  'use strict';
  const data = window.CLASSROOM_DATA, core = window.ClassroomCore, flow = window.ClassroomFlow;
  const $ = id => document.getElementById(id);
  const storageKey = 'henu-classroom-preferences-v1';
  const nativeVersion = document.documentElement.getAttribute('data-native-app') || '';
  const campuses = ['金明校区', '明伦校区'];
  const dogImages = {time:'assets/ink-dog-time.png',low:'assets/ink-dog-low.png',balanced:'assets/ink-dog-balanced.png',quiet:'assets/ink-dog-quiet.png',results:'assets/ink-dog-results.png',empty:'assets/ink-dog-empty.png',favorites:'assets/ink-dog-favorites.png'};
  const modes = {
    low: {title:'少爬楼梯', short:'低楼层', description:'低楼层优先', icon:'stairs', note:'楼层越低越靠前，减少爬楼梯。'},
    balanced: {title:'中等楼层', short:'中等楼层', description:'楼栋中间层优先', icon:'layers', note:'优先推荐所在教学楼的中间楼层。'},
    high: {title:'人少倾向', short:'人少倾向', description:'较高楼层优先', icon:'quiet', note:'按较高楼层排序；实际人数需要到场确认。'}
  };
  const weekdays = ['', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
  const paths = {
    door:'M5 21V3h14v18M11 4v16M15 12h.01M3 21h18',
    home:'m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7',
    search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8',
    settings:'M9 3h6l.5 3 2.5 1.5 2.8-1 3 5-2.3 2v3l2.3 2-3 5-2.8-1-2.5 1.5L15 27H9l-.5-3L6 22.5l-2.8 1-3-5 2.3-2v-3l-2.3-2 3-5 2.8 1L8.5 6 9 3',
    pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    'chevron-down':'m6 9 6 6 6-6', 'chevron-right':'m9 5 7 7-7 7', arrow:'M4 12h16m-6-6 6 6-6 6', back:'m14 5-7 7 7 7',
    close:'m6 6 12 12M6 18 18 6', book:'M4 3h12a3 3 0 0 1 3 3v15H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3M3 17h16M8 7h7M8 11h5',
    stairs:'M3 20h5v-5h5v-5h5V5h3M4 11V4h7M4 4l7 7', layers:'m12 2 10 6-10 6L2 8l10-6M2 13l10 6 10-6M2 17l10 6 10-6',
    quiet:'M15 3a7 7 0 0 0-4 13M7 8a7 7 0 0 0 4 13M9 3v3M4 4v1M20 19v1M15 18v3M16 10h5m-2-2 2 2-2 2',
    sunrise:'M12 3v3M4.5 7.5l2 2M19.5 7.5l-2 2M4 17h16M7 17a5 5 0 0 1 10 0M2 21h20',
    sun:'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
    moon:'M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10', clock:'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    building:'M4 21V3h16v18M2 21h20M8 7h1M15 7h1M8 11h1M15 11h1M8 15h1M15 15h1M10 21v-3h4v3',
    seat:'M6 12V4h12v8M4 12h16v6H4v-6M6 18v3M18 18v3',
    check:'m5 12 4 4L19 6', checkcircle:'M22 11v1a10 10 0 1 1-6-9M22 4 12 14l-3-3',
    info:'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    edit:'m16 3 5 5L9 20l-6 1 1-6L16 3M13 6l5 5',
    phone:'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2M10 18h4',
    download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5', cloud:'M7 18h11a4 4 0 0 0 0-8A6 6 0 0 0 6 8a5 5 0 0 0 1 10',
    calendar:'M4 5h16v16H4V5M8 2v6M16 2v6M4 10h16M8 14h2M14 14h2M8 18h2'
  };
  // Gear uses its own balanced 24px geometry.
  paths.settings = 'M9 3h6l.5 3 2 1.2 2.8-.8 3 5-2.3 2v2.4l2.3 2-3 5-2.8-.8-2 1.2L15 24H9l-.5-3-2-1.2-2.8.8-3-5 2.3-2v-2.4l-2.3-2 3-5 2.8.8 2-1.2L9 3';
  function icon(name, cls='') {
    if (name === 'settings') return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.6 3h4.8l.8 2.5 2.2 1.3 2.6-.6 2.4 4.2-1.8 1.9v2.6l1.8 1.9-2.4 4.2-2.6-.6-2.2 1.3-.8 2.3H9.6l-.8-2.3-2.2-1.3-2.6.6-2.4-4.2 1.8-1.9v-2.6l-1.8-1.9L4 6.2l2.6.6 2.2-1.3L9.6 3" transform="translate(0 -1) scale(1 .93)"/><circle cx="12" cy="12" r="3.1"/></svg>`;
    return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.info}"/></svg>`;
  }
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const availableRooms = data.rooms.filter(core.roomEnabled);
  const roomMap = new Map(availableRooms.map(room => [room.id, room]));
  const campusCount = campus => availableRooms.filter(room => room.campus === campus).length;
  let saved = {};
  try { const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed; } catch (_) {}
  const favorites = new Set((Array.isArray(saved.favorites) ? saved.favorites : []).filter(id => roomMap.has(id)));
  function validTime(value, fallback) { try { core.minutes(value); return value; } catch (_) { return fallback; } }
  const state = {
    campus: campuses.includes(saved.campus) ? saved.campus : campuses[0],
    mode: Object.prototype.hasOwnProperty.call(modes, saved.mode) ? saved.mode : 'balanced',
    date: core.chinaToday(), start: validTime(saved.start, '14:05'), end: validTime(saved.end, '16:40'),
    building:'', keyword:'', onlyFavorites:false, scheduleDay:''
  };
  if (flow.timeError(state.start, state.end)) {state.start='14:05';state.end='16:40';}
  if (!availableRooms.some(room => room.campus === state.campus && room.building === state.building)) state.building = '';
  let dateAuto = true, currentQuery = null, queryError = '', visibleCount = 8, installPrompt = null;
  let toastTimer, route = '', detailOrigin = 'results', offlineStatus = nativeVersion ? '课表随安装包提供 · 可离线查询' : '联网可查；手机离线功能需 HTTPS', dialogReturnFocus;
  const scrollPositions = new Map(), routeStack = [];
  let currentStudyRoute = 'home';
  function options(extra={}) {return {...state, favorites:[...favorites], ...extra};}
  function persist() {
    try {localStorage.setItem(storageKey, JSON.stringify({campus:state.campus, mode:state.mode, building:state.building, start:state.start, end:state.end, favorites:[...favorites]}));}
    catch (_) {toast('当前浏览器无法保存喜欢，查询仍可使用。');}
    updateShell();
  }
  function toast(message) {
    clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
    toastTimer = setTimeout(() => {$('toast').hidden = true;}, 2500);
  }
  function dateInfo() {try {return core.dateInfo(state.date);} catch (_) {return null;}}
  function dateLabel(date=state.date) {
    const info = (() => {try {return core.dateInfo(date);} catch (_) {return null;}})();
    return info ? `${Number(date.slice(5,7))} 月 ${Number(date.slice(8,10))} 日 ${weekdays[info.day]}` : '请选择日期';
  }
  function weekLabel() {const info=dateInfo(); return info && info.week >= 1 && info.week <= data.maxWeek ? `第 ${info.week} 周` : '超出已导入学期';}
  function roomTitle(room) {return room.type === '多媒体教室' && room.code ? room.code : room.name;}
  function detailHref(id) {return '#room/' + encodeURIComponent(id);}
  function dogArt(cls='campus-art', pose='empty') {return `<img class="${cls}" src="${dogImages[pose]}" width="1280" height="1280" alt="" decoding="async">`;}

  function heading(title, subtitle='', right='') {return `<div class="page-heading"><div><h1 tabindex="-1">${title}</h1>${subtitle ? `<p class="muted">${subtitle}</p>` : ''}</div>${right}</div>`;}
  function back(fallback='query', label='返回') {return `<button type="button" class="back-link" data-action="back" data-fallback="${fallback}">${icon('back')}${label}</button>`;}
  function empty(title, message, href='#home', action='去找教室', symbol='search') {
    const artwork = dogArt('empty-art', symbol === 'heart' ? 'favorites' : 'empty');
    return `<div class="empty-state">${artwork}<div class="empty-symbol">${icon(symbol)}</div><h2>${title}</h2><p>${escape(message)}</p><a class="primary-button" href="${href}">${action}${icon('arrow')}</a></div>`;
  }
  function compute() {
    try {
      const error=flow.timeError(state.start,state.end);if(error)throw new Error(error);
      currentQuery = core.recommend(data, options()); queryError='';
    }
    catch (error) {currentQuery=null;queryError=error.message;}
    return currentQuery;
  }
  function snapshot(room) {
    try {
      const info = core.dateInfo(state.date), start = core.minutes(state.start), end = core.minutes(state.end);
      if (info.week < 1 || info.week > data.maxWeek || start >= end) throw new Error('请选择课表范围内的日期和有效时段。');
      const day = state.scheduleDay ? Number(state.scheduleDay) : info.day;
      const events = core.dayEvents(room, info.week, day);
      const next = events.find(event => event.start >= end);
      return {room, events, busy:events.some(event => event.start < end && event.end > start), nextClass:next ? next.start : null, favorite:favorites.has(room.id)};
    } catch (_) {return {room,events:[],unknown:true,favorite:favorites.has(room.id)};}
  }
  function card(result) {
    const room=result.room, favorite=favorites.has(room.id);
    return `<article class="room-card" data-room-id="${escape(room.id)}"><a class="room-entry" href="${detailHref(room.id)}" aria-label="查看${escape(room.name)}详情"><span>${escape(room.name)}</span>${icon('chevron-right')}</a><button type="button" class="icon-button favorite-button" data-favorite="${escape(room.id)}" aria-pressed="${favorite}" aria-label="${favorite?'取消喜欢':'喜欢'}${escape(room.name)}">${icon('heart')}</button></article>`;
  }
  function tearFooter(label) {
    return `<div class="paper-footer"><button type="submit" class="primary-button wizard-next">${label}${icon('arrow')}</button><button type="button" class="tear-handle" data-action="tear" aria-label="向下拉动纸角进入下一页">${icon('arrow')}<span>拉一拉</span></button></div>`;
  }
  function paperStart(step,next) {
    return `<div class="paper-underleaf" aria-hidden="true"><p>${next}</p></div><div class="paper-sheet" data-sketch="paper"><div class="paper-binding"><span>自习便签</span><span>${step} / 2</span></div>`;
  }
  function durationLabel() {
    if(flow.timeError(state.start,state.end))return '请选择有效时段';
    const length=core.minutes(state.end)-core.minutes(state.start);
    return `${Math.floor(length/60)?Math.floor(length/60)+' 小时 ':''}${length%60?length%60+' 分钟':''}`.trim();
  }
  function sliderValue(field) {
    try {return core.minutes(state[field]);}catch (_) {return field==='start'?480:1300;}
  }
  function homePage() {
    return `<section class="page wizard-page paper-pad" data-page="home">${paperStart(1,'喜欢哪一种？')}
      <header class="wizard-intro"><div><p class="when-label" lang="en">When do we go?</p><h1 tabindex="-1">哪段时间？</h1><p class="muted">滑动或输入时间。</p></div>${dogArt('wizard-dog','time')}</header>
      <form id="time-form" class="time-card" novalidate>
        <div class="time-date-row"><button type="button" class="plan-date" data-action="date" aria-haspopup="dialog">${icon('calendar')}<span>${dateLabel()}<small>${weekLabel()}</small></span>${icon('chevron-down')}</button></div>
        <div class="time-input-row"><label class="field">开始时间<input id="start-time" data-field="start" type="time" value="${escape(state.start)}" min="08:00" max="21:39" step="60" required aria-describedby="time-error"></label>${icon('arrow')}<label class="field">结束时间<input id="end-time" data-field="end" type="time" value="${escape(state.end)}" min="08:01" max="21:40" step="60" required aria-describedby="time-error"></label></div>
        <div class="time-sliders"><label class="slider-label" for="start-slider"><span>滑动调整开始</span><output id="start-output">${escape(state.start)}</output></label><input id="start-slider" data-boundary="start" type="range" min="480" max="1299" step="1" value="${sliderValue('start')}" aria-label="滑动调整开始时间" aria-valuetext="${escape(state.start)}">
        <label class="slider-label" for="end-slider"><span>滑动调整结束</span><output id="end-output">${escape(state.end)}</output></label><input id="end-slider" data-boundary="end" type="range" min="481" max="1300" step="1" value="${sliderValue('end')}" aria-label="滑动调整结束时间" aria-valuetext="${escape(state.end)}"><div class="slider-axis"><span>08:00</span><span>21:40</span></div></div>
        <p class="selected-duration">这次学习 <strong id="study-duration">${durationLabel()}</strong></p>
        <p class="error" id="time-error" role="alert" ${queryError?'':'hidden'}>${escape(queryError)}</p>
        ${tearFooter('下一页，选偏好')}
      </form></div></section>`;
  }
  function preferencesPage() {
    return `<section class="page wizard-page paper-pad" data-page="preferences">${paperStart(2,'找到这些教室')}
      <header class="paper-title"><p class="when-label" lang="en">What feels right?</p><h1 tabindex="-1">喜欢哪一种？</h1><p>选一种舒服的自习方式。</p></header>
      <a class="wizard-plan-summary" href="#home" aria-label="修改自习时间"><span>${Number(state.date.slice(5,7))}月${Number(state.date.slice(8,10))}日 · ${escape(state.start)}—${escape(state.end)}</span><span>${icon('edit')}修改</span></a>
      <form id="preference-form" novalidate><fieldset class="preference-list"><legend class="sr-only">选择推荐偏好</legend>${Object.entries(modes).map(([key,m])=>`<label class="preference-option"><input type="radio" name="mode" value="${key}" ${state.mode===key?'checked':''}><span class="preference-option-content" data-sketch="option">${dogArt('preference-dog',key==='high'?'quiet':key)}<span class="preference-copy"><b>${m.title}</b><small>${key==='high'?'较高楼层优先，人数以现场为准。':key==='low'?'低楼层优先，少爬几级台阶。':'不太高也不太低，中间层优先。'}</small></span><i class="radio-dot" aria-hidden="true"></i></span></label>`).join('')}</fieldset>
      <p class="error" id="preference-error" role="alert" ${queryError?'':'hidden'}>${escape(queryError)}</p>${tearFooter('看看推荐教室')}</form></div></section>`;
  }
  function resultsPage() {
    const q=compute();
    if(!q)return `<section class="page results-page" data-page="results">${heading('调整一下自习时间')}${empty('这个时间暂时无法查询',queryError,'#home','修改时间','calendar')}</section>`;
    return `<section class="page results-page" data-page="results">${heading('找到这些教室',`${escape(state.campus)} · ${q.results.length} 间无课`,q.results.length?dogArt('result-dog','results'):'')}
      <div class="result-query-line"><a href="#home" aria-label="修改自习时间"><strong>${escape(state.start)}—${escape(state.end)}</strong><small>${dateLabel()} · 第 ${q.week} 周${q.scheduleDay!==q.day?' · 按'+weekdays[q.scheduleDay]+'课表':''}</small></a><a class="text-link" href="#preferences">${modes[state.mode].short}${icon('edit')}</a></div>
      <div class="room-grid" id="results">${q.results.length?q.results.slice(0,visibleCount).map(card).join(''):empty('这个时段没有无课教室','换一个学习时段再找找吧。','#home','修改时间')}</div>${q.results.length>visibleCount?`<button type="button" class="more-button" id="more-button" data-action="more">再看 ${Math.min(12,q.results.length-visibleCount)} 间${icon('chevron-down')}</button>`:''}
      <p class="section-note">点教室看详情 · 点爱心留给下次<br>按课表推荐，开放情况请到场确认。</p></section>`;
  }
  function timeline(events,start,end) {
    const range=(a,b)=>({left:Math.max(0,Math.min(100,(a-480)/820*100)),width:Math.max(0,(Math.min(b,1300)-Math.max(a,480))/820*100)});
    const bars=core.mergeIntervals(events).map(event=>{const p=range(event.start,event.end);return `<span class="busy-bar" style="left:${p.left}%;width:${p.width}%" aria-hidden="true"></span>`;}).join('');
    const selected=range(start,end), description=events.length ? core.mergeIntervals(events).map(e=>`${core.clock(e.start)}至${core.clock(e.end)}有课`).join('；') : '当天课表无课';
    return `<div class="schedule-timeline" role="img" aria-label="${escape(description)}；所选时段 ${core.clock(start)}至${core.clock(end)}"><span class="study-bar" style="left:${selected.left}%;width:${selected.width}%" aria-hidden="true"></span>${bars}</div><div class="time-axis"><span>08:00</span><span>12:00</span><span>16:00</span><span>21:40</span></div><div class="schedule-legend"><span><i></i>课表无课</span><span><i></i>课程占用</span><span><i></i>所选时段</span></div>`;
  }
  function scheduleRows(events,start,end) {
    const rows=[...core.mergeIntervals(events).map(e=>({...e,busy:true})),...core.freeIntervals(events).map(e=>({...e,busy:false}))].sort((a,b)=>a.start-b.start);
    return rows.map(row=>{
      const selected=!row.busy&&start>=row.start&&end<=row.end;
      const matching=events.filter(e=>e.start<row.end&&e.end>row.start);
      const caption=row.busy ? [...new Set(matching.map(e=>`${e.session==='noon'?'中午 ':''}第 ${e.firstSection===e.lastSection?e.firstSection:`${e.firstSection}—${e.lastSection}`} 节`))].join('、') : selected ? '覆盖你选择的完整自习时段' : '按当前教学周的课表计算';
      return `<div class="schedule-row ${row.busy?'occupied':''} ${selected?'selected':''}"><time>${core.clock(row.start)}—${core.clock(row.end)}</time><span class="schedule-dot" aria-hidden="true"></span><div><b>${row.busy?'课程占用':selected?'课表无课 · 所选时段':'课表无课'}</b><small>${escape(caption)}</small></div></div>`;
    }).join('');
  }
  function detailPage(id) {
    const room=roomMap.get(id);
    if (!room) return `<section class="page page-narrow" data-page="room">${back('query')}${empty('没有找到这间教室','这条教室地址可能不完整，请从推荐列表重新选择。','#home','重新找教室','building')}</section>`;
    const result=snapshot(room), title=roomTitle(room), favorite=favorites.has(id), info=dateInfo();
    const buildingFloors=[...new Set(availableRooms.filter(r=>r.campus===room.campus&&r.building===room.building).map(r=>r.floor))].sort((a,b)=>a-b);
    const start=(() => {try {return core.minutes(state.start);} catch (_) {return 0;}})(),end=(() => {try {return core.minutes(state.end);} catch (_) {return 0;}})();
    const availability=result.unknown ? `<p class="error">请选择课表范围内的有效日期和时段。<a href="#home">修改查询</a></p>` : `<div class="availability-panel ${result.busy?'busy':''}">${icon(result.busy?'clock':'checkcircle')}<div><h2>${escape(state.start)}—${escape(state.end)} ${result.busy?'有课程占用':'课表无课'}</h2><p>${result.busy?'可以查看下面的其他无课时间。':'完整覆盖你的学习时段。'}</p></div><a class="text-link" href="#home">换个时间${icon('chevron-right')}</a></div>`;
    return `<section class="page page-narrow" data-page="room">${back(detailOrigin==='settings'?'settings':'results','返回列表')}<div class="detail-hero"><div class="detail-heading"><div><p>${escape(room.campus)} · ${escape(room.building)}</p><h1 tabindex="-1" class="${title.length>12?'long-name':''}">${escape(title)}</h1></div><button type="button" class="detail-favorite" data-favorite="${escape(id)}" aria-pressed="${favorite}">${icon('heart')}${favorite?'已喜欢':'喜欢'}</button></div><div class="detail-metadata"><div><span>所在楼层</span><b>${room.floor} 层</b></div><div><span>教室类型</span><b>${escape(room.type)}</b></div>${room.capacity?`<div><span>座位容量</span><b>${room.capacity} 座</b></div>`:''}</div><div class="floor-visual"><div class="floor-track" aria-label="所在楼层${room.floor}层，按教室编号推算">${buildingFloors.map(f=>`<span class="${f===room.floor?'active':''}">${f}层</span>`).join('')}</div><p>楼层按教室<br>编号推算</p></div></div>${availability}${!result.unknown ? `<section class="schedule-panel"><h2>这间教室的一天</h2><p class="schedule-date">${dateLabel()} · 第 ${info.week} 周${state.scheduleDay&&Number(state.scheduleDay)!==info.day?` · 改按${weekdays[Number(state.scheduleDay)]}课表`:''}</p>${timeline(result.events,start,end)}${scheduleRows(result.events,start,end)}</section>` : ''}<p class="detail-note">课程占用按周次、星期和单双周计算。容量表示座位总数，并非当前空位；开放情况、现场人数及临时活动尚未核验。多媒体教室不保证有可用电脑或插座。<a href="#about">查看数据说明</a></p></section>`;
  }
  function settingsRow(symbol,title,caption,action='',href='') {
    const attrs=href ? `href="${href}"${href.endsWith('.apk')?' download="等你下课-v1.0.1.apk"':''}` : action ? `type="button" data-action="${action}"` : '', tag=href?'a':action?'button':'div';
    return `<${tag} class="settings-row" ${attrs}><span class="settings-icon">${icon(symbol)}</span><span><b>${title}</b><small>${escape(caption)}</small></span>${action||href?icon('chevron-right'):''}</${tag}>`;
  }
  function settingsPage() {
    const rooms=availableRooms.filter(room=>room.campus===state.campus&&favorites.has(room.id));
    return `<section class="page page-narrow" data-page="settings">${heading('设置','喜欢的教室，留给下次自习。')}
      <section class="settings-group favorite-management"><div class="favorite-management-heading"><h2>喜欢的教室 <span>${rooms.length}</span></h2><p>${escape(state.campus)} · 切换右上角校区可管理另一校区的喜欢列表</p></div>
      ${rooms.length?`<div class="favorite-list">${rooms.map(room=>`<div class="favorite-row"><a href="${detailHref(room.id)}" aria-label="查看${escape(room.name)}详情"><b>${escape(room.name)}</b><small>${room.floor} 层${room.capacity?' · '+room.capacity+' 座':''}</small></a><button type="button" class="remove-favorite" data-favorite="${escape(room.id)}" aria-label="取消喜欢${escape(room.name)}">移除</button></div>`).join('')}</div><p class="favorite-explanation">所选时段内无课时，喜欢的教室在同一楼栋组里优先。列表保存在这台设备上。</p>`:`<div class="favorites-empty">${dogArt('settings-dog','favorites')}<p>还没有喜欢的教室。<br>推荐时点一下爱心，就能留在这里。</p></div>`}</section>
      <section class="settings-group">${nativeVersion ? settingsRow('phone',`安卓版本 ${escape(nativeVersion)}`,'已安装 · 去自习，好吗？')+settingsRow('cloud','检查更新','联网查看新版本。','','https://henu-study.pages.dev/android-update.html?versionCode=2') : settingsRow('phone','下载安卓 App','1.0.1 测试版 · 内置课表','',document.documentElement.hasAttribute('data-preview-only')?'https://henu-study.pages.dev/downloads/dengni-xiake-v1.0.1.apk':'./downloads/dengni-xiake-v1.0.1.apk')+settingsRow('phone','添加到手机桌面','iPhone 或支持的安卓浏览器。','install')}${settingsRow('book','课表与推荐规则',`课表导出于 ${data.sourceExportedAt}`,'','#about')}</section>
      <details class="settings-group schedule-settings"><summary>学校临时调课</summary><div class="settings-content"><label class="field">按哪一天的课表查询<select id="schedule-day" data-field="scheduleDay"><option value="">随日期自动识别</option>${weekdays.slice(1).map((day,index)=>`<option value="${index+1}" ${state.scheduleDay===String(index+1)?'selected':''}>${day}</option>`).join('')}</select></label><p class="helper">仅在学校通知调课时调整，教学周仍按日期计算。</p></div></details>
      <p class="settings-footer">河南大学 · 明伦 ${campusCount('明伦校区')} 间 / 金明 ${campusCount('金明校区')} 间</p></section>`;
  }
  function aboutPage() {
    return `<section class="page page-narrow" data-page="about">${back('settings','返回')}${heading('课表与推荐规则','知道推荐来自哪里，也知道它能说明什么。')}<section class="data-sheet"><h2>正在使用的课表</h2><div class="data-kv"><span>学校</span><strong>${escape(data.school)}</strong></div><div class="data-kv"><span>学期</span><strong>2026—2027 第一学期</strong></div><div class="data-kv"><span>导出时间</span><strong>${escape(data.sourceExportedAt)}</strong></div><div class="data-kv"><span>教学周范围</span><strong>第 1—${data.maxWeek} 周</strong></div><div class="data-kv"><span>明伦 / 金明</span><strong>${campusCount('明伦校区')} / ${campusCount('金明校区')} 间</strong></div><p>日期按北京时间识别，${escape(data.anchor.firstMonday)} 为第一周周一。课程按星期、周次、单双周和实际起止时间计算；只要课程与自习时段重叠，就排除这间教室。</p></section><section class="data-sheet"><h2>怎样排序</h2><p><strong>先按楼栋组，再按喜欢与楼层。</strong>金明综合楼和七号教学楼优先，计算机大楼放在后备组。曾宪梓楼已移除。同一组内先推荐喜欢的教室，再按低楼层、中等楼层或较高楼层排序。同等条件下，连续无课时间更长的教室靠前。中等楼层取该楼已导入教室最高层与最低层的中间位置。</p><p><strong>人少是一种倾向。</strong>这里先按较高楼层排序，没有测量现场人数。楼层按编号推算，例如金明综合楼5203暂按2层判断。</p><p><strong>无课不等于现场空置。</strong>教室开放情况、临时活动尚未接入；座位容量不是空位数，多媒体教室也不保证提供可用电脑或插座。</p><p>课表不会自动更新。学校临时调课时，可以在设置里的“学校临时调课”调整课表星期。</p></section><section class="data-sheet"><h2>开封校区作息时间</h2><table class="info-table"><thead><tr><th>节次</th><th>开始</th><th>结束</th></tr></thead><tbody>${core.PERIODS.map((p,index)=>`<tr><td>第 ${index+1} 节</td><td>${core.clock(p[0])}</td><td>${core.clock(p[1])}</td></tr>`).join('')}<tr><td>中午 1—2 节</td><td>12:30</td><td>14:00</td></tr></tbody></table></section></section>`;
  }
  function getRoute() {
    const value=location.hash.slice(1)||'home';
    return value==='query'?'home':value==='favorites'?'settings':value;
  }
  function routeName(value=route) {return value.split('/')[0];}
  function updateShell() {
    $('header-campus').textContent=state.campus;
    const settings=routeName()==='settings'||routeName()==='about'||(routeName()==='room'&&detailOrigin==='settings');
    document.querySelectorAll('[data-nav]').forEach(link=>{
      if(link.dataset.nav==='study')link.href='#'+currentStudyRoute;
      if(link.dataset.nav===(settings?'settings':'study'))link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
  }
  function focusKey() {
    const el=document.activeElement;
    if (!el || !$('app-main').contains(el)) return '';
    if (el.id) return '#'+CSS.escape(el.id);
    for (const name of ['favorite','mode','period','date','action']) if (el.dataset[name]) return `[data-${name}="${CSS.escape(el.dataset[name])}"]`;
    if (el.name && el.value) return `input[name="${CSS.escape(el.name)}"][value="${CSS.escape(el.value)}"]`;
    return '';
  }
  function render(changed=false) {
    const y=window.scrollY, oldFocus=changed?'':focusKey();
    let content='', title='等你下课', name=routeName();
    if (name==='home') {content=homePage();title='选择时间';}
    else if (name==='preferences') {content=preferencesPage();title='选择偏好';}
    else if (name==='results') {content=resultsPage();title='推荐教室';}
    else if (name==='settings') {content=settingsPage();title='设置';}
    else if (name==='about') {content=aboutPage();title='课表说明';}
    else if (name==='room') {
      let id='';try {id=decodeURIComponent(route.slice(5));}catch (_) {}
      content=detailPage(id);title=roomMap.has(id)?roomMap.get(id).name:'教室详情';
    } else content=`<section class="page">${empty('这个页面还没有内容','可以从底部导航重新进入查询。','#home','回到首页')}</section>`;
    if(['home','preferences','results'].includes(name))currentStudyRoute=name;
    $('app-main').innerHTML=content;updateShell();requestAnimationFrame(drawSketchFrames);
    if(transitionBusy)$('app-main').querySelectorAll('.wizard-next,.tear-handle').forEach(button=>{button.disabled=true;});
    document.title=`${title} · 等你下课`;
    if (changed) {
      const heading=$('app-main').querySelector('h1');
      (heading||$('app-main')).focus({preventScroll:true});
      window.scrollTo({top:scrollPositions.get(route)||0,behavior:'auto'});
      $('page-status').textContent=`已打开${title}页面`;
    } else {
      if(oldFocus) document.querySelector(oldFocus)?.focus({preventScroll:true});
      window.scrollTo({top:y,behavior:'auto'});
    }
  }
  function drawSketchFrames() {
    if(!window.rough)return;
    document.querySelectorAll('[data-sketch]').forEach((el,index)=>{
      el.querySelector(':scope > .sketch-border')?.remove();
      const w=el.clientWidth,h=el.clientHeight;
      if(!w||!h)return;
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('aria-hidden','true');svg.classList.add('sketch-border');
      const renderer=window.rough.svg(svg), opts={stroke:'#303030',strokeWidth:1,roughness:.55,bowing:.45,seed:31+index};
      const d=el.dataset.sketch==='paper'?`M2 3 L${w-3} 2 L${w-2} ${h-7} L3 ${h-7} Z`:`M8 3 Q${w/2} 1 ${w-7} 4 Q${w-2} 5 ${w-3} 11 L${w-3} ${h-9} Q${w-3} ${h-3} ${w-10} ${h-4} L10 ${h-3} Q3 ${h-4} 4 ${h-11} L3 11 Q2 4 8 3 Z`;
      svg.appendChild(renderer.path(d,opts));el.prepend(svg);
    });
  }
  let resizeFrame;
  window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(drawSketchFrames);});
  function navigate(value) {if(getRoute()===value)render();else location.hash=value;}
  let transitionBusy=false, tearGesture=null, suppressTearClickUntil=0;
  function tearTo(next) {
    if(transitionBusy)return;
    const sheet=document.querySelector('.paper-sheet');
    if(!sheet||matchMedia('(prefers-reduced-motion: reduce)').matches||!sheet.animate){navigate(next);return;}
    transitionBusy=true;
    const rect=sheet.getBoundingClientRect(), overlay=sheet.cloneNode(true);
    overlay.removeAttribute('data-sketch');overlay.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
    overlay.classList.add('tear-overlay');overlay.setAttribute('aria-hidden','true');overlay.inert=true;
    Object.assign(overlay.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',transform:''});
    document.body.appendChild(overlay);navigate(next);
    const motion=overlay.animate([
      {transform:'translate(0,0) rotate(0deg)',opacity:1},
      {transform:'translate(12px,35px) rotate(3deg)',opacity:1,offset:.27},
      {transform:`translate(70px,${Math.min(innerHeight,rect.height)*.8}px) rotate(13deg)`,opacity:0}
    ],{duration:470,easing:'cubic-bezier(.34,.02,.66,1)',fill:'forwards'});
    motion.finished.catch(()=>{}).finally(()=>{overlay.remove();transitionBusy=false;$('app-main').querySelectorAll('.wizard-next,.tear-handle').forEach(button=>{button.disabled=false;});});
  }
  document.addEventListener('pointerdown',event=>{
    const handle=event.target.closest('.tear-handle');
    if(!handle||transitionBusy||event.button!==0)return;
    const sheet=handle.closest('.paper-sheet');
    tearGesture={id:event.pointerId,y:event.clientY,distance:0,handle,sheet,form:handle.closest('form')};
    handle.setPointerCapture(event.pointerId);sheet.classList.add('is-dragging');
  });
  document.addEventListener('pointermove',event=>{
    const g=tearGesture;if(!g||g.id!==event.pointerId)return;
    g.distance=event.clientY-g.y;
    g.sheet.style.transform=`translateY(${Math.max(0,g.distance)*.16}px) rotate(${Math.min(2,Math.max(0,g.distance)*.018)}deg)`;
  });
  function endTear(event,cancelled=false) {
    const g=tearGesture;if(!g||g.id!==event.pointerId)return;
    tearGesture=null;g.sheet.style.transform='';g.sheet.classList.remove('is-dragging');
    if(g.handle.hasPointerCapture(g.id))g.handle.releasePointerCapture(g.id);
    if(Math.abs(g.distance)>4||cancelled)suppressTearClickUntil=performance.now()+500;
    if(flow.tearOutcome(state.start,state.end,g.distance,cancelled)!=='stay')g.form.requestSubmit();
  }
  document.addEventListener('pointerup',event=>endTear(event));
  document.addEventListener('pointercancel',event=>endTear(event,true));
  function onRouteChange() {
    scrollPositions.set(route,window.scrollY);
    const next=getRoute();
    if (next.startsWith('room/') && !route.startsWith('room/')) detailOrigin=routeName();
    if (routeStack.length>1 && routeStack[routeStack.length-2]===next) routeStack.pop();
    else routeStack.push(next);
    route=next;render(true);
  }
  function refreshTimeUI() {
    for(const field of ['start','end']) {
      const time=state[field], input=$(field+'-time'), slider=$(field+'-slider');
      if(input&&input!==document.activeElement)input.value=time;
      if(slider&&time) {try {slider.value=core.minutes(time);slider.setAttribute('aria-valuetext',time);}catch (_) {}}
      if($(field+'-output'))$(field+'-output').textContent=time||'—';
      input?.setAttribute('aria-invalid',String(Boolean(flow.timeError(state.start,state.end))));
    }
    if($('study-duration'))$('study-duration').textContent=durationLabel();
    const error=flow.timeError(state.start,state.end);
    if($('time-error')) {$('time-error').textContent=error;$('time-error').hidden=!error;}
  }
  function setCampus(campus) {
    if(!campuses.includes(campus)) return;
    if(state.campus!==campus) state.building='';
    state.campus=campus;persist();currentQuery=null;
  }
  function showDialog(title,content) {
    dialogReturnFocus=document.activeElement;
    $('dialog-title').textContent=title;$('dialog-content').innerHTML=content;
    $('info-dialog').showModal();
  }
  function campusDialog() {
    showDialog('选择你的校区',`<div class="dialog-campus">${campuses.map(campus=>`<button type="button" data-campus="${campus}" aria-pressed="${state.campus===campus}">${icon('building')}<span><b>${campus}</b><small>${campusCount(campus)} 间教室已导入课表</small></span>${state.campus===campus?icon('check'):icon('chevron-right')}</button>`).join('')}</div><p class="helper">目前支持开封的金明、明伦两个校区。</p>`);
  }
  function dateDialog() {
    const lastDate=new Date(core.dateInfo(data.anchor.firstMonday).stamp+data.maxWeek*7*86400000-86400000).toISOString().slice(0,10);
    showDialog('选择学习日期',`<div class="date-sheet"><p class="helper">确认日期后，自动识别对应的教学周。</p><label class="field">学习日期<input id="dialog-study-date" type="date" value="${escape(state.date)}" min="${data.anchor.firstMonday}" max="${lastDate}" required></label><p class="error" id="dialog-date-error" role="alert" hidden></p><div class="sheet-actions"><button type="button" class="secondary-button" data-action="today">回到今天</button><button type="button" class="primary-button" data-action="confirm-date">确认日期</button></div></div>`);
  }
  async function install() {
    if(installPrompt) {await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;return;}
    const preview=document.documentElement.hasAttribute('data-preview-only') || location.protocol==='file:' || location.protocol!=='https:';
    showDialog('添加到手机桌面',`<div class="info-text">${preview?'<p>当前是本地预览。手机安装请使用固定网站地址。</p>':''}<p><b>iPhone</b><br>用 Safari 打开链接，点分享，选择“添加到主屏幕”；如有“作为网页 App 打开”，将它打开，再点“添加”。</p><p><b>安卓</b><br>可以在设置中下载安卓 App 测试版，直接安装。也可以用手机自带浏览器打开网站；如果菜单提供“添加到桌面”或“安装应用”，可以使用。没有这个选项时，请下载安卓安装包。</p><p>网页版请联网使用；安卓包内含页面和课表。课表不会自动更新。</p></div>`);
  }
  document.addEventListener('click',event=>{
    const target=event.target.closest('button');
    if(!target) return;
    if(target.dataset.favorite) {
      const id=target.dataset.favorite;if(!roomMap.has(id))return;
      if(favorites.has(id))favorites.delete(id);else favorites.add(id);
      persist();render();toast(favorites.has(id)?'已喜欢，同一楼栋组内优先推荐。':'已取消喜欢。');
      $('page-status').textContent=`${roomMap.get(id).name}${favorites.has(id)?'已喜欢':'已取消喜欢'}`;
      return;
    }

    if(target.dataset.campus) {
      setCampus(target.dataset.campus);$('info-dialog').close();
      if(routeName()==='room')navigate(detailOrigin==='settings'?'settings':'results');
      else render();
      return;
    }
    const action=target.dataset.action;
    if(action==='tear') {if(event.detail===0||performance.now()>suppressTearClickUntil)target.closest('form').requestSubmit();}
    else if(action==='campus')campusDialog();
    else if(action==='date')dateDialog();
    else if(action==='confirm-date') {
      try {
        const value=$('dialog-study-date').value, info=core.dateInfo(value);
        if(info.week<1||info.week>data.maxWeek)throw new Error('请选择当前课表学期内的日期。');
        state.date=value;dateAuto=value===core.chinaToday();state.scheduleDay='';currentQuery=null;queryError='';persist();$('info-dialog').close();render();
      } catch(error) {$('dialog-date-error').textContent=error.message;$('dialog-date-error').hidden=false;}
    }
    else if(action==='close-dialog')$('info-dialog').close();
    else if(action==='install')install();
    else if(action==='today') {dateAuto=true;state.date=core.chinaToday();state.scheduleDay='';queryError='';$('info-dialog').close();render();}
    else if(action==='back') {if(routeStack.length>1)history.back();else navigate(target.dataset.fallback||'home');}
    else if(action==='more') {visibleCount+=12;render();}
  });
  function readField(target) {
    const field=target.dataset.field;
    if(!['start','end','scheduleDay'].includes(field))return;
    state[field]=target.value;currentQuery=null;queryError='';
  }
  document.addEventListener('input',event=>{
    const target=event.target;
    if(target.dataset.boundary) {
      Object.assign(state,flow.moveBoundary(state.start,state.end,target.dataset.boundary,target.value));
      queryError='';currentQuery=null;refreshTimeUI();persist();
    } else if(target.matches('[data-field]')) {readField(target);refreshTimeUI();persist();}
  });
  document.addEventListener('change',event=>{
    const target=event.target;
    if(target.name==='mode'&&Object.prototype.hasOwnProperty.call(modes,target.value)) {state.mode=target.value;visibleCount=8;persist();return;}
    if(target.matches('[data-field]')) {readField(target);refreshTimeUI();persist();}
  });
  document.addEventListener('submit',event=>{
    const id=event.target.id;
    if(!['time-form','preference-form'].includes(id))return;
    event.preventDefault();
    if(compute()) {
      visibleCount=8;scrollPositions.delete('results');persist();tearTo(id==='time-form'?'preferences':'results');
    } else {
      const error=$(id==='time-form'?'time-error':'preference-error');
      error.textContent=queryError;error.hidden=false;$('page-status').textContent=queryError;
    }
  });

  $('info-dialog').addEventListener('close',()=>{
    if(dialogReturnFocus?.isConnected)dialogReturnFocus.focus({preventScroll:true});
    else document.querySelector('[data-action="campus"]')?.focus({preventScroll:true});
  });
  $('info-dialog').addEventListener('click',event=>{
    if(event.target!==$('info-dialog'))return;
    const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('info-dialog').close();
  });
  function refreshToday() {
    const today=core.chinaToday();
    if(dateAuto&&state.date!==today) {state.date=today;state.scheduleDay='';currentQuery=null;queryError='';render();}
  }
  const dateTimer=setInterval(refreshToday,60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshToday();});
  window.addEventListener('hashchange',onRouteChange);
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
  window.addEventListener('appinstalled',()=>toast('已添加到桌面。'));
  document.querySelectorAll('[data-icon]').forEach(el=>{if(el.classList.contains('brand-mark'))el.innerHTML=icon(el.dataset.icon);else el.outerHTML=icon(el.dataset.icon);});
  if(!location.hash)history.replaceState(null,'','#home');
  route=getRoute();routeStack.push(route);render();
  if(nativeVersion)window.ClassroomNative = {
    handleBack() {
      const dialog=$('info-dialog');
      if(dialog.open){dialog.close();return true;}
      if(routeName()==='home')return false;
      if(routeStack.length>1)history.back();
      else navigate(routeName()==='room'?detailOrigin:routeName()==='about'?'settings':routeName()==='results'?'preferences':'home');
      return true;
    }
  };
  async function setupOffline() {
    const standalone=document.documentElement.hasAttribute('data-preview-only'), local=['localhost','127.0.0.1'].includes(location.hostname);
    if(nativeVersion) {
      offlineStatus='课表随安装包提供 · 可离线查询';
    } else if(standalone || !('serviceWorker' in navigator) || !(location.protocol==='https:'||local)) {
      offlineStatus=standalone?'单文件预览 · 不依赖网络':'本地手机测试 · 完整离线功能需 HTTPS';
    } else {
      try {
        await navigator.serviceWorker.register('./sw.js');
        await navigator.serviceWorker.ready;
        const keys=await caches.keys(), cached=keys.some(key=>key.startsWith('henu-classroom-'));
        offlineStatus=cached?'课表已缓存 · 可离线查询':'正在准备离线课表';
      } catch (_) {offlineStatus='缓存暂不可用 · 联网仍可查询';}
    }
    if(routeName()==='settings')render();
  }
  window.addEventListener('online',()=>{if(routeName()==='settings')render();});
  window.addEventListener('offline',()=>{toast('当前离线，使用已加载的课表。');if(routeName()==='settings')render();});
  setupOffline();
  const context=document.modelContext, lifecycle=new AbortController();
  if(context?.registerTool) {
    const register=tool=>{try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch(_) {}};
    register({
      name:'read_classroom_query',title:'读取当前空教室查询',description:'读取页面查询条件和推荐结果，不改变页面。',
      inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},
      execute(){const q=compute();return {page:route,query:options(),week:q?.week,total:q?.results.length||0,rooms:(q?.results||[]).slice(0,10).map(x=>({id:x.room.id,name:x.room.name,floor:x.room.floor,campus:x.room.campus}))};}
    });
    register({
      name:'query_free_classrooms',title:'按时段推荐空教室',description:'更新校区、日期、学习时段和偏好，并打开推荐结果页面。',
      inputSchema:{type:'object',properties:{campus:{type:'string',enum:['明伦校区','金明校区']},date:{type:'string'},start:{type:'string'},end:{type:'string'},mode:{type:'string',enum:['low','balanced','high']}},required:['campus','date','start','end','mode'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},
      execute(input){
        if(!input||typeof input!=='object')throw new Error('需要提供查询条件。');
        const error=flow.timeError(input.start,input.end);if(error)throw new Error(error);
        const q=core.recommend(data,{...input,favorites:[...favorites]});
        Object.assign(state,input,{building:'',keyword:'',onlyFavorites:false,scheduleDay:''});dateAuto=false;currentQuery=q;visibleCount=8;persist();navigate('results');
        return {week:q.week,total:q.results.length,rooms:q.results.slice(0,10).map(x=>({id:x.room.id,name:x.room.name,floor:x.room.floor}))};
      }
    });
  }
  window.addEventListener('pagehide',event=>{if(!event.persisted){clearInterval(dateTimer);lifecycle.abort();}},{once:true});
})();

