## ADDED Requirements

### Requirement: 前端静态站点托管在 Cloudflare Pages
系统 SHALL 将 `npm run build` 产出的 `dist/` 作为静态站点发布到 Cloudflare Pages，构建使用 Node 24。

#### Scenario: 主分支构建并发布
- **WHEN** 主分支有新的提交被推送
- **THEN** Cloudflare Pages 使用 `npm run build` 构建，并发布 `dist/` 的内容

#### Scenario: 首页可访问
- **WHEN** 用户访问自有域名的根路径
- **THEN** 系统返回首页，并且页面资源（脚本、样式、图片）加载成功

### Requirement: SPA 路由直接访问与刷新可用
系统 SHALL 对所有未匹配静态文件且不以 `/api/` 开头的路径返回 `index.html`，使前端路由可直接访问和刷新。

#### Scenario: 刷新深层路由
- **WHEN** 用户在 `/grid-trading/records` 页面刷新浏览器
- **THEN** 系统返回应用入口页，并显示网格记录页面，而不是 404

#### Scenario: 不存在的前端路由
- **WHEN** 用户访问一个前端未定义的路径，例如 `/no-such-page`
- **THEN** 系统返回应用入口页，并由前端渲染"未找到"页面

### Requirement: 未知 API 路径返回 404
系统 SHALL 对以 `/api/` 开头但没有对应接口的请求返回 404 状态码，响应体 MUST NOT 是应用入口页的 HTML。

#### Scenario: 请求不存在的接口
- **WHEN** 客户端请求 `/api/does-not-exist`
- **THEN** 响应状态码为 404，且响应体不是 `index.html`

### Requirement: 过渡期 API 指向现有 Vercel 部署
在 `workers-api-runtime` 中对应接口完成迁移之前，系统 SHALL 使前端对该接口的请求指向现有 Vercel 部署，且 MUST 通过构建期配置切换，不需要修改页面代码。

#### Scenario: 第 1 步上线后接口仍可用
- **WHEN** 前端部署到 Cloudflare Pages，且接口尚未迁移
- **THEN** 前端发起的行情、同步等接口请求能到达 Vercel 并返回与迁移前相同的数据

#### Scenario: 切换接口指向
- **WHEN** 某个接口迁到 Workers 后，修改构建期配置并重新发布
- **THEN** 前端对该接口的请求改由 Workers 处理，无需修改页面代码

### Requirement: 访问地址与 HTTPS
系统 SHALL 通过 Cloudflare 提供的 `*.pages.dev` 地址提供访问，并 MUST 使用 HTTPS；使用者接入自有域名后，系统 SHALL 同样通过该域名以 HTTPS 提供访问。

#### Scenario: 通过 pages.dev 地址访问
- **WHEN** 用户使用 `https://` 访问 `*.pages.dev` 地址
- **THEN** 连接使用有效证书，页面正常加载

#### Scenario: 接入自有域名后访问
- **WHEN** 使用者已将自有域名绑定到 Pages 项目，用户使用 `https://` 访问该域名
- **THEN** 连接使用有效证书，页面正常加载
