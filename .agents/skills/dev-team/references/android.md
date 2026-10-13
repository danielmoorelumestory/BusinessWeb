# Android 流程（先读 common.md）

## 阶段与产出
1. **发现**：模块结构、minSdk/targetSdk/compileSdk、AGP/Kotlin/Gradle 版本（取自清单）、UI 技术（Compose/Views/混合）、DI、导航、网络、持久化、测试框架、flavor/buildType、Gradle 任务（读脚本或 CI）。
2. **需求**：用户故事 + 验收标准；屏幕与状态清单；所需权限及系统版本差异；最低系统版本影响；前后台/配置变更/进程被杀下的预期行为；离线与弱网预期。
3. **设计**：导航变更；UiState/Event/Effect 模型；数据流 UI→ViewModel→Repository→数据源；包/模块落位；如需后端则列接口需求。
4. **实现**：数据层 → ViewModel → UI → 资源（strings/themes/drawable）→ Manifest/DI。
5. **自测**：见"验收"。
6. **交付**：按 common.md 报告格式。

## UI：Compose vs Views
- 以项目现状为准：纯 Compose 用 Compose；纯 Views 用 XML+既有绑定方式；混合项目新界面沿用所在模块/邻近界面技术，用 ComposeView/AndroidView 互操作。不为偏好重写既有界面。
- Compose：状态提升，remember 与 rememberSaveable 区分，副作用放 LaunchedEffect/DisposableEffect，关注重组稳定性，生命周期感知地收集 Flow。
- Views：Fragment 用 viewLifecycleOwner，onDestroyView 清 binding，列表用 ListAdapter+DiffUtil。
- 必核场景：深浅色、字体缩放、不同屏幕/折叠、横竖屏、RTL（若项目支持）、TalkBack 内容描述与触控目标。

## 生命周期 / 协程 / 权限
- 状态放 ViewModel；一次性事件用项目既有机制避免重复消费；SavedStateHandle/rememberSaveable 保存轻量状态。订阅与注册成对释放。
- 协程：UI 用 viewModelScope/lifecycleScope，长任务用 WorkManager/Service，不用 GlobalScope；Dispatcher 注入；不吞 CancellationException；Flow 的 stateIn/shareIn 策略明确。
- 权限：最小化；先说明用途再请求；处理拒绝/永久拒绝/仅此次/部分授权并给降级路径与设置入口；注意随系统版本变化的权限（通知、媒体、定位、蓝牙等）。Manifest 是共享文件，单 owner。

## 验收（按能力分级，如实标注）
1. 静态：项目既有 lint/detekt/ktlint/编译（任务名取自发现阶段，选定 variant 并说明）。
2. JVM 单元测试：无需设备。
3. 仪器/UI 测试：需模拟器或真机。
4. 手动场景清单：正常/空/错误/弱网/旋转/权限拒绝/深色/大字体/进程被杀恢复。

**环境限制**：先检查 SDK 路径、JDK 与 Gradle 兼容、wrapper、依赖可达性、`adb devices`。缺 SDK/JDK、无设备、依赖下载失败属环境限制而非代码问题：只完成静态与 JVM 验证，仪器测试与真机行为标"未验证"并给出命令。不自行安装 SDK/镜像或启动模拟器（除非范围含环境搭建）；签名密钥、google-services.json、API key 不生成不提交；Release/R8 问题未构建 release 则标未验证；性能/内存/电量结论需 profiler 数据。

## 所有权与依赖
- UI（屏幕/资源/主题）、数据（repository/Room/网络模型）、构建与清单（gradle/Manifest/proguard/CI，单 owner）。
- 依赖：数据层接口/UiState 约定 → ViewModel → UI 接入（UI 布局可在 UiState 约定后与数据层并行）；Room schema 变更与迁移先于依赖新字段的 UI；依赖版本变更先于使用者。
