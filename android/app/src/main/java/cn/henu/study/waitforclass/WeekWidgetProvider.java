package cn.henu.study.waitforclass;
import android.appwidget.*;
import android.content.*;
import android.os.Bundle;
public class WeekWidgetProvider extends AppWidgetProvider {
    @Override public void onUpdate(Context c,AppWidgetManager m,int[] ids){for(int id:ids)TimetableWidgets.update(c,m,id,true);}
    @Override public void onAppWidgetOptionsChanged(Context c,AppWidgetManager m,int id,Bundle options){TimetableWidgets.update(c,m,id,true);}
    @Override public void onReceive(Context c,Intent i){super.onReceive(c,i);if(TimetableWidgets.REFRESH.equals(i.getAction()))TimetableWidgets.update(c,AppWidgetManager.getInstance(c),i.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,-1),true);}
}
