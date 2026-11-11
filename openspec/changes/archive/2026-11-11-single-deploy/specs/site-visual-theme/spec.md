## MODIFIED Requirements

### Requirement: 换肤不改变功能与数据
系统 SHALL 保证换肤不改变任何页面的功能、接口、数据与路由；所有现有自动化测试在更新与新色板相关的断言之后 MUST 通过，且主站构建 `npm run build` 与发布构建 `npm run build:cloudflare` 的产物都能成功构建。

#### Scenario: 功能回归
- **WHEN** 运行前端测试、类型检查与构建
- **THEN** 全部通过，没有功能性测试因换肤而失败

#### Scenario: 两种构建
- **WHEN** 分别运行 `npm run build` 与 `npm run build:cloudflare`
- **THEN** 两者都构建成功
