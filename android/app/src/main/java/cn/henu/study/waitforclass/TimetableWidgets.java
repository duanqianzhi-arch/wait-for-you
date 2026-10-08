package cn.henu.study.waitforclass;

import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import org.json.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

final class TimetableWidgets {
    static final String REFRESH="cn.henu.study.waitforclass.REFRESH_TIMETABLE_WIDGET";
    private static final ZoneId ZONE=ZoneId.of("Asia/Shanghai");
    private static final int[] COLUMNS={R.id.widget_day1,R.id.widget_day2,R.id.widget_day3,R.id.widget_day4,R.id.widget_day5,R.id.widget_day6,R.id.widget_day7};
    private static final int[] HEADS={R.id.widget_head1,R.id.widget_head2,R.id.widget_head3,R.id.widget_head4,R.id.widget_head5,R.id.widget_head6,R.id.widget_head7};
    private static final String[] DAYS={"一","二","三","四","五","六","日"};
    private static Class<? extends AppWidgetProvider> provider(boolean week){return week?WeekWidgetProvider.class:TodayWidgetProvider.class;}
    static boolean requestPin(Activity activity,String kind)throws Exception {
        if(!"today".equals(kind)&&!"week".equals(kind))throw new IllegalArgumentException("widget_kind");
        AppWidgetManager manager=AppWidgetManager.getInstance(activity);if(!manager.isRequestPinAppWidgetSupported())return false;
        JSONObject table=new TimetableStore(activity).load();if(table==null)return false;boolean weekly="week".equals(kind);
        ZonedDateTime now=ZonedDateTime.now(ZONE);Bundle extras=new Bundle();
        extras.putParcelable(AppWidgetManager.EXTRA_APPWIDGET_PREVIEW,build(activity,table,now.toLocalDate(),now.toLocalTime(),340,weekly?360:160,weekly));
        try{return manager.requestPinAppWidget(new ComponentName(activity,provider(weekly)),extras,null);}
        catch(IllegalStateException|SecurityException unavailable){return false;}
    }
    static void refreshAll(Context context){
        try{
            AppWidgetManager manager=AppWidgetManager.getInstance(context);
            for(boolean weekly:new boolean[]{false,true})for(int id:manager.getAppWidgetIds(new ComponentName(context,provider(weekly))))update(context,manager,id,weekly);
        }catch(RuntimeException unavailable){/* Launcher availability must not make a saved timetable look unsaved. */}
    }
    static void update(Context context,AppWidgetManager manager,int id,boolean weekly){
        int[] owned=manager.getAppWidgetIds(new ComponentName(context,provider(weekly)));boolean known=false;for(int own:owned)known|=own==id;if(!known)return;
        ZonedDateTime now=ZonedDateTime.now(ZONE);Bundle options=manager.getAppWidgetOptions(id);
        int width=options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,340),height=options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,weekly?360:160);
        RemoteViews views;
        try{views=build(context,new TimetableStore(context).load(),now.toLocalDate(),now.toLocalTime(),width,height,weekly);}
        catch(Exception invalid){views=base(context,now.toLocalDate(),now.toLocalTime(),weekly);message(views,"请打开 App 检查课表");}
        Intent refresh=new Intent(context,provider(weekly)).setAction(REFRESH).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,id);
        views.setOnClickPendingIntent(R.id.widget_refresh,PendingIntent.getBroadcast(context,id,refresh,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
        try{manager.updateAppWidget(id,views);}catch(RuntimeException unavailable){/* A deleted widget or unavailable launcher does not change private data. */}
    }
    static RemoteViews build(Context context,JSONObject table,LocalDate date,LocalTime time,int width,int height,boolean weekly)throws JSONException {
        RemoteViews views=base(context,date,time,weekly);
        if(table==null){message(views,"先在 App 导入你的课表");return views;}
        TimetableProjection.Day day=TimetableProjection.forDate(table,date);
        views.setTextViewText(R.id.widget_title,weekly?"第 "+day.week+" 周 · 本周课表":"今日课程 · 第 "+day.week+" 周");
        if(day.week<1||day.week>table.getInt("maxWeek")){views.setTextViewText(R.id.widget_title,weekly?"本周课表":"今日课程");message(views,"今天在已导入的学期外");return views;}
        height=Math.max(weekly?320:160,Math.min(900,height));width=Math.max(250,Math.min(900,width));
        int hidden=0;
        if(weekly)week(context,views,table,date,day.week,width,height);
        else hidden=today(context,views,day,time,height);
        if(day.pending||hidden>0)views.setTextViewText(R.id.widget_footer,(day.pending?"有未识别安排，请核对 · ":"")+(hidden>0?"还有 "+hidden+" 次课程 · ":"")+"更新 "+time.format(DateTimeFormatter.ofPattern("HH:mm")));
        return views;
    }
    private static RemoteViews base(Context context,LocalDate date,LocalTime time,boolean weekly){
        RemoteViews v=new RemoteViews(context.getPackageName(),weekly?R.layout.widget_week:R.layout.widget_today);
        // Launchers reapply updates to an existing tree: replace dynamic children and state.
        v.setViewVisibility(R.id.widget_courses,View.VISIBLE);
        if(weekly){
            v.removeAllViews(R.id.widget_periods);
            for(int column:COLUMNS)v.removeAllViews(column);
            for(int head:HEADS){v.setInt(head,"setBackgroundColor",0x00000000);v.setTextColor(head,0xff171717);}
        }else v.removeAllViews(R.id.widget_courses);
        v.setViewVisibility(R.id.widget_message,View.GONE);
        v.setTextViewText(R.id.widget_title,weekly?"本周课表":"今日课程");
        v.setTextViewText(R.id.widget_date,date.format(DateTimeFormatter.ofPattern("MM月dd日"))+" 周"+DAYS[date.getDayOfWeek().getValue()-1]);
        v.setTextViewText(R.id.widget_footer,"更新 "+time.format(DateTimeFormatter.ofPattern("HH:mm"))+" · 点开查看完整课表");
        v.setOnClickPendingIntent(R.id.widget_root,open(context,null));return v;
    }
    private static void message(RemoteViews views,String text){
        views.setViewVisibility(R.id.widget_message,View.VISIBLE);views.setTextViewText(R.id.widget_message,text);views.setViewVisibility(R.id.widget_courses,View.GONE);
    }
    private static PendingIntent open(Context context,String key){
        Intent intent=new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if(key==null)intent.putExtra("widgetTimetable",true);else intent.putExtra("widgetCourse",key);
        // Data gives each course a distinct PendingIntent identity; it is never loaded as a URL.
        intent.setData(new android.net.Uri.Builder().scheme("waitforclass").authority("widget").appendPath(key==null?"timetable":key).build());
        return PendingIntent.getActivity(context,0,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    private static int today(Context context,RemoteViews views,TimetableProjection.Day day,LocalTime time,int height){
        List<TimetableProjection.Entry> remaining=new ArrayList<>();
        for(TimetableProjection.Entry e:day.entries)if(time.isBefore(LocalTime.parse(TimetableProjection.clock(e.endPeriod,true))))remaining.add(e);
        if(remaining.isEmpty()){message(views,day.entries.isEmpty()?"今天没有已排课程":"今天的已排课程已结束");return 0;}
        TimetableProjection.Entry next=remaining.get(0);views.setViewVisibility(R.id.widget_message,View.VISIBLE);
        views.setTextViewText(R.id.widget_message,time.isBefore(LocalTime.parse(TimetableProjection.clock(next.startPeriod,false)))?"下一节":"正在上课");
        int count=Math.min(remaining.size(),Math.max(1,Math.min(6,(height-100)/44)));
        for(int i=0;i<count;i++){
            TimetableProjection.Entry e=remaining.get(i);RemoteViews row=new RemoteViews(context.getPackageName(),R.layout.widget_course);
            row.setTextViewText(R.id.widget_course_text,e.name);
            row.setTextViewText(R.id.widget_course_meta,TimetableProjection.clock(e.startPeriod,false)+"–"+TimetableProjection.clock(e.endPeriod,true)+"  "+(e.location.isEmpty()?"地点待补充":e.location));
            row.setContentDescription(R.id.widget_course_row,e.name+"，"+e.startPeriod+"–"+e.endPeriod+"节，"+(e.location.isEmpty()?"地点待补充":e.location));
            row.setOnClickPendingIntent(R.id.widget_course_row,open(context,e.courseKey));views.addView(R.id.widget_courses,row);
        }
        return remaining.size()-count;
    }
    private static void week(Context context,RemoteViews views,JSONObject table,LocalDate date,int week,int width,int height)throws JSONException {
        List<TimetableProjection.Entry> entries=TimetableProjection.forWeek(table,week);if(entries.isEmpty()){message(views,"本周没有已排课程");return;}
        int row=Math.max(14,(height-100)/13);LocalDate monday=date.minusDays(date.getDayOfWeek().getValue()-1);
        for(int p=1;p<=13;p++)views.addView(R.id.widget_periods,slot(context,String.valueOf(p),row,9,false,null));
        for(int day=1;day<=7;day++){
            views.setTextViewText(HEADS[day-1],DAYS[day-1]+"\n"+monday.plusDays(day-1).getDayOfMonth());
            if(day==date.getDayOfWeek().getValue()){views.setInt(HEADS[day-1],"setBackgroundColor",0xff171717);views.setTextColor(HEADS[day-1],0xffffffff);}
            List<TimetableProjection.Entry> column=new ArrayList<>();for(TimetableProjection.Entry e:entries)if(e.day==day)column.add(e);
            int period=1,index=0;
            while(index<column.size()){
                TimetableProjection.Entry first=column.get(index++);int end=first.endPeriod;List<TimetableProjection.Entry> group=new ArrayList<>();group.add(first);
                while(index<column.size()&&column.get(index).startPeriod<=end){TimetableProjection.Entry e=column.get(index++);group.add(e);end=Math.max(end,e.endPeriod);}
                while(period<first.startPeriod){views.addView(COLUMNS[day-1],slot(context,"",row,9,false,null));period++;}
                String label=group.size()>1?group.size()+"门\n冲突":first.name+(height>=360&&!first.location.isEmpty()?"\n"+first.location:"");
                RemoteViews block=slot(context,label,row*(end-first.startPeriod+1),width>=400?11:9,true,group.size()==1?first.courseKey:null);
                StringBuilder description=new StringBuilder();for(int n=0;n<Math.min(3,group.size());n++){TimetableProjection.Entry e=group.get(n);description.append(e.name).append('，').append(e.startPeriod).append('–').append(e.endPeriod).append("节，").append(e.location.isEmpty()?"地点待补充":e.location).append('；');}
                String summary=description.substring(0,Math.min(480,description.length()));if(group.size()>3)summary+="共"+group.size()+"门冲突课程，点开查看完整课表";
                block.setContentDescription(R.id.widget_slot_text,summary);views.addView(COLUMNS[day-1],block);period=end+1;
            }
            while(period++<=13)views.addView(COLUMNS[day-1],slot(context,"",row,9,false,null));
        }
    }
    private static RemoteViews slot(Context context,String text,int height,int font,boolean course,String key){
        RemoteViews slot=new RemoteViews(context.getPackageName(),R.layout.widget_slot);slot.setTextViewText(R.id.widget_slot_text,text);
        slot.setInt(R.id.widget_slot_text,"setHeight",Math.round(height*context.getResources().getDisplayMetrics().density));slot.setTextViewTextSize(R.id.widget_slot_text,TypedValue.COMPLEX_UNIT_SP,font);
        android.util.DisplayMetrics metrics=context.getResources().getDisplayMetrics();
        android.graphics.Paint paint=new android.graphics.Paint();paint.setTextSize(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP,font,metrics));
        android.graphics.Paint.FontMetricsInt fm=paint.getFontMetricsInt();
        // Ellipsize whole lines instead of allowing the last line to be cut by a short period cell.
        int available=Math.round((height-2)*metrics.density),line=Math.max(1,fm.descent-fm.ascent);
        slot.setInt(R.id.widget_slot_text,"setMaxLines",Math.max(1,Math.min(6,available/line)));
        if(course){slot.setInt(R.id.widget_slot_text,"setBackgroundResource",R.drawable.widget_course_border);slot.setOnClickPendingIntent(R.id.widget_slot_text,open(context,key));}
        return slot;
    }
}
