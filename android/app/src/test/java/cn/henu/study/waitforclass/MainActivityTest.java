package cn.henu.study.waitforclass;
import static org.junit.Assert.*;
import android.content.pm.PackageInfo;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import java.nio.charset.StandardCharsets;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowWebView;

/** Checks our native request boundary and actual bundled asset I/O, not a real phone renderer. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public class MainActivityTest {
    @Before public void compatibleSystemComponent(){
        PackageInfo provider=new PackageInfo();provider.versionName="130.0.0.0";
        ShadowWebView.setCurrentWebViewPackage(provider);
    }
    @Test public void startupLoadsBundledHttpsPageAndDataWithoutNetwork() throws Exception {
        MainActivity activity=Robolectric.buildActivity(MainActivity.class).setup().get();
        WebView web=activity.findViewById(R.id.main_webview);
        assertNotNull(web);
        assertEquals("https://appassets.androidplatform.net/assets/www/index.html#home",web.getUrl());
        assertTrue(web.getSettings().getJavaScriptEnabled());
        assertTrue(web.getSettings().getDomStorageEnabled());
        assertFalse(web.getSettings().getAllowFileAccess());
        assertFalse(web.getSettings().getAllowContentAccess());
        assertEquals(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW,web.getSettings().getMixedContentMode());
        WebResourceResponse html=web.getWebViewClient().shouldInterceptRequest(web, "https://appassets.androidplatform.net/assets/www/index.html");
        assertNotNull(html);
        String content=new String(html.getData().readAllBytes(),StandardCharsets.UTF_8);
        assertTrue(content.contains("data-native-app=\"1.2.1\""));
        assertTrue(content.contains("等你下课"));
        WebResourceResponse data=web.getWebViewClient().shouldInterceptRequest(web,"https://appassets.androidplatform.net/assets/www/data.js");
        assertTrue(data.getData().readAllBytes().length>1000);
        assertEquals(403,web.getWebViewClient().shouldInterceptRequest(web,"https://example.com/private").getStatusCode());
        assertTrue(web.getWebViewClient().shouldOverrideUrlLoading(web,"https://example.com/private"));
        assertFalse(web.getWebViewClient().shouldOverrideUrlLoading(web,"https://appassets.androidplatform.net/assets/www/index.html#preferences"));
    }
    @Test public void updateLinkOpensOnlyOurTrustedBrowserPage(){
        MainActivity activity=Robolectric.buildActivity(MainActivity.class).setup().get();
        WebView web=activity.findViewById(R.id.main_webview);
        String url="https://henu-study.pages.dev/android-update.html?versionCode=7";
        assertTrue(web.getWebViewClient().shouldOverrideUrlLoading(web,url));
        android.content.Intent intent=org.robolectric.Shadows.shadowOf(activity).getNextStartedActivity();
        assertNotNull(intent);
        assertEquals(android.content.Intent.ACTION_VIEW,intent.getAction());
        assertEquals(url,intent.getDataString());
        web.getWebViewClient().shouldOverrideUrlLoading(web,"https://evil.example/android-update.html?versionCode=7");
        web.getWebViewClient().shouldOverrideUrlLoading(web,"https://henu-study.pages.dev/other");
        assertNull(org.robolectric.Shadows.shadowOf(activity).getNextStartedActivity());
        web.getWebViewClient().shouldOverrideUrlLoading(web,updateRequest(url,false));
        assertNull(org.robolectric.Shadows.shadowOf(activity).getNextStartedActivity());
        web.getWebViewClient().shouldOverrideUrlLoading(web,updateRequest(url,true));
        assertEquals(url,org.robolectric.Shadows.shadowOf(activity).getNextStartedActivity().getDataString());
    }
    private static android.webkit.WebResourceRequest updateRequest(String url,boolean gesture){
        return new android.webkit.WebResourceRequest(){
            public android.net.Uri getUrl(){return android.net.Uri.parse(url);}
            public boolean isForMainFrame(){return true;}
            public boolean isRedirect(){return false;}
            public boolean hasGesture(){return gesture;}
            public String getMethod(){return "GET";}
            public java.util.Map<String,String> getRequestHeaders(){return java.util.Collections.emptyMap();}
        };
    }
    @Test public void oldWebViewShowsAnExplanationInsteadOfBlankScreen(){
        PackageInfo old=new PackageInfo();old.versionName="101.1.0.0";
        ShadowWebView.setCurrentWebViewPackage(old);
        MainActivity activity=Robolectric.buildActivity(MainActivity.class).setup().get();
        assertNull(activity.findViewById(R.id.main_webview));
        android.widget.TextView explanation=activity.findViewById(android.R.id.text1);
        assertNotNull(explanation);
        assertTrue(explanation.getText().toString().contains("系统WebView"));
    }
    @Test public void missingWebViewShowsAnExplanation(){
        ShadowWebView.setCurrentWebViewPackage(null);
        MainActivity activity=Robolectric.buildActivity(MainActivity.class).setup().get();
        assertNull(activity.findViewById(R.id.main_webview));
        android.widget.TextView explanation=activity.findViewById(android.R.id.text1);
        assertNotNull(explanation);
        assertTrue(explanation.getText().toString().contains("系统WebView"));
    }
}
