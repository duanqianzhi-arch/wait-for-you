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
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Button;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;
@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class TimetableImportActivityTest {
    public static class ControlledCleanupActivity extends TimetableImportActivity {
        ValueCallback<String> cleanupCallback;
        @Override protected void evaluateSchoolCleanup(ValueCallback<String> callback){cleanupCallback=callback;}
    }
    public static class ControlledReadActivity extends ControlledCleanupActivity {
        ValueCallback<String> pageCallback;
        JSONObject imported;
        @Override protected void evaluateTimetablePage(ValueCallback<String> callback){pageCallback=callback;}
        @Override protected void onParsed(JSONObject raw){imported=raw;}
    }
    private WebView loggedInHome(ControlledReadActivity activity){
        WebView web=activity.findViewById(R.id.timetable_import_webview);
        cleanupDocumentLoaded(web);activity.cleanupCallback.onReceiveValue("true");ShadowLooper.runUiThreadTasks();
        web.loadUrl("https://xk.henu.edu.cn/frame/homes.action");web.getWebViewClient().onPageStarted(web,web.getUrl(),null);
        web.getWebViewClient().onPageCommitVisible(web,web.getUrl());
        ShadowLooper.idleMainLooper(1,TimeUnit.SECONDS);return web;
    }
    private String emptyCompleteImport()throws Exception{
        return JSONObject.quote("{\"adapterVersion\":\"henu-list-1\",\"semester\":\"2026-2027-1\",\"declaredCourseCount\":0,\"complete\":true,\"rows\":[]}");
    }
    private String displayedStatus(ControlledReadActivity activity){
        android.view.ViewGroup content=activity.findViewById(android.R.id.content);
        LinearLayout root=(LinearLayout)content.getChildAt(0);
        return ((TextView)root.getChildAt(1)).getText().toString();
    }
    private void exhaustRead(ControlledReadActivity activity,String error)throws Exception{
        for(int i=0;i<40;i++){
            activity.pageCallback.onReceiveValue(JSONObject.quote(error));
            ShadowLooper.idleMainLooper(1,TimeUnit.SECONDS);
        }
        ShadowLooper.idleMainLooper(2,TimeUnit.SECONDS);
    }
    @Test public void rejectedPageCountRemainsVisibleAfterPollingDeadline()throws Exception{
        ControlledReadActivity activity=Robolectric.buildActivity(ControlledReadActivity.class).setup().get();
        loggedInHome(activity);
        exhaustRead(activity,"{\"errorCode\":\"incomplete_table\",\"diagnostics\":{\"check\":\"page_count\",\"pageCount\":2,\"declaredCourseCount\":12}}");
        String message=displayedStatus(activity);
        assertTrue("A loaded report rejected for pagination must not be mislabeled as still loading",message.contains("多页")&&message.contains("2"));
        assertTrue("Include the installed app and rendering engine versions for phone diagnosis",message.contains("App ")&&message.contains("WebView "));
        assertNull(activity.imported);
    }
    @Test public void rejectedCourseCountShowsCountsWithoutPrivateText()throws Exception{
        ControlledReadActivity activity=Robolectric.buildActivity(ControlledReadActivity.class).setup().get();loggedInHome(activity);
        exhaustRead(activity,"{\"errorCode\":\"incomplete_table\",\"diagnostics\":{\"check\":\"course_count\",\"declaredCourseCount\":12,\"readCourseCount\":10,\"studentName\":\"PRIVATE_STUDENT\"},\"rows\":[{\"courseText\":\"PRIVATE_COURSE\"}]}");
        String message=displayedStatus(activity);
        assertTrue(message.contains("12")&&message.contains("10")&&message.contains("数量"));
        assertFalse(message.contains("PRIVATE_"));assertNull(activity.imported);
    }
    @Test public void unsupportedSelectionHasDistinctReasonAndUnknownErrorsAreNotEchoed()throws Exception{
        ControlledReadActivity activity=Robolectric.buildActivity(ControlledReadActivity.class).setup().get();loggedInHome(activity);
        exhaustRead(activity,"{\"errorCode\":\"unsupported_selection_status\",\"status\":\"PRIVATE_STATUS\"}");
        assertTrue(displayedStatus(activity).contains("选课状态"));assertFalse(displayedStatus(activity).contains("PRIVATE_"));
        android.view.ViewGroup content=activity.findViewById(android.R.id.content);
        LinearLayout toolbar=(LinearLayout)((LinearLayout)content.getChildAt(0)).getChildAt(0);
        ((Button)toolbar.getChildAt(2)).performClick();ShadowLooper.idleMainLooper(1,TimeUnit.SECONDS);
        exhaustRead(activity,"{\"errorCode\":\"PRIVATE_ERROR\",\"diagnostics\":{\"check\":\"PRIVATE_CHECK\",\"declaredCourseCount\":2510000000}}");
        String message=displayedStatus(activity);
        assertFalse("Retry must not retain the previous student's error",message.contains("选课状态"));
        assertFalse("Untrusted page fields must never be echoed",message.contains("PRIVATE_")||message.contains("2510000000"));assertNull(activity.imported);
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
    @Test public void loggedInHomeUsesSchoolMenuInsteadOfLoadingRestrictedPersonalUrl(){
        ControlledCleanupActivity activity=Robolectric.buildActivity(ControlledCleanupActivity.class).setup().get();
        WebView web=activity.findViewById(R.id.timetable_import_webview);
        cleanupDocumentLoaded(web);activity.cleanupCallback.onReceiveValue("true");ShadowLooper.runUiThreadTasks();
        web.loadUrl("https://xk.henu.edu.cn/frame/homes.action");
        web.getWebViewClient().onPageStarted(web,web.getUrl(),null);
        web.getWebViewClient().onPageFinished(web,web.getUrl());
        assertEquals("School route must remain on the home page with its authenticated frames", "https://xk.henu.edu.cn/frame/homes.action",web.getUrl());
    }
    @Test public void nestedFrameReadRetriesAndReturnsImportWithoutMainPageFinished()throws Exception{
        ControlledReadActivity activity=Robolectric.buildActivity(ControlledReadActivity.class).setup().get();
        WebView web=loggedInHome(activity);
        assertNotNull(activity.pageCallback);
        activity.pageCallback.onReceiveValue(JSONObject.quote("{\"errorCode\":\"not_ready\",\"stage\":\"opening-menu\"}"));
        ShadowLooper.idleMainLooper(1,TimeUnit.SECONDS);
        activity.pageCallback.onReceiveValue(emptyCompleteImport());
        assertNotNull("Loaded nested frames must become an import even without a new top-level finished event",activity.imported);
        assertTrue(activity.imported.getBoolean("complete"));assertEquals(0,activity.imported.getJSONArray("rows").length());
        assertEquals("https://xk.henu.edu.cn/frame/homes.action",web.getUrl());
    }
    @Test public void navigationAwayDiscardsPendingHomeImport()throws Exception{
        ControlledReadActivity activity=Robolectric.buildActivity(ControlledReadActivity.class).setup().get();
        WebView web=loggedInHome(activity);ValueCallback<String> previous=activity.pageCallback;
        web.loadUrl(TimetableImportPolicy.LOGIN);web.getWebViewClient().onPageStarted(web,web.getUrl(),null);
        previous.onReceiveValue(emptyCompleteImport());assertNull(activity.imported);
    }
    @Test public void lateScriptAfterTimeoutCannotSaveTimetable()throws Exception{
        ControlledReadActivity activity=Robolectric.buildActivity(ControlledReadActivity.class).setup().get();
        loggedInHome(activity);ValueCallback<String> late=activity.pageCallback;
        ShadowLooper.idleMainLooper(11,TimeUnit.SECONDS);
        late.onReceiveValue(emptyCompleteImport());assertNull(activity.imported);
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
