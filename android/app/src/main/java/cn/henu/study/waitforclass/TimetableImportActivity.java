package cn.henu.study.waitforclass;
import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Color;
import android.webkit.*;
import android.widget.*;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import org.json.*;

/** School content has no native bridge. Only a native-initiated read produces a draft. */
public class TimetableImportActivity extends Activity {
    static final String CLEANUP_URL="https://xk.henu.edu.cn/__waitforclass_cleanup__";
    private WebView browser;
    private TextView status;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private int generation,attempts;
    private boolean delivered,destroyed;
    private boolean closing,cookieClearing,startupCleanup,loginReady;
    private String extractor;

    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);root.setFitsSystemWindows(true);setContentView(root);
        LinearLayout toolbar=new LinearLayout(this);
        Button close=new Button(this);close.setText("关闭");close.setOnClickListener(v->finish());toolbar.addView(close);
        TextView domain=new TextView(this);domain.setText("河南大学教务\nxk.henu.edu.cn");domain.setTextSize(16);domain.setTextColor(Color.BLACK);
        toolbar.addView(domain,new LinearLayout.LayoutParams(0,-2,1));
        Button retry=new Button(this);retry.setText("重试");retry.setOnClickListener(v->{if(closing)return;attempts=0;delivered=false;if(!loginReady)beginSchoolLogin();else if(TimetableImportPolicy.acceptsTimetableDocument(browser.getUrl()))readPage(generation);else browser.loadUrl(TimetableImportPolicy.LOGIN);});toolbar.addView(retry);root.addView(toolbar);
        status=new TextView(this);status.setText("请在学校原网页自行登录，程序随后自动读取课表。");status.setTextColor(Color.DKGRAY);status.setPadding(16,10,16,10);root.addView(status);
        browser=new WebView(this);browser.setId(R.id.timetable_import_webview);root.addView(browser,new LinearLayout.LayoutParams(-1,0,1));
        WebSettings settings=browser.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSaveFormData(false);settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        CookieManager.getInstance().setAcceptThirdPartyCookies(browser,false);
        try{extractor=readAsset("www/henu-schedule-adapter.js");}
        catch(Exception unavailable){status.setText("导入资源暂不可用，请返回应用。");return;}
        browser.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !TimetableImportPolicy.acceptsNavigation(request.getUrl().toString());}
            @Override public boolean shouldOverrideUrlLoading(WebView view,String url){return !TimetableImportPolicy.acceptsNavigation(url);}
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){return shouldInterceptRequest(view,request.getUrl().toString());}
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,String url){return TimetableImportPolicy.acceptsNavigation(url)?null:rejected();}
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){generation++;attempts=0;if(!closing)handler.removeCallbacksAndMessages(null);}
            @Override public void onPageFinished(WebView view,String url){
                if(destroyed||closing||url==null||!url.equals(view.getUrl()))return;
                if(startupCleanup&&CLEANUP_URL.equals(url)){clearBeforeLogin(generation);return;}
                if(delivered||!loginReady)return;
                if(TimetableImportPolicy.isHome(url)){view.loadUrl(TimetableImportPolicy.PERSONAL);return;}
                if(TimetableImportPolicy.acceptsTimetableDocument(url)){
                    // Select the already-observed list view; this changes presentation only.
                    view.evaluateJavascript("(function(){var e=document.getElementById('cxfs_lb');if(e&&!e.checked)e.click();})()",null);
                    readPage(generation);
                }
            }
            @Override public void onReceivedSslError(WebView view,SslErrorHandler handler,android.net.http.SslError error){handler.cancel();status.setText("学校连接证书验证失败，未读取课表。");}
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())status.setText("暂时无法连接教务系统。原有课表仍然保留。");}
        });
        beginSchoolLogin();
    }
    private void recordCleanup(boolean success){
        boolean saved=getSharedPreferences("henu-import-session",MODE_PRIVATE).edit().putBoolean("cleanup-pending",!success).commit();
        if(!success||!saved)android.util.Log.w("TimetableImport","school_cleanup_pending");
    }
    private void markCleanupPending(){
        if(!getSharedPreferences("henu-import-session",MODE_PRIVATE).edit().putBoolean("cleanup-pending",true).commit())android.util.Log.w("TimetableImport","cleanup_flag_write_failed");
    }
    private void beginSchoolLogin(){
        if(destroyed||closing)return;loginReady=false;startupCleanup=true;generation++;handler.removeCallbacksAndMessages(null);markCleanupPending();
        status.setText("正在清理上次学校会话…");
        // A bundled, network-free document uses only the verified school origin to clear its storage.
        browser.loadDataWithBaseURL(CLEANUP_URL,"<!doctype html><meta charset='utf-8'><p>正在准备学校登录…</p>","text/html","UTF-8",CLEANUP_URL);
    }
    protected void evaluateSchoolCleanup(ValueCallback<String> callback){
        browser.evaluateJavascript("(function(){try{if(location.origin!=='https://xk.henu.edu.cn')return false;localStorage.clear();sessionStorage.clear();return localStorage.length===0&&sessionStorage.length===0;}catch(e){return false;}})()",callback);
    }
    private void clearBeforeLogin(int started){
        Runnable failed=()->{if(!destroyed&&!closing&&startupCleanup&&started==generation){startupCleanup=false;recordCleanup(false);status.setText("学校缓存清理未完成，请点重试。尚未打开登录页。");}};
        handler.postDelayed(failed,2000);
        evaluateSchoolCleanup(value->{
            if(destroyed||closing||!startupCleanup||started!=generation||!CLEANUP_URL.equals(browser.getUrl()))return;
            handler.removeCallbacks(failed);startupCleanup=false;
            if(!"true".equals(value)){recordCleanup(false);status.setText("学校缓存清理未完成，请点重试。尚未打开登录页。");return;}
            WebStorage.getInstance().deleteOrigin("https://xk.henu.edu.cn");browser.clearCache(true);browser.clearHistory();browser.clearFormData();
            CookieManager.getInstance().removeAllCookies(removed->{
                if(destroyed||closing||started!=generation||!CLEANUP_URL.equals(browser.getUrl()))return;
                if(CookieManager.getInstance().hasCookies()){recordCleanup(false);status.setText("学校会话尚未清理，请点重试。");return;}
                CookieManager.getInstance().flush();markCleanupPending();loginReady=true;browser.loadUrl(TimetableImportPolicy.LOGIN);
            });
        });
    }
    private void readPage(int started){
        if(destroyed||closing||delivered||started!=generation||!TimetableImportPolicy.acceptsTimetableDocument(browser.getUrl()))return;
        if(attempts++>=5){status.setText("课表尚未读取完成，可点重试；原有课表未改变。");return;}
        status.setText("正在识别本人课表…");
        String script="(function(){var module;"+extractor+";return JSON.stringify(HenuScheduleAdapter.extract(document));})()";
        browser.evaluateJavascript(script,value->{
            if(destroyed||delivered||!TimetableImportPolicy.acceptsResult(started,generation,browser.getUrl(),value==null?0:value.getBytes(StandardCharsets.UTF_8).length))return;
            try{
                Object decoded=new JSONTokener(value).nextValue();
                if(!(decoded instanceof String))throw new JSONException("invalid_result");
                JSONObject result=new JSONObject((String)decoded);
                if(result.has("errorCode")){
                    String error=result.optString("errorCode");
                    if("unsupported_semester".equals(error)){status.setText("当前先支持2026—2027第一学期，请选择这个学期。");return;}
                    handler.postDelayed(()->readPage(started),4000);return;
                }
                if(!result.optBoolean("complete")||!result.has("rows"))throw new JSONException("incomplete_result");
                delivered=true;onParsed(result);
            }catch(Exception invalid){status.setText("未能识别完整课表，请重试。原有课表未改变。");}
        });
    }
    protected void onParsed(JSONObject raw){
        try{
            String token=new TimetableStore(this).stageImport(raw);
            setResult(RESULT_OK,new android.content.Intent().putExtra("importToken",token));
            finish();
        }catch(Exception invalid){delivered=false;status.setText("未能保存导入预览，请重试；原有课表未改变。");}
    }
    private String readAsset(String path)throws Exception{
        try(InputStream input=getAssets().open(path);ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] buffer=new byte[4096];int n;while((n=input.read(buffer))!=-1)out.write(buffer,0,n);
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }
    private static WebResourceResponse rejected(){return new WebResourceResponse("text/plain","UTF-8",403,"Forbidden",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
    private void clearSchoolSession(){
        if(browser==null)return;
        WebStorage.getInstance().deleteOrigin("https://xk.henu.edu.cn");
        CookieManager.getInstance().removeAllCookies(null);browser.clearCache(true);browser.clearHistory();browser.clearFormData();
    }
    @Override public void finish(){
        if(closing)return;closing=true;startupCleanup=false;generation++;handler.removeCallbacksAndMessages(null);
        if(browser!=null&&TimetableImportPolicy.acceptsNavigation(browser.getUrl())){
            final int started=generation;final String url=browser.getUrl();
            evaluateSchoolCleanup(value->completeClose(started==generation&&url.equals(browser.getUrl())&&"true".equals(value)));
            handler.postDelayed(()->completeClose(false),2000);
        }else completeClose(false);
    }
    private void completeClose(boolean storageClean){
        if(cookieClearing||destroyed)return;cookieClearing=true;handler.removeCallbacksAndMessages(null);
        WebStorage.getInstance().deleteOrigin("https://xk.henu.edu.cn");
        if(browser!=null){browser.clearCache(true);browser.clearHistory();browser.clearFormData();}
        CookieManager.getInstance().removeAllCookies(removed->{
            if(destroyed)return;CookieManager.getInstance().flush();
            boolean clean=storageClean&&!CookieManager.getInstance().hasCookies();recordCleanup(clean);
            if(!clean)Toast.makeText(this,"学校缓存清理未完成，下次导入会先重试。",Toast.LENGTH_LONG).show();
            TimetableImportActivity.super.finish();
        });
    }
    @Override protected void onDestroy(){destroyed=true;generation++;handler.removeCallbacksAndMessages(null);clearSchoolSession();if(browser!=null){browser.destroy();browser=null;}super.onDestroy();}
}
