package cn.henu.study.waitforclass;
import android.content.Context;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

final class TimetableStore {
    interface Writer {void write(FileOutputStream out,byte[] bytes)throws IOException;}
    private final AtomicFile file;
    private final File cache;
    private final Writer writer;
    TimetableStore(Context context){this(new File(context.getFilesDir(),"personal-timetable-v1.json"),context.getCacheDir(),(out,data)->out.write(data));pruneStaged();}
    TimetableStore(File path,Writer writer){this(path,path.getParentFile(),writer);}
    private TimetableStore(File path,File cache,Writer writer){this.file=new AtomicFile(path);this.cache=cache;this.writer=writer;}
    synchronized JSONObject load()throws Exception {
        try(InputStream in=file.openRead()){JSONObject value=read(in);TimetableSchema.timetable(value);return value;}
        catch(FileNotFoundException missing){return null;}
    }
    synchronized void save(JSONObject value)throws Exception {
        TimetableSchema.timetable(value);byte[] data=TimetableSchema.bytes(value);FileOutputStream out=null;
        try{out=file.startWrite();writer.write(out,data);file.finishWrite(out);}
        catch(Exception failure){if(out!=null)file.failWrite(out);throw failure;}
    }
    synchronized void clear(){file.delete();}
    synchronized String stageImport(JSONObject value)throws Exception {
        TimetableSchema.raw(value);String token=UUID.randomUUID().toString();AtomicFile staged=new AtomicFile(stagedFile(token));FileOutputStream out=null;
        try{out=staged.startWrite();out.write(TimetableSchema.bytes(value));staged.finishWrite(out);return token;}
        catch(Exception failure){if(out!=null)staged.failWrite(out);throw failure;}
    }
    synchronized JSONObject consumeStagedImport(String token)throws Exception {
        File path=stagedFile(token);JSONObject value;
        try(InputStream in=new FileInputStream(path)){value=read(in);TimetableSchema.raw(value);}
        if(!path.delete())throw new IOException("import_cleanup_failed");return value;
    }
    private File stagedFile(String token)throws IOException {
        if(token==null||!token.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"))throw new IOException("invalid_import_token");
        File path=new File(cache,"pending-timetable-"+token+".json");
        if(!path.getCanonicalFile().getParentFile().equals(cache.getCanonicalFile()))throw new IOException("invalid_import_path");return path;
    }
    private void pruneStaged(){
        File[] files=cache.listFiles();if(files==null)return;long cutoff=System.currentTimeMillis()-30*60*1000;
        for(File f:files)if(f.getName().matches("pending-timetable-[a-f0-9-]+\\.json(?:\\.bak|\\.new)?")&&f.lastModified()<cutoff)f.delete();
    }
    private static JSONObject read(InputStream in)throws Exception {
        ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;
        while((n=in.read(buffer))!=-1){if(out.size()+n>TimetableImportPolicy.MAX_BYTES)throw new IOException("timetable_too_large");out.write(buffer,0,n);}
        return new JSONObject(out.toString(StandardCharsets.UTF_8.name()));
    }
}
