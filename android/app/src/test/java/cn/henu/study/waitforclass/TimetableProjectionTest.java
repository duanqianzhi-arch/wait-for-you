package cn.henu.study.waitforclass;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.json.*;
import java.nio.file.*;
import java.time.LocalDate;
@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class TimetableProjectionTest {
    @Test public void sharedEffectiveTimetableVectorsMatchJavaScript()throws Exception {
        JSONArray vectors=new JSONArray(new String(Files.readAllBytes(Paths.get(System.getProperty("studyProjectionFixtures"))),java.nio.charset.StandardCharsets.UTF_8));
        for(int i=0;i<vectors.length();i++){
            JSONObject vector=vectors.getJSONObject(i),expected=vector.getJSONObject("expected");
            TimetableProjection.Day result=TimetableProjection.forDate(vector.getJSONObject("table"),LocalDate.parse(vector.getString("date")));
            assertEquals(vector.getString("name"),expected.getInt("week"),result.week);
            assertEquals(expected.getBoolean("pending"),result.pending);
            JSONArray entries=expected.getJSONArray("entries");assertEquals(entries.length(),result.entries.size());
            for(int n=0;n<entries.length();n++){
                JSONObject want=entries.getJSONObject(n);TimetableProjection.Entry actual=result.entries.get(n);
                assertEquals(want.getString("courseKey"),actual.courseKey);assertEquals(want.getString("name"),actual.name);
                assertEquals(want.getString("location"),actual.location);assertEquals(want.getInt("day"),actual.day);
                assertEquals(want.getInt("startPeriod"),actual.startPeriod);assertEquals(want.getInt("endPeriod"),actual.endPeriod);
            }
        }
        assertEquals("08:00",TimetableProjection.clock(1,false));assertEquals("09:40",TimetableProjection.clock(2,true));assertEquals("21:40",TimetableProjection.clock(13,true));
    }
}
