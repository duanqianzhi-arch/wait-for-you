package cn.henu.study.waitforclass;
import org.json.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

/** Validates externally sourced records again before native storage. */
final class TimetableSchema {
    static void check(boolean condition)throws JSONException{if(!condition)throw new JSONException("invalid_timetable");}
    static void keys(JSONObject object,String... allowed)throws JSONException{
        Set<String> names=new HashSet<>(Arrays.asList(allowed));Iterator<String> actual=object.keys();
        while(actual.hasNext())check(names.contains(actual.next()));
    }
    static String text(JSONObject o,String key,int max,boolean empty)throws JSONException{
        Object v=o.opt(key);check(v instanceof String);String s=(String)v;check(s.length()<=max&&(empty||!s.trim().isEmpty()));return s;
    }
    static int number(JSONObject o,String key,int min,int max)throws JSONException{
        Object value=o.opt(key);check(value instanceof Integer);int n=(Integer)value;check(n>=min&&n<=max);return n;
    }
    static void weeks(JSONArray weeks)throws JSONException{
        check(weeks.length()>0&&weeks.length()<=18);int previous=0;
        for(int i=0;i<weeks.length();i++){Object v=weeks.get(i);check(v instanceof Integer);int n=(Integer)v;check(n>previous&&n<=18);previous=n;}
    }
    static byte[] bytes(JSONObject value)throws JSONException{
        byte[] bytes=value.toString().getBytes(StandardCharsets.UTF_8);check(bytes.length<=TimetableImportPolicy.MAX_BYTES);return bytes;
    }
    static void raw(JSONObject value)throws JSONException{
        bytes(value);keys(value,"adapterVersion","semester","declaredCourseCount","complete","rows");
        text(value,"adapterVersion",64,false);check("2026-2027-1".equals(text(value,"semester",64,false)));check(Boolean.TRUE.equals(value.opt("complete")));
        JSONArray rows=value.getJSONArray("rows");check(rows.length()<=500);check(number(value,"declaredCourseCount",0,500)==rows.length());
        for(int i=0;i<rows.length();i++){
            JSONObject row=rows.getJSONObject(i);keys(row,"courseText","teachingGroupCode","selectionStatus","scheduleText");
            text(row,"courseText",200,false);text(row,"teachingGroupCode",128,false);text(row,"scheduleText",10000,true);check("选中".equals(text(row,"selectionStatus",16,false)));
        }
    }
    static void timetable(JSONObject value)throws JSONException{
        bytes(value);keys(value,"schemaVersion","school","semester","firstMonday","maxWeek","timezone","importedAt","adapterVersion","revision","courses","overrides");
        check(number(value,"schemaVersion",1,1)==1);check("henu".equals(text(value,"school",32,false)));
        check("2026-2027-1".equals(text(value,"semester",64,false)));check("2026-08-31".equals(text(value,"firstMonday",32,false)));check(number(value,"maxWeek",18,18)==18);
        check("Asia/Shanghai".equals(text(value,"timezone",64,false)));text(value,"adapterVersion",64,false);number(value,"revision",1,Integer.MAX_VALUE);
        try{Instant.parse(text(value,"importedAt",64,false));}catch(Exception invalid){throw new JSONException("invalid_timestamp");}
        JSONArray courses=value.getJSONArray("courses"),overrides=value.getJSONArray("overrides");check(courses.length()<=500&&overrides.length()<=2500);
        Map<String,JSONObject> courseMap=new HashMap<>();int count=0;
        for(int i=0;i<courses.length();i++){
            JSONObject c=courses.getJSONObject(i);keys(c,"key","code","teachingGroupCode","name","meetings","pendingSchedules","unscheduled","localOnly","schoolRecord");
            String key=text(c,"key",400,false);check(!courseMap.containsKey(key));courseMap.put(key,c);
            text(c,"code",64,false);text(c,"teachingGroupCode",128,false);text(c,"name",120,false);
            JSONArray meetings=c.getJSONArray("meetings"),pending=c.getJSONArray("pendingSchedules");check(pending.length()<=2000);count+=meetings.length();
            check(c.opt("unscheduled") instanceof Boolean&&c.getBoolean("unscheduled")== (meetings.length()==0));
            if(c.has("localOnly"))check(c.opt("localOnly") instanceof Boolean);
            if(c.optBoolean("localOnly",false)){
                check(c.has("schoolRecord"));Object record=c.get("schoolRecord");check(record==JSONObject.NULL||record instanceof JSONObject);
                if(record instanceof JSONObject)count+=schoolRecord((JSONObject)record,key);
            }else check(!c.has("schoolRecord"));
            for(int n=0;n<pending.length();n++)check(pending.get(n) instanceof String&&pending.getString(n).length()<=10000);
            Set<String> meetingKeys=new HashSet<>();
            for(int n=0;n<meetings.length();n++){
                JSONObject m=meetings.getJSONObject(n);keys(m,"key","day","weeks","startPeriod","endPeriod","location");
                String mk=text(m,"key",400,false);check(meetingKeys.add(mk));number(m,"day",1,7);weeks(m.getJSONArray("weeks"));
                int start=number(m,"startPeriod",1,13);number(m,"endPeriod",start,13);text(m,"location",240,true);
            }
        }
        check(count<=2000);Set<String> overrideKeys=new HashSet<>();
        for(int i=0;i<overrides.length();i++){
            JSONObject o=overrides.getJSONObject(i);keys(o,"courseKey","meetingKey","baseSnapshot","patch");
            String ck=text(o,"courseKey",400,false);check(courseMap.containsKey(ck));Object mk=o.opt("meetingKey");check(mk==JSONObject.NULL||mk instanceof String);
            check(overrideKeys.add(ck+"\n"+String.valueOf(mk)));JSONObject base=courseMap.get(ck);boolean courseLevel=mk==JSONObject.NULL;
            if(!courseLevel){base=null;JSONArray ms=courseMap.get(ck).getJSONArray("meetings");for(int n=0;n<ms.length();n++)if(ms.getJSONObject(n).getString("key").equals(mk))base=ms.getJSONObject(n);check(base!=null);}
            JSONObject patch=o.getJSONObject("patch"),snapshot=o.getJSONObject("baseSnapshot");validatePatch(patch,courseLevel);validatePatch(snapshot,courseLevel);
            Iterator<String> names=patch.keys();while(names.hasNext())check(snapshot.has(names.next()));
            if(!courseLevel){int start=patch.has("startPeriod")?patch.getInt("startPeriod"):base.getInt("startPeriod");int end=patch.has("endPeriod")?patch.getInt("endPeriod"):base.getInt("endPeriod");check(end>=start);}
        }
    }
    private static int schoolRecord(JSONObject c,String expectedKey)throws JSONException{
        keys(c,"key","code","teachingGroupCode","name","meetings","pendingSchedules","unscheduled");
        check(expectedKey.equals(text(c,"key",400,false)));text(c,"code",64,false);text(c,"teachingGroupCode",128,false);text(c,"name",120,false);
        JSONArray meetings=c.getJSONArray("meetings"),pending=c.getJSONArray("pendingSchedules");check(pending.length()<=2000);
        check(c.opt("unscheduled") instanceof Boolean&&c.getBoolean("unscheduled")== (meetings.length()==0));
        for(int i=0;i<pending.length();i++)check(pending.get(i) instanceof String&&pending.getString(i).length()<=10000);
        Set<String> seen=new HashSet<>();
        for(int i=0;i<meetings.length();i++){
            JSONObject m=meetings.getJSONObject(i);keys(m,"key","day","weeks","startPeriod","endPeriod","location");
            check(seen.add(text(m,"key",400,false)));number(m,"day",1,7);weeks(m.getJSONArray("weeks"));
            number(m,"endPeriod",number(m,"startPeriod",1,13),13);text(m,"location",240,true);
        }
        return meetings.length();
    }
    private static void validatePatch(JSONObject patch,boolean courseLevel)throws JSONException{
        if(courseLevel)keys(patch,"name","note");else keys(patch,"location","note","day","weeks","startPeriod","endPeriod");
        if(patch.has("name"))text(patch,"name",120,false);if(patch.has("note"))text(patch,"note",1000,true);if(patch.has("location"))text(patch,"location",240,true);
        if(patch.has("day"))number(patch,"day",1,7);if(patch.has("weeks"))weeks(patch.getJSONArray("weeks"));
        if(patch.has("startPeriod"))number(patch,"startPeriod",1,13);if(patch.has("endPeriod"))number(patch,"endPeriod",1,13);
    }
}
