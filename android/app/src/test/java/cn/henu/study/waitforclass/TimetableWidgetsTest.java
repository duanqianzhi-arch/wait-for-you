package cn.henu.study.waitforclass;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import android.app.Activity;
import android.appwidget.*;
import android.content.*;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.time.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class TimetableWidgetsTest {
    private Context context(){return RuntimeEnvironment.getApplication();}
    private JSONObject table()throws Exception {
        JSONObject t=TimetableStoreTest.sample(),m=t.getJSONArray("courses").getJSONObject(0).getJSONArray("meetings").getJSONObject(0);
        m.put("day",4).put("weeks",new JSONArray("[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]")).put("startPeriod",1).put("endPeriod",2).put("location","Room101");return t;
    }
    private View view(JSONObject t,LocalTime time,int height,boolean weekly)throws Exception {
        View v=TimetableWidgets.build(context(),t,LocalDate.of(2026,10,8),time,340,height,weekly).apply(context(),new FrameLayout(context()));
        v.measure(View.MeasureSpec.makeMeasureSpec(340,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.EXACTLY));v.layout(0,0,340,height);return v;
    }
    private String text(View v){StringBuilder out=new StringBuilder();if(v instanceof TextView)out.append(((TextView)v).getText()).append('\n');if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++)out.append(text(((ViewGroup)v).getChildAt(i)));return out.toString();}
    @Test public void dailyHostReapplyReplacesCardsInsteadOfAppending()throws Exception {
        JSONObject t=table();JSONObject first=t.getJSONArray("courses").getJSONObject(0);
        first.getJSONArray("meetings").getJSONObject(0).put("day",5).put("startPeriod",6).put("endPeriod",8);
        JSONObject second=new JSONObject(first.toString()).put("key","course-2").put("name","Evening example");
        second.getJSONArray("meetings").getJSONObject(0).put("startPeriod",11).put("endPeriod",13);t.getJSONArray("courses").put(second);
        LocalDate friday=LocalDate.of(2026,10,9);
        View host=TimetableWidgets.build(context(),t,friday,LocalTime.of(7,0),340,380,false).apply(context(),new FrameLayout(context()));
        for(int n=0;n<3;n++)TimetableWidgets.build(context(),t,friday,LocalTime.of(7,n+1),340,380,false).reapply(context(),host);
        ViewGroup cards=host.findViewById(R.id.widget_courses);
        assertEquals("Launcher reuse must leave exactly the two current cards after each refresh",2,cards.getChildCount());
        assertTrue(text(cards.getChildAt(0)).contains("Example"));assertTrue(text(cards.getChildAt(1)).contains("Evening example"));
        TimetableWidgets.build(context(),null,friday,LocalTime.NOON,340,380,false).reapply(context(),host);
        assertEquals("Deleting the timetable must also remove previously rendered private course cards",0,cards.getChildCount());
        TimetableWidgets.build(context(),t,friday,LocalTime.of(7,0),340,380,false).reapply(context(),host);
        assertEquals(View.VISIBLE,cards.getVisibility());assertEquals(2,cards.getChildCount());
    }
    @Test public void weekHostReapplyResetsRowsHighlightAndOldConflict()throws Exception {
        JSONObject t=table();JSONObject overlap=new JSONObject(t.getJSONArray("courses").getJSONObject(0).toString()).put("key","course-2").put("name","Other example");t.getJSONArray("courses").put(overlap);
        View host=TimetableWidgets.build(context(),t,LocalDate.of(2026,10,8),LocalTime.of(7,0),340,400,true).apply(context(),new FrameLayout(context()));
        assertTrue(text(host).contains("2门"));
        t.getJSONArray("courses").remove(1);
        for(int n=0;n<3;n++)TimetableWidgets.build(context(),t,LocalDate.of(2026,10,9),LocalTime.of(7,n+1),340,400,true).reapply(context(),host);
        assertEquals("The period axis must remain 13 rows on refresh",13,((ViewGroup)host.findViewById(R.id.widget_periods)).getChildCount());
        assertEquals(13,((ViewGroup)host.findViewById(R.id.widget_day1)).getChildCount());
        assertEquals(12,((ViewGroup)host.findViewById(R.id.widget_day4)).getChildCount());
        assertFalse("A resolved conflict must not remain in an older appended grid",text(host).contains("2门"));
        TextView thursday=host.findViewById(R.id.widget_head4),friday=host.findViewById(R.id.widget_head5);
        assertEquals("Yesterday's highlighted header must reset",0,((android.graphics.drawable.ColorDrawable)thursday.getBackground()).getColor());
        assertEquals(0xff171717,thursday.getCurrentTextColor());assertEquals(0xff171717,((android.graphics.drawable.ColorDrawable)friday.getBackground()).getColor());
        assertEquals(0xffffffff,friday.getCurrentTextColor());
        TimetableWidgets.build(context(),null,LocalDate.of(2026,10,9),LocalTime.NOON,340,400,true).reapply(context(),host);
        assertEquals(0,((ViewGroup)host.findViewById(R.id.widget_day4)).getChildCount());
        TimetableWidgets.build(context(),t,LocalDate.of(2026,10,9),LocalTime.NOON,340,400,true).reapply(context(),host);
        assertEquals(View.VISIBLE,host.findViewById(R.id.widget_courses).getVisibility());
    }
    @Test public void dailyNextClassEndedAndEmptyStatesAreTruthful()throws Exception {
        assertTrue(text(view(table(),LocalTime.of(7,30),160,false)).contains("下一节"));
        assertTrue(text(view(table(),LocalTime.of(8,30),160,false)).contains("正在上课"));
        String ended=text(view(table(),LocalTime.of(10,0),160,false));assertTrue(ended.contains("已结束"));
        assertTrue(text(view(null,LocalTime.NOON,160,false)).contains("先在 App 导入"));
        JSONObject none=table();none.put("courses",new JSONArray());assertTrue(text(view(none,LocalTime.NOON,160,false)).contains("没有已排课程"));
        View outside=TimetableWidgets.build(context(),table(),LocalDate.of(2027,1,4),LocalTime.NOON,340,160,false).apply(context(),new FrameLayout(context()));assertTrue(text(outside).contains("学期外"));
        JSONObject pending=table();pending.getJSONArray("courses").getJSONObject(0).getJSONArray("pendingSchedules").put("未识别安排");assertTrue(text(view(pending,LocalTime.NOON,160,false)).contains("核对"));
    }
    @Test public void resizedWidgetsSpanPeriodsAndKeepConflictsVisible()throws Exception {
        JSONObject t=table();JSONArray meetings=t.getJSONArray("courses").getJSONObject(0).getJSONArray("meetings");
        for(int n=0;n<4;n++){JSONObject m=new JSONObject(meetings.getJSONObject(0).toString());m.put("key","extra"+n).put("startPeriod",new int[]{3,6,9,11}[n]).put("endPeriod",new int[]{4,7,10,13}[n]);meetings.put(m);}
        View small=view(t,LocalTime.of(7,0),160,false),big=view(t,LocalTime.of(7,0),380,false);
        assertTrue(((ViewGroup)big.findViewById(R.id.widget_courses)).getChildCount()>((ViewGroup)small.findViewById(R.id.widget_courses)).getChildCount());
        assertTrue(text(small).contains("还有"));
        View week=view(t,LocalTime.of(7,0),400,true);LinearLayout thu=week.findViewById(R.id.widget_day4);TextView first=(TextView)thu.getChildAt(0);
        assertTrue(first.getText().toString().contains("Example"));assertEquals(Math.max(8,(400-100)/13)*2,first.getMinHeight());
        JSONObject conflict=new JSONObject(t.getJSONArray("courses").getJSONObject(0).toString());conflict.put("key","another").put("name","Overlap");conflict.put("meetings",new JSONArray().put(new JSONObject(meetings.getJSONObject(0).toString()).put("key","other")));t.getJSONArray("courses").put(conflict);
        assertTrue(text(view(t,LocalTime.NOON,400,true)).contains("2门"));
    }
    @Test public void pinSupportAndPrivateStorageRefresh()throws Exception {
        Activity activity=Robolectric.buildActivity(Activity.class).setup().get();TimetableStore store=new TimetableStore(context());store.clear();store.save(table());
        AppWidgetManager manager=AppWidgetManager.getInstance(context());org.robolectric.shadows.ShadowAppWidgetManager shadow=Shadows.shadowOf(manager);
        shadow.setRequestPinAppWidgetSupported(false);assertFalse(TimetableWidgets.requestPin(activity,"today"));
        shadow.setRequestPinAppWidgetSupported(true);assertTrue(TimetableWidgets.requestPin(activity,"today"));assertTrue(TimetableWidgets.requestPin(activity,"week"));
        assertThrows(IllegalArgumentException.class,()->TimetableWidgets.requestPin(activity,"external"));
        int id=shadow.createWidget(TodayWidgetProvider.class,R.layout.widget_today);assertNotNull(shadow.getViewFor(id));
        store.clear();TimetableWidgets.refreshAll(context());assertTrue(text(shadow.getViewFor(id)).contains("先在 App 导入"));
        java.io.File f=new java.io.File(context().getFilesDir(),"personal-timetable-v1.json");try(java.io.FileOutputStream out=new java.io.FileOutputStream(f)){out.write("broken".getBytes());}
        TimetableWidgets.refreshAll(context());assertTrue(text(shadow.getViewFor(id)).contains("检查课表"));assertTrue(f.exists());store.clear();
    }
    @Test public void pendingWarningsPreserveHiddenCount()throws Exception {
        JSONObject t=table(),course=t.getJSONArray("courses").getJSONObject(0);JSONArray meetings=course.getJSONArray("meetings");
        course.getJSONArray("pendingSchedules").put("未识别安排");
        for(int i=0;i<4;i++)meetings.put(new JSONObject(meetings.getJSONObject(0).toString()).put("key","extra"+i).put("startPeriod",3+i*2).put("endPeriod",4+i*2));
        String small=text(view(t,LocalTime.of(7,0),160,false));assertTrue(small.contains("核对"));assertTrue("pending warning must not erase hidden-course count",small.contains("还有 4"));
    }
    @Test public void denseConflictsStayBounded()throws Exception {
        JSONObject t=table(),course=t.getJSONArray("courses").getJSONObject(0);JSONArray meetings=course.getJSONArray("meetings");
        for(int i=0;i<500;i++)meetings.put(new JSONObject(meetings.getJSONObject(0).toString()).put("key","dense"+i));
        View week=view(t,LocalTime.NOON,400,true);TextView conflict=(TextView)((LinearLayout)week.findViewById(R.id.widget_day4)).getChildAt(0);
        assertTrue(conflict.getText().toString().contains("501门"));assertTrue("launcher description must remain bounded",conflict.getContentDescription().length()<=600);
    }
    @Test public void widgetIntentsOnlyOpenValidatedPackagedRoutes()throws Exception {
        TimetableStore store=new TimetableStore(context());store.save(table());
        assertEquals(MainActivity.START_URL,MainActivity.widgetRoute(context(),new Intent().putExtra("url","https://evil.invalid")));
        assertTrue(MainActivity.widgetRoute(context(),new Intent().putExtra("widgetTimetable",true)).endsWith("#timetable"));
        assertTrue(MainActivity.widgetRoute(context(),new Intent().putExtra("widgetCourse","course-1")).endsWith("#timetable/course/course-1"));
        assertTrue(MainActivity.widgetRoute(context(),new Intent().putExtra("widgetCourse","https://evil.invalid")).endsWith("#timetable"));store.clear();
        assertTrue(MainActivity.widgetRoute(context(),new Intent().putExtra("widgetCourse","course-1")).endsWith("#timetable"));
    }
}
