(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AppUpdates=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function create({bridge,onState=()=>{},toast=()=>{}}){
    const state={status:'idle',release:null,dismissed:false};let pending=null,lastAttempt=0,wantsFeedback=false;
    const publish=()=>onState({...state});
    function check(manual=false){
      if(!bridge.supported)return Promise.resolve();if(pending){wantsFeedback=wantsFeedback||manual;return pending;}
      wantsFeedback=manual;
      state.status='checking';publish();lastAttempt=Date.now();
      pending=Promise.resolve().then(()=>bridge.request('check')).then(reply=>{
        if(!reply||typeof reply.available!=='boolean'||!Number.isSafeInteger(reply.versionCode)||!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(reply.version)||!/^https:\/\/henu-study\.pages\.dev\/android-update\.html\?versionCode=\d{1,7}$/.test(reply.pageUrl))throw Error('invalid_release');
        state.release=reply;state.status=reply.available?'available':'current';state.dismissed=false;
        if(wantsFeedback&&!reply.available)toast('当前已是最新版本。');
      }).catch(()=>{state.status='error';if(wantsFeedback)toast('暂时无法检查更新，请联网后重试。');}).finally(()=>{pending=null;publish();});
      return pending;
    }
    const ready=bridge.supported?check(false):Promise.resolve();
    return {supported:bridge.supported,state,ready,check,dismiss(){state.dismissed=true;publish();},resume(){if(Date.now()-lastAttempt>6*60*60*1000)return check(false);}};
  }
  return {create};
});
