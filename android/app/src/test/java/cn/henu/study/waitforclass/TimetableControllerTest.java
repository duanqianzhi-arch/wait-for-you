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
