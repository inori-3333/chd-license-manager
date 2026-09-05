---
version: alpha
name: "持证上岗统计分析系统"
description: "面向持证治理人员的冷色液态玻璃运营工作台，以任务信号和可追溯数据为视觉核心。"
colors:
  primary: "#3978F6"
  canvas: "#EEF4FC"
  surface: "rgba(255, 255, 255, 0.62)"
  ink: "#17243D"
  muted: "#6D7B91"
  danger: "#C43E37"
  warning: "#D89324"
  success: "#159A97"
typography:
  sans:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, SF Pro Display, PingFang SC, Helvetica Neue, sans-serif"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
rounded:
  control: "0.5rem"
  focus-tab: "0.5625rem"
  card: "1.0625rem"
  dialog: "1.375rem"
spacing:
  page-x: "2.125rem"
  section-gap: "1.25rem"
  toolbar: "0.75rem"
components:
  button: {}
  card: {}
  dialog: {}
  focus-tabs: {}
  search-field: {}
  table: {}
---

# 持证上岗统计分析系统 Design System

## Overview

### Creative North Star

界面参考电力集控室中的冷色监控玻璃：环境层有柔和蓝青光，业务层保持清晰、安静、可快速扫读。表达重点是当前任务信号，而不是装饰性说明。

### Product context and register

- **Audience and primary job:** HR、专业部门、基层单位与复核人员，用于定位持证问题、管理规则和推进整改。
- **Target market(s) and evidence:** 中国企业内部管理场景，依据项目中文业务方案、角色和制度材料。
- **Locale(s) and language policy:** `zh-CN`；界面使用简洁的中文名词和动作动词。
- **Usage scene:** 桌面端高频运营为主，同时支持窄屏查询与处理。
- **Register:** 产品型后台；任务清晰度和数据可读性优先。
- **Memorable signature:** 由数量、类别和当前选择组成的“任务信号轨”，在制度、规则、问题等高密度页面复用。
- **Restraint:** 表格、表单、弹窗和制度原文保持稳定几何与高对比度，玻璃效果只用于分层。
- **Anti-references:** 避免营销大屏、装饰性仪表盘和连续说明卡片；它们会分散操作注意力。
- **Token ownership/runtime mapping:** 现有运行时样式 `src/index.css` 为规范值来源，本文件镜像已接受的语义值。共享组件位于 `src/components/ui.tsx`；以 DESIGN lint、静态审计和浏览器计算样式检查漂移。

## Colors

`canvas` 是固定冷色底层；`surface` 用于玻璃卡片；`ink` 与 `muted` 建立两级文字层次。`primary` 只标识当前选择、主动作与焦点。`danger`、`warning`、`success` 保留业务语义，并与文字或图标共同表达状态。

## Typography

正文和控件使用系统无衬线字体并优先 `PingFang SC`，保证中文密度与平台一致性。页面标题使用 24px/660 权重，表格正文约 12.5px，编号使用 `mono`。数字启用等宽数字特性，长制度文本允许自然换行。

## Layout

桌面端保留 252px 侧栏和 68px 顶栏，页面最大宽度 1660px。区块垂直间距为 `section-gap`。高密度页面以“标题 → 任务信号轨与搜索 → 主数据表 → 按需展开内容”为固定顺序。1023px 以下工具栏纵向排列，720px 以下信号轨变为两列；表格保留横向滚动。

## Elevation & Depth

卡片使用半透明白色、细高光边框、24px 背景模糊和低对比阴影。侧栏与顶栏使用更强模糊形成稳定外壳。主数据工作区悬停时保持位置稳定，避免表格整体上浮；交互反馈留给按钮、信号轨和行状态。

## Shapes

控件采用 8–11px 圆角，卡片 17px，弹窗 22px。圆角用于表达可操作区域的边界；状态徽标采用紧凑 5px 圆角，不与主要按钮竞争。

## Components

### Foundational visual states

所有可点击控件具有默认、悬停、键盘焦点、按下和禁用状态。焦点使用 `primary` 的半透明外环。加载与反馈保持原组件尺寸；减少动态偏好下将过渡压缩到近即时。

### Buttons and actions

安全主动作使用蓝色实心按钮，普通动作使用玻璃描边按钮，破坏性确认使用 `danger`。一个决策区域只保留一个明显主动作，图标按钮始终带可访问名称。

### Navigation and data display

侧栏按业务阶段分组。`FocusTabs` 是类别和任务聚焦的共享入口，当前项通过底部信号线、数字颜色和玻璃高光共同表达。数据表使用原生表格语义、分页和独立横向滚动；详情和制度冲突进入弹窗或渐进展开区。

### Forms and overlays

输入与搜索使用半透明表面和明确焦点环。搜索框在有值时提供清空按钮。项目接受原生选择器和日期选择器的系统弹层。模态框锁定背景滚动，支持 Escape、焦点循环和触发点恢复。

### Iconography

统一使用 Lucide 线性图标，常规尺寸 14–20px，约 2px 描边。图标用于强化识别，业务动作保留文字标签。

### Motion

路由进入使用一次 460ms 的淡入、轻微上移和去模糊；控件反馈为 180–240ms。内容列表不使用持续动画。`prefers-reduced-motion` 关闭可感知位移和长过渡。

### Content and data visualization

界面文案以标题、标签、状态、数字和动作构成。删除与当前任务无关的解释性句子，业务依据放入详情层。图表沿用蓝、青、紫语义色，表格或明细提供同一数据的文本路径。

## Do's and Don'ts

- **Do:** 先呈现当前可处理对象及数量，再提供详情和依据。
- **Do:** 在三个以上同类页面复用任务信号轨、搜索和数据工作区。
- **Don't:** 用连续提示、免责声明或重复统计卡片占据主视觉层。
- **Don't:** 为玻璃效果降低文字对比度、隐藏滚动条或移动主数据表。
