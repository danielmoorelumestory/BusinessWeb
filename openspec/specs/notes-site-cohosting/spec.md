# notes-site-cohosting Specification

## Purpose
notes 站点（Astro）的静态产物在主站的 `/note/` 路径下与主站同域托管：构建集成、路径与链接、对主站路由与接口的非干扰、主站导航入口、网格后端保持不变，以及从旧域名迁移时对浏览器本地数据的说明。

## Requirements
### Requirement: notes 站点在 `/note/` 路径下与主站同域托管
系统 SHALL 在 Cloudflare 构建产物的 `dist/note/` 目录下提供 notes 站点的全部静态页面，使其可通过主站域名的 `/note/...` 路径访问，路径与 notes 在 GitHub Pages 上的 `/note` 路径保持一致。

#### Scenario: 访问 notes 首页
- **WHEN** 用户访问主站域名的 `/note/`
- **THEN** 系统返回 notes 的首页，页面样式与脚本加载成功

#### Scenario: 访问 notes 的功能页面
- **WHEN** 用户访问 `/note/notes`、`/note/lab/grid-trading`、`/note/lab/grid-trading/saved`、`/note/lab/grid-trading/minute` 或 `/note/rss.xml`
- **THEN** 系统返回对应的 notes 页面或 RSS，而不是主站的"这一页不存在"页面

#### Scenario: 静态报告可访问
- **WHEN** 用户访问 `/note/reports/` 下已有的 HTML 报告
- **THEN** 系统返回该报告原文

### Requirement: notes 页面内的链接与资源全部落在 `/note/` 下
系统 SHALL 保证 notes 页面里的内部链接与资源（样式、脚本、图标、RSS、报告）都使用 `/note/` 前缀，且这些目标在 `dist/note/` 中真实存在。

#### Scenario: 内部链接不失效
- **WHEN** 对 `dist/note/` 下所有 HTML 页面中以 `/note/` 开头的内部链接与资源引用进行检查
- **THEN** 每一个目标都能在 `dist/note/` 中找到对应文件或目录

#### Scenario: 站点地址随部署环境变化
- **WHEN** 在 Cloudflare Pages 环境中构建 notes
- **THEN** RSS 与规范链接使用当前站点自己的地址，而不是 GitHub Pages 的地址

### Requirement: 复制 notes 站点不得影响主站
系统 SHALL 保证 `/note/` 子树的加入不改变主站现有行为：非 `/note/` 且未匹配静态文件的路径仍回退到主站入口页，未知 `/api/*` 仍返回 404 的 JSON，已有 `/api/*` 接口行为不变。

#### Scenario: 主站路由刷新
- **WHEN** 用户在 `/grid-trading/records` 刷新浏览器
- **THEN** 系统返回主站入口页，并显示主站的网格记录页面

#### Scenario: 未知接口仍为 404
- **WHEN** 客户端请求 `/api/does-not-exist`
- **THEN** 响应状态码为 404，且响应体不是 HTML 页面

#### Scenario: 主站的网格交易页面保持不变
- **WHEN** 用户访问主站的 `/grid-trading`
- **THEN** 系统返回主站现有的网格交易页面，不被 `/note/` 下的同名功能替换

### Requirement: 主站提供进入 notes 的导航入口
系统 SHALL 在主站 Header 中提供指向 `/note/` 的入口，并 MUST 通过触发整页加载的普通链接实现，使请求由静态托管返回真实文件，而不是被前端路由接管。

#### Scenario: 从主站进入 notes
- **WHEN** 用户在主站点击 Header 中指向 notes 的入口
- **THEN** 浏览器整页加载 `/note/`，显示 notes 首页

### Requirement: notes 的网格交易继续使用原有后端
系统 SHALL 保持 notes 网格交易页面对独立 Worker `grid-trading-sync` 的调用方式不变，Worker、D1 数据与定时任务不因本变更被迁移、修改或重新部署。

#### Scenario: 在新域名下回测
- **WHEN** 用户在 `/note/lab/grid-trading` 填写参数并获取历史行情
- **THEN** 页面能完成回测并显示结果

#### Scenario: 用同步密钥恢复已同步的记录
- **WHEN** 用户在新域名的"已保存标的"页填写与旧站点相同的同步密钥并同步
- **THEN** 此前已同步到 D1 的记录出现在新域名下

### Requirement: 搬家前提示本地数据按域名隔离
系统的迁移文档 SHALL 明确说明：notes 的已保存标的与同步密钥存放在浏览器的 `localStorage` 中，按域名隔离，从旧域名迁到新域名后不会自动带过去；只存在本地、从未同步的记录会丢失，因此搬家前必须先在旧站点同步或导出。

#### Scenario: 迁移文档包含搬家前的操作清单
- **WHEN** 使用者阅读迁移文档
- **THEN** 文档列出"先在旧站点同步或导出""新站点填同样的同步密钥再同步"两个步骤，并说明接入自有域名后需要再次做同样的操作
