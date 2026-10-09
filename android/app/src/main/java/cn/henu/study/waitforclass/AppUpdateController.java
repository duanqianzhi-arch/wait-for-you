package cn.henu.study.waitforclass;

import android.app.Activity;
import android.webkit.WebView;
import androidx.webkit.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.*;

/** Public release metadata only; never receives timetable or school credentials. */
final class AppUpdateController {
    private static final String ORIGIN="https://appassets.androidplatform.net";
    private static final String META="https://henu-study.pages.dev/downloads/android-release.json";
    private final Activity activity;
    private final WebView web;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private boolean checking,closed;
    AppUpdateController(Activity activity,WebView web){this.activity=activity;this.web=web;}
    static boolean acceptsPage(String page,String origin,boolean main){
        if(!main||!ORIGIN.equals(origin)||!PackagedContent.accepts(page))return false;
        try{return "/assets/www/index.html".equals(new URI(page).getPath());}catch(Exception invalid){return false;}
    }
    void attach(){
        try{
            if(!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))return;
            WebViewCompat.addWebMessageListener(web,"StudyUpdateBridge",Collections.singleton(ORIGIN),(view,message,origin,main,proxy)->{
                String id="";
                try{
                    String text=message.getData();if(closed||!acceptsPage(web.getUrl(),origin.toString(),main)||text==null||text.length()>1024)throw new JSONException("forbidden");
                    JSONObject request=new JSONObject(text);TimetableSchema.keys(request,"id","action");id=TimetableSchema.text(request,"id",64,false);
                    if(!"check".equals(request.getString("action"))||checking)throw new JSONException("invalid_request");
                    final String requestId=id;checking=true;
                    worker.execute(()->{
                        JSONObject payload=null;
                        try{int installed=activity.getPackageManager().getPackageInfo(activity.getPackageName(),0).versionCode;payload=parseRelease(readRelease(),installed);}catch(Exception unavailable){/* Fixed public failure code only. */}
                        final JSONObject result=payload;
                        activity.runOnUiThread(()->{
                            checking=false;
                            if(!closed&&!activity.isFinishing()&&acceptsPage(web.getUrl(),ORIGIN,true))respond(proxy,requestId,result);
                        });
                    });
                }catch(Exception invalid){respond(proxy,id,null);}
            });
        }catch(RuntimeException|LinkageError unavailable){/* Offline study remains available. */}
    }
    private static void respond(JavaScriptReplyProxy proxy,String id,JSONObject payload){
        try{JSONObject reply=new JSONObject().put("id",id).put("ok",payload!=null);if(payload!=null)reply.put("payload",payload);else reply.put("errorCode","update_unavailable");proxy.postMessage(reply.toString());}catch(Exception unavailable){/* Closed page. */}
    }
    static JSONObject parseRelease(JSONObject release,int installed)throws Exception {
        String version=release.getString("version"),file=release.getString("file"),hash=release.getString("sha256");
        if(!"cn.henu.study.waitforclass".equals(release.getString("applicationId"))||!version.matches("[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}")||!file.equals("dengni-xiake-v"+version+".apk")||!hash.matches("[0-9a-f]{64}"))throw new JSONException("invalid_release");
        Object code=release.get("versionCode"),size=release.get("size");
        if(!(code instanceof Integer||code instanceof Long)||!(size instanceof Integer||size instanceof Long)||release.getLong("versionCode")<1||release.getLong("versionCode")>1000000||release.getLong("size")<1||release.getLong("size")>25*1024*1024)throw new JSONException("invalid_release");
        String notes=release.opt("notes") instanceof String?release.getString("notes"):"";if(notes.length()>600)notes=notes.substring(0,600);
        return new JSONObject().put("available",release.getInt("versionCode")>installed).put("version",version).put("versionCode",release.getInt("versionCode")).put("notes",notes).put("pageUrl","https://henu-study.pages.dev/android-update.html?versionCode="+installed);
    }
    private static JSONObject readRelease()throws Exception {
        HttpURLConnection connection=(HttpURLConnection)new URL(META).openConnection();
        connection.setConnectTimeout(5000);connection.setReadTimeout(5000);connection.setUseCaches(false);connection.setInstanceFollowRedirects(false);connection.setRequestProperty("Cache-Control","no-cache");
        try{
            if(connection.getResponseCode()!=200)throw new IOException("update_unavailable");
            try(InputStream in=connection.getInputStream();ByteArrayOutputStream bytes=new ByteArrayOutputStream()){
                byte[] buffer=new byte[2048];int count;while((count=in.read(buffer))!=-1){if(bytes.size()+count>16384)throw new IOException("metadata_too_large");bytes.write(buffer,0,count);}
                return new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));
            }
        }finally{connection.disconnect();}
    }
    void close(){closed=true;worker.shutdownNow();}
}
