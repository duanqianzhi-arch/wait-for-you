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
@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class TimetableImportActivityTest {
    @Test public void schoolBrowserKeepsNetworkSeparateFromPackagedApp(){
        TimetableImportActivity activity=Robolectric.buildActivity(TimetableImportActivity.class).setup().get();
        ShadowLooper.runUiThreadTasks();
        WebView web=activity.findViewById(R.id.timetable_import_webview);
        assertNotNull(web);
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
}
