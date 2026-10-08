# 紧凑课表和两个桌面组件实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. 沿用用户已选择的当前助手直接实施方式。

**Goal:** 修正手机课表跨节与缩放，新增今日课程／本周课表安卓组件，交付同签名可覆盖安装的测试APK。

**Architecture:** 手机周视图使用固定节高的CSS Grid，并在课表区域处理缩放。原生投影从既有私有课表计算有效课程，两个RemoteViews组件共用它；现有课表桥只增加组件固定请求，保存成功后刷新。

**Tech Stack:** 现有HTML/CSS/JavaScript、Java、Android AppWidgetProvider/RemoteViews，JSDOM和Robolectric；不添加产品依赖。

**Spec:** `docs/superpowers/specs/2026-10-08-timetable-widgets-design.md`，用户2026-10-08已选“方案符合，两个组件都做”。

## Global Constraints

- 沿用 `.worktrees/personal-timetable` / `feat/personal-timetable`；顶部不动，底部三项不变。
- 七天适应屏幕，13节固定节高，跨节占满，缩放100%–220%，细黑白网格和既有手写字体。
- 私有 `TimetableStore` 为唯一正本；组件应用本地修改，不上传课表，不储存密码，不增加教务来源。
- 两个组件“今日课程”“本周课表”，可调整尺寸；固定请求由桌面确认，接口true不提示“已添加”。
- 系统周期30分钟，打开App／保存成功／组件按钮主动刷新；不承诺省电模式及时刷新，不增加通知／精确闹钟权限。
- 本次版本 `1.2.0` / `versionCode=6`，原签名覆盖安装。独立Preview测试，正式网站未验收前保持1.0.1。

## Review Focus

1. 重叠课程仍能看到且进入详情，布局不能只保留一门；Task1用三门相交课程回归。
2. 双指结束不能误点课程，单指仍可滚动；Task1模拟触摸序列并在浏览器检查几何与滑动。
3. 组件必须应用周次／星期／节次修改及保留课程；Task2共享匿名向量验证JS和Java有效结果。
4. 系统桌面拒绝或不支持添加，不能声称添加成功；Task3覆盖接口返回false/true与无课表状态。
5. 更新覆盖安装和组件点击不能丢数据或接受任意网址；Task3验证明确路由/过期课程，Task4核对同签名和手机验收说明。

## Task 1：手机网格与缩放

**Files:** 修改 `dist/timetable-ui.js`（周视图、缩放状态与事件）、`dist/styles.css`（课表局部布局）、`dist/app.js`（触摸委托）；测试 `test-timetable-ui.cjs`。

**Interfaces:** 保留 `createTimetableUI(...)` 现有API；增加 `handleTouch(event):boolean`。课程按钮保留 `data-timetable-action=course` 和课程key。增加 `zoom-in`、`zoom-out`、`zoom-fit` 动作。内部 `layoutMeetings(entries)` 计算同日相交区间的并排位置，包含同一起点与嵌套区间。

- [x] Step1：先写回归：1–2／3–5／11–13跨行位置正确；相交三门课程均有可点按钮；下一周和本周不破坏缩放；100%下缩小禁用、220%下放大禁用、恢复100%；双指结束后短时点击不打开课程。
- [x] Step2：运行 `node test-timetable-ui.cjs`，确认新断言因现有单节单元格／无缩放失败。
- [x] Step3：实现固定行高网格、精简文本和完整无障碍名称；缩放只改区域宽度、行高和字体，不重绘整个App。仅双指时阻止默认操作，普通滑动保留。
- [x] Step4：运行上述脚本；匿名浏览器验证320/360/390/430/1440px、一屏七天、跨节实际高度、放大后可滚动、详情／导航／切周不退化；保存匿名截图。
- [x] Step5：提交 `fix: make mobile timetable compact with spanning classes and zoom`。

## Task 2：原生有效课表投影

**Files:** 新建 `android/app/src/main/java/cn/henu/study/waitforclass/TimetableProjection.java` 和同路径测试目录 `TimetableProjectionTest.java`；新建 `test-fixtures/widget-projection.json` 与 `test-widget-projection.cjs`，更新 `package.json` 测试链。

**Interfaces:** `TimetableProjection.forDate(JSONObject table, LocalDate date):Day`；`TimetableProjection.forWeek(JSONObject table,int week):List<Entry>`；Entry含courseKey/name/location/day/startPeriod/endPeriod，Day含date/week/entries/pending，所有结果是有效本地课表。`TimetableProjection.clock(int period,boolean end):String` 使用既有13节时间。

