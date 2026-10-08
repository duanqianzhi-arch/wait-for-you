package cn.henu.study.waitforclass;
import java.net.URI;
final class TimetableImportPolicy {
    static final int MAX_BYTES=512*1024;
    static final String LOGIN="https://xk.henu.edu.cn/cas/login.action";
    static final String PERSONAL="https://xk.henu.edu.cn/student/xkjg.wdkb.jsp?menucode=S20301";
    static boolean acceptsNavigation(String value){
        try{
            URI uri=new URI(value);
            if(!"https".equals(uri.getScheme())||!"xk.henu.edu.cn".equals(uri.getHost())||uri.getUserInfo()!=null||(uri.getPort()!=-1&&uri.getPort()!=443))return false;
            String path=uri.getPath();if(path==null)return false;
            for(String segment:path.split("/"))if("..".equals(segment))return false;
            return true;
        }catch(Exception invalid){return false;}
    }
    static boolean acceptsTimetableDocument(String value){
        if(!acceptsNavigation(value))return false;
        try{String path=new URI(value).getPath();return "/student/xkjg.wdkb.jsp".equals(path)||"/wsxk/xkjg.ckdgxsxdkchj_data10319.jsp".equals(path);}
        catch(Exception invalid){return false;}
    }
    static boolean isHome(String value){
        if(!acceptsNavigation(value))return false;
        try{return "/frame/homes.action".equals(new URI(value).getPath());}catch(Exception invalid){return false;}
    }
    static boolean acceptsResult(int started,int current,String url,int sizeBytes){
        return started==current&&sizeBytes>0&&sizeBytes<=MAX_BYTES&&acceptsTimetableDocument(url);
    }
}
