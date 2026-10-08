package cn.henu.study.waitforclass;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebView;
import androidx.webkit.*;
import org.json.*;
import java.nio.charset.StandardCharsets;
import java.net.URI;
import java.util.Collections;

final class TimetableController {
    static final int IMPORT_REQUEST=2301;
    private static final String ORIGIN="https://appassets.androidplatform.net";
    private final Activity activity;
    private final WebView web;
    private final TimetableStore store;
    private JavaScriptReplyProxy replyProxy;
    private JSONObject pendingRaw;
    private boolean importing;
    TimetableController(Activity activity,WebView web,TimetableStore store){this.activity=activity;this.web=web;this.store=store;}
    void attach(){
        try{
            if(!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))return;
            WebViewCompat.addWebMessageListener(web,"StudyTimetableBridge",Collections.singleton(ORIGIN),(view,message,origin,mainFrame,proxy)->{
                String data=message.getData();
                JSONObject response=handle(data,origin.toString(),mainFrame);
                proxy.postMessage(response.toString());
                if(trusted(origin.toString(),mainFrame)){replyProxy=proxy;deliverPending();}
            });
        }catch(RuntimeException|LinkageError unavailable){/* The existing offline study flow remains usable. */}
    }
    private boolean trusted(String origin,boolean mainFrame){
        if(!mainFrame||!ORIGIN.equals(origin)||!PackagedContent.accepts(web.getUrl()))return false;
        try{return "/assets/www/index.html".equals(new URI(web.getUrl()).getPath());}catch(Exception invalid){return false;}
    }
    JSONObject handle(String data,String origin,boolean mainFrame){
        String id="";
        try{
            if(!trusted(origin,mainFrame)||data==null||data.getBytes(StandardCharsets.UTF_8).length>TimetableImportPolicy.MAX_BYTES)throw new JSONException("forbidden");
            JSONObject request=new JSONObject(data);TimetableSchema.keys(request,"id","action","payload");id=TimetableSchema.text(request,"id",64,false);String action=TimetableSchema.text(request,"action",16,false);
            Object payload=JSONObject.NULL;
            switch(action){
                case "load":JSONObject table=store.load();payload=table==null?JSONObject.NULL:table;break;
                case "save":store.save(request.getJSONObject("payload"));payload=store.load();TimetableWidgets.refreshAll(activity);break;
                case "clear":store.clear();TimetableWidgets.refreshAll(activity);break;
                case "widget":
                    JSONObject widget=request.getJSONObject("payload");TimetableSchema.keys(widget,"kind");
                    payload=new JSONObject().put("requested",TimetableWidgets.requestPin(activity,TimetableSchema.text(widget,"kind",5,false)));break;
                case "import":
                    if(importing)throw new JSONException("import_in_progress");
                    activity.startActivityForResult(new Intent(activity,TimetableImportActivity.class),IMPORT_REQUEST);importing=true;break;
                default:throw new JSONException("unknown_action");
            }
            return new JSONObject().put("id",id).put("ok",true).put("payload",payload);
        }catch(Exception failure){
            try{return new JSONObject().put("id",id).put("ok",false).put("errorCode","timetable_operation_failed");}
            catch(JSONException impossible){return new JSONObject();}
        }
    }
    void importResult(int resultCode,Intent data){
        importing=false;
        if(resultCode==Activity.RESULT_OK&&data!=null){
            try{pendingRaw=store.consumeStagedImport(data.getStringExtra("importToken"));deliverPending();}
            catch(Exception invalid){sendEvent("import-error",null);}
        }else sendEvent("import-cancelled",null);
    }
    private void deliverPending(){if(pendingRaw!=null&&sendEvent("import-ready",pendingRaw))pendingRaw=null;}
    private boolean sendEvent(String event,JSONObject payload){
        if(replyProxy==null||!trusted(ORIGIN,true))return false;
        try{replyProxy.postMessage(new JSONObject().put("event",event).put("payload",payload==null?JSONObject.NULL:payload).toString());return true;}
        catch(Exception invalid){replyProxy=null;return false;}
    }
}
