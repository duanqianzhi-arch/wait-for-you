# 个人课表自动导入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 用户已经要求由当前助手推进；本阶段保留本人直接执行方式，不重新询问执行人。

**Goal:** 安卓登录学校原网页后自动导入整学期课表，提供“我的课表”周视图和本地修改，并在重新同步时保护修正。

**Architecture:** 专用学校 WebView 读取最小课程字段，主包内 WebView 通过精确来源约束的消息通道使用原生课表存储。纯 JavaScript 模块负责时间/周次标准化和差异合并；保存前由原生再次校验结构并原子写入。阶段验收通过前不替换现有公网网站或 APK。

**Tech Stack:** 原生 HTML/CSS/JavaScript，Node + jsdom 26.1.0，Java 17，Android SDK 35，AndroidX WebKit 1.12.1，JUnit/Robolectric，Gradle Wrapper 8.11.1。

**Spec:** [已确认书面设计](../specs/2026-10-08-personal-timetable-design.md)。本计划引用该文档的字段限制、流程和发布条件；必须同时阅读。

## Global Constraints

- 底部为“自习 / 我的课表 / 设置”；顶部品牌、校区切换及现有自习流程保持原样。
- 安卓 minSdk 26、target/compileSdk 35；WebView 102+，包名 `cn.henu.study.waitforclass` 和现有签名不变。
- 首阶段适配河南大学 2026—2027 第一学期，首周周一 `2026-08-31`、18 周、北京时间、现有开封十三节作息。
- 自动读取为主要入口，不要求逐门录入、导出文件；登录和验证码由本人完成，不做后台无人值守同步。
- 无开发者账号代理后台、云课表、通知或桌面组件；不上传个人数据、不保存密码、真实学生 HTML、Cookie 或完整个人 URL 到 Git/日志。
- 主 WebView 保持包内边界，教务浏览器不挂原生 JavaScript 桥；精确 HTTPS 来源 `xk.henu.edu.cn`。
- 总正本 JSON 上限 512 KiB、最多 500 门/2000 条安排；课程名 120、地点 240、备注 1000 字；不识别的格式不能默认全学期。
- 收藏键 `henu-classroom-preferences-v1` 不变；会话清理不能删除包内网页存储。
- 原始学校数据与本地修正分开；写入失败、取消或解析失败保留旧数据。
- 书面计划审阅通过后才编码；执行完成后按真机反馈发布，不提前展示无效入口。

## Review Focus

- 双周或离散周、多段时段：明确周次集合；未知格式提示，不凭网格行号推断。Task 1 的 week/range 测试负责。
- 学校记录和修正同时改变、课表切换账号：冲突需要选择，另一份课表不继承旧修正。Task 4 的 merge/new-table 测试负责。
- 登录后仍在旧框架或读取期间跳转：拒绝错误来源与过期回调，旧课表不变。Task 2 的 navigation-generation 测试负责。
- 半张课表、空课表、缺地点、重复回调：区分未完成与真正无课，不误删旧数据。Task 1、2、3 的 completeness/idempotency 测试负责。
- 清理会话、储存失败、覆盖更新：收藏与已保存修改保留，错误可见。Task 3、5 的 rollback/storage-preservation 测试和真机用例负责。

## 文件与数据接口

| 文件 | 职责 |
| --- | --- |
| `dist/personal-timetable.js` | `window.PersonalTimetable` 与 CommonJS 同一纯逻辑 API：解析、校验、周视图、编辑合并 |
| `dist/henu-schedule-adapter.js` | 随 APK 提供的只读 DOM 提取；只读已确认的本人课表列 |
| `dist/timetable-ui.js` | 周视图、详情、编辑、预览与冲突选择；通过显式接口接入现有 app.js |
| `android/.../TimetableImportPolicy.java` | 精确域名/path/回调代号及 payload 限制 |
| `android/.../TimetableImportActivity.java` | 学校登录、加载、有限重试、原生执行提取及清理 |
| `android/.../TimetableStore.java` | 正本与暂存导入的私有原子文件 IO、验证和删除 |
| `android/.../TimetableController.java` | 包内主框架消息协议与 Activity 结果转发 |
| `test-personal-timetable.cjs` / `test-henu-adapter.cjs` / `test-timetable-ui.cjs` | 匿名虚构数据测试，不进入真实个人课表 |
| `android/.../Timetable*Test.java` | 原生策略、存储、控制器与学校浏览器约束测试 |

