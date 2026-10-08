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
