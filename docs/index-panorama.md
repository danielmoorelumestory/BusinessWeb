# 指数全景（/index-panorama/）

36 只 A 股、港股、美股指数的点位、PE/PB/股息率等历史分位与走势，有首页（`#/panorama`）和详情（`#/index/<代码>`，如 `#/index/000300.SH`），图表带十字参考线，15 只指数有原站 EPS。页面是独立的静态应用（原生 JS + 本地 ECharts），打开时不联网取数，数据全部在 `data-bundle.js` 里。

入口：投资首页「第五步 · 工具与参考」→「指数全景」，地址 `https://businessweb-c0u.pages.dev/index-panorama/`（`/index-panorama` 会 308 到带斜杠的地址）。

## 目录

| 路径 | 内容 | 是否公开 |
|---|---|---|
| `tools/index-panorama/` | 源目录：前端源码、数据管线（`fetch_data.py`、`providers/`、`refresh_runner.py`）、测试、刷新需要的缓存（`data/store`、`data/providers`）、数据口径报告（`reports/`） | 否 |
| `public/index-panorama/` | 发布目录：只有页面运行需要的 10 个文件（`index.html`、3 个 css/js 组、`assets/echarts.min.js` 与许可、`data-bundle.js`） | 是，随站点构建 |
| `scripts/index-panorama-sync.mjs` | 源目录 → 发布目录：白名单复制、数据包校验、拒绝退化；`check` 核对两边一致 | — |
| `.github/workflows/index-panorama.yml` | 工作日定时刷新 | — |

`data-bundle.js` 只在 `public/index-panorama/` 提交一份；源目录里的副本被忽略，刷新前用 `npm run index-panorama:restore` 取回。前端代码改在源目录，再 `npm run index-panorama:publish`；`npm run test:scripts` 里的检查会发现两边不一致。

## 数据刷新

依赖（一次性）：Python 3.12、Node 24。

```bash
python3 -m venv .venv && .venv/bin/pip install -r tools/index-panorama/requirements-ci.txt
.venv/bin/python -m playwright install chromium        # 只有抓原站 EPS 时需要
```

```bash
npm run index-panorama:restore                         # 取回上一版数据包（runner 门禁要和它比较）
.venv/bin/python tools/index-panorama/refresh_runner.py --mode online             # 正式刷新
.venv/bin/python tools/index-panorama/refresh_runner.py --mode online --skip-eps  # 不抓原站 EPS，沿用已提交的 raw
.venv/bin/python tools/index-panorama/refresh_runner.py --mode offline --skip-eps # 不联网演练
npm run index-panorama:publish                         # 校验并发布到 public/index-panorama
npm run index-panorama:check
```

runner 在隔离目录里跑完整流程（腾讯/中证行情 → domestic → supplemental → 原站 EPS → 生成数据包 → 门禁 → 复算审计），通过后才备份并原子替换源目录数据。退出码：0 全部成功；10 部分成功（有来源沿用旧缓存，或跳过了 EPS），已通过门禁；20 失败，数据未改；3 另一次刷新正在进行。报告写在 `tools/index-panorama/reports/refresh/last-refresh.{md,json}`。

不要直接跑在线全量 `fetch_data.py`（会把 50 多列 PE/股息率的选源从 domestic 切到中证），也不要用 `fetch_data.py --collect-providers`（不会保存 domestic.json）。细节见 `tools/index-panorama/reports/remote-refresh-readiness.md`。

测试：`npm run index-panorama:test`（需先装好上面的依赖，`xlrd` 缺失时有一个测试报错）与 `node --test scripts/index-panorama-sync.test.mjs`。

## 定时任务

`.github/workflows/index-panorama.yml`：周一至周五 UTC 12:30（北京时间 20:30），也可手动运行（可选跳过 EPS）。

- 同组 `concurrency` 不并行；`permissions: contents: write`；超时 45 分钟。
- 大且可重新下载的 raw（`domestic_raw` 非 `accum_*`、`supplemental_raw/shiller`）不入库，用 `actions/cache` 保留；缓存未命中时在线重下（本机冷缓存实测约 6.5 分钟）。
- runner 退出 0 或 10 才发布；发布脚本再次校验并拒绝“指数减少、字段末日回退、整列消失”。失败时丢弃全部改动，线上保留上一版。
- 数据包的实际观测和上一版相同（休市、来源没更新）时不提交，不产生部署。
- 提交只包含 runner 的白名单（`--print-commit-paths`）和 `public/index-panorama`。
- 退出 10 记为警告（成功），20/3 或发布失败记为失败；报告写进运行 Summary 并上传为 artifact。

**部署**：工作流用 `GITHUB_TOKEN` 推送到 `main`。这样的推送不会触发别的 GitHub workflow，但 Cloudflare Pages 的 Git 集成照常构建（已核对：`github-actions[bot]` 的数据提交如 `bcbb2258`、`aeacbe76` 都有 Cloudflare Pages 成功检查）。所以不需要 Cloudflare API Token 或 Deploy Hook。部署是否成功，以该提交的 Cloudflare Pages 检查和线上 `/index-panorama/data-bundle.js` 的 `asOf` 为准。

## 数据口径（摘要）

页面里每个字段都标了来源、单位、频率和实际日期，各字段日期独立，不当作同一天。

- PE 主要来自中证官网日频；本地 PE 已核实，不为了对齐原站数字而修改。
- 原站 EPS（李神奇数据网）的计算口径未核实，按周采样（每 5 个交易日取 1 点），与 PE 只并列展示，不互相换算；原站每天的采样网格会平移，runner 用同源整份历史替换并加门禁。
- 原站 EPS 依赖 Playwright 匿名打开原站页面读取。GitHub 美国 IP 能否访问、原站会不会改版，都需要真实运行确认；抓取失败时沿用旧 raw，结果记为部分成功。
- 完整口径见 `tools/index-panorama/README.md` 与 `reports/` 下的口径报告。
