package cn.henu.study.waitforclass;

import android.content.Context;
import android.content.res.XmlResourceParser;
import android.view.*;
import android.widget.*;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import java.time.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class WidgetGeometryTest {
    private final Context context=RuntimeEnvironment.getApplication();
    private int minimum(boolean week)throws Exception {
        try(XmlResourceParser xml=context.getResources().getXml(week?R.xml.widget_week_info:R.xml.widget_today_info)){
            while(xml.next()!=XmlResourceParser.START_TAG){}
            return Math.round(Float.parseFloat(xml.getAttributeValue("http://schemas.android.com/apk/res/android","minResizeHeight").replaceAll("[^0-9.]","")));
        }
    }
    private JSONObject single()throws Exception {
        JSONObject t=TimetableStoreTest.sample(),m=t.getJSONArray("courses").getJSONObject(0).getJSONArray("meetings").getJSONObject(0);
        m.put("day",4).put("weeks",new JSONArray("[6]")).put("startPeriod",1).put("endPeriod",1);return t;
    }
    private View view(JSONObject t,int width,int height,boolean weekly)throws Exception {
        View v=TimetableWidgets.build(context,t,LocalDate.of(2026,10,8),LocalTime.of(7,0),width,height,weekly).apply(context,new FrameLayout(context));
        v.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.EXACTLY));v.layout(0,0,width,height);return v;
    }
    private void textFits(TextView text){
        assertNotNull(text.getLayout());
        int lines=text.getLayout().getLineCount();assertTrue(lines>0);
        assertTrue("visible text lines must fit the course cell",text.getLayout().getLineBottom(lines-1)<=text.getHeight()-text.getPaddingTop()-text.getPaddingBottom());
    }
    private View hostedWeek(android.os.Bundle options,int width,int height)throws Exception {
        return hosted(options,width,height,single(),true);
    }
    private View hosted(android.os.Bundle options,int width,int height,JSONObject table,boolean weekly)throws Exception {
        ZonedDateTime now=ZonedDateTime.of(2026,10,8,7,0,0,0,ZoneId.of("Asia/Shanghai"));
        new TimetableStore(context).save(table);
        android.appwidget.AppWidgetManager manager=android.appwidget.AppWidgetManager.getInstance(context);
        org.robolectric.shadows.ShadowAppWidgetManager shadow=Shadows.shadowOf(manager);
        int id=shadow.createWidget(weekly?WeekWidgetProvider.class:TodayWidgetProvider.class,weekly?R.layout.widget_week:R.layout.widget_today);
        manager.updateAppWidgetOptions(id,options);TimetableWidgets.update(context,manager,id,weekly,now);
        View host=shadow.getViewFor(id);
        host.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.EXACTLY));host.layout(0,0,width,height);
        return host;
    }
    private android.os.Bundle ranges(){
        android.os.Bundle options=new android.os.Bundle();
        options.putInt(android.appwidget.AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,340);
        options.putInt(android.appwidget.AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH,700);
        options.putInt(android.appwidget.AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,320);
        options.putInt(android.appwidget.AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT,620);
        return options;
    }
    private void gridFills(View host){
        ViewGroup periods=host.findViewById(R.id.widget_periods);assertEquals(13,periods.getChildCount());
        int bottom=periods.getChildAt(12).getBottom();
        assertTrue("the grid must fill the tall host instead of using the landscape minimum",bottom>=periods.getHeight()*0.9);
        assertTrue("all thirteen periods must fit inside the host",bottom<=periods.getHeight());
    }
    @Test @Config(qualifiers="port-mdpi") public void portraitHostUsesTallRangeInsteadOfMinimumHeight()throws Exception {
        gridFills(hostedWeek(ranges(),340,620));
    }
    @Test @Config(qualifiers="land-mdpi") public void landscapeHostFitsItsShortWideRange()throws Exception {
        gridFills(hostedWeek(ranges(),700,320));
    }
    @Test @Config(sdk=35,qualifiers="port-mdpi") public void modernHostExactSizeOverridesCoarseBounds()throws Exception {
        android.os.Bundle options=ranges();options.putInt(android.appwidget.AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT,320);
        java.util.ArrayList<android.util.SizeF> sizes=new java.util.ArrayList<>();sizes.add(new android.util.SizeF(340,620));
        options.putParcelableArrayList(android.appwidget.AppWidgetManager.OPTION_APPWIDGET_SIZES,sizes);
        gridFills(hostedWeek(options,340,620));
    }
    private JSONObject fourDailyCourses()throws Exception {
        JSONObject table=single(),original=table.getJSONArray("courses").getJSONObject(0);JSONArray courses=new JSONArray();
        int[] starts={1,3,9,11},ends={2,4,10,13};
        for(int i=0;i<4;i++){
            JSONObject course=new JSONObject(original.toString()).put("key","daily-"+i).put("name",new String[]{"Morning A","Morning B","Afternoon example","Evening example"}[i]);
            course.getJSONArray("meetings").getJSONObject(0).put("startPeriod",starts[i]).put("endPeriod",ends[i]);courses.put(course);
        }
        courses.getJSONObject(0).getJSONArray("pendingSchedules").put("4-18周");return table.put("courses",courses);
    }
    private void allDailyCoursesFit(View host){
        ViewGroup cards=host.findViewById(R.id.widget_courses);assertEquals("a tall host must show afternoon and evening too",4,cards.getChildCount());
        assertTrue(((TextView)cards.getChildAt(2).findViewById(R.id.widget_course_text)).getText().toString().contains("Afternoon"));
        assertTrue(((TextView)cards.getChildAt(3).findViewById(R.id.widget_course_text)).getText().toString().contains("Evening"));
        assertTrue(cards.getChildAt(3).getBottom()<=cards.getHeight());
        String footer=((TextView)host.findViewById(R.id.widget_footer)).getText().toString();assertTrue(footer.contains("核对"));assertFalse(footer.contains("还有"));
    }
    @Test @Config(qualifiers="port-mdpi") public void tallDailyHostDoesNotHideAfternoonAndEvening()throws Exception {
        android.os.Bundle options=ranges();options.putInt(android.appwidget.AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,190);options.putInt(android.appwidget.AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT,380);
        allDailyCoursesFit(hosted(options,340,380,fourDailyCourses(),false));
    }
    @Test @Config(sdk=35,qualifiers="port-mdpi") public void exactDailySizeDoesNotHideAfternoonAndEvening()throws Exception {
        android.os.Bundle options=ranges();options.putInt(android.appwidget.AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,190);options.putInt(android.appwidget.AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT,190);
        java.util.ArrayList<android.util.SizeF> sizes=new java.util.ArrayList<>();sizes.add(new android.util.SizeF(340,380));options.putParcelableArrayList(android.appwidget.AppWidgetManager.OPTION_APPWIDGET_SIZES,sizes);
        allDailyCoursesFit(hosted(options,340,380,fourDailyCourses(),false));
    }
    @Test public void minimumWeekKeepsSinglePeriodAndConflictReadable()throws Exception {
        for(int width:new int[]{250,440})for(boolean conflict:new boolean[]{false,true}){
            JSONObject t=single();if(conflict){JSONObject other=new JSONObject(t.getJSONArray("courses").getJSONObject(0).toString());other.put("key","other").put("name","Conflict");t.getJSONArray("courses").put(other);}
            View week=view(t,width,minimum(true),true);LinearLayout col=week.findViewById(R.id.widget_day4);TextView cell=(TextView)col.getChildAt(0);
            textFits(cell);if(conflict)assertTrue(cell.getText().toString().contains("2门"));
            assertTrue("thirteen periods must stay within the column",col.getChildAt(col.getChildCount()-1).getBottom()<=col.getHeight());
        }
    }
    @Test public void minimumTodayFitsCardAndPendingHiddenFooter()throws Exception {
        JSONObject t=single(),course=t.getJSONArray("courses").getJSONObject(0);course.getJSONArray("pendingSchedules").put("pending");JSONArray ms=course.getJSONArray("meetings");
        for(int i=0;i<4;i++)ms.put(new JSONObject(ms.getJSONObject(0).toString()).put("key","extra"+i).put("startPeriod",3+i*2).put("endPeriod",4+i*2));
        View today=view(t,250,minimum(false),false);LinearLayout cards=today.findViewById(R.id.widget_courses);
        assertTrue(cards.getChildCount()>0);assertTrue("complete course card must fit",cards.getChildAt(cards.getChildCount()-1).getBottom()<=cards.getHeight());
        TextView footer=today.findViewById(R.id.widget_footer);textFits(footer);assertTrue(footer.getText().toString().contains("核对"));assertTrue(footer.getText().toString().contains("还有 4"));
    }
}
