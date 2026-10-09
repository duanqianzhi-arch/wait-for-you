package cn.henu.study.waitforclass;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import android.app.Activity;
import android.webkit.WebView;
import org.json.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class TimetableControllerTest {
    @Test public void widgetRequestsAndRefreshStayInsideTrustedPrivateFlow()throws Exception {
        Activity activity=Robolectric.buildActivity(Activity.class).setup().get();WebView web=new WebView(activity);web.loadUrl(MainActivity.START_URL);
        TimetableStore store=new TimetableStore(activity);store.clear();store.save(TimetableStoreTest.sample());TimetableController controller=new TimetableController(activity,web,store);
        String request="{\"id\":\"widget-1\",\"action\":\"widget\",\"payload\":{\"kind\":\"today\"}}",origin="https://appassets.androidplatform.net";
        android.appwidget.AppWidgetManager manager=android.appwidget.AppWidgetManager.getInstance(activity);org.robolectric.Shadows.shadowOf(manager).setRequestPinAppWidgetSupported(true);
        assertFalse(controller.handle(request,"https://xk.henu.edu.cn",true).getBoolean("ok"));assertFalse(controller.handle(request,origin,false).getBoolean("ok"));
        assertTrue(controller.handle(request,origin,true).getJSONObject("payload").getBoolean("requested"));
        assertFalse(controller.handle(request.replace("today","other"),origin,true).getBoolean("ok"));
        org.robolectric.shadows.ShadowAppWidgetManager shadow=org.robolectric.Shadows.shadowOf(manager);int id=shadow.createWidget(TodayWidgetProvider.class,R.layout.widget_today);
        java.io.File path=new java.io.File(activity.getFilesDir(),"personal-timetable-v1.json");TimetableStore broken=new TimetableStore(path,(out,bytes)->{throw new java.io.IOException("disk failure");});
        TimetableController failed=new TimetableController(activity,web,broken);JSONObject unsaved=TimetableStoreTest.sample();unsaved.getJSONArray("courses").getJSONObject(0).put("name","Never saved");
        assertFalse(failed.handle(new JSONObject().put("id","s").put("action","save").put("payload",unsaved).toString(),origin,true).getBoolean("ok"));assertEquals("Example",store.load().getJSONArray("courses").getJSONObject(0).getString("name"));
        assertTrue(controller.handle("{\"id\":\"c\",\"action\":\"clear\"}",origin,true).getBoolean("ok"));
        assertTrue(((android.widget.TextView)shadow.getViewFor(id).findViewById(R.id.widget_message)).getText().toString().contains("先在 App 导入"));web.destroy();
    }
    @Test public void onlyPackagedMainFrameCanUseTimetableStorage()throws Exception {
        Activity activity=Robolectric.buildActivity(Activity.class).setup().get();
        WebView web=new WebView(activity);web.loadUrl(MainActivity.START_URL);
        TimetableStore store=new TimetableStore(activity);store.clear();
        TimetableController controller=new TimetableController(activity,web,store);
        String origin="https://appassets.androidplatform.net";
        JSONObject request=new JSONObject().put("id","save-1").put("action","save").put("payload",TimetableStoreTest.sample());
        assertFalse(controller.handle(request.toString(),"https://xk.henu.edu.cn",true).getBoolean("ok"));assertNull(store.load());
        assertFalse(controller.handle(request.toString(),origin,false).getBoolean("ok"));assertNull(store.load());
        assertTrue(controller.handle(request.toString(),origin,true).getBoolean("ok"));
        JSONObject loaded=controller.handle("{\"id\":\"read-1\",\"action\":\"load\"}",origin,true);assertEquals(1,loaded.getJSONObject("payload").getInt("revision"));
        assertFalse(controller.handle("{\"id\":\"x\",\"action\":\"execute\"}",origin,true).getBoolean("ok"));
        web.loadUrl("https://appassets.androidplatform.net/assets/www/other.html");
        assertFalse(controller.handle(request.toString(),origin,true).getBoolean("ok"));
        store.clear();web.destroy();
    }
}
