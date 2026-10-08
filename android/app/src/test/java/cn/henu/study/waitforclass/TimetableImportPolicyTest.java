package cn.henu.study.waitforclass;
import org.junit.Test;
import static org.junit.Assert.*;
public class TimetableImportPolicyTest {
    @Test public void schoolOriginAndPersonalDocumentsHaveStrictBoundaries(){
        assertTrue(TimetableImportPolicy.acceptsNavigation("https://xk.henu.edu.cn/cas/login.action"));
        assertTrue(TimetableImportPolicy.acceptsTimetableDocument("https://xk.henu.edu.cn/student/xkjg.wdkb.jsp?menucode=S20301"));
        assertTrue(TimetableImportPolicy.acceptsTimetableDocument("https://xk.henu.edu.cn/wsxk/xkjg.ckdgxsxdkchj_data10319.jsp?params=synthetic"));
        assertFalse(TimetableImportPolicy.acceptsTimetableDocument("https://xk.henu.edu.cn/cas/login.action"));
        for(String url:new String[]{"https://xk.henu.edu.cn.evil.example/student/xkjg.wdkb.jsp","http://xk.henu.edu.cn/student/xkjg.wdkb.jsp","https://user@xk.henu.edu.cn/student/xkjg.wdkb.jsp","https://xk.henu.edu.cn:444/student/xkjg.wdkb.jsp","file:///private","content://private","javascript:alert(1)","https://xk.henu.edu.cn/student/../xkjg.wdkb.jsp"})assertFalse(url,TimetableImportPolicy.acceptsNavigation(url));
    }
    @Test public void outdatedNavigationAndOversizedResultsCannotBecomeImports(){
        String url="https://xk.henu.edu.cn/student/xkjg.wdkb.jsp";
        assertTrue(TimetableImportPolicy.acceptsResult(1,1,url,512));
        assertFalse(TimetableImportPolicy.acceptsResult(1,2,url,512));
        assertFalse(TimetableImportPolicy.acceptsResult(1,1,url,512*1024+1));
        assertFalse(TimetableImportPolicy.acceptsResult(1,1,"https://xk.henu.edu.cn/cas/login.action",512));
    }
    @Test public void nestedTimetableCanReturnWhileTopPageStaysOnSchoolHome(){
        assertTrue(TimetableImportPolicy.acceptsResult(8,8,"https://xk.henu.edu.cn/frame/homes.action",512));
        assertFalse(TimetableImportPolicy.acceptsResult(8,9,"https://xk.henu.edu.cn/frame/homes.action",512));
        assertFalse(TimetableImportPolicy.acceptsResult(8,8,"https://xk.henu.edu.cn/frame/errors/405.jsp",512));
        assertFalse(TimetableImportPolicy.acceptsResult(8,8,"https://xk.henu.edu.cn.evil.example/frame/homes.action",512));
    }
}
