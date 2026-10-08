package cn.henu.study.waitforclass;

import static org.junit.Assert.*;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real WebView regression for the internal cleanup document. No account or credentials. */
@RunWith(AndroidJUnit4.class)
public class TimetableImportWebViewTest {
    private String js(ActivityScenario<TimetableImportActivity> scenario,String script)throws Exception{
        CountDownLatch ready=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
        scenario.onActivity(activity->((WebView)activity.findViewById(R.id.timetable_import_webview))
            .evaluateJavascript(script,value->{result.set(value);ready.countDown();}));
        assertTrue("WebView evaluation timed out",ready.await(10,TimeUnit.SECONDS));return result.get();
    }
    private void waitForLogin(ActivityScenario<TimetableImportActivity> scenario)throws Exception{
        long end=System.currentTimeMillis()+45000;
        while(System.currentTimeMillis()<end){
            if("true".equals(js(scenario,"location.origin==='https://xk.henu.edu.cn'&&!!document.querySelector('input[type=password]')")))return;
            Thread.sleep(200);
        }
        fail("School login was blocked before any account could be entered");
    }
    @Test public void cleanupAllowsFirstLoginAndRemovesPreviousLocalStorage()throws Exception{
        try(ActivityScenario<TimetableImportActivity> first=ActivityScenario.launch(TimetableImportActivity.class)){
            waitForLogin(first);
            assertEquals("true",js(first,"localStorage.setItem('waitforclass-cleanup-regression','anonymous');localStorage.getItem('waitforclass-cleanup-regression')==='anonymous'"));
            // ActivityScenario closes without finish(): models interrupted login and a pending cleanup.
        }
        try(ActivityScenario<TimetableImportActivity> next=ActivityScenario.launch(TimetableImportActivity.class)){
            waitForLogin(next);
            assertEquals("true",js(next,"localStorage.getItem('waitforclass-cleanup-regression')===null"));
        }
    }
}
