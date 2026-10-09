package cn.henu.study.waitforclass;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.json.*;
import java.lang.reflect.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class AppUpdateControllerTest {
    private JSONObject release()throws Exception {return new JSONObject().put("applicationId","cn.henu.study.waitforclass").put("version","1.2.5").put("versionCode",11).put("file","dengni-xiake-v1.2.5.apk").put("size",7300000).put("sha256","a".repeat(64)).put("notes","Update notes");}
    private JSONObject parse(JSONObject value,int installed)throws Exception {return (JSONObject)Class.forName("cn.henu.study.waitforclass.AppUpdateController").getDeclaredMethod("parseRelease",JSONObject.class,int.class).invoke(null,value,installed);}
    @Test public void newReleaseIsComparedByCodeAndUsesFixedOfficialPage()throws Exception {
        JSONObject result=parse(release(),10);assertTrue(result.getBoolean("available"));assertEquals("1.2.5",result.getString("version"));assertEquals("https://henu-study.pages.dev/android-update.html?versionCode=10",result.getString("pageUrl"));
        assertFalse(parse(release(),11).getBoolean("available"));assertFalse(parse(release(),12).getBoolean("available"));
    }
    @Test public void untrustedOrMalformedReleaseCannotBecomeDownload()throws Exception {
        for(JSONObject bad:new JSONObject[]{release().put("applicationId","other.app"),release().put("file","https://evil.example/a.apk"),release().put("file","../a.apk"),release().put("versionCode","11"),release().put("size",30000000),release().put("sha256","bad")})assertThrows(InvocationTargetException.class,()->parse(bad,10));
    }
    @Test public void untrustedPagesCannotUseTheNativeUpdateBridge()throws Exception {
        Method method=Class.forName("cn.henu.study.waitforclass.AppUpdateController").getDeclaredMethod("acceptsPage",String.class,String.class,boolean.class);
        assertEquals(true,method.invoke(null,MainActivity.START_URL,"https://appassets.androidplatform.net",true));
        assertEquals(false,method.invoke(null,MainActivity.START_URL,"https://evil.example",true));assertEquals(false,method.invoke(null,MainActivity.START_URL,"https://appassets.androidplatform.net",false));assertEquals(false,method.invoke(null,"https://appassets.androidplatform.net/assets/www/other.html","https://appassets.androidplatform.net",true));
    }
}
