# 第三方资源说明

本项目自行编写的代码与文档采用根目录 [MIT License](LICENSE)。该许可不替代下列第三方许可，也不向学校课表数据、咖喱狗插画、应用图标或品牌标识授予 MIT 权利；具体范围见 README 的“许可证”一节。

- Rough.js 4.6.6：https://github.com/rough-stuff/rough 。MIT，用于真实表单背后的轻微不规则 SVG 轮廓。完整许可：dist/assets/OFL-RoughJS-MIT.txt。
- 小赖字体 v3.126：https://github.com/lxgw/kose-font 。SIL Open Font License 1.1。仅保留应用、课表名称和通用标点所需字形，并将子集字体名称改为 StudyNoteHand。完整许可：dist/assets/OFL-Xiaolai.txt。
- Wired Elements：https://github.com/rough-stuff/wired-elements 。参考手绘交互外观，未引入该组件库。
- Rough Notation：https://github.com/rough-stuff/rough-notation 。参考克制的手绘标记方法，未引入该库。

字体与 Rough.js 均随应用本地提供，单文件预览嵌入对应许可全文。应用不依赖字体 CDN。
# AndroidX runtime libraries

河南大学个人课表适配参考 [HENU_Assistant](https://github.com/jry21223/HENU_Assistant) 的页面路径与列表提取思路，并通过用户本人登录后的原网页结构核对。本项目的浏览器适配、周次模型与原生保存代码自行编写，未复制该项目实现。参考不作为第三方运行依赖。

AndroidX WebKit1.12.1及其AndroidX运行依赖，Copyright The Android Open Source Project，Apache License2.0。未修改库源代码。完整许可及来源保留在 `dist/assets/LICENSE-AndroidX-Apache-2.0.txt`，同时收入安卓资源包。源码见 https://android.googlesource.com/platform/frameworks/support/ ，许可原文见 https://www.apache.org/licenses/LICENSE-2.0.txt 。
