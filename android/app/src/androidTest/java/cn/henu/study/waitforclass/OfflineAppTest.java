package cn.henu.study.waitforclass;

import static org.junit.Assert.*;
import android.app.Activity;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Tests actual packaged WebView and persistent data, with device networking disabled. */
@RunWith(AndroidJUnit4.class)
public class OfflineAppTest {
    private String js(ActivityScenario<MainActivity> scenario, String expression) throws Exception {
        CountDownLatch ready = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        scenario.onActivity(activity -> ((WebView) activity.findViewById(R.id.main_webview))
            .evaluateJavascript(expression, value -> { result.set(value); ready.countDown(); }));
        assertTrue("WebView evaluation timed out", ready.await(10, TimeUnit.SECONDS));
        return result.get();
    }
    private void waitFor(ActivityScenario<MainActivity> scenario, String expression) throws Exception {
        long end=System.currentTimeMillis()+20000;
        while(System.currentTimeMillis()<end){
            if("true".equals(js(scenario,expression)))return;
            Thread.sleep(100);
        }
        fail("Packaged page did not become ready: "+expression);
    }
    @Test public void firstLaunchUsesOnlyBundledResources() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            waitFor(scenario,"!!document.querySelector('[data-page=home]')");
            assertEquals("true",js(scenario,"document.body.innerText.includes('哪段时间？')"));
            waitFor(scenario,"document.fonts.check('16px StudyNoteHand')");
            waitFor(scenario,"Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)");
            js(scenario,"location.hash='settings'");
            waitFor(scenario,"!!document.querySelector('[data-page=settings]')");
            assertEquals("true",js(scenario,"document.body.innerText.includes('安卓版本 1.1.2')&&!document.body.innerText.includes('离线课表')&&document.body.innerText.includes('检查更新')"));
            assertEquals("true",js(scenario,"!document.querySelector('[data-action=install]')"));
            assertEquals("true",js(scenario,"!navigator.serviceWorker.controller"));
        }
    }
    @Test public void queryAndFavoritesSurviveRelaunch() throws Exception {
        String favorite;
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            waitFor(scenario,"!!window.CLASSROOM_DATA&&!!document.querySelector('[data-page=home]')");
            js(scenario,"document.querySelector('[data-action=campus]').click();Array.from(document.querySelectorAll('[data-campus]')).find(el=>el.dataset.campus==='金明校区').click()");
            js(scenario,"document.querySelector('[data-action=date]').click();document.querySelector('#dialog-study-date').value='2026-10-05';document.querySelector('[data-action=confirm-date]').click()");
            js(scenario,"document.querySelector('[data-field=start]').value='14:05';document.querySelector('[data-field=start]').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-field=end]').value='16:40';document.querySelector('[data-field=end]').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#time-form').requestSubmit()");
            waitFor(scenario,"!!document.querySelector('[data-page=preferences]')");
            waitFor(scenario,"!document.querySelector('.tear-overlay')&&!!document.querySelector('.wizard-next:not(:disabled)')");
            js(scenario,"const choice=document.querySelector('[name=mode][value=balanced]');choice.checked=true;choice.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#preference-form').requestSubmit()");
            waitFor(scenario,"!!document.querySelector('[data-page=results]')");
            assertEquals("true",js(scenario,"document.body.innerText.includes('57')"));
            assertEquals("true",js(scenario,"!document.body.innerText.includes('曾宪梓')"));
            favorite=js(scenario,"document.querySelector('[data-favorite]').dataset.favorite");
            js(scenario,"const favoriteButton=document.querySelector('[data-favorite]');if(favoriteButton.getAttribute('aria-pressed')!=='true')favoriteButton.click()");
            assertEquals("true",js(scenario,"document.querySelector('[data-favorite]').getAttribute('aria-pressed')==='true'"));
        }
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            waitFor(scenario,"!!document.querySelector('[data-page=home]')");
            js(scenario,"location.hash='settings'");
            waitFor(scenario,"!!document.querySelector('[data-page=settings]')");
            assertEquals("true",js(scenario,"Array.from(document.querySelectorAll('[data-favorite]')).some(el=>el.dataset.favorite==="+favorite+")"));
        }
    }
    @Test public void nativeBackClosesModalThenReturnsToPreviousStep() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            waitFor(scenario,"!!document.querySelector('[data-page=home]')");
            js(scenario,"document.querySelector('[data-action=campus]').click()");
            assertEquals("true",js(scenario,"document.querySelector('#info-dialog').open"));
            scenario.onActivity(MainActivity::onBackPressed);
            waitFor(scenario,"!document.querySelector('#info-dialog').open");
            js(scenario,"location.hash='preferences'");
            waitFor(scenario,"!!document.querySelector('[data-page=preferences]')");
            scenario.onActivity(MainActivity::onBackPressed);
            waitFor(scenario,"!!document.querySelector('[data-page=home]')");
        }
    }
}
