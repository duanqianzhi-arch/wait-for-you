package cn.henu.study.waitforclass;
import android.app.Activity;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.widget.Toast;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;
import java.util.Collections;

public class MainActivity extends Activity {
    public static final String START_URL="https://appassets.androidplatform.net/assets/www/index.html#home";
    private WebView webView;
    private FrameLayout root;
    private boolean handlingBack;
    private TimetableController timetableController;

    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        root=new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(244,244,242));
        setContentView(root);
        applySystemInsets();
        PackageInfo provider;
        try { provider=WebView.getCurrentWebViewPackage(); }
        catch(RuntimeException unavailable) { provider=null; }
        if(provider==null || !PackagedContent.supportsVersion(provider.versionName)) {
            showExplanation("请更新手机的系统WebView组件后再打开。\n\n本应用支持WebView 102及以上，无需另装Chrome。更新组件后，课表可以离线查询。");
            return;
        }
        try { webView=new WebView(this); }
        catch(RuntimeException unavailable) {
            showExplanation("系统WebView暂不可用，请更新手机的系统WebView组件后再打开。");
            return;
        }
        webView.setId(R.id.main_webview);
        webView.setBackgroundColor(Color.rgb(244,244,242));
        WebSettings settings=webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        WebViewAssetLoader loader=new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
        webView.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                return shouldInterceptRequest(view,request.getUrl().toString());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,String url){
                if(!PackagedContent.accepts(url))return rejected(403,"Forbidden");
                WebResourceResponse response=loader.shouldInterceptRequest(Uri.parse(url));
                return response!=null?response:rejected(404,"Not Found");
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                if(request.isForMainFrame() && request.hasGesture() && openUpdatePage(request.getUrl().toString()))return true;
                return !PackagedContent.accepts(request.getUrl().toString());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,String url){
                if(openUpdatePage(url))return true;
                return !PackagedContent.accepts(url);
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){
                if(request.isForMainFrame())runOnUiThread(()->showExplanation("包内页面未能打开，请关闭应用后重试；仍有问题时请重新安装测试包。"));
            }
        });
        timetableController=new TimetableController(this,webView,new TimetableStore(this));
        timetableController.attach();
        root.addView(webView,new FrameLayout.LayoutParams(-1,-1));
        if(state==null || webView.restoreState(state)==null)webView.loadUrl(START_URL);
    }
    private boolean openUpdatePage(String url){
        if(!"https://henu-study.pages.dev/android-update.html?versionCode=3".equals(url))return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url))); }
        catch(ActivityNotFoundException unavailable){Toast.makeText(this,"请用浏览器打开 henu-study.pages.dev 查看新版本。",Toast.LENGTH_LONG).show();}
        return true;
    }
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode==TimetableController.IMPORT_REQUEST&&timetableController!=null)timetableController.importResult(resultCode,data);
    }
    private static WebResourceResponse rejected(int status,String reason){
        return new WebResourceResponse("text/plain","UTF-8",status,reason,Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
    }
    private void showExplanation(String message){
        root.removeAllViews();
        TextView text=new TextView(this);
        text.setId(android.R.id.text1);
        text.setText("等你下课\n\n"+message);
        text.setTextColor(Color.rgb(23,23,23));
        text.setTextSize(20);
        int space=Math.round(24*getResources().getDisplayMetrics().density);
        text.setPadding(space,space,space,space);
        root.addView(text,new FrameLayout.LayoutParams(-1,-1));
    }
    private void applySystemInsets(){
        if(Build.VERSION.SDK_INT>=30){
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view,insets)->{
                Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());
                Insets keyboard=insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(bars.left,bars.top,bars.right,Math.max(bars.bottom,keyboard.bottom));
                return insets;
            });
        }else{
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
            root.setOnApplyWindowInsetsListener((view,insets)->{
                view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
                return insets;
            });
        }
        root.requestApplyInsets();
    }
    @Override public void onBackPressed(){
        if(webView==null){super.onBackPressed();return;}
        if(handlingBack)return;
        handlingBack=true;
        webView.evaluateJavascript("Boolean(window.ClassroomNative && window.ClassroomNative.handleBack())",value->{
            handlingBack=false;
            if(!"true".equals(value))finish();
        });
    }
    @Override protected void onSaveInstanceState(Bundle state){
        if(webView!=null)webView.saveState(state);
        super.onSaveInstanceState(state);
    }
    @Override protected void onPause(){if(webView!=null)webView.onPause();super.onPause();}
    @Override protected void onResume(){super.onResume();if(webView!=null)webView.onResume();}
    @Override protected void onDestroy(){
        if(webView!=null){root.removeView(webView);webView.destroy();webView=null;}
        super.onDestroy();
    }
}
