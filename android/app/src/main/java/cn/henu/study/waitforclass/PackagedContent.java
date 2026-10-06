package cn.henu.study.waitforclass;
import java.net.URI;
final class PackagedContent {
    static boolean accepts(String url){
        try {
            URI uri=new URI(url);
            if(!"https".equals(uri.getScheme()) || !"appassets.androidplatform.net".equals(uri.getHost()) || uri.getUserInfo()!=null || (uri.getPort()!=-1&&uri.getPort()!=443))return false;
            String path=uri.getPath();
            if(path==null||!path.startsWith("/assets/www/"))return false;
            for(String segment:path.split("/"))if("..".equals(segment))return false;
            return true;
        }catch(Exception invalid){return false;}
    }
    static boolean supportsVersion(String version){
        if(version==null)return false;
        try{return Integer.parseInt(version.split("\\.",2)[0])>=102;}
        catch(NumberFormatException invalid){return false;}
    }
}
