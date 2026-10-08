# 河南大学个人课表自动导入：源码与安全读取调研

调研日期：2026-10-08（Asia/Shanghai）。范围：公开的原作者源码、Android 官方文档，以及主代理在用户自行登录后只读核查的页面结构。研究代理没有登录、提交凭据、运行参考项目或发起登录后接口请求；没有下载未知 APK。文中的泛化示例不含真实学号、姓名、Cookie 或 `params` 值。

## 结论

推荐实现“用户在 App 内打开学校原始登录页 → 登录后读取本人课表 → 自动解析整学期 → 本地查看和修改”。用户不用逐课录入或导出文件；首次登录、验证码及必要的再次登录仍由用户完成。此处的自动导入是自动读取与解析课表，不等于后台长期无人值守登录、每周自动同步。

公开源码中已找到与河南大学当前页面路径相符的参考。适合借鉴路径识别、时间地点拆分方法，自建严格的周次解析与本地修改保护；不宜把通用青果解析器当作已经验证的河南大学适配。

## 候选对照

| 候选 | 与当前需求的关系 | 许可与实际阅读版本 | 本次验证程度 | 决策 |
| --- | --- | --- | --- | --- |
| [jry21223/HENU_Assistant](https://github.com/jry21223/HENU_Assistant) | 河南大学特定：识别个人课表入口、列表及二维课表路径 | MIT；`mcp-server` 提交 `20431d6b1c0f4dfff0186ea50a9db89e2e350ade`，2026-07-25 | 静态读源码；路径与主代理现场观察一致；未运行或调用接口 | 最有价值的路径与格式参考，不直接移植账号登录或整套后端 |
| [NYIST-CIPS/CourseTable](https://github.com/NYIST-CIPS/CourseTable) | 南阳理工：同类青果/服务大厅，提供小爱及 WakeUp 解析 | MIT；`d8a6686b37265974b039a7160ba0fb835464329a`，2022-03-03 | 静态读 JS、Kotlin；不是河南大学 | 参考单双周、分段周次测试样例；其 `.course-content` 布局与河南现场列表不同 |
| [baoozak/timetable](https://github.com/baoozak/timetable) | uni-app 登录页面、导入、周视图；学校配置列河南大学 | MIT；`e4b57dfa63359320ad0642aaf8c1f703e9236101`，2026-03-26 | 静态读学校配置与 Kingosoft 解析器；未真机导入 | 借交互和模块分层，不能把学校配置存在当作适配通过 |
| [MoicLoi/XiaoQue-UniversityTimetable](https://github.com/MoicLoi/XiaoQue-UniversityTimetable) | 非官方喜鹊儿服务 Android 客户端 | 仓库显示 MIT；本次仅看原作者 README，未审协议源码 | 未确认河南大学适配、厂商授权或协议长期稳定性 | 暂不作为默认接入路径 |

日期是实际阅读提交的日期，不能拿仓库“最近更新”日期代替某适配代码最后变更时间。未找到可直接采用并已于本次通过河南大学账号导入的现成适配。

## 河南大学特定参考的有效部分与缺口

[course_schedule.py 固定提交源码](https://github.com/jry21223/HENU_Assistant/blob/20431d6b1c0f4dfff0186ea50a9db89e2e350ade/henu_mcp/core/course_schedule.py) 识别 `/student/xkjg.wdkb.jsp`；列表默认路径 `../wsxk/xkjg.ckdgxsxdkchj_data10319.jsp`，二维课表 `../student/wsxk.xskcb10319.jsp`。它尝试从页面发现路径，再构造参数。本项目优先读取学校已加载的本人课表，不硬编码任何个人标识，也不复制它的多路径试探或自动登录方案。

[schedule_cleaner.py 固定提交源码](https://github.com/jry21223/HENU_Assistant/blob/20431d6b1c0f4dfff0186ea50a9db89e2e350ade/henu_mcp/core/schedule_cleaner.py) 能处理列表与 `mytable` 网格。列表读取 `tbody/tr`，先检查时间地点列再扫描包含“星期字符[节次]”的字段，用中英文分号拆分多段；无地点显示“未标注”。其输出仍把教学周放在原始时间文本里，没有完成可直接供本项目周视图使用的严格教学周数组。

该解析器依赖固定列索引并使用若干回退；本项目应按“课程”“上课时间地点”等表头定位，不把教师等其他列误当课程。不能用课表格子的第几行推断节次；课程文本中的 `[3-5]` 等才是依据。未知周次、无法解析的记录应显示待核对提示，不默认变成整个学期的课，更不能因为读取失败清空既有课表。

主代理于 2026-10-08 通过用户已经登录的浏览器只读观察到：教学安排 `S203` 下入口 `/student/xkjg.wdkb.jsp?menucode=S20301`，实际列表框架 `/wsxk/xkjg.ckdgxsxdkchj_data10319.jsp?params=...`。列包含课程、上课班级代码、上课时间地点等；时段形态可概括为 `1-18周 三[3-5] 教学楼5404(96)`，多段由 `；` 分隔，部分地点为空。这里只确认页面路径、表头及语法；不记录真实参数和个人课程。现场观察证据由主代理纳入本功能规格，研究代理没有自行再次读取个人页面。

## 为什么不直接采用通用 Kingosoft 适配

baoozak 的 [schools.json](https://github.com/baoozak/timetable/blob/e4b57dfa63359320ad0642aaf8c1f703e9236101/utils/schools.json) 确实列出河南大学及 `https://xk.henu.edu.cn/cas/login.action`，但这只是配置。

其 [kingosoft_new.js](https://github.com/baoozak/timetable/blob/e4b57dfa63359320ad0642aaf8c1f703e9236101/utils/parsers/kingosoft_new.js) 的 JSON 分支直接返回空数组，HTML 分支按行号推断成对节次；选择器 `kbtable`/`scheduleTable` 与当前河南列表没有已验证的一致性。文件混用金智/青果称呼，不能把名称当作系统识别依据。这里应避免照搬代码后宣称河南适配完成。

NYIST 的 [provider](https://github.com/NYIST-CIPS/CourseTable/blob/d8a6686b37265974b039a7160ba0fb835464329a/AISchedule/scheduleHtmlProvider.js) 读取 `.course-content`；[JS parser](https://github.com/NYIST-CIPS/CourseTable/blob/d8a6686b37265974b039a7160ba0fb835464329a/AISchedule/scheduleHtmlParser.js) 处理单双周和分段；[WakeUp Kotlin parser](https://github.com/NYIST-CIPS/CourseTable/blob/d8a6686b37265974b039a7160ba0fb835464329a/Wakeup/NYISTParser.kt) 采用 Jsoup。它们的空时间回退会给虚构时间，不能沿用到本产品。适合把历史问题转成测试用例，自建河南当前格式适配。

## 原生 Android 页面读取建议

1. 建立专门的教务登录/导入 Activity 与 WebView；本地产品主页面保留在原来的 WebView。学校 WebView 不暴露可被任意页面调用的 `addJavascriptInterface`。Android 明确指出该接口暴露给所有 frame，应用无法据此验证调用 frame 来源。[官方桥接安全说明](https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges)
2. 用户主动导入时，由原生层在核验 URL 后调用 `evaluateJavascript`，通过其原生回调接收最小课程 JSON；这是官方支持的异步当前页面执行方式。页面跳转后不要假定之前注入的变量仍在。[WebView.evaluateJavascript](https://developer.android.com/reference/android/webkit/WebView#evaluateJavascript(java.lang.String,%20android.webkit.ValueCallback))
3. 所有主导航解析成 URI，核验 `https`、精确 host、允许 path；不要用字符串包含 `henu.edu.cn` 判断。接收结果前再次校验当前地址，避免导航期间把其他来源数据当课表。只允许实际确认的学校域名，其他地址转系统浏览器。[官方 URI 载入安全说明](https://developer.android.com/privacy-and-security/risks/unsafe-uri-loading)
4. SSL 错误取消，不提供“继续忽略证书”按钮。[WebViewClient.onReceivedSslError](https://developer.android.com/reference/android/webkit/WebViewClient#onReceivedSslError(android.webkit.WebView,%20android.webkit.SslErrorHandler,%20android.net.http.SslError))
5. 两个 WebView 实例本身不会隔离 Cookie；CookieManager 是应用 WebView 的单例管理器。不保存密码仍可能留下学校会话。退出提供明确会话清理，并提示会影响同进程 WebView 登录态。[CookieManager](https://developer.android.com/reference/android/webkit/CookieManager)
6. 真正独立 WebView 数据目录的 `setDataDirectorySuffix` 从 API 28 才提供，按进程设置且必须在初始化之前调用。现有最低 Android API 26，需要明确分版本方案；无需为这一阶段盲目增加多进程或提升最低版本。[WebView 数据目录文档](https://developer.android.com/reference/android/webkit/WebView#setDataDirectorySuffix(java.lang.String))

第 1、2、3 项组合是本项目建议，不是 Android 官方对本校适配的背书。课程结果始终视作外部输入：只保存课名、课程键、周次、星期、节次和地点；限制条目及文本长度，用纯文本渲染，严格校验字段，不保存完整网页、密码、Cookie、参数或个人身份。缺失信息保留为缺失并允许用户修改。

课程原始记录与本地修正分开保存。重导入先验证完整结果，再原子更新原始记录；保留修正并提示不再匹配的旧课程，不盲目丢弃。读取失败、登录失效、空课表和解析器不支持必须是不同状态。

## 自动导入与后台同步的产品边界

本阶段可做：进入原始教务网站登录，一次读取整学期课表；导入后离线按周显示；用户编辑地址、时间及备注；下次主动同步使用学校仍有效的会话，否则提醒重新登录。

本阶段不能直接承诺：不再登录、绕过验证码、永久会话、后台每周更新、获取全部活动占用。公开参考的自动登录会处理密码和学校认证细节，并有验证码失败分支；这不是无需用户参与的稳定官方授权 API。[原作者登录源码](https://github.com/jry21223/HENU_Assistant/blob/20431d6b1c0f4dfff0186ea50a9db89e2e350ade/henu_mcp/core/kingo_auth.py)

在学校没有明确开放跨域读取或消息协作的前提下，纯网页不能直接读取学校已登录课表，这是浏览器同源策略的限制；安卓内嵌读取可作为本次首要路线。[MDN 同源策略](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy) 用户个人课表不汇总成全校教室占用，也不覆盖既有公共教室课表数据。

## 实施前后必须验证

- 主流程是自动读取全部课程，手动修改只用于修正；没有逐门手录要求。
- 当前河南列表、嵌套框架、多段时间、单双周、断开的周次、单节课及跨多节课均有解析用例；样例完全虚构。
- 空地点、无时间、未排课与解析失败有明确区别；不编造周次或地点。
- 登录页、未知 host、非 HTTPS、无效或过大的结果、导入中导航变更全部拒绝；不读取密码控件或会话到产品数据层。
- 再导入改变教室、课程移除、用户本地修改、保存失败与应用重启均验证；已有收藏保持兼容。
- 真机验证登录、解析全部课程、离线查看和覆盖更新。完成桌面浏览器验证不能代替原生 Android 验证。

## 许可与本次文件范围

参考源码的 MIT 许可见 [HENU_Assistant LICENSE](https://github.com/jry21223/HENU_Assistant/blob/20431d6b1c0f4dfff0186ea50a9db89e2e350ade/LICENSE)、[NYIST LICENSE](https://github.com/NYIST-CIPS/CourseTable/blob/d8a6686b37265974b039a7160ba0fb835464329a/LICENSE)、[baoozak LICENSE](https://github.com/baoozak/timetable/blob/e4b57dfa63359320ad0642aaf8c1f703e9236101/LICENSE)。若采用实质代码，保留对应版权与许可并更新 THIRD_PARTY_NOTICES；目前本调研没有复制其产品代码。学校服务接入与数据使用权限不因代码采用 MIT 自动获得。

本次仅新增这份研究记录；没有修改产品代码、构建、部署或提交。公开源码的本地研究副本位于历史工作目录 `.research-henu-import`，没有放入产品仓库。记忆合并由主代理在任务收尾执行，以避免并发覆盖同一项目摘要。
