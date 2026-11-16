# 指数全景 · ETF 官方映射报告

- 核验快照时间：2026-11-16T13:52:15Z（非实时；重新执行 `fetch`+`build` 才会更新）
- 指数 63 只；有直接跟踪 ETF 的 56 只；tracks 产品 340 条；related_theme 7 条。
- 生成：`python etf_catalog.py fetch --cache <dir> && python etf_catalog.py build --cache <dir>`；离线校验：`python etf_catalog.py validate`、`python -m unittest tests/test_etf_catalog.py`。
- 产出：`data/etf_catalog.json`、`etf-catalog.js`（`window.PANO_ETFS=` 同内容）。不构成投资建议，列表顺序为交易所+代码，与收益无关。

## 方法与证据口径

1. **交易所登记的跟踪指数**（主证据）：上交所 ETF 清单 `query.sse.com.cn` FUND_LIST 的 `INDEX_CODE/INDEX_NAME`；深交所基金子网 ETF 列表 `fund.szse.cn` CATALOGID=1945 的“拟合指数”。清单只含当前挂牌 ETF，已清盘产品自然排除。
2. **指数公司交叉核对**：中证系指数要求中证官网“相关产品”（`/csindex-home/index-list/queryByIndexCode/<code>`）中该产品 fundType=ETF；两者不一致不收。国证/恒生/标普/道琼斯/纳斯达克指数以交易所登记为准（未逐只查招募说明书，见“未验证项”）。
3. 排除：ETF 联接、LOF、普通指数/主动基金、名称含“增强”的增强 ETF、境外上市 ETF。
4. `benchmarkCode` 保留官方原码：中证指数官方为无后缀代码（如本地 `000922.CSI` ↔ 官方 `000922`，`399967.SZ` ↔ `399967`），前端按去后缀比较；别名以条目 `benchmarkAliases` 显式声明：`DJI.US` ↔ 上交所登记 `DJIA`；深交所对中证系宽基登记深市镜像代码 `399300`(沪深300)/`399905`(中证500)/`399903`(中证100)/`399906`(中证800)，产品 benchmarkCode 保留交易所登记原码，且这些产品均经中证官网相关产品在主代码下交叉核对。
5. related_theme 仅人工声明（000994 → 931235 中证电信；399997 → 399987 中证酒；IXIC → NDX 纳斯达克100），不计入直接跟踪。

## 000994.SH 全指通信（优先项）

- 官方全称：中证全指通信服务指数；中证官网相关产品接口返回 `data: []`。
- 上交所 948 只 / 深交所 772 只 ETF 清单中无跟踪代码 000994 的产品。**结论：无已核实的直接跟踪 ETF。**
- 515880 通信ETF国泰 跟踪 931160 中证全指通信设备；515050 通信ETF华夏 跟踪 931079 中证5G通信 —— 均非 000994，已分别归入新增指数 931160/931079 的 tracks。
- 000994 下仅列 related_theme：中证电信 931235 的产品（上交所 INDEX_CODE=931235），relationNote 说明关系。

## 逐指数映射与证据摘要

### 000001.SH 上证指数（基准 000001）
- 两所当前ETF清单中跟踪 000001 的场内ETF共 6 只，均经中证官网相关产品交叉核对。
  - `510140` 上证综指ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 000001 上证综合指数；证据：上交所 INDEX_CODE=000001；中证官网相关产品同列；[上交所ETF基本信息 510140（跟踪指数 000001 上证综合指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510140)
  - `510210` 上证指数ETF富国（SH，富国基金管理有限公司）— 直接跟踪 000001 上证综合指数；证据：上交所 INDEX_CODE=000001；中证官网相关产品同列；[上交所ETF基本信息 510210（跟踪指数 000001 上证综合指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510210)
  - `510760` 上证指数ETF国泰（SH，国泰基金管理有限公司）— 直接跟踪 000001 上证综合指数；证据：上交所 INDEX_CODE=000001；中证官网相关产品同列；[上交所ETF基本信息 510760（跟踪指数 000001 上证综合指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510760)
  - `510910` 上证指数ETF南方（SH，南方基金管理股份有限公司）— 直接跟踪 000001 上证综合指数；证据：上交所 INDEX_CODE=000001；中证官网相关产品同列；[上交所ETF基本信息 510910（跟踪指数 000001 上证综合指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510910)
  - `510980` 上证指数ETF汇添富（SH，汇添富基金管理股份有限公司）— 直接跟踪 000001 上证综合指数；证据：上交所 INDEX_CODE=000001；中证官网相关产品同列；[上交所ETF基本信息 510980（跟踪指数 000001 上证综合指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510980)
  - `530060` 上证指数ETF易方达（SH，易方达基金管理有限公司）— 直接跟踪 000001 上证综合指数；证据：上交所 INDEX_CODE=000001；中证官网相关产品同列；[上交所ETF基本信息 530060（跟踪指数 000001 上证综合指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=530060)