Java 根目录简写在各任务中展开为 `android/app/src/main/java/cn/henu/study/waitforclass/`，单元测试根为 `android/app/src/test/java/cn/henu/study/waitforclass/`。

**RawImport**：`{adapterVersion, semester:'2026-2027-1', declaredCourseCount, complete, rows:[{courseText, teachingGroupCode, selectionStatus, scheduleText}]}`。不含学生身份、教师、班级名称、网页参数或 HTML。只有识别到正确页面标题、学期和列头才能设 `complete:true`；分页或未知格式分别反馈状态。

**Timetable**：`{schemaVersion:1, school:'henu', semester:'2026-2027-1', firstMonday:'2026-08-31', maxWeek:18, timezone:'Asia/Shanghai', importedAt, adapterVersion, revision, courses:Course[], overrides:Override[]}`。

**Course**：`{key, code, teachingGroupCode, name, meetings:Meeting[], unscheduled:boolean}`；key 是学期/课程代码/教学组的确定性组合，不用行号和标题作唯一键。

**Meeting**：`{key, day:1..7, weeks:number[], startPeriod:1..13, endPeriod:1..13, location:string}`；key 根据未修改的时段与同课段序确定，缺地点为空字符串，不把容量当空位。

**Override**：`{courseKey, meetingKey:null|string, baseSnapshot, patch}`；patch 只接受已定义的 name/location/note/day/weeks/startPeriod/endPeriod 字段。原始 base 不被编辑覆盖。

**NormalizeResult**：`{ok, timetable:null|Timetable, issues:[{kind,row,segment}], counts:{courses,meetings,missingLocation}}`；未知时间保留为待完善，预览必须显式确认，不能静默丢课。

**消息协议**：包内页面请求 `{id:string,action:'load'|'save'|'import'|'clear',payload?}`，原生回复 `{id,ok,payload?,errorCode?}`；额外事件 `{event:'import-ready',payload:RawImport}`。使用 JSON 序列化，不能把课程文本拼进可执行 JS。最大请求/回复按 spec 限额，ID 最长 64 字、动作白名单。

---

### Task 1: 严格课程解析与周次模型

**Files:** Create `dist/personal-timetable.js`, `test-personal-timetable.cjs`；Modify `package.json` 的测试脚本。

**Interfaces:** Produces `normalizeImport(raw, importedAt):NormalizeResult`、`validateTimetable(value):{ok,errors}`、`coursesForWeek(timetable,week):Array<{course,meeting}>`、`weekForDate(timetable,date):number`。Task 2 输出 RawImport，Task 4 使用这些纯函数。

- [ ] **Step 1: 写业务断言。** 虚构 10 门 13 段样本应得 13 条安排、8 条空地点；连续 `1-18周`、`1-18周(单)`、`2-18周(双)`、离散 `1-4,7,9-12周`、全角括号/空格、单节与多节均验证明确 weeks。无法识别语法返回 issues；时间范围和大小越界拒绝；“未排课”保留 unscheduled；样本课程名含 HTML 标签仍为文本。日期 `2026-10-03` 应第 5 周，第 9/10 周切换课程正确。
- [ ] **Step 2: 执行 `node test-personal-timetable.cjs`，确认因模块或 API 尚未实现失败。** 不把环境缺依赖当预期业务失败。
- [ ] **Step 3: 实现以上 API。** 先按 header 提取后的字段解析，分号分段、周次精确展开并去重，周视图不显示 unscheduled 的虚构时间；有解析问题的课程在 preview 明示。遵守 schema 和十三节/18周配置，不引入其他学校解析器或网络依赖。
- [ ] **Step 4: 执行同一脚本和 `npm test`。** 新业务断言及既有七个脚本均通过；没有真实个人数据。
- [ ] **Step 5: 提交这一个可测试单元。** Commit `feat: add personal timetable parsing and week model`。