- [x] Step1：匿名JSON向量及Java/JS断言：首周周日、跨学期、单双周、本地名称地点时间修改、localOnly且schoolRecord为null或新安排、无地点、未识别安排。相同输入预期相同课程key/时间/地点。
- [x] Step2：运行JS向量测试与 `:app:testDebugUnitTest --tests '*TimetableProjectionTest'`，Java待实现时确认失败，不以依赖缺失当业务失败。
- [x] Step3：实现纯Java投影，用现有schema校验；复制最少字段并应用patch，按星期／节次／key确定性排序。schoolRecord不参与有效安排，日期按Asia/Shanghai提供，学期外不强制夹到第1或18周。
- [x] Step4：运行共享向量脚本和原生测试，所有断言通过；不记录用户真实课程。
- [x] Step5：提交 `feat: project private timetable for Android widgets`。

## Task 3：组件显示、添加与刷新

**Files:** 新建 `TimetableWidgets.java`（共用呈现/刷新/固定请求）、`TodayWidgetProvider.java`、`WeekWidgetProvider.java`；资源 `res/layout/widget_today.xml`、`widget_week.xml`、`widget_course.xml`、`widget_slot.xml`、`res/xml/widget_today_info.xml`、`widget_week_info.xml`、黑白drawable边框；修改 `AndroidManifest.xml`、`TimetableController.java`、`MainActivity.java`、`dist/timetable-ui.js`；新建 `TimetableWidgetsTest.java` 并扩展controller/main/UI测试。

**Interfaces:** `TimetableWidgets.refreshAll(Context)`；`TimetableWidgets.requestPin(Activity,String kind):boolean`，kind仅today/week；`TimetableWidgets.update(Context,AppWidgetManager,int id,boolean weekly)`。桥动作 `widget`，payload仅 `{kind:'today'|'week'}`，回复 `{requested:boolean}`。MainActivity仅处理明确 `widgetCourse` key或 `widgetTimetable=true`，从私有课表核验key后构造包内hash；过期key回到课表，其他额外值不打开外部来源。

- [x] Step1：写组件回归：实际RemoteViews展开后的文本／行跨度／空态；尺寸变化不同数量课程；重叠安排显示数量；今日下一节与已结束状态；读取失败不删除文件；save失败不显示新数据；clear清空；pin不支持false、支持true仅“请在桌面确认”；未可信学校来源仍拒绝桥动作；点击过期key回课表，外部URL不被加载。
- [x] Step2：运行 `:app:testDebugUnitTest --tests '*TimetableWidgetsTest' --tests '*TimetableControllerTest' --tests '*MainActivityTest'` 与UI脚本，确认缺少组件行为的失败。
- [x] Step3：实现RemoteViews黑白自适应组件，provider-info设1800000ms周期与horizontal|vertical resize；同一投影驱动两种展示。今日显示当前/下一节与后续数量，本周七列按节高生成跨节块；冲突块点击打开App。明确不可变PendingIntent，内部receiver，限制ID和操作。存储操作成功后刷新失败不得冒充保存失败；组件异常只显示读取状态，独立保护已有文件。
- [x] Step4：运行全部原生和前端逻辑测试、资源构建；用匿名展开视图核验大小与文案。添加真实设备验收用例/步骤，明确本机无已连接设备不宣称真机通过。
- [x] Step5：提交 `feat: add today and weekly home screen timetable widgets`。

## Task 4：测试包、复核与交付

**Files:** 版本配置、`dist/android-release.json`、下载页、SW版本和包内资产列表/产物测试中确有版本关联的文件；新建 `docs/releases/1.2.0-testing.md`，更新维护交接与项目记忆。

- [x] Step1：将应用名版本／code／文件名／下载metadata统一为1.2.0/code6，检查更新仍指正式站但参数6。构建signed release和androidTest；复制实际APK，计算字节数/hash，旧候选从当前dist移除，正式1.0.1包保留。
- [x] Step2：执行 `pnpm test`、`:app:testDebugUnitTest :app:assembleRelease :app:assembleDebugAndroidTest`；用apksigner/aapt核对原签名、版本及权限。所有通过后不无故重复拓宽测试。
- [ ] Step3：按 requesting-code-review 技能做本次分支变更独立复核，修复有证据的问题并验证；更新已有草稿PR，不合并正式分支。
- [ ] Step4：沿用用户已授权的Cloudflare独立Preview上传公开dist，验证线上metadata、APK实际下载hash和匿名截图，生成测试链接；正式发布等待手机验收。
- [ ] Step5：保存记忆与必要交接，给用户覆盖安装、课表缩放、两个组件添加/调整、编辑刷新/删课清空的简短测试步骤。

## 执行与审批

本计划已经自检映射到全部spec：Task1页面，Task2共同数据，Task3两个组件／添加／刷新，Task4版本／发布／测试边界。用户已选择两个组件，执行方式保留本人直接实施；用户已于2026-10-08批准按此计划继续。