### 399001.SZ 深证成指（基准 399001）
- 两所当前ETF清单中跟踪 399001 的场内ETF共 2 只（非中证编制指数，以交易所登记为准）。
  - `159903` 深成ETF南方（SZ，南方基金管理股份有限公司）— 直接跟踪 399001 深证成指；证据：深交所 拟合指数=399001；[深交所基金子网ETF列表 159903（拟合指数 399001）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159943` 深证成指ETF大成（SZ，大成基金管理有限公司）— 直接跟踪 399001 深证成指；证据：深交所 拟合指数=399001；[深交所基金子网ETF列表 159943（拟合指数 399001）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 399006.SZ 创业板指（基准 399006）
- 两所当前ETF清单中跟踪 399006 的场内ETF共 15 只（非中证编制指数，以交易所登记为准）。
  - `159205` 创业板ETF东财（SZ，东财基金管理有限公司）— 直接跟踪 399006 创业板指；证据：深交所 拟合指数=399006；[深交所基金子网ETF列表 159205（拟合指数 399006）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159247` 创业板ETF汇添富（SZ，汇添富基金管理股份有限公司）— 直接跟踪 399006 创业板指；证据：深交所 拟合指数=399006；[深交所基金子网ETF列表 159247（拟合指数 399006）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159808` 创100ETF融通（SZ，融通基金管理有限公司）— 直接跟踪 399006 创业板指；证据：深交所 拟合指数=399006；[深交所基金子网ETF列表 159808（拟合指数 399006）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159810` 创业板ETF浦银（SZ，浦银基金管理有限公司）— 直接跟踪 399006 创业板指；证据：深交所 拟合指数=399006；[深交所基金子网ETF列表 159810（拟合指数 399006）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159821` 创业板ETF中银证券（SZ，中银国际证券股份有限公司）— 直接跟踪 399006 创业板指；证据：深交所 拟合指数=399006；[深交所基金子网ETF列表 159821（拟合指数 399006）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159908` 创业板ETF博时（SZ，博时基金管理有限公司）— 直接跟踪 399006 创业板指；证据：深交所 拟合指数=399006；[深交所基金子网ETF列表 159908（拟合指数 399006）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159915` 创业板ETF易方达（SZ，易方达基金管理有限公司）— 直接跟踪 399006 创业板指；证据：深交所 拟合指数=399006；[深交所基金子网ETF列表 159915（拟合指数 399006）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159948` 创业板ETF南方（SZ，南方基金管理股份有限公司）— 直接跟踪 399006 创业板指；证据：深交所 拟合指数=399006；[深交所基金子网ETF列表 159948（拟合指数 399006）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159952` 创业板ETF广发（SZ，广发基金管理有限公司）— 直接跟踪 399006 创业板指；证据：深交所 拟合指数=399006；[深交所基金子网ETF列表 159952（拟合指数 399006）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159956` 创业板ETF建信（SZ，建信基金管理有限责任公司）— 直接跟踪 399006 创业板指；证据：深交所 拟合指数=399006；[深交所基金子网ETF列表 159956（拟合指数 399006）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159957` 创业板ETF华夏（SZ，华夏基金管理有限公司）— 直接跟踪 399006 创业板指；证据：深交所 拟合指数=399006；[深交所基金子网ETF列表 159957（拟合指数 399006）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159958` 创业板ETF工银（SZ，工银瑞信基金管理有限公司）— 直接跟踪 399006 创业板指；证据：深交所 拟合指数=399006；[深交所基金子网ETF列表 159958（拟合指数 399006）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159964` 创业板ETF平安（SZ，平安基金管理有限公司）— 直接跟踪 399006 创业板指；证据：深交所 拟合指数=399006；[深交所基金子网ETF列表 159964（拟合指数 399006）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159971` 创业板ETF富国（SZ，富国基金管理有限公司）— 直接跟踪 399006 创业板指；证据：深交所 拟合指数=399006；[深交所基金子网ETF列表 159971（拟合指数 399006）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159977` 创业板ETF天弘（SZ，天弘基金管理有限公司）— 直接跟踪 399006 创业板指；证据：深交所 拟合指数=399006；[深交所基金子网ETF列表 159977（拟合指数 399006）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 000688.SH 科创50（基准 000688）
- 两所当前ETF清单中跟踪 000688 的场内ETF共 17 只，均经中证官网相关产品交叉核对。
  - `588000` 科创50ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 000688 上证科创板50成份指数；证据：上交所 INDEX_CODE=000688；中证官网相关产品同列；[上交所ETF基本信息 588000（跟踪指数 000688 上证科创板50成份指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=588000)
  - `588040` 科创50ETF鹏华（SH，鹏华基金管理有限公司）— 直接跟踪 000688 上证科创板50成份指数；证据：上交所 INDEX_CODE=000688；中证官网相关产品同列；[上交所ETF基本信息 588040（跟踪指数 000688 上证科创板50成份指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=588040)
  - `588050` 科创50ETF工银（SH，工银瑞信基金管理有限公司）— 直接跟踪 000688 上证科创板50成份指数；证据：上交所 INDEX_CODE=000688；中证官网相关产品同列；[上交所ETF基本信息 588050（跟踪指数 000688 上证科创板50成份指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=588050)
  - `588060` 科创50ETF广发（SH，广发基金管理有限公司）— 直接跟踪 000688 上证科创板50成份指数；证据：上交所 INDEX_CODE=000688；中证官网相关产品同列；[上交所ETF基本信息 588060（跟踪指数 000688 上证科创板50成份指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=588060)
  - `588080` 科创50ETF易方达（SH，易方达基金管理有限公司）— 直接跟踪 000688 上证科创板50成份指数；证据：上交所 INDEX_CODE=000688；中证官网相关产品同列；[上交所ETF基本信息 588080（跟踪指数 000688 上证科创板50成份指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=588080)
  - `588090` 科创50ETF华泰柏瑞（SH，华泰柏瑞基金管理有限公司）— 直接跟踪 000688 上证科创板50成份指数；证据：上交所 INDEX_CODE=000688；中证官网相关产品同列；[上交所ETF基本信息 588090（跟踪指数 000688 上证科创板50成份指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=588090)
  - `588150` 科创50ETF南方（SH，南方基金管理股份有限公司）— 直接跟踪 000688 上证科创板50成份指数；证据：上交所 INDEX_CODE=000688；中证官网相关产品同列；[上交所ETF基本信息 588150（跟踪指数 000688 上证科创板50成份指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=588150)
  - `588180` 科创50ETF国联安（SH，国联安基金管理有限公司）— 直接跟踪 000688 上证科创板50成份指数；证据：上交所 INDEX_CODE=000688；中证官网相关产品同列；[上交所ETF基本信息 588180（跟踪指数 000688 上证科创板50成份指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=588180)
  - `588280` 科创50ETF华安（SH，华安基金管理有限公司）— 直接跟踪 000688 上证科创板50成份指数；证据：上交所 INDEX_CODE=000688；中证官网相关产品同列；[上交所ETF基本信息 588280（跟踪指数 000688 上证科创板50成份指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=588280)
  - `588720` 科创50ETF中银（SH，中银基金管理有限公司）— 直接跟踪 000688 上证科创板50成份指数；证据：上交所 INDEX_CODE=000688；中证官网相关产品同列；[上交所ETF基本信息 588720（跟踪指数 000688 上证科创板50成份指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=588720)
  - `588840` 科创50ETF万家（SH，万家基金管理有限公司）— 直接跟踪 000688 上证科创板50成份指数；证据：上交所 INDEX_CODE=000688；中证官网相关产品同列；[上交所ETF基本信息 588840（跟踪指数 000688 上证科创板50成份指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=588840)
  - `588870` 科创50ETF汇添富（SH，汇添富基金管理股份有限公司）— 直接跟踪 000688 上证科创板50成份指数；证据：上交所 INDEX_CODE=000688；中证官网相关产品同列；[上交所ETF基本信息 588870（跟踪指数 000688 上证科创板50成份指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=588870)
  - `588940` 科创50ETF富国（SH，富国基金管理有限公司）— 直接跟踪 000688 上证科创板50成份指数；证据：上交所 INDEX_CODE=000688；中证官网相关产品同列；[上交所ETF基本信息 588940（跟踪指数 000688 上证科创板50成份指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=588940)
  - `588950` 科创50ETF景顺（SH，景顺长城基金管理有限公司）— 直接跟踪 000688 上证科创板50成份指数；证据：上交所 INDEX_CODE=000688；中证官网相关产品同列；[上交所ETF基本信息 588950（跟踪指数 000688 上证科创板50成份指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=588950)
  - `589150` 科创50ETF平安（SH，平安基金管理有限公司）— 直接跟踪 000688 上证科创板50成份指数；证据：上交所 INDEX_CODE=000688；中证官网相关产品同列；[上交所ETF基本信息 589150（跟踪指数 000688 上证科创板50成份指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=589150)
  - `589360` 科创50ETF国泰（SH，国泰基金管理有限公司）— 直接跟踪 000688 上证科创板50成份指数；证据：上交所 INDEX_CODE=000688；中证官网相关产品同列；[上交所ETF基本信息 589360（跟踪指数 000688 上证科创板50成份指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=589360)
  - `589850` 科创50ETF东财（SH，东财基金管理有限公司）— 直接跟踪 000688 上证科创板50成份指数；证据：上交所 INDEX_CODE=000688；中证官网相关产品同列；[上交所ETF基本信息 589850（跟踪指数 000688 上证科创板50成份指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=589850)

### 000016.SH 上证50（基准 000016）
- 两所当前ETF清单中跟踪 000016 的场内ETF共 10 只，均经中证官网相关产品交叉核对。
  - `510050` 上证50ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 000016 上证50指数；证据：上交所 INDEX_CODE=000016；中证官网相关产品同列；[上交所ETF基本信息 510050（跟踪指数 000016 上证50指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510050)
  - `510100` 上证50ETF易方达（SH，易方达基金管理有限公司）— 直接跟踪 000016 上证50指数；证据：上交所 INDEX_CODE=000016；中证官网相关产品同列；[上交所ETF基本信息 510100（跟踪指数 000016 上证50指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510100)
  - `510600` 上证50ETF申万菱信（SH，申万菱信基金管理有限公司）— 直接跟踪 000016 上证50指数；证据：上交所 INDEX_CODE=000016；中证官网相关产品同列；[上交所ETF基本信息 510600（跟踪指数 000016 上证50指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510600)
  - `510680` 上证50ETF万家（SH，万家基金管理有限公司）— 直接跟踪 000016 上证50指数；证据：上交所 INDEX_CODE=000016；中证官网相关产品同列；[上交所ETF基本信息 510680（跟踪指数 000016 上证50指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510680)
  - `510710` 上证50ETF博时（SH，博时基金管理有限公司）— 直接跟踪 000016 上证50指数；证据：上交所 INDEX_CODE=000016；中证官网相关产品同列；[上交所ETF基本信息 510710（跟踪指数 000016 上证50指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510710)
  - `510800` 上证50ETF建信（SH，建信基金管理有限责任公司）— 直接跟踪 000016 上证50指数；证据：上交所 INDEX_CODE=000016；中证官网相关产品同列；[上交所ETF基本信息 510800（跟踪指数 000016 上证50指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510800)
  - `510850` 上证50ETF工银（SH，工银瑞信基金管理有限公司）— 直接跟踪 000016 上证50指数；证据：上交所 INDEX_CODE=000016；中证官网相关产品同列；[上交所ETF基本信息 510850（跟踪指数 000016 上证50指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510850)
  - `510950` 上证50ETF广发（SH，广发基金管理有限公司）— 直接跟踪 000016 上证50指数；证据：上交所 INDEX_CODE=000016；中证官网相关产品同列；[上交所ETF基本信息 510950（跟踪指数 000016 上证50指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510950)
  - `530000` 上证50ETF天弘（SH，天弘基金管理有限公司）— 直接跟踪 000016 上证50指数；证据：上交所 INDEX_CODE=000016；中证官网相关产品同列；[上交所ETF基本信息 530000（跟踪指数 000016 上证50指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=530000)
  - `530050` 上证50ETF东财（SH，东财基金管理有限公司）— 直接跟踪 000016 上证50指数；证据：上交所 INDEX_CODE=000016；中证官网相关产品同列；[上交所ETF基本信息 530050（跟踪指数 000016 上证50指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=530050)

### 000300.SH 沪深300（基准 000300）
- 两所当前ETF清单中跟踪 000300 的场内ETF共 25 只，均经中证官网相关产品交叉核对。
  - `510300` 沪深300ETF华泰柏瑞（SH，华泰柏瑞基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：上交所 INDEX_CODE=000300；中证官网相关产品同列；[上交所ETF基本信息 510300（跟踪指数 000300 沪深300指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510300)
  - `510310` 沪深300ETF易方达（SH，易方达基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：上交所 INDEX_CODE=000300；中证官网相关产品同列；[上交所ETF基本信息 510310（跟踪指数 000300 沪深300指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510310)
  - `510320` 沪深300ETF中金（SH，中金基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：上交所 INDEX_CODE=000300；中证官网相关产品同列；[上交所ETF基本信息 510320（跟踪指数 000300 沪深300指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510320)
  - `510330` 沪深300ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：上交所 INDEX_CODE=000300；中证官网相关产品同列；[上交所ETF基本信息 510330（跟踪指数 000300 沪深300指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510330)
  - `510350` 沪深300ETF工银（SH，工银瑞信基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：上交所 INDEX_CODE=000300；中证官网相关产品同列；[上交所ETF基本信息 510350（跟踪指数 000300 沪深300指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510350)
  - `510360` 沪深300ETF广发（SH，广发基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：上交所 INDEX_CODE=000300；中证官网相关产品同列；[上交所ETF基本信息 510360（跟踪指数 000300 沪深300指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510360)
  - `510370` 沪深300ETF兴业（SH，兴业基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：上交所 INDEX_CODE=000300；中证官网相关产品同列；[上交所ETF基本信息 510370（跟踪指数 000300 沪深300指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510370)
  - `510380` 沪深300ETF国寿（SH，国寿安保基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：上交所 INDEX_CODE=000300；中证官网相关产品同列；[上交所ETF基本信息 510380（跟踪指数 000300 沪深300指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510380)
  - `510390` 沪深300ETF平安（SH，平安基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：上交所 INDEX_CODE=000300；中证官网相关产品同列；[上交所ETF基本信息 510390（跟踪指数 000300 沪深300指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510390)
  - `515130` 沪深300ETF博时（SH，博时基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：上交所 INDEX_CODE=000300；中证官网相关产品同列；[上交所ETF基本信息 515130（跟踪指数 000300 沪深300指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515130)
  - `515310` 沪深300ETF汇添富（SH，汇添富基金管理股份有限公司）— 直接跟踪 000300 沪深300指数；证据：上交所 INDEX_CODE=000300；中证官网相关产品同列；[上交所ETF基本信息 515310（跟踪指数 000300 沪深300指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515310)
  - `515330` 沪深300ETF天弘（SH，天弘基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：上交所 INDEX_CODE=000300；中证官网相关产品同列；[上交所ETF基本信息 515330（跟踪指数 000300 沪深300指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515330)
  - `515350` 沪深300ETF民生加银（SH，民生加银基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：上交所 INDEX_CODE=000300；中证官网相关产品同列；[上交所ETF基本信息 515350（跟踪指数 000300 沪深300指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515350)
  - `515360` 沪深300ETF方正富邦（SH，方正富邦基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：上交所 INDEX_CODE=000300；中证官网相关产品同列；[上交所ETF基本信息 515360（跟踪指数 000300 沪深300指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515360)
  - `515380` 沪深300ETF泰康（SH，泰康基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：上交所 INDEX_CODE=000300；中证官网相关产品同列；[上交所ETF基本信息 515380（跟踪指数 000300 沪深300指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515380)
  - `515390` 沪深300ETF华安（SH，华安基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：上交所 INDEX_CODE=000300；中证官网相关产品同列；[上交所ETF基本信息 515390（跟踪指数 000300 沪深300指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515390)
  - `515660` 沪深300ETF国联安（SH，国联安基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：上交所 INDEX_CODE=000300；中证官网相关产品同列；[上交所ETF基本信息 515660（跟踪指数 000300 沪深300指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515660)
  - `561930` 沪深300ETF招商（SH，招商基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：上交所 INDEX_CODE=000300；中证官网相关产品同列；[上交所ETF基本信息 561930（跟踪指数 000300 沪深300指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=561930)
  - `563520` 沪深300ETF永赢（SH，永赢基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：上交所 INDEX_CODE=000300；中证官网相关产品同列；[上交所ETF基本信息 563520（跟踪指数 000300 沪深300指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=563520)
  - `159300` 沪深300ETF富国（SZ，富国基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：深交所 拟合指数=000300；中证官网相关产品同列；[深交所基金子网ETF列表 159300（拟合指数 000300）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159330` 沪深300ETF东财（SZ，东财基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：深交所 拟合指数=000300；中证官网相关产品同列；[深交所基金子网ETF列表 159330（拟合指数 000300）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159393` 沪深300ETF万家（SZ，万家基金管理有限公司）— 直接跟踪 000300 沪深300指数；证据：深交所 拟合指数=000300；中证官网相关产品同列；[深交所基金子网ETF列表 159393（拟合指数 000300）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159673` 沪深300ETF鹏华（SZ，鹏华基金管理有限公司）— 直接跟踪 399300 沪深300指数；证据：深交所 拟合指数=399300；中证官网相关产品同列；[深交所基金子网ETF列表 159673（拟合指数 399300）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159919` 沪深300ETF嘉实（SZ，嘉实基金管理有限公司）— 直接跟踪 399300 沪深300指数；证据：深交所 拟合指数=399300；中证官网相关产品同列；[深交所基金子网ETF列表 159919（拟合指数 399300）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159925` 沪深300ETF南方（SZ，南方基金管理股份有限公司）— 直接跟踪 399300 沪深300指数；证据：深交所 拟合指数=399300；中证官网相关产品同列；[深交所基金子网ETF列表 159925（拟合指数 399300）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 000905.SH 中证500（基准 000905）
- 两所当前ETF清单中跟踪 000905 的场内ETF共 22 只，均经中证官网相关产品交叉核对。
  - `510500` 中证500ETF南方（SH，南方基金管理股份有限公司）— 直接跟踪 000905 中证小盘500指数；证据：上交所 INDEX_CODE=000905；中证官网相关产品同列；[上交所ETF基本信息 510500（跟踪指数 000905 中证小盘500指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510500)
  - `510510` 中证500ETF广发（SH，广发基金管理有限公司）— 直接跟踪 000905 中证小盘500指数；证据：上交所 INDEX_CODE=000905；中证官网相关产品同列；[上交所ETF基本信息 510510（跟踪指数 000905 中证小盘500指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510510)
  - `510530` 中证500ETF工银（SH，工银瑞信基金管理有限公司）— 直接跟踪 000905 中证小盘500指数；证据：上交所 INDEX_CODE=000905；中证官网相关产品同列；[上交所ETF基本信息 510530（跟踪指数 000905 中证小盘500指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510530)
  - `510550` 中证500ETF方正富邦（SH，方正富邦基金管理有限公司）— 直接跟踪 000905 中证小盘500指数；证据：上交所 INDEX_CODE=000905；中证官网相关产品同列；[上交所ETF基本信息 510550（跟踪指数 000905 中证小盘500指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510550)
  - `510560` 中证500ETF国寿（SH，国寿安保基金管理有限公司）— 直接跟踪 000905 中证小盘500指数；证据：上交所 INDEX_CODE=000905；中证官网相关产品同列；[上交所ETF基本信息 510560（跟踪指数 000905 中证小盘500指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510560)
  - `510570` 中证500ETF兴业（SH，兴业基金管理有限公司）— 直接跟踪 000905 中证小盘500指数；证据：上交所 INDEX_CODE=000905；中证官网相关产品同列；[上交所ETF基本信息 510570（跟踪指数 000905 中证小盘500指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510570)
  - `510580` 中证500ETF易方达（SH，易方达基金管理有限公司）— 直接跟踪 000905 中证小盘500指数；证据：上交所 INDEX_CODE=000905；中证官网相关产品同列；[上交所ETF基本信息 510580（跟踪指数 000905 中证小盘500指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510580)
  - `510590` 中证500ETF平安（SH，平安基金管理有限公司）— 直接跟踪 000905 中证小盘500指数；证据：上交所 INDEX_CODE=000905；中证官网相关产品同列；[上交所ETF基本信息 510590（跟踪指数 000905 中证小盘500指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510590)
  - `512500` 中证500ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 000905 中证小盘500指数；证据：上交所 INDEX_CODE=000905；中证官网相关产品同列；[上交所ETF基本信息 512500（跟踪指数 000905 中证小盘500指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512500)
  - `512510` 中证500ETF华泰柏瑞（SH，华泰柏瑞基金管理有限公司）— 直接跟踪 000905 中证小盘500指数；证据：上交所 INDEX_CODE=000905；中证官网相关产品同列；[上交所ETF基本信息 512510（跟踪指数 000905 中证小盘500指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512510)
  - `515190` 中证500ETF中银证券（SH，中银国际证券股份有限公司）— 直接跟踪 000905 中证小盘500指数；证据：上交所 INDEX_CODE=000905；中证官网相关产品同列；[上交所ETF基本信息 515190（跟踪指数 000905 中证小盘500指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515190)
  - `515530` 中证500ETF泰康（SH，泰康基金管理有限公司）— 直接跟踪 000905 中证小盘500指数；证据：上交所 INDEX_CODE=000905；中证官网相关产品同列；[上交所ETF基本信息 515530（跟踪指数 000905 中证小盘500指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515530)
  - `515550` 中证500ETF国联（SH，国联基金管理有限公司）— 直接跟踪 000905 中证小盘500指数；证据：上交所 INDEX_CODE=000905；中证官网相关产品同列；[上交所ETF基本信息 515550（跟踪指数 000905 中证小盘500指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515550)
  - `561350` 中证500ETF国泰（SH，国泰基金管理有限公司）— 直接跟踪 000905 中证小盘500指数；证据：上交所 INDEX_CODE=000905；中证官网相关产品同列；[上交所ETF基本信息 561350（跟踪指数 000905 中证小盘500指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=561350)
  - `563750` 中证500ETF汇添富（SH，汇添富基金管理股份有限公司）— 直接跟踪 000905 中证小盘500指数；证据：上交所 INDEX_CODE=000905；中证官网相关产品同列；[上交所ETF基本信息 563750（跟踪指数 000905 中证小盘500指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=563750)
  - `159337` 中证500ETF东财（SZ，东财基金管理有限公司）— 直接跟踪 000905 中证小盘500指数；证据：深交所 拟合指数=000905；中证官网相关产品同列；[深交所基金子网ETF列表 159337（拟合指数 000905）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159500` 中证500ETF富国（SZ，富国基金管理有限公司）— 直接跟踪 000905 中证小盘500指数；证据：深交所 拟合指数=000905；中证官网相关产品同列；[深交所基金子网ETF列表 159500（拟合指数 000905）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159820` 中证500ETF天弘（SZ，天弘基金管理有限公司）— 直接跟踪 399905 中证小盘500指数；证据：深交所 拟合指数=399905；中证官网相关产品同列；[深交所基金子网ETF列表 159820（拟合指数 399905）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159922` 中证500ETF嘉实（SZ，嘉实基金管理有限公司）— 直接跟踪 399905 中证小盘500指数；证据：深交所 拟合指数=399905；中证官网相关产品同列；[深交所基金子网ETF列表 159922（拟合指数 399905）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159935` 中证500ETF景顺（SZ，景顺长城基金管理有限公司）— 直接跟踪 000905 中证小盘500指数；证据：深交所 拟合指数=000905；中证官网相关产品同列；[深交所基金子网ETF列表 159935（拟合指数 000905）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159968` 中证500ETF博时（SZ，博时基金管理有限公司）— 直接跟踪 399905 中证小盘500指数；证据：深交所 拟合指数=399905；中证官网相关产品同列；[深交所基金子网ETF列表 159968（拟合指数 399905）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159982` 中证500ETF鹏华（SZ，鹏华基金管理有限公司）— 直接跟踪 399905 中证小盘500指数；证据：深交所 拟合指数=399905；中证官网相关产品同列；[深交所基金子网ETF列表 159982（拟合指数 399905）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 000852.SH 中证1000（基准 000852）
- 两所当前ETF清单中跟踪 000852 的场内ETF共 7 只，均经中证官网相关产品交叉核对。
  - `512100` 中证1000ETF南方（SH，南方基金管理股份有限公司）— 直接跟踪 000852 中证1000指数；证据：上交所 INDEX_CODE=000852；中证官网相关产品同列；[上交所ETF基本信息 512100（跟踪指数 000852 中证1000指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512100)
  - `516300` 中证1000ETF华泰柏瑞（SH，华泰柏瑞基金管理有限公司）— 直接跟踪 000852 中证1000指数；证据：上交所 INDEX_CODE=000852；中证官网相关产品同列；[上交所ETF基本信息 516300（跟踪指数 000852 中证1000指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=516300)
  - `560010` 中证1000ETF广发（SH，广发基金管理有限公司）— 直接跟踪 000852 中证1000指数；证据：上交所 INDEX_CODE=000852；中证官网相关产品同列；[上交所ETF基本信息 560010（跟踪指数 000852 中证1000指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560010)
  - `560110` 中证1000ETF汇添富（SH，汇添富基金管理股份有限公司）— 直接跟踪 000852 中证1000指数；证据：上交所 INDEX_CODE=000852；中证官网相关产品同列；[上交所ETF基本信息 560110（跟踪指数 000852 中证1000指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560110)
  - `159629` 中证1000ETF富国（SZ，富国基金管理有限公司）— 直接跟踪 000852 中证1000指数；证据：深交所 拟合指数=000852；中证官网相关产品同列；[深交所基金子网ETF列表 159629（拟合指数 000852）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159633` 中证1000ETF易方达（SZ，易方达基金管理有限公司）— 直接跟踪 000852 中证1000指数；证据：深交所 拟合指数=000852；中证官网相关产品同列；[深交所基金子网ETF列表 159633（拟合指数 000852）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159845` 中证1000ETF华夏（SZ，华夏基金管理有限公司）— 直接跟踪 000852 中证1000指数；证据：深交所 拟合指数=000852；中证官网相关产品同列；[深交所基金子网ETF列表 159845（拟合指数 000852）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 000903.SH 中证A100（基准 000903）
- 两所当前ETF清单中跟踪 000903 的场内ETF共 13 只，均经中证官网相关产品交叉核对。
  - `512060` A100ETF天弘（SH，天弘基金管理有限公司）— 直接跟踪 000903 中证A100指数；证据：上交所 INDEX_CODE=000903；中证官网相关产品同列；[上交所ETF基本信息 512060（跟踪指数 000903 中证A100指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512060)
  - `512910` A100ETF广发（SH，广发基金管理有限公司）— 直接跟踪 000903 中证A100指数；证据：上交所 INDEX_CODE=000903；中证官网相关产品同列；[上交所ETF基本信息 512910（跟踪指数 000903 中证100指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512910)
  - `560380` A100ETF南方（SH，南方基金管理股份有限公司）— 直接跟踪 000903 中证A100指数；证据：上交所 INDEX_CODE=000903；中证官网相关产品同列；[上交所ETF基本信息 560380（跟踪指数 000903 中证100指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560380)
  - `561180` A100ETF富国（SH，富国基金管理有限公司）— 直接跟踪 000903 中证A100指数；证据：上交所 INDEX_CODE=000903；中证官网相关产品同列；[上交所ETF基本信息 561180（跟踪指数 000903 中证100指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=561180)
  - `561770` A100ETF博时（SH，博时基金管理有限公司）— 直接跟踪 000903 中证A100指数；证据：上交所 INDEX_CODE=000903；中证官网相关产品同列；[上交所ETF基本信息 561770（跟踪指数 000903 中证A100指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=561770)
  - `561880` A100ETF华富（SH，华富基金管理有限公司）— 直接跟踪 000903 中证A100指数；证据：上交所 INDEX_CODE=000903；中证官网相关产品同列；[上交所ETF基本信息 561880（跟踪指数 000903 中证A100指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=561880)
  - `562000` A100ETF华宝（SH，华宝基金管理有限公司）— 直接跟踪 000903 中证A100指数；证据：上交所 INDEX_CODE=000903；中证官网相关产品同列；[上交所ETF基本信息 562000（跟踪指数 000903 中证100指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=562000)
  - `159627` A100ETF华夏（SZ，华夏基金管理有限公司）— 直接跟踪 000903 中证A100指数；证据：深交所 拟合指数=000903；中证官网相关产品同列；[深交所基金子网ETF列表 159627（拟合指数 000903）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159630` A100ETF汇添富（SZ，汇添富基金管理股份有限公司）— 直接跟踪 000903 中证A100指数；证据：深交所 拟合指数=000903；中证官网相关产品同列；[深交所基金子网ETF列表 159630（拟合指数 000903）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159631` A100ETF招商（SZ，招商基金管理有限公司）— 直接跟踪 000903 中证A100指数；证据：深交所 拟合指数=000903；中证官网相关产品同列；[深交所基金子网ETF列表 159631（拟合指数 000903）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159661` A100ETF嘉实（SZ，嘉实基金管理有限公司）— 直接跟踪 000903 中证A100指数；证据：深交所 拟合指数=000903；中证官网相关产品同列；[深交所基金子网ETF列表 159661（拟合指数 000903）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159686` A100ETF易方达（SZ，易方达基金管理有限公司）— 直接跟踪 000903 中证A100指数；证据：深交所 拟合指数=000903；中证官网相关产品同列；[深交所基金子网ETF列表 159686（拟合指数 000903）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159923` 中证A100ETF大成（SZ，大成基金管理有限公司）— 直接跟踪 399903 中证A100指数；证据：深交所 拟合指数=399903；中证官网相关产品同列；[深交所基金子网ETF列表 159923（拟合指数 399903）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 000906.SH 中证800（基准 000906）
- 两所当前ETF清单中跟踪 000906 的场内ETF共 3 只，均经中证官网相关产品交叉核对。
  - `515800` 中证800ETF汇添富（SH，汇添富基金管理股份有限公司）— 直接跟踪 000906 中证800指数；证据：上交所 INDEX_CODE=000906；中证官网相关产品同列；[上交所ETF基本信息 515800（跟踪指数 000906 中证800指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515800)
  - `515810` 中证800ETF易方达（SH，易方达基金管理有限公司）— 直接跟踪 000906 中证800指数；证据：上交所 INDEX_CODE=000906；中证官网相关产品同列；[上交所ETF基本信息 515810（跟踪指数 000906 中证800指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515810)
  - `159800` 中证800ETF鹏华（SZ，鹏华基金管理有限公司）— 直接跟踪 000906 中证800指数；证据：深交所 拟合指数=000906；中证官网相关产品同列；[深交所基金子网ETF列表 159800（拟合指数 000906）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 000985.SH 中证全指（基准 000985）
- 未找到已核实的直接跟踪 000985 的场内ETF（中证官网相关产品与两所清单均无）。

### 399303.SZ 国证2000（基准 399303）
- 两所当前ETF清单中跟踪 399303 的场内ETF共 5 只（非中证编制指数，以交易所登记为准）。
  - `159505` 国证2000ETF博时（SZ，博时基金管理有限公司）— 直接跟踪 399303 国证2000；证据：深交所 拟合指数=399303；[深交所基金子网ETF列表 159505（拟合指数 399303）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159521` 国证2000ETF平安（SZ，平安基金管理有限公司）— 直接跟踪 399303 国证2000；证据：深交所 拟合指数=399303；[深交所基金子网ETF列表 159521（拟合指数 399303）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159543` 国证2000ETF工银（SZ，工银瑞信基金管理有限公司）— 直接跟踪 399303 国证2000；证据：深交所 拟合指数=399303；[深交所基金子网ETF列表 159543（拟合指数 399303）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159628` 国证2000ETF万家（SZ，万家基金管理有限公司）— 直接跟踪 399303 国证2000；证据：深交所 拟合指数=399303；[深交所基金子网ETF列表 159628（拟合指数 399303）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159907` 国证2000ETF广发（SZ，广发基金管理有限公司）— 直接跟踪 399303 国证2000；证据：深交所 拟合指数=399303；[深交所基金子网ETF列表 159907（拟合指数 399303）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 932000.CSI 中证2000（基准 932000）
- 两所当前ETF清单中跟踪 932000 的场内ETF共 10 只，均经中证官网相关产品交叉核对。
  - `560220` 中证2000ETF广发（SH，广发基金管理有限公司）— 直接跟踪 932000 中证2000指数；证据：上交所 INDEX_CODE=932000；中证官网相关产品同列；[上交所ETF基本信息 560220（跟踪指数 932000 中证2000指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560220)
  - `561370` 中证2000ETF国泰（SH，国泰基金管理有限公司）— 直接跟踪 932000 中证2000指数；证据：上交所 INDEX_CODE=932000；中证官网相关产品同列；[上交所ETF基本信息 561370（跟踪指数 932000 中证2000指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=561370)
  - `562660` 中证2000ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 932000 中证2000指数；证据：上交所 INDEX_CODE=932000；中证官网相关产品同列；[上交所ETF基本信息 562660（跟踪指数 932000 中证2000指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=562660)
  - `563200` 中证2000ETF富国（SH，富国基金管理有限公司）— 直接跟踪 932000 中证2000指数；证据：上交所 INDEX_CODE=932000；中证官网相关产品同列；[上交所ETF基本信息 563200（跟踪指数 932000 中证2000指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=563200)
  - `563300` 中证2000ETF华泰柏瑞（SH，华泰柏瑞基金管理有限公司）— 直接跟踪 932000 中证2000指数；证据：上交所 INDEX_CODE=932000；中证官网相关产品同列；[上交所ETF基本信息 563300（跟踪指数 932000 中证2000指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=563300)
  - `159531` 中证2000ETF南方（SZ，南方基金管理股份有限公司）— 直接跟踪 932000 中证2000指数；证据：深交所 拟合指数=932000；中证官网相关产品同列；[深交所基金子网ETF列表 159531（拟合指数 932000）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159532` 中证2000ETF易方达（SZ，易方达基金管理有限公司）— 直接跟踪 932000 中证2000指数；证据：深交所 拟合指数=932000；中证官网相关产品同列；[深交所基金子网ETF列表 159532（拟合指数 932000）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159533` 中证2000ETF博时（SZ，博时基金管理有限公司）— 直接跟踪 932000 中证2000指数；证据：深交所 拟合指数=932000；中证官网相关产品同列；[深交所基金子网ETF列表 159533（拟合指数 932000）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159535` 中证2000ETF嘉实（SZ，嘉实基金管理有限公司）— 直接跟踪 932000 中证2000指数；证据：深交所 拟合指数=932000；中证官网相关产品同列；[深交所基金子网ETF列表 159535（拟合指数 932000）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159536` 中证2000ETF汇添富（SZ，汇添富基金管理股份有限公司）— 直接跟踪 932000 中证2000指数；证据：深交所 拟合指数=932000；中证官网相关产品同列；[深交所基金子网ETF列表 159536（拟合指数 932000）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 000922.CSI 中证红利（基准 000922）
- 两所当前ETF清单中跟踪 000922 的场内ETF共 6 只，均经中证官网相关产品交叉核对。
  - `515080` 中证红利ETF招商（SH，招商基金管理有限公司）— 直接跟踪 000922 中证红利指数；证据：上交所 INDEX_CODE=000922；中证官网相关产品同列；[上交所ETF基本信息 515080（跟踪指数 000922 中证红利指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515080)
  - `515180` 红利ETF易方达（SH，易方达基金管理有限公司）— 直接跟踪 000922 中证红利指数；证据：上交所 INDEX_CODE=000922；中证官网相关产品同列；[上交所ETF基本信息 515180（跟踪指数 000922 中证红利指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515180)
  - `515890` 红利ETF博时（SH，博时基金管理有限公司）— 直接跟踪 000922 中证红利指数；证据：上交所 INDEX_CODE=000922；中证官网相关产品同列；[上交所ETF基本信息 515890（跟踪指数 000922 中证红利指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515890)
  - `560020` 红利ETF汇添富（SH，汇添富基金管理股份有限公司）— 直接跟踪 000922 中证红利指数；证据：上交所 INDEX_CODE=000922；中证官网相关产品同列；[上交所ETF基本信息 560020（跟踪指数 000922 中证红利指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560020)
  - `159581` 红利ETF万家（SZ，万家基金管理有限公司）— 直接跟踪 000922 中证红利指数；证据：深交所 拟合指数=000922；中证官网相关产品同列；[深交所基金子网ETF列表 159581（拟合指数 000922）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159589` 红利ETF广发（SZ，广发基金管理有限公司）— 直接跟踪 000922 中证红利指数；证据：深交所 拟合指数=000922；中证官网相关产品同列；[深交所基金子网ETF列表 159589（拟合指数 000922）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 000932.SH 中证消费（基准 000932）
- 两所当前ETF清单中跟踪 000932 的场内ETF共 5 只，均经中证官网相关产品交叉核对。
  - `512600` 消费ETF嘉实（SH，嘉实基金管理有限公司）— 直接跟踪 000932 中证主要消费指数；证据：上交所 INDEX_CODE=000932；中证官网相关产品同列；[上交所ETF基本信息 512600（跟踪指数 000932 中证主要消费指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512600)
  - `560680` 消费ETF广发（SH，广发基金管理有限公司）— 直接跟踪 000932 中证主要消费指数；证据：上交所 INDEX_CODE=000932；中证官网相关产品同列；[上交所ETF基本信息 560680（跟踪指数 000932 中证主要消费指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560680)
  - `159672` 消费ETF博时（SZ，博时基金管理有限公司）— 直接跟踪 000932 中证主要消费指数；证据：深交所 拟合指数=000932；中证官网相关产品同列；[深交所基金子网ETF列表 159672（拟合指数 000932）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159689` 消费ETF南方（SZ，南方基金管理股份有限公司）— 直接跟踪 000932 中证主要消费指数；证据：深交所 拟合指数=000932；中证官网相关产品同列；[深交所基金子网ETF列表 159689（拟合指数 000932）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159928` 消费ETF汇添富（SZ，汇添富基金管理股份有限公司）— 直接跟踪 000932 中证主要消费指数；证据：深交所 拟合指数=000932；中证官网相关产品同列；[深交所基金子网ETF列表 159928（拟合指数 000932）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 399967.SZ 中证军工（基准 399967）
- 两所当前ETF清单中跟踪 399967 的场内ETF共 4 只，均经中证官网相关产品交叉核对。
  - `512560` 军工ETF易方达（SH，易方达基金管理有限公司）— 直接跟踪 399967 中证军工指数；证据：上交所 INDEX_CODE=399967；中证官网相关产品同列；[上交所ETF基本信息 512560（跟踪指数 399967 中证军工指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512560)
  - `512660` 军工ETF国泰（SH，国泰基金管理有限公司）— 直接跟踪 399967 中证军工指数；证据：上交所 INDEX_CODE=399967；中证官网相关产品同列；[上交所ETF基本信息 512660（跟踪指数 399967 中证军工指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512660)
  - `512680` 军工ETF广发（SH，广发基金管理有限公司）— 直接跟踪 399967 中证军工指数；证据：上交所 INDEX_CODE=399967；中证官网相关产品同列；[上交所ETF基本信息 512680（跟踪指数 399967 中证军工指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512680)
  - `512810` 军工ETF华宝（SH，华宝基金管理有限公司）— 直接跟踪 399967 中证军工指数；证据：上交所 INDEX_CODE=399967；中证官网相关产品同列；[上交所ETF基本信息 512810（跟踪指数 399967 中证军工指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512810)

### 399975.SZ 证券公司（基准 399975）
- 两所当前ETF清单中跟踪 399975 的场内ETF共 17 只，均经中证官网相关产品交叉核对。
  - `512000` 券商ETF华宝（SH，华宝基金管理有限公司）— 直接跟踪 399975 中证全指证券公司指数；证据：上交所 INDEX_CODE=399975；中证官网相关产品同列；[上交所ETF基本信息 512000（跟踪指数 399975 中证全指证券公司指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512000)
  - `512570` 证券ETF易方达（SH，易方达基金管理有限公司）— 直接跟踪 399975 中证全指证券公司指数；证据：上交所 INDEX_CODE=399975；中证官网相关产品同列；[上交所ETF基本信息 512570（跟踪指数 399975 中证全指证券公司指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512570)
  - `512880` 证券ETF国泰（SH，国泰基金管理有限公司）— 直接跟踪 399975 中证全指证券公司指数；证据：上交所 INDEX_CODE=399975；中证官网相关产品同列；[上交所ETF基本信息 512880（跟踪指数 399975 中证全指证券公司指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512880)
  - `512900` 证券ETF南方（SH，南方基金管理股份有限公司）— 直接跟踪 399975 中证全指证券公司指数；证据：上交所 INDEX_CODE=399975；中证官网相关产品同列；[上交所ETF基本信息 512900（跟踪指数 399975 中证全指证券公司指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512900)
  - `515010` 证券ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 399975 中证全指证券公司指数；证据：上交所 INDEX_CODE=399975；中证官网相关产品同列；[上交所ETF基本信息 515010（跟踪指数 399975 中证全指证券公司指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515010)
  - `515560` 证券ETF建信（SH，建信基金管理有限责任公司）— 直接跟踪 399975 中证全指证券公司指数；证据：上交所 INDEX_CODE=399975；中证官网相关产品同列；[上交所ETF基本信息 515560（跟踪指数 399975 中证全指证券公司指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515560)
  - `515850` 证券ETF富国（SH，富国基金管理有限公司）— 直接跟踪 399975 中证全指证券公司指数；证据：上交所 INDEX_CODE=399975；中证官网相关产品同列；[上交所ETF基本信息 515850（跟踪指数 399975 中证全指证券公司指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515850)
  - `516200` 证券ETF华安（SH，华安基金管理有限公司）— 直接跟踪 399975 中证全指证券公司指数；证据：上交所 INDEX_CODE=399975；中证官网相关产品同列；[上交所ETF基本信息 516200（跟踪指数 399975 中证全指证券公司指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=516200)
  - `560090` 证券ETF汇添富（SH，汇添富基金管理股份有限公司）— 直接跟踪 399975 中证全指证券公司指数；证据：上交所 INDEX_CODE=399975；中证官网相关产品同列；[上交所ETF基本信息 560090（跟踪指数 399975 中证全指证券公司指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560090)
  - `560400` 证券ETF华泰柏瑞（SH，华泰柏瑞基金管理有限公司）— 直接跟踪 399975 中证全指证券公司指数；证据：上交所 INDEX_CODE=399975；中证官网相关产品同列；[上交所ETF基本信息 560400（跟踪指数 399975 中证全指证券公司指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560400)
  - `562870` 证券ETF嘉实（SH，嘉实基金管理有限公司）— 直接跟踪 399975 中证全指证券公司指数；证据：上交所 INDEX_CODE=399975；中证官网相关产品同列；[上交所ETF基本信息 562870（跟踪指数 399975 中证全指证券公司指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=562870)
  - `159008` 证券ETF景顺（SZ，景顺长城基金管理有限公司）— 直接跟踪 399975 中证全指证券公司指数；证据：深交所 拟合指数=399975；中证官网相关产品同列；[深交所基金子网ETF列表 159008（拟合指数 399975）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159058` 证券ETF大成（SZ，大成基金管理有限公司）— 直接跟踪 399975 中证全指证券公司指数；证据：深交所 拟合指数=399975；中证官网相关产品同列；[深交所基金子网ETF列表 159058（拟合指数 399975）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159260` 证券ETF博时（SZ，博时基金管理有限公司）— 直接跟踪 399975 中证全指证券公司指数；证据：深交所 拟合指数=399975；中证官网相关产品同列；[深交所基金子网ETF列表 159260（拟合指数 399975）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159841` 证券ETF天弘（SZ，天弘基金管理有限公司）— 直接跟踪 399975 中证全指证券公司指数；证据：深交所 拟合指数=399975；中证官网相关产品同列；[深交所基金子网ETF列表 159841（拟合指数 399975）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159842` 券商ETF银华（SZ，银华基金管理股份有限公司）— 直接跟踪 399975 中证全指证券公司指数；证据：深交所 拟合指数=399975；中证官网相关产品同列；[深交所基金子网ETF列表 159842（拟合指数 399975）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159848` 证券ETF国联安（SZ，国联安基金管理有限公司）— 直接跟踪 399975 中证全指证券公司指数；证据：深交所 拟合指数=399975；中证官网相关产品同列；[深交所基金子网ETF列表 159848（拟合指数 399975）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 399986.SZ 中证银行（基准 399986）
- 两所当前ETF清单中跟踪 399986 的场内ETF共 12 只，均经中证官网相关产品交叉核对。
  - `512410` 银行ETF广发（SH，广发基金管理有限公司）— 直接跟踪 399986 中证银行指数；证据：上交所 INDEX_CODE=399986；中证官网相关产品同列；[上交所ETF基本信息 512410（跟踪指数 399986 中证银行指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512410)
  - `512700` 银行ETF南方（SH，南方基金管理股份有限公司）— 直接跟踪 399986 中证银行指数；证据：上交所 INDEX_CODE=399986；中证官网相关产品同列；[上交所ETF基本信息 512700（跟踪指数 399986 中证银行指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512700)
  - `512730` 银行ETF鹏华（SH，鹏华基金管理有限公司）— 直接跟踪 399986 中证银行指数；证据：上交所 INDEX_CODE=399986；中证官网相关产品同列；[上交所ETF基本信息 512730（跟踪指数 399986 中证银行指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512730)
  - `512800` 银行ETF华宝（SH，华宝基金管理有限公司）— 直接跟踪 399986 中证银行指数；证据：上交所 INDEX_CODE=399986；中证官网相关产品同列；[上交所ETF基本信息 512800（跟踪指数 399986 中证银行指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512800)
  - `512820` 银行ETF汇添富（SH，汇添富基金管理股份有限公司）— 直接跟踪 399986 中证银行指数；证据：上交所 INDEX_CODE=399986；中证官网相关产品同列；[上交所ETF基本信息 512820（跟踪指数 399986 中证银行指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512820)
  - `515020` 银行ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 399986 中证银行指数；证据：上交所 INDEX_CODE=399986；中证官网相关产品同列；[上交所ETF基本信息 515020（跟踪指数 399986 中证银行指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515020)
  - `515290` 银行ETF天弘（SH，天弘基金管理有限公司）— 直接跟踪 399986 中证银行指数；证据：上交所 INDEX_CODE=399986；中证官网相关产品同列；[上交所ETF基本信息 515290（跟踪指数 399986 中证银行指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515290)
  - `516210` 银行ETF华安（SH，华安基金管理有限公司）— 直接跟踪 399986 中证银行指数；证据：上交所 INDEX_CODE=399986；中证官网相关产品同列；[上交所ETF基本信息 516210（跟踪指数 399986 中证银行指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=516210)
  - `516310` 银行ETF易方达（SH，易方达基金管理有限公司）— 直接跟踪 399986 中证银行指数；证据：上交所 INDEX_CODE=399986；中证官网相关产品同列；[上交所ETF基本信息 516310（跟踪指数 399986 中证银行指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=516310)
  - `560670` 银行ETF华泰柏瑞（SH，华泰柏瑞基金管理有限公司）— 直接跟踪 399986 中证银行指数；证据：上交所 INDEX_CODE=399986；中证官网相关产品同列；[上交所ETF基本信息 560670（跟踪指数 399986 中证银行指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560670)
  - `561530` 银行ETF银华（SH，银华基金管理股份有限公司）— 直接跟踪 399986 中证银行指数；证据：上交所 INDEX_CODE=399986；中证官网相关产品同列；[上交所ETF基本信息 561530（跟踪指数 399986 中证银行指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=561530)
  - `159253` 银行ETF博时（SZ，博时基金管理有限公司）— 直接跟踪 399986 中证银行指数；证据：深交所 拟合指数=399986；中证官网相关产品同列；[深交所基金子网ETF列表 159253（拟合指数 399986）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 399971.SZ 中证传媒（基准 399971）
- 两所当前ETF清单中跟踪 399971 的场内ETF共 2 只，均经中证官网相关产品交叉核对。
  - `512980` 传媒ETF广发（SH，广发基金管理有限公司）— 直接跟踪 399971 中证传媒指数；证据：上交所 INDEX_CODE=399971；中证官网相关产品同列；[上交所ETF基本信息 512980（跟踪指数 399971 中证传媒指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512980)
  - `159805` 传媒ETF鹏华（SZ，鹏华基金管理有限公司）— 直接跟踪 399971 中证传媒指数；证据：深交所 拟合指数=399971；中证官网相关产品同列；[深交所基金子网ETF列表 159805（拟合指数 399971）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 000827.SH 中证环保（基准 000827）
- 两所当前ETF清单中跟踪 000827 的场内ETF共 1 只，均经中证官网相关产品交叉核对。
  - `512580` 环保ETF广发（SH，广发基金管理有限公司）— 直接跟踪 000827 中证环保产业指数；证据：上交所 INDEX_CODE=000827；中证官网相关产品同列；[上交所ETF基本信息 512580（跟踪指数 000827 中证环保产业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512580)

### 000986.SH 全指能源（基准 000986）
- 两所当前ETF清单中跟踪 000986 的场内ETF共 1 只，均经中证官网相关产品交叉核对。
  - `159945` 能源ETF广发（SZ，广发基金管理有限公司）— 直接跟踪 000986 中证全指能源指数；证据：深交所 拟合指数=000986；中证官网相关产品同列；[深交所基金子网ETF列表 159945（拟合指数 000986）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 000987.SH 全指材料（基准 000987）
- 两所当前ETF清单中跟踪 000987 的场内ETF共 1 只，均经中证官网相关产品交叉核对。
  - `159944` 材料ETF广发（SZ，广发基金管理有限公司）— 直接跟踪 000987 中证全指原材料指数；证据：深交所 拟合指数=000987；中证官网相关产品同列；[深交所基金子网ETF列表 159944（拟合指数 000987）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 000988.SH 全指工业（基准 000988）
- 未找到已核实的直接跟踪 000988 的场内ETF（中证官网相关产品与两所清单均无）。

### 000989.SH 全指可选（基准 000989）
- 两所当前ETF清单中跟踪 000989 的场内ETF共 2 只，均经中证官网相关产品交叉核对。
  - `562580` 可选消费ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 000989 中证全指可选消费指数；证据：上交所 INDEX_CODE=000989；中证官网相关产品同列；[上交所ETF基本信息 562580（跟踪指数 000989 中证全指可选消费指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=562580)
  - `159936` 可选消费ETF广发（SZ，广发基金管理有限公司）— 直接跟踪 000989 中证全指可选消费指数；证据：深交所 拟合指数=000989；中证官网相关产品同列；[深交所基金子网ETF列表 159936（拟合指数 000989）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 000990.SH 全指消费（基准 000990）
- 未找到已核实的直接跟踪 000990 的场内ETF（中证官网相关产品与两所清单均无）。

### 000991.SH 全指医药（基准 000991）
- 两所当前ETF清单中跟踪 000991 的场内ETF共 1 只，均经中证官网相关产品交叉核对。
  - `159938` 医药ETF广发（SZ，广发基金管理有限公司）— 直接跟踪 000991 中证全指医药卫生指数；证据：深交所 拟合指数=000991；中证官网相关产品同列；[深交所基金子网ETF列表 159938（拟合指数 000991）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 000992.SH 全指金融（基准 000992）
- 两所当前ETF清单中跟踪 000992 的场内ETF共 1 只，均经中证官网相关产品交叉核对。
  - `159940` 金融地产ETF广发（SZ，广发基金管理有限公司）— 直接跟踪 000992 中证全指金融地产指数；证据：深交所 拟合指数=000992；中证官网相关产品同列；[深交所基金子网ETF列表 159940（拟合指数 000992）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 000993.SH 全指信息（基准 000993）
- 两所当前ETF清单中跟踪 000993 的场内ETF共 2 只，均经中证官网相关产品交叉核对。
  - `562560` 信息技术ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 000993 中证全指信息技术指数；证据：上交所 INDEX_CODE=000993；中证官网相关产品同列；[上交所ETF基本信息 562560（跟踪指数 000993 中证全指信息技术指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=562560)
  - `159939` 信息技术ETF广发（SZ，广发基金管理有限公司）— 直接跟踪 000993 中证全指信息技术指数；证据：深交所 拟合指数=000993；中证官网相关产品同列；[深交所基金子网ETF列表 159939（拟合指数 000993）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 000994.SH 全指通信（基准 000994）
- 中证官网相关产品为空，两所 ETF 清单中无跟踪 000994 的产品：无已核实的直接跟踪 ETF。常被当作“通信ETF”的 515880 跟踪 931160 中证全指通信设备、515050 跟踪 931079 中证5G通信，均非本指数；下列仅为主题相关产品。
  - `560300` 电信ETF汇添富（SH，汇添富基金管理股份有限公司）— 主题相关 931235 中证电信主题指数；证据：上交所 INDEX_CODE=931235；[上交所ETF基本信息 560300（跟踪指数 931235 中证电信主题指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560300)；说明：跟踪中证电信主题指数（电信运营/增值服务/通信设备/数据中心等50只），与全指通信服务行业部分重叠，非本指数跟踪产品
  - `560690` 电信ETF鹏华（SH，鹏华基金管理有限公司）— 主题相关 931235 中证电信主题指数；证据：上交所 INDEX_CODE=931235；[上交所ETF基本信息 560690（跟踪指数 931235 中证电信主题指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560690)；说明：跟踪中证电信主题指数（电信运营/增值服务/通信设备/数据中心等50只），与全指通信服务行业部分重叠，非本指数跟踪产品
  - `563010` 电信ETF易方达（SH，易方达基金管理有限公司）— 主题相关 931235 中证电信主题指数；证据：上交所 INDEX_CODE=931235；[上交所ETF基本信息 563010（跟踪指数 931235 中证电信主题指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=563010)；说明：跟踪中证电信主题指数（电信运营/增值服务/通信设备/数据中心等50只），与全指通信服务行业部分重叠，非本指数跟踪产品

### 000995.SH 全指公用（基准 000995）
- 两所当前ETF清单中跟踪 000995 的场内ETF共 4 只，均经中证官网相关产品交叉核对。
  - `560190` 公用事业ETF鹏华（SH，鹏华基金管理有限公司）— 直接跟踪 000995 中证全指公用事业指数；证据：上交所 INDEX_CODE=000995；中证官网相关产品同列；[上交所ETF基本信息 560190（跟踪指数 000995 中证全指公用事业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560190)
  - `560620` 公用事业ETF万家（SH，万家基金管理有限公司）— 直接跟踪 000995 中证全指公用事业指数；证据：上交所 INDEX_CODE=000995；中证官网相关产品同列；[上交所ETF基本信息 560620（跟踪指数 000995 中证全指公用事业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560620)
  - `159159` 公用事业ETF国投瑞银（SZ，国投瑞银基金管理有限公司）— 直接跟踪 000995 中证全指公用事业指数；证据：深交所 拟合指数=000995；中证官网相关产品同列；[深交所基金子网ETF列表 159159（拟合指数 000995）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159301` 公用事业ETF华夏（SZ，华夏基金管理有限公司）— 直接跟踪 000995 中证全指公用事业指数；证据：深交所 拟合指数=000995；中证官网相关产品同列；[深交所基金子网ETF列表 159301（拟合指数 000995）](https://fund.szse.cn/marketdata/fundslist/index.html)

### HSI.HK 恒生指数（基准 HSI）
- 两所当前ETF清单中跟踪 HSI 的场内ETF共 5 只（非中证编制指数，以交易所登记为准）。
  - `513210` 恒生ETF易方达（SH，易方达基金管理有限公司）— 直接跟踪 HSI 恒生指数；证据：上交所 INDEX_CODE=HSI；[上交所ETF基本信息 513210（跟踪指数 HSI 恒生指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=513210)
  - `513600` 恒生指数ETF南方（SH，南方基金管理股份有限公司）— 直接跟踪 HSI 恒生指数；证据：上交所 INDEX_CODE=HSI；[上交所ETF基本信息 513600（跟踪指数 HSI 恒生指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=513600)
  - `513660` 恒生ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 HSI 恒生指数；证据：上交所 INDEX_CODE=HSI；[上交所ETF基本信息 513660（跟踪指数 HSI 恒生指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=513660)
  - `159271` 恒生ETF鹏华（SZ，鹏华基金管理有限公司）— 直接跟踪 HSI 恒生指数；证据：深交所 拟合指数=HSI；[深交所基金子网ETF列表 159271（拟合指数 HSI）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159920` 恒生ETF华夏（SZ，华夏基金管理有限公司）— 直接跟踪 HSI 恒生指数；证据：深交所 拟合指数=HSI；[深交所基金子网ETF列表 159920（拟合指数 HSI）](https://fund.szse.cn/marketdata/fundslist/index.html)

### HSTECH.HK 恒生科技（基准 HSTECH）
- 两所当前ETF清单中跟踪 HSTECH 的场内ETF共 14 只（非中证编制指数，以交易所登记为准）。
  - `513010` 恒生科技ETF易方达（SH，易方达基金管理有限公司）— 直接跟踪 HSTECH 恒生科技指数；证据：上交所 INDEX_CODE=HSTECH；[上交所ETF基本信息 513010（跟踪指数 HSTECH 恒生科技指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=513010)
  - `513130` 恒生科技ETF华泰柏瑞（SH，华泰柏瑞基金管理有限公司）— 直接跟踪 HSTECH 恒生科技指数；证据：上交所 INDEX_CODE=HSTECH；[上交所ETF基本信息 513130（跟踪指数 HSTECH 恒生科技指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=513130)
  - `513180` 恒生科技ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 HSTECH 恒生科技指数；证据：上交所 INDEX_CODE=HSTECH；[上交所ETF基本信息 513180（跟踪指数 HSTECH 恒生科技指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=513180)
  - `513260` 恒生科技ETF汇添富（SH，汇添富基金管理股份有限公司）— 直接跟踪 HSTECH 恒生科技指数；证据：上交所 INDEX_CODE=HSTECH；[上交所ETF基本信息 513260（跟踪指数 HSTECH 恒生科技指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=513260)
  - `513380` 恒生科技ETF广发（SH，广发基金管理有限公司）— 直接跟踪 HSTECH 恒生科技指数；证据：上交所 INDEX_CODE=HSTECH；[上交所ETF基本信息 513380（跟踪指数 HSTECH 恒生科技指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=513380)
  - `513580` 恒生科技ETF华安（SH，华安基金管理有限公司）— 直接跟踪 HSTECH 恒生科技指数；证据：上交所 INDEX_CODE=HSTECH；[上交所ETF基本信息 513580（跟踪指数 HSTECH 恒生科技指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=513580)
  - `513890` 恒生科技ETF摩根（SH，摩根基金管理（中国）有限公司）— 直接跟踪 HSTECH 恒生科技指数；证据：上交所 INDEX_CODE=HSTECH；[上交所ETF基本信息 513890（跟踪指数 HSTECH 恒生科技指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=513890)
  - `520570` 恒生科技ETF南方（SH，南方基金管理股份有限公司）— 直接跟踪 HSTECH 恒生科技指数；证据：上交所 INDEX_CODE=HSTECH；[上交所ETF基本信息 520570（跟踪指数 HSTECH 恒生科技指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=520570)
  - `520590` 恒生科技ETF鹏华（SH，鹏华基金管理有限公司）— 直接跟踪 HSTECH 恒生科技指数；证据：上交所 INDEX_CODE=HSTECH；[上交所ETF基本信息 520590（跟踪指数 HSTECH 恒生科技指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=520590)
  - `520920` 恒生科技ETF天弘（SH，天弘基金管理有限公司）— 直接跟踪 HSTECH 恒生科技指数；证据：上交所 INDEX_CODE=HSTECH；[上交所ETF基本信息 520920（跟踪指数 HSTECH 恒生科技指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=520920)
  - `158042` 恒生科技ETF富国（SZ，富国基金管理有限公司）— 直接跟踪 HSTECH 恒生科技指数；证据：深交所 拟合指数=HSTECH；[深交所基金子网ETF列表 158042（拟合指数 HSTECH）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159740` 恒生科技ETF大成（SZ，大成基金管理有限公司）— 直接跟踪 HSTECH 恒生科技指数；证据：深交所 拟合指数=HSTECH；[深交所基金子网ETF列表 159740（拟合指数 HSTECH）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159741` 恒生科技ETF嘉实（SZ，嘉实基金管理有限公司）— 直接跟踪 HSTECH 恒生科技指数；证据：深交所 拟合指数=HSTECH；[深交所基金子网ETF列表 159741（拟合指数 HSTECH）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159742` 恒生科技ETF博时（SZ，博时基金管理有限公司）— 直接跟踪 HSTECH 恒生科技指数；证据：深交所 拟合指数=HSTECH；[深交所基金子网ETF列表 159742（拟合指数 HSTECH）](https://fund.szse.cn/marketdata/fundslist/index.html)

### HSCEI.HK 恒生国企（基准 HSCEI）
- 两所当前ETF清单中跟踪 HSCEI 的场内ETF共 4 只（非中证编制指数，以交易所登记为准）。
  - `510900` 恒生中国企业ETF易方达（SH，易方达基金管理有限公司）— 直接跟踪 HSCEI 恒生中国企业指数；证据：上交所 INDEX_CODE=HSCEI；[上交所ETF基本信息 510900（跟踪指数 HSCEI 恒生中国企业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=510900)
  - `159850` 恒生国企ETF华夏（SZ，华夏基金管理有限公司）— 直接跟踪 HSCEI 恒生中国企业指数；证据：深交所 拟合指数=HSCEI；[深交所基金子网ETF列表 159850（拟合指数 HSCEI）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159954` 恒生中国企业ETF南方（SZ，南方基金管理股份有限公司）— 直接跟踪 HSCEI 恒生中国企业指数；证据：深交所 拟合指数=HSCEI；[深交所基金子网ETF列表 159954（拟合指数 HSCEI）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159960` 恒生中国企业ETF平安（SZ，平安基金管理有限公司）— 直接跟踪 HSCEI 恒生中国企业指数；证据：深交所 拟合指数=HSCEI；[深交所基金子网ETF列表 159960（拟合指数 HSCEI）](https://fund.szse.cn/marketdata/fundslist/index.html)

### SPX.US 标普500（基准 SPX）
- 两所当前ETF清单中跟踪 SPX 的场内ETF共 2 只（非中证编制指数，以交易所登记为准）。
  - `513500` 标普500ETF博时（SH，博时基金管理有限公司）— 直接跟踪 SPX 标准普尔500指数；证据：上交所 INDEX_CODE=SPX；[上交所ETF基本信息 513500（跟踪指数 SPX 标准普尔500指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=513500)
  - `513650` 标普500ETF南方（SH，南方基金管理股份有限公司）— 直接跟踪 SPX 标准普尔500指数；证据：上交所 INDEX_CODE=SPX；[上交所ETF基本信息 513650（跟踪指数 SPX 标普500指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=513650)

### IXIC.US 纳斯达克综指（基准 IXIC）
- 两所 ETF 清单中无跟踪纳斯达克综合指数的产品；“纳指ETF”跟踪的是纳斯达克100（NDX），仅作主题相关列示。
  - `513100` 纳指ETF国泰（SH，国泰基金管理有限公司）— 主题相关 NDX 纳斯达克100指数；证据：上交所 INDEX_CODE=NDX；[上交所ETF基本信息 513100（跟踪指数 NDX 纳斯达克100指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=513100)；说明：跟踪纳斯达克100指数（纳斯达克综指中市值最大的约100只非金融股），非综指跟踪产品
  - `513110` 纳指ETF华泰柏瑞（SH，华泰柏瑞基金管理有限公司）— 主题相关 NDX 纳斯达克100指数；证据：上交所 INDEX_CODE=NDX；[上交所ETF基本信息 513110（跟踪指数 NDX 纳斯达克100指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=513110)；说明：跟踪纳斯达克100指数（纳斯达克综指中市值最大的约100只非金融股），非综指跟踪产品
  - `513300` 纳斯达克ETF华夏（SH，华夏基金管理有限公司）— 主题相关 NDX 纳斯达克100指数；证据：上交所 INDEX_CODE=NDX；[上交所ETF基本信息 513300（跟踪指数 NDX 纳斯达克100指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=513300)；说明：跟踪纳斯达克100指数（纳斯达克综指中市值最大的约100只非金融股），非综指跟踪产品

### DJI.US 道琼斯工业（基准 DJIA）
- 本地代码 DJI 与上交所登记的 DJIA 为同一指数（道琼斯工业平均指数），在 benchmarkAliases 中显式声明。
  - `513400` 道琼斯ETF鹏华（SH，鹏华基金管理有限公司）— 直接跟踪 DJIA 道琼斯工业平均指数；证据：上交所 INDEX_CODE=DJIA；[上交所ETF基本信息 513400（跟踪指数 DJIA 道琼斯工业平均指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=513400)

### H30184.CSI 全指半导体（基准 H30184）
- 两所当前ETF清单中跟踪 H30184 的场内ETF共 1 只，均经中证官网相关产品交叉核对。
  - `512480` 半导体ETF国联安（SH，国联安基金管理有限公司）— 直接跟踪 H30184 中证全指半导体产品与设备指数；证据：上交所 INDEX_CODE=H30184；中证官网相关产品同列；[上交所ETF基本信息 512480（跟踪指数 H30184 中证全指半导体产品与设备指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512480)

### H30202.CSI 全指软件（基准 H30202）
- 两所当前ETF清单中跟踪 H30202 的场内ETF共 4 只，均经中证官网相关产品交叉核对。
  - `515230` 软件ETF国泰（SH，国泰基金管理有限公司）— 直接跟踪 H30202 中证全指软件指数；证据：上交所 INDEX_CODE=H30202；中证官网相关产品同列；[上交所ETF基本信息 515230（跟踪指数 H30202 中证全指软件指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515230)
  - `159068` 软件ETF华夏（SZ，华夏基金管理有限公司）— 直接跟踪 H30202 中证全指软件指数；证据：深交所 拟合指数=H30202；中证官网相关产品同列；[深交所基金子网ETF列表 159068（拟合指数 H30202）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159590` 软件ETF汇添富（SZ，汇添富基金管理股份有限公司）— 直接跟踪 H30202 中证全指软件指数；证据：深交所 拟合指数=H30202；中证官网相关产品同列；[深交所基金子网ETF列表 159590（拟合指数 H30202）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159899` 软件ETF招商（SZ，招商基金管理有限公司）— 直接跟踪 H30202 中证全指软件指数；证据：深交所 拟合指数=H30202；中证官网相关产品同列；[深交所基金子网ETF列表 159899（拟合指数 H30202）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 931160.CSI 全指通信设备（基准 931160）
- 两所当前ETF清单中跟踪 931160 的场内ETF共 1 只，均经中证官网相关产品交叉核对。
  - `515880` 通信ETF国泰（SH，国泰基金管理有限公司）— 直接跟踪 931160 中证全指通信设备指数；证据：上交所 INDEX_CODE=931160；中证官网相关产品同列；[上交所ETF基本信息 515880（跟踪指数 931160 中证全指通信设备指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515880)

### 931775.CSI 全指房地产（基准 931775）
- 两所当前ETF清单中跟踪 931775 的场内ETF共 2 只，均经中证官网相关产品交叉核对。
  - `512200` 房地产ETF南方（SH，南方基金管理股份有限公司）— 直接跟踪 931775 中证全指房地产指数；证据：上交所 INDEX_CODE=931775；中证官网相关产品同列；[上交所ETF基本信息 512200（跟踪指数 931775 中证全指房地产指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512200)
  - `515060` 房地产ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 931775 中证全指房地产指数；证据：上交所 INDEX_CODE=931775；中证官网相关产品同列；[上交所ETF基本信息 515060（跟踪指数 931775 中证全指房地产指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515060)

### 930697.CSI 全指家电（基准 930697）
- 两所当前ETF清单中跟踪 930697 的场内ETF共 6 只，均经中证官网相关产品交叉核对。
  - `515640` 家电ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 930697 中证全指家用电器指数；证据：上交所 INDEX_CODE=930697；中证官网相关产品同列；[上交所ETF基本信息 515640（跟踪指数 930697 中证全指家用电器指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515640)
  - `560880` 家电ETF广发（SH，广发基金管理有限公司）— 直接跟踪 930697 中证全指家用电器指数；证据：上交所 INDEX_CODE=930697；中证官网相关产品同列；[上交所ETF基本信息 560880（跟踪指数 930697 中证全指家用电器指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560880)
  - `561120` 家电ETF富国（SH，富国基金管理有限公司）— 直接跟踪 930697 中证全指家用电器指数；证据：上交所 INDEX_CODE=930697；中证官网相关产品同列；[上交所ETF基本信息 561120（跟踪指数 930697 中证全指家用电器指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=561120)
  - `159176` 家电ETF华宝（SZ，华宝基金管理有限公司）— 直接跟踪 930697 中证全指家用电器指数；证据：深交所 拟合指数=930697；中证官网相关产品同列；[深交所基金子网ETF列表 159176（拟合指数 930697）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159182` 家电ETF南方（SZ，南方基金管理股份有限公司）— 直接跟踪 930697 中证全指家用电器指数；证据：深交所 拟合指数=930697；中证官网相关产品同列；[深交所基金子网ETF列表 159182（拟合指数 930697）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159996` 家电ETF国泰（SZ，国泰基金管理有限公司）— 直接跟踪 930697 中证全指家用电器指数；证据：深交所 拟合指数=930697；中证官网相关产品同列；[深交所基金子网ETF列表 159996（拟合指数 930697）](https://fund.szse.cn/marketdata/fundslist/index.html)

### H30199.CSI 全指电力（基准 H30199）
- 两所当前ETF清单中跟踪 H30199 的场内ETF共 16 只，均经中证官网相关产品交叉核对。
  - `512140` 电力ETF华安（SH，华安基金管理有限公司）— 直接跟踪 H30199 中证全指电力公用事业指数；证据：上交所 INDEX_CODE=H30199；中证官网相关产品同列；[上交所ETF基本信息 512140（跟踪指数 H30199 中证全指电力公用事业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512140)
  - `516370` 电力ETF汇添富（SH，汇添富基金管理股份有限公司）— 直接跟踪 H30199 中证全指电力公用事业指数；证据：上交所 INDEX_CODE=H30199；中证官网相关产品同列；[上交所ETF基本信息 516370（跟踪指数 H30199 中证全指电力公用事业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=516370)
  - `560270` 电力ETF工银（SH，工银瑞信基金管理有限公司）— 直接跟踪 H30199 中证全指电力公用事业指数；证据：上交所 INDEX_CODE=H30199；中证官网相关产品同列；[上交所ETF基本信息 560270（跟踪指数 H30199 中证全指电力公用事业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560270)
  - `560450` 电力ETF天弘（SH，天弘基金管理有限公司）— 直接跟踪 H30199 中证全指电力公用事业指数；证据：上交所 INDEX_CODE=H30199；中证官网相关产品同列；[上交所ETF基本信息 560450（跟踪指数 H30199 中证全指电力公用事业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560450)
  - `560460` 电力ETF平安（SH，平安基金管理有限公司）— 直接跟踪 H30199 中证全指电力公用事业指数；证据：上交所 INDEX_CODE=H30199；中证官网相关产品同列；[上交所ETF基本信息 560460（跟踪指数 H30199 中证全指电力公用事业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560460)
  - `560480` 电力ETF招商（SH，招商基金管理有限公司）— 直接跟踪 H30199 中证全指电力公用事业指数；证据：上交所 INDEX_CODE=H30199；中证官网相关产品同列；[上交所ETF基本信息 560480（跟踪指数 H30199 中证全指电力公用事业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560480)
  - `560580` 电力ETF南方（SH，南方基金管理股份有限公司）— 直接跟踪 H30199 中证全指电力公用事业指数；证据：上交所 INDEX_CODE=H30199；中证官网相关产品同列；[上交所ETF基本信息 560580（跟踪指数 H30199 中证全指电力公用事业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560580)
  - `560830` 电力ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 H30199 中证全指电力公用事业指数；证据：上交所 INDEX_CODE=H30199；中证官网相关产品同列；[上交所ETF基本信息 560830（跟踪指数 H30199 中证全指电力公用事业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560830)
  - `560930` 电力ETF易方达（SH，易方达基金管理有限公司）— 直接跟踪 H30199 中证全指电力公用事业指数；证据：上交所 INDEX_CODE=H30199；中证官网相关产品同列；[上交所ETF基本信息 560930（跟踪指数 H30199 中证全指电力公用事业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560930)
  - `561560` 电力ETF华泰柏瑞（SH，华泰柏瑞基金管理有限公司）— 直接跟踪 H30199 中证全指电力公用事业指数；证据：上交所 INDEX_CODE=H30199；中证官网相关产品同列；[上交所ETF基本信息 561560（跟踪指数 H30199 中证全指电力公用事业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=561560)
  - `561700` 电力ETF博时（SH，博时基金管理有限公司）— 直接跟踪 H30199 中证全指电力公用事业指数；证据：上交所 INDEX_CODE=H30199；中证官网相关产品同列；[上交所ETF基本信息 561700（跟踪指数 H30199 中证全指电力公用事业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=561700)
  - `562350` 电力ETF银华（SH，银华基金管理股份有限公司）— 直接跟踪 H30199 中证全指电力公用事业指数；证据：上交所 INDEX_CODE=H30199；中证官网相关产品同列；[上交所ETF基本信息 562350（跟踪指数 H30199 中证全指电力公用事业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=562350)
  - `159059` 电力ETF大成（SZ，大成基金管理有限公司）— 直接跟踪 H30199 中证全指电力公用事业指数；证据：深交所 拟合指数=H30199；中证官网相关产品同列；[深交所基金子网ETF列表 159059（拟合指数 H30199）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159146` 电力ETF华宝（SZ，华宝基金管理有限公司）— 直接跟踪 H30199 中证全指电力公用事业指数；证据：深交所 拟合指数=H30199；中证官网相关产品同列；[深交所基金子网ETF列表 159146（拟合指数 H30199）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159158` 电力ETF景顺（SZ，景顺长城基金管理有限公司）— 直接跟踪 H30199 中证全指电力公用事业指数；证据：深交所 拟合指数=H30199；中证官网相关产品同列；[深交所基金子网ETF列表 159158（拟合指数 H30199）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159611` 电力ETF广发（SZ，广发基金管理有限公司）— 直接跟踪 H30199 中证全指电力公用事业指数；证据：深交所 拟合指数=H30199；中证官网相关产品同列；[深交所基金子网ETF列表 159611（拟合指数 H30199）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 990001.CSI 中华半导体芯片（基准 990001）
- 两所当前ETF清单中跟踪 990001 的场内ETF共 1 只，均经中证官网相关产品交叉核对。
  - `512760` 芯片ETF国泰（SH，国泰基金管理有限公司）— 直接跟踪 990001 中华交易服务半导体芯片行业指数；证据：上交所 INDEX_CODE=990001；中证官网相关产品同列；[上交所ETF基本信息 512760（跟踪指数 990001 中华交易服务半导体芯片行业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512760)

### 930651.CSI 中证计算机（基准 930651）
- 两所当前ETF清单中跟踪 930651 的场内ETF共 2 只，均经中证官网相关产品交叉核对。
  - `512720` 计算机ETF国泰（SH，国泰基金管理有限公司）— 直接跟踪 930651 中证计算机主题指数；证据：上交所 INDEX_CODE=930651；中证官网相关产品同列；[上交所ETF基本信息 512720（跟踪指数 930651 中证计算机主题指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512720)
  - `159998` 计算机ETF天弘（SZ，天弘基金管理有限公司）— 直接跟踪 930651 中证计算机主题指数；证据：深交所 拟合指数=930651；中证官网相关产品同列；[深交所基金子网ETF列表 159998（拟合指数 930651）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 930713.CSI 人工智能（基准 930713）
- 两所当前ETF清单中跟踪 930713 的场内ETF共 6 只，均经中证官网相关产品交叉核对。
  - `512930` AI人工智能ETF平安（SH，平安基金管理有限公司）— 直接跟踪 930713 中证人工智能主题指数；证据：上交所 INDEX_CODE=930713；中证官网相关产品同列；[上交所ETF基本信息 512930（跟踪指数 930713 中证人工智能主题指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512930)
  - `515070` 人工智能ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 930713 中证人工智能主题指数；证据：上交所 INDEX_CODE=930713；中证官网相关产品同列；[上交所ETF基本信息 515070（跟踪指数 930713 中证人工智能主题指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515070)
  - `515470` 人工智能ETF南方（SH，南方基金管理股份有限公司）— 直接跟踪 930713 中证人工智能主题指数；证据：上交所 INDEX_CODE=930713；中证官网相关产品同列；[上交所ETF基本信息 515470（跟踪指数 930713 中证人工智能主题指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515470)
  - `561460` 人工智能ETF天弘（SH，天弘基金管理有限公司）— 直接跟踪 930713 中证人工智能主题指数；证据：上交所 INDEX_CODE=930713；中证官网相关产品同列；[上交所ETF基本信息 561460（跟踪指数 930713 中证人工智能主题指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=561460)
  - `159248` 人工智能ETF万家（SZ，万家基金管理有限公司）— 直接跟踪 930713 中证人工智能主题指数；证据：深交所 拟合指数=930713；中证官网相关产品同列；[深交所基金子网ETF列表 159248（拟合指数 930713）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159819` 人工智能ETF易方达（SZ，易方达基金管理有限公司）— 直接跟踪 930713 中证人工智能主题指数；证据：深交所 拟合指数=930713；中证官网相关产品同列；[深交所基金子网ETF列表 159819（拟合指数 930713）](https://fund.szse.cn/marketdata/fundslist/index.html)

### H30590.CSI 机器人（基准 H30590）
- 两所当前ETF清单中跟踪 H30590 的场内ETF共 10 只，均经中证官网相关产品交叉核对。
  - `560630` 机器人ETF万家（SH，万家基金管理有限公司）— 直接跟踪 H30590 中证机器人指数；证据：上交所 INDEX_CODE=H30590；中证官网相关产品同列；[上交所ETF基本信息 560630（跟踪指数 H30590 中证机器人指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560630)
  - `560770` 机器人ETF招商（SH，招商基金管理有限公司）— 直接跟踪 H30590 中证机器人指数；证据：上交所 INDEX_CODE=H30590；中证官网相关产品同列；[上交所ETF基本信息 560770（跟踪指数 H30590 中证机器人指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560770)
  - `562360` 机器人ETF银华（SH，银华基金管理股份有限公司）— 直接跟踪 H30590 中证机器人指数；证据：上交所 INDEX_CODE=H30590；中证官网相关产品同列；[上交所ETF基本信息 562360（跟踪指数 H30590 中证机器人指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=562360)
  - `562500` 机器人ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 H30590 中证机器人指数；证据：上交所 INDEX_CODE=H30590；中证官网相关产品同列；[上交所ETF基本信息 562500（跟踪指数 H30590 中证机器人指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=562500)
  - `158037` 机器人ETF博时（SZ，博时基金管理有限公司）— 直接跟踪 H30590 中证机器人指数；证据：深交所 拟合指数=H30590；中证官网相关产品同列；[深交所基金子网ETF列表 158037（拟合指数 H30590）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159213` 机器人ETF汇添富（SZ，汇添富基金管理股份有限公司）— 直接跟踪 H30590 中证机器人指数；证据：深交所 拟合指数=H30590；中证官网相关产品同列；[深交所基金子网ETF列表 159213（拟合指数 H30590）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159258` 机器人ETF南方（SZ，南方基金管理股份有限公司）— 直接跟踪 H30590 中证机器人指数；证据：深交所 拟合指数=H30590；中证官网相关产品同列；[深交所基金子网ETF列表 159258（拟合指数 H30590）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159526` 机器人ETF嘉实（SZ，嘉实基金管理有限公司）— 直接跟踪 H30590 中证机器人指数；证据：深交所 拟合指数=H30590；中证官网相关产品同列；[深交所基金子网ETF列表 159526（拟合指数 H30590）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159551` 机器人ETF国泰（SZ，国泰基金管理有限公司）— 直接跟踪 H30590 中证机器人指数；证据：深交所 拟合指数=H30590；中证官网相关产品同列；[深交所基金子网ETF列表 159551（拟合指数 H30590）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159770` 机器人ETF天弘（SZ，天弘基金管理有限公司）— 直接跟踪 H30590 中证机器人指数；证据：深交所 拟合指数=H30590；中证官网相关产品同列；[深交所基金子网ETF列表 159770（拟合指数 H30590）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 931079.CSI 5G通信（基准 931079）
- 两所当前ETF清单中跟踪 931079 的场内ETF共 2 只，均经中证官网相关产品交叉核对。
  - `515050` 通信ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 931079 中证5G通信主题指数；证据：上交所 INDEX_CODE=931079；中证官网相关产品同列；[上交所ETF基本信息 515050（跟踪指数 931079 中证5G通信主题指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515050)
  - `159994` 通信ETF银华（SZ，银华基金管理股份有限公司）— 直接跟踪 931079 中证5G通信主题指数；证据：深交所 拟合指数=931079；中证官网相关产品同列；[深交所基金子网ETF列表 159994（拟合指数 931079）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 931151.CSI 光伏产业（基准 931151）
- 两所当前ETF清单中跟踪 931151 的场内ETF共 16 只，均经中证官网相关产品交叉核对。
  - `515370` 光伏ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 931151 中证光伏产业指数；证据：上交所 INDEX_CODE=931151；中证官网相关产品同列；[上交所ETF基本信息 515370（跟踪指数 931151 中证光伏产业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515370)
  - `515790` 光伏ETF华泰柏瑞（SH，华泰柏瑞基金管理有限公司）— 直接跟踪 931151 中证光伏产业指数；证据：上交所 INDEX_CODE=931151；中证官网相关产品同列；[上交所ETF基本信息 515790（跟踪指数 931151 中证光伏产业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515790)
  - `516180` 光伏ETF平安（SH，平安基金管理有限公司）— 直接跟踪 931151 中证光伏产业指数；证据：上交所 INDEX_CODE=931151；中证官网相关产品同列；[上交所ETF基本信息 516180（跟踪指数 931151 中证光伏产业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=516180)
  - `516230` 光伏ETF招商（SH，招商基金管理有限公司）— 直接跟踪 931151 中证光伏产业指数；证据：上交所 INDEX_CODE=931151；中证官网相关产品同列；[上交所ETF基本信息 516230（跟踪指数 931151 中证光伏产业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=516230)
  - `516290` 光伏ETF汇添富（SH，汇添富基金管理股份有限公司）— 直接跟踪 931151 中证光伏产业指数；证据：上交所 INDEX_CODE=931151；中证官网相关产品同列；[上交所ETF基本信息 516290（跟踪指数 931151 中证光伏产业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=516290)
  - `516880` 光伏ETF银华（SH，银华基金管理股份有限公司）— 直接跟踪 931151 中证光伏产业指数；证据：上交所 INDEX_CODE=931151；中证官网相关产品同列；[上交所ETF基本信息 516880（跟踪指数 931151 中证光伏产业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=516880)
  - `560230` 光伏ETF富国（SH，富国基金管理有限公司）— 直接跟踪 931151 中证光伏产业指数；证据：上交所 INDEX_CODE=931151；中证官网相关产品同列；[上交所ETF基本信息 560230（跟踪指数 931151 中证光伏产业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560230)
  - `560310` 光伏ETF博时（SH，博时基金管理有限公司）— 直接跟踪 931151 中证光伏产业指数；证据：上交所 INDEX_CODE=931151；中证官网相关产品同列；[上交所ETF基本信息 560310（跟踪指数 931151 中证光伏产业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560310)
  - `561410` 光伏ETF工银（SH，工银瑞信基金管理有限公司）— 直接跟踪 931151 中证光伏产业指数；证据：上交所 INDEX_CODE=931151；中证官网相关产品同列；[上交所ETF基本信息 561410（跟踪指数 931151 中证光伏产业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=561410)
  - `562970` 光伏ETF易方达（SH，易方达基金管理有限公司）— 直接跟踪 931151 中证光伏产业指数；证据：上交所 INDEX_CODE=931151；中证官网相关产品同列；[上交所ETF基本信息 562970（跟踪指数 931151 中证光伏产业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=562970)
  - `159123` 光伏ETF嘉实（SZ，嘉实基金管理有限公司）— 直接跟踪 931151 中证光伏产业指数；证据：深交所 拟合指数=931151；中证官网相关产品同列；[深交所基金子网ETF列表 159123（拟合指数 931151）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159609` 光伏ETF浦银（SZ，浦银基金管理有限公司）— 直接跟踪 931151 中证光伏产业指数；证据：深交所 拟合指数=931151；中证官网相关产品同列；[深交所基金子网ETF列表 159609（拟合指数 931151）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159618` 光伏ETF华安（SZ，华安基金管理有限公司）— 直接跟踪 931151 中证光伏产业指数；证据：深交所 拟合指数=931151；中证官网相关产品同列；[深交所基金子网ETF列表 159618（拟合指数 931151）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159857` 光伏ETF天弘（SZ，天弘基金管理有限公司）— 直接跟踪 931151 中证光伏产业指数；证据：深交所 拟合指数=931151；中证官网相关产品同列；[深交所基金子网ETF列表 159857（拟合指数 931151）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159863` 光伏ETF鹏华（SZ，鹏华基金管理有限公司）— 直接跟踪 931151 中证光伏产业指数；证据：深交所 拟合指数=931151；中证官网相关产品同列；[深交所基金子网ETF列表 159863（拟合指数 931151）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159864` 光伏ETF国泰（SZ，国泰基金管理有限公司）— 直接跟踪 931151 中证光伏产业指数；证据：深交所 拟合指数=931151；中证官网相关产品同列；[深交所基金子网ETF列表 159864（拟合指数 931151）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 399976.SZ 中证新能源汽车（基准 399976）
- 两所当前ETF清单中跟踪 399976 的场内ETF共 6 只，均经中证官网相关产品交叉核对。
  - `515030` 新能源车ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 399976 中证新能源汽车指数；证据：上交所 INDEX_CODE=399976；中证官网相关产品同列；[上交所ETF基本信息 515030（跟踪指数 399976 中证新能源汽车指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515030)
  - `516660` 新能源车ETF华安（SH，华安基金管理有限公司）— 直接跟踪 399976 中证新能源汽车指数；证据：上交所 INDEX_CODE=399976；中证官网相关产品同列；[上交所ETF基本信息 516660（跟踪指数 399976 中证新能源汽车指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=516660)
  - `159183` 新能源车ETF招商（SZ，招商基金管理有限公司）— 直接跟踪 399976 中证新能源汽车指数；证据：深交所 拟合指数=399976；中证官网相关产品同列；[深交所基金子网ETF列表 159183（拟合指数 399976）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159637` 新能源车ETF东财（SZ，东财基金管理有限公司）— 直接跟踪 399976 中证新能源汽车指数；证据：深交所 拟合指数=399976；中证官网相关产品同列；[深交所基金子网ETF列表 159637（拟合指数 399976）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159806` 新能源车ETF国泰（SZ，国泰基金管理有限公司）— 直接跟踪 399976 中证新能源汽车指数；证据：深交所 拟合指数=399976；中证官网相关产品同列；[深交所基金子网ETF列表 159806（拟合指数 399976）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159824` 新能源车ETF博时（SZ，博时基金管理有限公司）— 直接跟踪 399976 中证新能源汽车指数；证据：深交所 拟合指数=399976；中证官网相关产品同列；[深交所基金子网ETF列表 159824（拟合指数 399976）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 931719.CSI 电池（基准 931719）
- 两所当前ETF清单中跟踪 931719 的场内ETF共 13 只，均经中证官网相关产品交叉核对。
  - `512460` 电池ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 931719 中证电池主题指数；证据：上交所 INDEX_CODE=931719；中证官网相关产品同列；[上交所ETF基本信息 512460（跟踪指数 931719 中证电池主题指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512460)
  - `560410` 电池ETF鹏华（SH，鹏华基金管理有限公司）— 直接跟踪 931719 中证电池主题指数；证据：上交所 INDEX_CODE=931719；中证官网相关产品同列；[上交所ETF基本信息 560410（跟踪指数 931719 中证电池主题指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560410)
  - `560910` 电池ETF华泰柏瑞（SH，华泰柏瑞基金管理有限公司）— 直接跟踪 931719 中证电池主题指数；证据：上交所 INDEX_CODE=931719；中证官网相关产品同列；[上交所ETF基本信息 560910（跟踪指数 931719 中证电池主题指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560910)
  - `561160` 电池ETF富国（SH，富国基金管理有限公司）— 直接跟踪 931719 中证电池主题指数；证据：上交所 INDEX_CODE=931719；中证官网相关产品同列；[上交所ETF基本信息 561160（跟踪指数 931719 中证电池主题指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=561160)
  - `561910` 电池ETF招商（SH，招商基金管理有限公司）— 直接跟踪 931719 中证电池主题指数；证据：上交所 INDEX_CODE=931719；中证官网相关产品同列；[上交所ETF基本信息 561910（跟踪指数 931719 中证电池主题指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=561910)
  - `562880` 电池ETF嘉实（SH，嘉实基金管理有限公司）— 直接跟踪 931719 中证电池主题指数；证据：上交所 INDEX_CODE=931719；中证官网相关产品同列；[上交所ETF基本信息 562880（跟踪指数 931719 中证电池主题指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=562880)
  - `158019` 电池ETF永赢（SZ，永赢基金管理有限公司）— 直接跟踪 931719 中证电池主题指数；证据：深交所 拟合指数=931719；中证官网相关产品同列；[深交所基金子网ETF列表 158019（拟合指数 931719）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159077` 电池ETF鑫元（SZ，鑫元基金管理有限公司）— 直接跟踪 931719 中证电池主题指数；证据：深交所 拟合指数=931719；中证官网相关产品同列；[深交所基金子网ETF列表 159077（拟合指数 931719）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159147` 电池ETF南方（SZ，南方基金管理股份有限公司）— 直接跟踪 931719 中证电池主题指数；证据：深交所 拟合指数=931719；中证官网相关产品同列；[深交所基金子网ETF列表 159147（拟合指数 931719）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159155` 电池ETF大成（SZ，大成基金管理有限公司）— 直接跟踪 931719 中证电池主题指数；证据：深交所 拟合指数=931719；中证官网相关产品同列；[深交所基金子网ETF列表 159155（拟合指数 931719）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159160` 电池ETF东财（SZ，东财基金管理有限公司）— 直接跟踪 931719 中证电池主题指数；证据：深交所 拟合指数=931719；中证官网相关产品同列；[深交所基金子网ETF列表 159160（拟合指数 931719）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159175` 电池ETF易方达（SZ，易方达基金管理有限公司）— 直接跟踪 931719 中证电池主题指数；证据：深交所 拟合指数=931719；中证官网相关产品同列；[深交所基金子网ETF列表 159175（拟合指数 931719）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159796` 电池ETF汇添富（SZ，汇添富基金管理股份有限公司）— 直接跟踪 931719 中证电池主题指数；证据：深交所 拟合指数=931719；中证官网相关产品同列；[深交所基金子网ETF列表 159796（拟合指数 931719）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 399989.SZ 中证医疗（基准 399989）
- 两所当前ETF清单中跟踪 399989 的场内ETF共 5 只，均经中证官网相关产品交叉核对。
  - `512170` 医疗ETF华宝（SH，华宝基金管理有限公司）— 直接跟踪 399989 中证医疗指数；证据：上交所 INDEX_CODE=399989；中证官网相关产品同列；[上交所ETF基本信息 512170（跟踪指数 399989 中证医疗指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512170)
  - `560260` 医疗ETF广发（SH，广发基金管理有限公司）— 直接跟踪 399989 中证医疗指数；证据：上交所 INDEX_CODE=399989；中证官网相关产品同列；[上交所ETF基本信息 560260（跟踪指数 399989 中证医疗指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560260)
  - `158010` 医疗ETF嘉实（SZ，嘉实基金管理有限公司）— 直接跟踪 399989 中证医疗指数；证据：深交所 拟合指数=399989；中证官网相关产品同列；[深交所基金子网ETF列表 158010（拟合指数 399989）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159828` 医疗ETF国泰（SZ，国泰基金管理有限公司）— 直接跟踪 399989 中证医疗指数；证据：深交所 拟合指数=399989；中证官网相关产品同列；[深交所基金子网ETF列表 159828（拟合指数 399989）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159847` 医疗ETF易方达（SZ，易方达基金管理有限公司）— 直接跟踪 399989 中证医疗指数；证据：深交所 拟合指数=399989；中证官网相关产品同列；[深交所基金子网ETF列表 159847（拟合指数 399989）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 931152.CSI 创新药（基准 931152）
- 两所当前ETF清单中跟踪 931152 的场内ETF共 7 只，均经中证官网相关产品交叉核对。
  - `515120` 创新药ETF广发（SH，广发基金管理有限公司）— 直接跟踪 931152 中证创新药产业指数；证据：上交所 INDEX_CODE=931152；中证官网相关产品同列；[上交所ETF基本信息 515120（跟踪指数 931152 中证创新药产业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515120)
  - `516060` 创新药ETF工银（SH，工银瑞信基金管理有限公司）— 直接跟踪 931152 中证创新药产业指数；证据：上交所 INDEX_CODE=931152；中证官网相关产品同列；[上交所ETF基本信息 516060（跟踪指数 931152 中证创新药产业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=516060)
  - `516080` 创新药ETF易方达（SH，易方达基金管理有限公司）— 直接跟踪 931152 中证创新药产业指数；证据：上交所 INDEX_CODE=931152；中证官网相关产品同列；[上交所ETF基本信息 516080（跟踪指数 931152 中证创新药产业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=516080)
  - `560900` 创新药ETF摩根（SH，摩根基金管理（中国）有限公司）— 直接跟踪 931152 中证创新药产业指数；证据：上交所 INDEX_CODE=931152；中证官网相关产品同列；[上交所ETF基本信息 560900（跟踪指数 931152 中证创新药产业指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560900)
  - `159835` 创新药ETF建信（SZ，建信基金管理有限责任公司）— 直接跟踪 931152 中证创新药产业指数；证据：深交所 拟合指数=931152；中证官网相关产品同列；[深交所基金子网ETF列表 159835（拟合指数 931152）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159858` 创新药ETF南方（SZ，南方基金管理股份有限公司）— 直接跟踪 931152 中证创新药产业指数；证据：深交所 拟合指数=931152；中证官网相关产品同列；[深交所基金子网ETF列表 159858（拟合指数 931152）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159992` 创新药ETF银华（SZ，银华基金管理股份有限公司）— 直接跟踪 931152 中证创新药产业指数；证据：深交所 拟合指数=931152；中证官网相关产品同列；[深交所基金子网ETF列表 159992（拟合指数 931152）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 930743.CSI 生物科技（基准 930743）
- 两所当前ETF清单中跟踪 930743 的场内ETF共 4 只，均经中证官网相关产品交叉核对。
  - `516500` 生物科技ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 930743 中证生物科技主题指数；证据：上交所 INDEX_CODE=930743；中证官网相关产品同列；[上交所ETF基本信息 516500（跟踪指数 930743 中证生物科技主题指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=516500)
  - `516930` 生物科技ETF民生加银（SH，民生加银基金管理有限公司）— 直接跟踪 930743 中证生物科技主题指数；证据：上交所 INDEX_CODE=930743；中证官网相关产品同列；[上交所ETF基本信息 516930（跟踪指数 930743 中证生物科技主题指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=516930)
  - `159837` 生物科技ETF易方达（SZ，易方达基金管理有限公司）— 直接跟踪 930743 中证生物科技主题指数；证据：深交所 拟合指数=930743；中证官网相关产品同列；[深交所基金子网ETF列表 159837（拟合指数 930743）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159849` 生物科技ETF招商（SZ，招商基金管理有限公司）— 直接跟踪 930743 中证生物科技主题指数；证据：深交所 拟合指数=930743；中证官网相关产品同列；[深交所基金子网ETF列表 159849（拟合指数 930743）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 399997.SZ 中证白酒（基准 399997）
- 中证官网相关产品中仅有境外上市及LOF/场外产品，两所ETF清单无跟踪399997的场内ETF；下列为中证酒指数产品，仅主题相关。
  - `512690` 酒ETF鹏华（SH，鹏华基金管理有限公司）— 主题相关 399987 中证酒指数；证据：上交所 INDEX_CODE=399987；[上交所ETF基本信息 512690（跟踪指数 399987 中证酒指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512690)；说明：跟踪中证酒指数（白酒、啤酒、葡萄酒等酒类公司），覆盖白酒但范围更宽，非中证白酒跟踪产品

### 930653.CSI 食品饮料（基准 930653）
- 两所当前ETF清单中跟踪 930653 的场内ETF共 1 只，均经中证官网相关产品交叉核对。
  - `159736` 食品饮料ETF天弘（SZ，天弘基金管理有限公司）— 直接跟踪 930653 中证食品饮料指数；证据：深交所 拟合指数=930653；中证官网相关产品同列；[深交所基金子网ETF列表 159736（拟合指数 930653）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 399998.SZ 中证煤炭（基准 399998）
- 两所当前ETF清单中跟踪 399998 的场内ETF共 1 只，均经中证官网相关产品交叉核对。
  - `515220` 煤炭ETF国泰（SH，国泰基金管理有限公司）— 直接跟踪 399998 中证煤炭指数；证据：上交所 INDEX_CODE=399998；中证官网相关产品同列；[上交所ETF基本信息 515220（跟踪指数 399998 中证煤炭指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515220)

### 000819.SH 有色金属（基准 000819）
- 两所当前ETF清单中跟踪 000819 的场内ETF共 1 只，均经中证官网相关产品交叉核对。
  - `512400` 有色金属ETF南方（SH，南方基金管理股份有限公司）— 直接跟踪 000819 中证申万有色金属指数；证据：上交所 INDEX_CODE=000819；中证官网相关产品同列；[上交所ETF基本信息 512400（跟踪指数 000819 中证申万有色金属指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512400)

### 930606.CSI 中证钢铁（基准 930606）
- 两所当前ETF清单中跟踪 930606 的场内ETF共 1 只，均经中证官网相关产品交叉核对。
  - `515210` 钢铁ETF国泰（SH，国泰基金管理有限公司）— 直接跟踪 930606 中证钢铁指数；证据：上交所 INDEX_CODE=930606；中证官网相关产品同列；[上交所ETF基本信息 515210（跟踪指数 930606 中证钢铁指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=515210)

### 000949.SH 中证农业（基准 000949）
- 两所当前ETF清单中跟踪 000949 的场内ETF共 5 只，均经中证官网相关产品交叉核对。
  - `512620` 农业ETF天弘（SH，天弘基金管理有限公司）— 直接跟踪 000949 中证农业主题指数；证据：上交所 INDEX_CODE=000949；中证官网相关产品同列；[上交所ETF基本信息 512620（跟踪指数 000949 中证农业主题指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512620)
  - `516810` 农业ETF华夏（SH，华夏基金管理有限公司）— 直接跟踪 000949 中证农业主题指数；证据：上交所 INDEX_CODE=000949；中证官网相关产品同列；[上交所ETF基本信息 516810（跟踪指数 000949 中证农业主题指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=516810)
  - `159041` 农业ETF鹏华（SZ，鹏华基金管理有限公司）— 直接跟踪 000949 中证农业主题指数；证据：深交所 拟合指数=000949；中证官网相关产品同列；[深交所基金子网ETF列表 159041（拟合指数 000949）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159825` 农业ETF富国（SZ，富国基金管理有限公司）— 直接跟踪 000949 中证农业主题指数；证据：深交所 拟合指数=000949；中证官网相关产品同列；[深交所基金子网ETF列表 159825（拟合指数 000949）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159827` 农业ETF银华（SZ，银华基金管理股份有限公司）— 直接跟踪 000949 中证农业主题指数；证据：深交所 拟合指数=000949；中证官网相关产品同列；[深交所基金子网ETF列表 159827（拟合指数 000949）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 399973.SZ 中证国防（基准 399973）
- 两所当前ETF清单中跟踪 399973 的场内ETF共 1 只，均经中证官网相关产品交叉核对。
  - `512670` 国防ETF鹏华（SH，鹏华基金管理有限公司）— 直接跟踪 399973 中证国防指数；证据：上交所 INDEX_CODE=399973；中证官网相关产品同列；[上交所ETF基本信息 512670（跟踪指数 399973 中证国防指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512670)

### 931066.CSI 军工龙头（基准 931066）
- 两所当前ETF清单中跟踪 931066 的场内ETF共 1 只，均经中证官网相关产品交叉核对。
  - `512710` 军工龙头ETF富国（SH，富国基金管理有限公司）— 直接跟踪 931066 中证军工龙头指数；证据：上交所 INDEX_CODE=931066；中证官网相关产品同列；[上交所ETF基本信息 512710（跟踪指数 931066 中证军工龙头指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512710)

### H30269.CSI 红利低波（基准 H30269）
- 两所当前ETF清单中跟踪 H30269 的场内ETF共 7 只，均经中证官网相关产品交叉核对。
  - `512890` 红利低波ETF华泰柏瑞（SH，华泰柏瑞基金管理有限公司）— 直接跟踪 H30269 中证红利低波动指数；证据：上交所 INDEX_CODE=H30269；中证官网相关产品同列；[上交所ETF基本信息 512890（跟踪指数 H30269 中证红利低波动指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=512890)
  - `560150` 红利低波ETF泰康（SH，泰康基金管理有限公司）— 直接跟踪 H30269 中证红利低波动指数；证据：上交所 INDEX_CODE=H30269；中证官网相关产品同列；[上交所ETF基本信息 560150（跟踪指数 H30269 中证红利低波动指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560150)
  - `560730` 红利低波ETF国泰海通（SH，上海国泰海通证券资产管理有限公司）— 直接跟踪 H30269 中证红利低波动指数；证据：上交所 INDEX_CODE=H30269；中证官网相关产品同列；[上交所ETF基本信息 560730（跟踪指数 H30269 中证红利低波动指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=560730)
  - `563020` 红利低波ETF易方达（SH，易方达基金管理有限公司）— 直接跟踪 H30269 中证红利低波动指数；证据：上交所 INDEX_CODE=H30269；中证官网相关产品同列；[上交所ETF基本信息 563020（跟踪指数 H30269 中证红利低波动指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=563020)
  - `563690` 红利低波ETF永赢（SH，永赢基金管理有限公司）— 直接跟踪 H30269 中证红利低波动指数；证据：上交所 INDEX_CODE=H30269；中证官网相关产品同列；[上交所ETF基本信息 563690（跟踪指数 H30269 中证红利低波动指数）](https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=563690)
  - `159525` 红利低波ETF富国（SZ，富国基金管理有限公司）— 直接跟踪 H30269 中证红利低波动指数；证据：深交所 拟合指数=H30269；中证官网相关产品同列；[深交所基金子网ETF列表 159525（拟合指数 H30269）](https://fund.szse.cn/marketdata/fundslist/index.html)
  - `159547` 红利低波ETF华夏（SZ，华夏基金管理有限公司）— 直接跟踪 H30269 中证红利低波动指数；证据：深交所 拟合指数=H30269；中证官网相关产品同列；[深交所基金子网ETF列表 159547（拟合指数 H30269）](https://fund.szse.cn/marketdata/fundslist/index.html)

### 399809.SZ 保险主题（基准 399809）
- 未找到已核实的直接跟踪 399809 的场内ETF（中证官网相关产品与两所清单均无）。

## 未收录与不一致

- H30269.CSI 158076 红利低波ETF广发：交易所登记跟踪 H30269，但中证官网相关产品未列为 ETF，未收录

## 未验证项与风险

- 未逐只打开基金公司产品页/招募说明书；跟踪指数以两所登记字段为主证据、中证官网为交叉证据。非中证指数（399001/399006/399303、恒生、标普、道琼斯、纳指）只有交易所单一官方来源。
- 深交所产品 sourceUrl 指向基金子网 ETF 列表页（无稳定的单产品静态页），按代码检索可复现；上交所产品指向单只 ETF 基本信息页。
- 快照之后新上市/清盘/变更标的的 ETF 不会自动反映；产品名称以交易所证券简称为准。