### Task 2: 打通最小安卓自动读取

**Files:** Create `dist/henu-schedule-adapter.js`, `test-henu-adapter.cjs`, `android/app/src/main/java/cn/henu/study/waitforclass/TimetableImportPolicy.java`, `TimetableImportActivity.java`（同目录），`android/app/src/test/java/cn/henu/study/waitforclass/TimetableImportPolicyTest.java`, `TimetableImportActivityTest.java`（同目录）；Modify `AndroidManifest.xml`, `android/app/build.gradle`。

**Interfaces:** Adapter produces `HenuScheduleAdapter.extract(rootDocument):RawImport|{errorCode}`。Policy produces `acceptsNavigation(url):boolean`、`acceptsTimetableDocument(url):boolean`、`acceptsResult(startGeneration,currentGeneration,currentUrl,sizeBytes):boolean`。Activity returns pending import token via RESULT_OK after `TimetableStore.stageImport(raw)`（Task 3）；最小探针阶段用内存 callback 验证，不提前装主页面无效按钮。

- [ ] **Step 1: 写匿名 DOM 和原生安全断言。** 表头 12 列/数据行额外 4 隐藏单元格只取目标字段；多框架只读同源、正确报告 path；乱序列仍定位正确；没有列头、重复列头、未完成加载、分页、门数不符、登录页分别失败。`https://xk.henu.edu.cn.evil.example`、userinfo、非443端口、HTTP、file、content 和过期导航回调拒绝；只接受已核验学校页面。
- [ ] **Step 2: 执行 `node test-henu-adapter.cjs` 和安卓 `gradlew.bat :app:testDebugUnitTest --tests '*TimetableImport*Test'`，确认相关断言因待实现 API 失败。**
- [ ] **Step 3: 实现只读适配和独立 Activity。** 首次打开 `/cas/login.action`；确认进入已登录 `/frame/homes.action` 后加载已观察的个人课表入口；不填凭据、不采集登录表单。个人页 onPageFinished 后最多 5 次/总 20 秒识别报告框架；超时允许原生重试。Android 通过 `evaluateJavascript` 回调收最小 JSON，导航代号和 URL 双检查。添加 INTERNET 权限、导入 Activity `exported=false`，禁止 SSL 放行、混合内容与外部页面桥。
- [ ] **Step 4: 执行 adapter 测试、原生上述测试和 `:app:assembleDebug`。** 用本机可用设备进行导入探针：本人学校登录后输出只有门数/安排数，不把原始课程放日志。10/13/8 是已观察样本对照，不硬编码 App 结果；若真机未可用，明确探针未过，继续可测模块但不得发布“已支持自动导入”。
- [ ] **Step 5: 提交自动读取边界单元。** Commit `feat: add native Henu timetable import browser`。先验证这条关键路径再完善 UI，失败须修正实际原因。

### Task 3: 本机正本、消息与会话清理

**Files:** Create `android/app/src/main/java/cn/henu/study/waitforclass/TimetableStore.java`, `TimetableController.java`（同目录）；Create `android/app/src/test/java/cn/henu/study/waitforclass/TimetableStoreTest.java`, `TimetableControllerTest.java`（同目录）；Modify `MainActivity.java`, Task 2 导入 Activity，现有 `android/app/src/main/res/values/ids.xml` 增加导入 WebView ID。

