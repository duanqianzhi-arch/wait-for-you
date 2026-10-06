package cn.henu.study.waitforclass;
import static org.junit.Assert.*;
import org.junit.Test;
public class PackagedContentTest {
    @Test public void onlyBundledHttpsOriginCanBeLoaded(){
        assertTrue(PackagedContent.accepts("https://appassets.androidplatform.net/assets/www/index.html#home"));
        assertTrue(PackagedContent.accepts("https://appassets.androidplatform.net/assets/www/assets/ink-dog-time.png?v=14"));
        for(String url:new String[]{"http://appassets.androidplatform.net/assets/www/index.html","file:///sdcard/example.html","https://example.com/assets/www/index.html","https://appassets.androidplatform.net/assets/private.txt","https://appassets.androidplatform.net/assets/www/../private.txt","https://appassets.androidplatform.net/assets/www/%2e%2e/private.txt","https://user@appassets.androidplatform.net/assets/www/index.html","javascript:alert(1)","broken",null})assertFalse(url,PackagedContent.accepts(url));
    }
    @Test public void unsupportedOrMissingWebViewHasClearCompatibilityBoundary(){
        assertTrue(PackagedContent.supportsVersion("102.0.5005.1"));
        assertTrue(PackagedContent.supportsVersion("130.0.0.0"));
        assertFalse(PackagedContent.supportsVersion("101.0.0.0"));
        assertFalse(PackagedContent.supportsVersion(null));
        assertFalse(PackagedContent.supportsVersion("invalid"));
    }
}
