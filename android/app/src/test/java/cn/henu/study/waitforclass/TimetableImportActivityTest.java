package cn.henu.study.waitforclass;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowLooper;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.ValueCallback;
@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class TimetableImportActivityTest {
    public static class ControlledCleanupActivity extends TimetableImportActivity {
        ValueCallback<String> cleanupCallback;
        @Override protected void evaluateSchoolCleanup(ValueCallback<String> callback){cleanupCallback=callback;}
    }
    private void cleanupDocumentLoaded(WebView web){
        assertEquals("https://xk.henu.edu.cn/__waitforclass_cleanup__",web.getUrl());
        // Robolectric doesn't render WebView: notify the real client after the recorded load.
        web.getWebViewClient().onPageFinished(web,web.getUrl());
    }
    @Test public void cleanupDocumentIsServedLocallyAtSchoolOrigin(){
        ControlledCleanupActivity activity=Robolectric.buildActivity(ControlledCleanupActivity.class).setup().get();
        WebView web=activity.findViewById(R.id.timetable_import_webview);
        android.webkit.WebResourceResponse response=web.getWebViewClient().shouldInterceptRequest(web,"https://xk.henu.edu.cn/__waitforclass_cleanup__");
        assertNotNull("The cleanup document must not be fetched from the school or rejected as an internal data URL",response);
        assertEquals(200,response.getStatusCode());assertEquals("text/html",response.getMimeType());
        assertEquals("https://xk.henu.edu.cn/__waitforclass_cleanup__",web.getUrl());
        assertNull(web.getWebViewClient().shouldInterceptRequest(web,"https://xk.henu.edu.cn/cas/login.action"));
        assertEquals(403,web.getWebViewClient().shouldInterceptRequest(web,"data:text/html;charset=utf-8;base64,").getStatusCode());
    }
    @Test public void schoolBrowserKeepsNetworkSeparateFromPackagedApp(){
        ControlledCleanupActivity activity=Robolectric.buildActivity(ControlledCleanupActivity.class).setup().get();
        ShadowLooper.runUiThreadTasks();
        WebView web=activity.findViewById(R.id.timetable_import_webview);
        assertNotNull(web);
        cleanupDocumentLoaded(web);activity.cleanupCallback.onReceiveValue("true");ShadowLooper.runUiThreadTasks();
        assertEquals("https://xk.henu.edu.cn/cas/login.action",web.getUrl());
        assertTrue(web.getSettings().getJavaScriptEnabled());
        assertFalse(web.getSettings().getAllowFileAccess());
        assertFalse(web.getSettings().getAllowContentAccess());
        assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,web.getSettings().getMixedContentMode());
        assertTrue(web.getWebViewClient().shouldOverrideUrlLoading(web,"https://evil.example/login"));
        assertFalse(web.getWebViewClient().shouldOverrideUrlLoading(web,"https://xk.henu.edu.cn/student/xkjg.wdkb.jsp"));
        assertEquals(403,web.getWebViewClient().shouldInterceptRequest(web,"http://xk.henu.edu.cn/script.js").getStatusCode());
        activity.finish();
    }
    @Test public void failedCleanupIsRetriedBeforeSchoolLoginOnNextImport(){
        ControlledCleanupActivity activity=Robolectric.buildActivity(ControlledCleanupActivity.class).setup().get();
        WebView web=activity.findViewById(R.id.timetable_import_webview);
        cleanupDocumentLoaded(web);assertNotNull(activity.cleanupCallback);
        activity.cleanupCallback.onReceiveValue("false");ShadowLooper.runUiThreadTasks();
        assertEquals(TimetableImportActivity.CLEANUP_URL,web.getUrl());
        assertTrue(activity.getSharedPreferences("henu-import-session",0).getBoolean("cleanup-pending",false));
        activity.finish();activity.cleanupCallback.onReceiveValue("false");ShadowLooper.runUiThreadTasks();
        ControlledCleanupActivity next=Robolectric.buildActivity(ControlledCleanupActivity.class).setup().get();
        WebView nextWeb=next.findViewById(R.id.timetable_import_webview);cleanupDocumentLoaded(nextWeb);next.cleanupCallback.onReceiveValue("true");ShadowLooper.runUiThreadTasks();
        assertEquals(TimetableImportPolicy.LOGIN,nextWeb.getUrl());
        next.finish();next.cleanupCallback.onReceiveValue("true");ShadowLooper.runUiThreadTasks();
        assertFalse(next.getSharedPreferences("henu-import-session",0).getBoolean("cleanup-pending",true));
    }
}
