package cn.henu.study.waitforclass;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.json.*;
import java.io.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class TimetableStoreTest {
    static JSONObject sample()throws Exception {
        return new JSONObject("{\"schemaVersion\":1,\"school\":\"henu\",\"semester\":\"2026-2027-1\",\"firstMonday\":\"2026-08-31\",\"maxWeek\":18,\"timezone\":\"Asia/Shanghai\",\"importedAt\":\"2026-10-08T08:00:00.000Z\",\"adapterVersion\":\"henu-list-1\",\"revision\":1,\"courses\":[{\"key\":\"course-1\",\"code\":\"12345678\",\"teachingGroupCode\":\"G-001\",\"name\":\"Example\",\"meetings\":[{\"key\":\"meeting-1\",\"day\":3,\"weeks\":[1,3,5],\"startPeriod\":3,\"endPeriod\":5,\"location\":\"\"}],\"pendingSchedules\":[],\"unscheduled\":false}],\"overrides\":[]}");
    }
    @Test public void savedTimetableSurvivesNewStoreAndInvalidWrite()throws Exception {
        TimetableStore store=new TimetableStore(RuntimeEnvironment.getApplication());store.clear();assertNull(store.load());
        store.save(sample());
        JSONObject loaded=new TimetableStore(RuntimeEnvironment.getApplication()).load();assertEquals("Example",loaded.getJSONArray("courses").getJSONObject(0).getString("name"));
        JSONObject invalid=sample();invalid.getJSONArray("courses").getJSONObject(0).getJSONArray("meetings").getJSONObject(0).put("day","3");
        assertThrows(Exception.class,()->store.save(invalid));assertEquals(1,store.load().getInt("revision"));
        JSONObject extra=sample().put("password","forbidden");assertThrows(Exception.class,()->store.save(extra));
        store.clear();assertNull(store.load());
    }
    @Test public void partialDiskWriteRollsBackToPreviousTimetable()throws Exception {
        File file=new File(RuntimeEnvironment.getApplication().getFilesDir(),"rollback-table.json");
        TimetableStore normal=new TimetableStore(file,(out,data)->out.write(data));normal.save(sample());
        TimetableStore broken=new TimetableStore(file,(out,data)->{out.write(data,0,7);throw new IOException("disk failure");});
        JSONObject next=sample().put("revision",2);assertThrows(IOException.class,()->broken.save(next));
        assertEquals(1,normal.load().getInt("revision"));normal.clear();
    }
    @Test public void stagedImportIsConsumedOnceAndCannotEscapeCache()throws Exception {
        TimetableStore store=new TimetableStore(RuntimeEnvironment.getApplication());
        JSONObject raw=new JSONObject("{\"adapterVersion\":\"henu-list-1\",\"semester\":\"2026-2027-1\",\"declaredCourseCount\":1,\"complete\":true,\"rows\":[{\"courseText\":\"[12345678]Example\",\"teachingGroupCode\":\"G-001\",\"selectionStatus\":\"选中\",\"scheduleText\":\"1-18周 三[3-5]\"}]}");
        String token=store.stageImport(raw);assertEquals(1,store.consumeStagedImport(token).getInt("declaredCourseCount"));
        assertThrows(Exception.class,()->store.consumeStagedImport(token));
        assertThrows(Exception.class,()->store.consumeStagedImport("../../private"));
        assertThrows(Exception.class,()->store.stageImport(raw.put("cookie","forbidden")));
    }
    @Test public void retainedLocalCoursePersistsLatestSchoolBaseline()throws Exception {
        TimetableStore store=new TimetableStore(RuntimeEnvironment.getApplication());JSONObject value=sample();
        JSONObject course=value.getJSONArray("courses").getJSONObject(0),school=new JSONObject(course.toString());
        school.getJSONArray("meetings").getJSONObject(0).put("day",6).put("location","School updated room");
        course.put("localOnly",true).put("schoolRecord",school);store.save(value);
        assertEquals(6,store.load().getJSONArray("courses").getJSONObject(0).getJSONObject("schoolRecord").getJSONArray("meetings").getJSONObject(0).getInt("day"));
        school.put("password","forbidden");assertThrows(Exception.class,()->store.save(value));
        school.remove("password");school.put("key","another-course");assertThrows(Exception.class,()->store.save(value));store.clear();
    }
}