**Interfaces:** Store produces `load():JSONObject|null`, `save(JSONObject):void`, `clear():void`, `stageImport(JSONObject):String`, `consumeStagedImport(String):JSONObject`；AtomicFile 保存 `filesDir/personal-timetable-v1.json`。暂存 raw 在私有 cache、UUID token 取文件，不通过巨型 Intent body 或原始文件路径跨 Activity。Controller consumes上表消息协议，使用 WebViewCompat.addWebMessageListener 的精确包内 origin/main-frame 限制；导入结束把 RawImport 交回页面供 Task 1 解析预览，保存最终规范化 Timetable 时再次严格验证。

- [ ] **Step 1: 写断言。** 首次 null，合法 save/load、clear、格式/版本/超限拒绝、模拟写失败保留旧内容；暂存 token 不接受路径穿越，消费一次/重复回调不重复创建课程，启动清理过期暂存。未知消息动作/来源/子框架/过大 JSON 不读写；schema 中数值为字符串也拒绝。Cookie 清理后 appassets 收藏及偏好保持。
- [ ] **Step 2: 执行 `gradlew.bat :app:testDebugUnitTest --tests '*TimetableStoreTest' --tests '*TimetableControllerTest'` 确认待实现断言失败。**
- [ ] **Step 3: 实现原子存储与最小消息能力。** 不清除原 classroom localStorage；raw暂存限制、正本结构和 UTF-8 字节数验证全部在原生层。清理 Cookie 等待 callback，定向清理已核验学校 origin 的 SQL/local/sessionStorage 与缓存，不调用 WebStorage.deleteAllData。提供下一次导入启动的残留清理，不声称清除所有未知存储。MainActivity 仅增加控制器挂载/导入结果处理，保留现有包外资源阻断。
- [ ] **Step 4: 执行原生全部单元测试与 `node test-native-ui.cjs`。** 旧导航/更新 URL 白名单和包内资产仍通过；SDK mock 不足以证明真实 Cookie 清理，保留 Task 5 设备用例。
- [ ] **Step 5: 提交存储通信单元。** Commit `feat: persist personal timetable with guarded native messages`。

### Task 4: 三导航、周课表、编辑与重新同步

**Files:** Create `dist/timetable-ui.js`, `test-timetable-ui.cjs`；Modify `dist/personal-timetable.js`, `dist/index.html`, `dist/app.js`, `dist/styles.css`, `dist/sw.js`, `android/app/build.gradle` 的 assets 列表、`package.json`。

**Interfaces:** Pure logic adds `applyEdit(timetable,courseKey,meetingKey,patch):Timetable`, `restoreEdit(timetable,courseKey,meetingKey):Timetable`, `prepareSync(previous,next):{draft,conflicts}`, `resolveSync(prepared,choices):Timetable`；`replaceWithNewTable(next)` 不复用 overrides。UI exposes `createTimetableUI({core,native,renderHost,navigate,toast}):{render(route),handleAction(target),handleBack()}`；native wrapper uses StudyTimetableBridge.postMessage 与请求 ID；read-only网页不伪装 native 支持。

- [ ] **Step 1: 写交互和合并断言。** 底部三项当前页 aria-current 正确；顶部 DOM/校区行为不变；课表不被校区筛掉；无数据有有效安卓导入入口；浏览器展示能力说明。周视图/详情/编辑/取消/恢复、跨午夜本周、空地点提示、保存失败可见；输入 `<script>` 显示纯文字。重新同步相同记录不重复、改变地点保留用户修正、移除已修改记录/拆分安排显示冲突、导入新的课表不套旧修正。
- [ ] **Step 2: 执行 `node test-personal-timetable.cjs` / `node test-timetable-ui.cjs`，确认新行为尚未实现而失败。**
- [ ] **Step 3: 实现逻辑与简洁手绘界面。** routes `#timetable`, `#timetable/course/<key>`, `#timetable/import-preview`；nav 对 timetable 子路由独立选中。主 app.js 只处理 shell/生命周期接线，课表模块不挤进巨型模板。临时导入预览须确认才 save，取消仍显示旧课表。App 退出学校页清理 Cookie 后只使用课表正本，预览/编辑不依赖教务会话。已删除的手动文件导入入口不恢复，狗图用于语义装饰并保持可读性。
- [ ] **Step 4: 执行 `npm test`，构建 debug APK，在浏览器查看 390px/宽屏与读屏焦点。** 新脚本进入测试链；校验 Android assets 带上所有新脚本、SW asset 列表/cache版本一致、native back正常。只用匿名数据做 UI 验证，真实课表测试不截图入仓库。
- [ ] **Step 5: 提交可用课表与编辑单元。** Commit `feat: add editable weekly timetable and safe resync`。

