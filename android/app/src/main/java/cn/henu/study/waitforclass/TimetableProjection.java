package cn.henu.study.waitforclass;

import org.json.*;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Read-only effective courses; the private store stays the only source of truth. */
final class TimetableProjection {
    private static final String[][] TIMES={{"08:00","08:45"},{"08:55","09:40"},{"10:00","10:45"},{"10:55","11:40"},{"11:45","12:30"},{"14:05","14:50"},{"15:00","15:45"},{"15:55","16:40"},{"17:00","17:45"},{"17:55","18:40"},{"19:10","19:55"},{"20:05","20:50"},{"20:55","21:40"}};
    static final class Entry {
        final String courseKey,name,location;
        final int day,startPeriod,endPeriod;
        Entry(String key,String name,String location,int day,int start,int end){this.courseKey=key;this.name=name;this.location=location;this.day=day;this.startPeriod=start;this.endPeriod=end;}
    }
    static final class Day {
        final LocalDate date;final int week;final boolean pending;final List<Entry> entries;
        Day(LocalDate date,int week,boolean pending,List<Entry> entries){this.date=date;this.week=week;this.pending=pending;this.entries=Collections.unmodifiableList(entries);}
    }
    static String clock(int period,boolean end){if(period<1||period>13)throw new IllegalArgumentException("period");return TIMES[period-1][end?1:0];}
    static int week(JSONObject table,LocalDate date)throws JSONException{return (int)Math.floorDiv(ChronoUnit.DAYS.between(LocalDate.parse(table.getString("firstMonday")),date),7)+1;}
    static Day forDate(JSONObject table,LocalDate date)throws JSONException {
        if(table==null)return new Day(date,0,false,new ArrayList<>());
        TimetableSchema.timetable(table);int week=week(table,date);boolean pending=false;
        JSONArray courses=table.getJSONArray("courses");
        for(int i=0;i<courses.length();i++){JSONObject c=courses.getJSONObject(i);pending|=c.getBoolean("unscheduled")||c.getJSONArray("pendingSchedules").length()>0;}
        List<Entry> entries=new ArrayList<>();
        for(Entry e:project(table,week))if(e.day==date.getDayOfWeek().getValue())entries.add(e);
        return new Day(date,week,pending,entries);
    }
    static List<Entry> forWeek(JSONObject table,int week)throws JSONException {
        if(table==null)return Collections.emptyList();TimetableSchema.timetable(table);return Collections.unmodifiableList(project(table,week));
    }
    private static List<Entry> project(JSONObject table,int week)throws JSONException {
        List<Entry> result=new ArrayList<>();if(week<1||week>table.getInt("maxWeek"))return result;
        Map<String,JSONObject> names=new HashMap<>();Map<String,Map<String,JSONObject>> changes=new HashMap<>();
        JSONArray overrides=table.getJSONArray("overrides");
        for(int i=0;i<overrides.length();i++){
            JSONObject o=overrides.getJSONObject(i);String ck=o.getString("courseKey");
            if(o.isNull("meetingKey"))names.put(ck,o.getJSONObject("patch"));
            else changes.computeIfAbsent(ck,k->new HashMap<>()).put(o.getString("meetingKey"),o.getJSONObject("patch"));
        }
        JSONArray courses=table.getJSONArray("courses");
        for(int i=0;i<courses.length();i++){
            JSONObject course=courses.getJSONObject(i);String key=course.getString("key");JSONObject title=names.get(key);
            String name=title==null?course.getString("name"):title.optString("name",course.getString("name"));
            JSONArray meetings=course.getJSONArray("meetings");Map<String,JSONObject> patches=changes.getOrDefault(key,Collections.emptyMap());
            for(int n=0;n<meetings.length();n++){
                JSONObject m=meetings.getJSONObject(n),patch=patches.get(m.getString("key"));if(patch==null)patch=new JSONObject();
                JSONArray weeks=patch.has("weeks")?patch.getJSONArray("weeks"):m.getJSONArray("weeks");boolean active=false;
                for(int w=0;w<weeks.length();w++)active|=weeks.getInt(w)==week;if(!active)continue;
                result.add(new Entry(key,name,patch.optString("location",m.getString("location")),patch.optInt("day",m.getInt("day")),patch.optInt("startPeriod",m.getInt("startPeriod")),patch.optInt("endPeriod",m.getInt("endPeriod"))));
            }
        }
        result.sort(Comparator.comparingInt((Entry e)->e.day).thenComparingInt(e->e.startPeriod).thenComparingInt(e->e.endPeriod).thenComparing(e->e.courseKey));return result;
    }
}