### Task 5: 手机验收、同签名升级与发布

**Files:** Modify `android/app/build.gradle`, `MainActivity.java` 更新链接、`dist/app.js` 版本文案、`dist/android-update.html`, `dist/downloads/android-release.json`, `README.md`, `THIRD_PARTY_NOTICES.md`；Create 新版本 APK 和简短发布说明；更新版本断言测试。旧 1.0.1 APK 保留为历史下载，不覆盖原文件名。

**Interfaces:** 所有安装与下载信息统一 `versionName='1.1.0'`、`versionCode=3`，APK 文件名 `dengni-xiake-v1.1.0.apk`。原生更新页参数使用 3，metadata SHA-256/字节数由实际产物计算；这不是组件或提醒版。

- [ ] **Step 1: 在用户安卓手机上验证：** 1.0.1 同签名覆盖 → 收藏仍在 → 本人登录自动导入 → 看周次/空地点 → 修改地点 → 关闭重开 → 同步保护修改 → 取消/断网仍有旧课表 → 退出会话重新登录。当前课程样本以现场数量作对照，变动后以学校最新结果为准。Android 8 或未测机型的清理/登录不得被其他机型结果代替。
- [ ] **Step 2: 若缺少可用设备，交付明确标记测试 APK 与测试步骤，保留发布待验状态；不声称真机通过。** 收到真实验证结果才能发布支持声明。
- [ ] **Step 3: 同步所有 1.1.0 / code3 字段并更新具体版本测试，再运行 `npm test` 与 `gradlew.bat :app:testDebugUnitTest :app:assembleRelease`。** 签名配置只读取仓库外已有私密路径，不输出密码或密钥，不生成替代签名破坏覆盖更新。
- [ ] **Step 4: 检查 APK 实际包名/版本/签名一致、19 个旧 assets 加新脚本正确、联网权限仅 INTERNET；生成 SHA-256 与 metadata，检查版本页/下载入口。** 如采用实际第三方代码，加入完整对应版权/许可；纯参考不虚构依赖。
- [ ] **Step 5: 更新 README 功能/限制/隐私边界及已测设备事实，提交发布变更。** 推送公开仓库和 Cloudflare Pages；真实个人课表与任何签名资料禁止进入部署文件。发布后验证 HTTPS 版本页/metadata/下载哈希与实际文件一致。用户已授权推进开发，沿用本项目发布目标；不得把未通过的阶段发布为完成。

## 自审映射与执行安排

Task 1 覆盖周次/数据校验；Task 2 覆盖学校读取及来源；Task 3 覆盖保存、消息、清理；Task 4 覆盖 UI、编辑/合并；Task 5 覆盖升级与真实验证。所有模块的失败路径保留旧数据；阶段范围不包含后台通知、组件、全校活动或重新制作品牌。

执行方式已保留：当前助手逐任务实现，任务完成后做整体独立审查；不是每个小步骤都请求用户确认。必要的本人登录与手机验收仍需用户完成。当前状态：计划已写并自审，等待书面计划审阅；尚无新产品代码或 APK。
