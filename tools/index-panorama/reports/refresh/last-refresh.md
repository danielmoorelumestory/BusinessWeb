# 指数全景刷新报告

- 结果：**部分成功：验证通过并已发布，但有来源沿用旧缓存或未联网（见下表），不代表全部最新**（退出码 10）
- 模式：online；开始 2026-11-16T22:27:55Z（北京 2026-11-17T06:27:55+08:00），结束 2026-11-16T22:35:30Z
- 数据包 asOf：2026-11-16（上一版 2026-11-16）。**生成时间不等于数据时间**，各字段日期见下表
- 已发布：是；备份：data/refresh-backups/20261116T222755Z；失败现场：data/refresh-work/20261116T222755Z

## 各步骤

| 步骤 | 状态 | 说明 | 秒 |
|---|---|---|---|
| 行情/中证 fetch_data | 成功 | 腾讯行情在线刷新；中证仅刷新生产已有中证 store 的指数（选源不变）；丢弃生产中不存在的新中证 store ['data/store/indicator_930606_CSI.csv', 'data/store/indicator_930651_CSI.csv', 'data/store/indicator_930653_CSI.csv', 'data/store/indicator_930697_CSI.csv', 'data/store/indicator_930713_CSI.csv', 'data/store/indicator_930743_CSI.csv', 'data/store/indicator_931066_CSI.csv', 'data/store/indicator_931079_CSI.csv', 'data/store/indicator_931151_CSI.csv', 'data/store/indicator_931152_CSI.csv', 'data/store/indicator_931160_CSI.csv', 'data/store/indicator_931719_CSI.csv', 'data/store/indicator_931775_CSI.csv', 'data/store/indicator_932000_CSI.csv', 'data/store/indicator_990001_CSI.csv', 'data/store/indicator_H30184_CSI.csv', 'data/store/indicator_H30199_CSI.csv', 'data/store/indicator_H30202_CSI.csv', 'data/store/indicator_H30269_CSI.csv', 'data/store/indicator_H30590_CSI.csv']（保持既有选源） | 38.8 |
| provider domestic | 成功 | 修订 5 个旧观测值；新字段 0；0 个请求错误（这些接口沿用上一份有效 raw） | 264.2 |
| provider supplemental | 部分成功 | 修订 0 个旧观测值；新字段 0；2 个请求错误（这些接口沿用上一份有效 raw） | 27.0 |
| 原站 EPS | 成功 | 抓取 2026-11-16T22:33:36.248Z，原站面板日 20261116，修订 0 个旧值 | 78.1 |
| 最终数据包 enrich-only | 成功 | 三 provider 缓存统一生成 | 4.1 |
| 数据包门禁 | 成功 | 结构/观测/末日/选源/EPS 一一对应通过；manager_audit 通过；修订 5 个旧值 | 42.0 |
| 发布 | 成功 | 原子替换 39 个文件；备份 data/refresh-backups/20261116T222755Z | 0.2 |

## 各指数字段真实最新日期（样本数·来源）

| 代码 | 名称 | 价格 | PE | PB | 股息率 | EPS | ROE |
|---|---|---|---|---|---|---|---|
| 000001.SH | 上证指数 | 2026-11-16（5310·cache+tencent） | 2026-11-16（3668·domestic） | 2026-11-16（3·domestic） | 2026-11-16（22·domestic） | 2026-11-16（1062·original_eps） | — |
| 399001.SZ | 深证成指 | 2026-11-16（5310·tencent） | 2026-11-16（516·domestic） | 2026-11-16（516·domestic） | 2026-11-16（2·domestic） | 2026-11-16（1062·original_eps） | 2026-11-16（364·domestic） |
| 399006.SZ | 创业板指 | 2026-11-16（3996·cache+tencent） | 2026-11-16（516·domestic） | 2026-11-16（516·domestic） | 2026-11-16（2·domestic） | 2026-11-16（799·original_eps） | 2026-11-16（364·domestic） |
| 000688.SH | 科创50 | 2026-11-16（1664·cache+tencent） | 2026-11-16（1543·domestic） | 2026-11-16（355·domestic） | 2026-11-16（22·domestic） | 2026-11-16（307·original_eps） | 2026-11-16（355·domestic） |
| 000016.SH | 上证50 | 2026-11-16（5310·cache+tencent） | 2026-11-16（3670·domestic） | 2026-11-16（516·domestic） | 2026-11-16（22·domestic） | 2026-11-16（1062·original_eps） | 2026-11-16（365·domestic） |
| 000300.SH | 沪深300 | 2026-11-16（5310·cache+tencent） | 2026-11-16（3670·domestic） | 2026-11-16（516·domestic） | 2026-11-16（22·domestic） | 2026-11-16（1050·original_eps） | 2026-11-16（362·domestic） |
| 000905.SH | 中证500 | 2026-11-16（5310·cache+tencent） | 2026-11-16（3670·domestic） | 2026-11-16（516·domestic） | 2026-11-16（22·domestic） | 2026-11-16（964·original_eps） | 2026-11-16（364·domestic） |
| 000852.SH | 中证1000 | 2026-11-16（5310·cache+tencent） | 2026-11-16（3490·domestic） | 2026-11-16（516·domestic） | 2026-11-16（22·domestic） | 2026-11-16（588·original_eps） | 2026-11-16（364·domestic） |
| 000903.SH | 中证A100 | 2026-11-16（5310·cache+tencent） | 2026-11-16（3670·domestic） | 2026-11-16（516·domestic） | 2026-11-16（22·domestic） | 2026-11-16（996·original_eps） | 2026-11-16（365·domestic） |
| 000906.SH | 中证800 | 2026-11-16（5310·cache+tencent） | 2026-11-16（3670·domestic） | — | 2026-11-16（22·domestic） | 2026-11-16（964·original_eps） | — |
| 000985.SH | 中证全指 | 2026-11-16（5310·cache+tencent） | 2026-11-16（3670·domestic） | — | 2026-11-16（22·domestic） | — | — |
| 399303.SZ | 国证2000 | 2026-11-16（3071·tencent） | 2026-11-13（1·domestic） | 2026-11-13（1·domestic） | — | — | — |
| 932000.CSI | 中证2000 | 2026-11-16（3129·csi） | 2026-11-16（829·csi） | — | 2026-11-16（22·domestic） | — | — |
| 000922.CSI | 中证红利 | 2026-11-16（5310·tencent） | 2026-11-16（3670·domestic） | 2026-11-16（516·domestic） | 2026-11-16（22·domestic） | 2026-11-16（898·original_eps） | 2026-11-16（365·domestic） |
| 000932.SH | 中证消费 | 2026-11-16（4219·tencent） | 2026-11-16（3670·domestic） | 2026-11-16（516·domestic） | 2026-11-16（22·domestic） | — | 2026-11-16（364·domestic） |
| 399967.SZ | 中证军工 | 2026-11-16（2735·tencent） | 2026-11-16（3068·domestic） | 2026-11-16（516·domestic） | 2026-11-16（22·domestic） | 2026-11-16（627·original_eps） | 2026-11-16（364·domestic） |
| 399975.SZ | 证券公司 | 2026-11-16（2735·tencent） | 2026-11-16（2794·domestic） | 2026-11-16（516·domestic） | 2026-11-16（22·domestic） | 2026-11-16（649·original_eps） | 2026-11-16（364·domestic） |
| 399986.SZ | 中证银行 | 2026-11-16（2735·tencent） | 2026-11-16（2794·domestic） | 2026-11-16（516·domestic） | 2026-11-16（22·domestic） | 2026-11-16（649·original_eps） | 2026-11-16（365·domestic） |
| 399971.SZ | 中证传媒 | 2026-11-16（2735·tencent） | 2026-11-16（2922·domestic） | 2026-11-16（516·domestic） | 2026-11-16（22·domestic） | — | 2026-11-16（365·domestic） |
| 000827.SH | 中证环保 | 2026-11-16（3609·tencent） | 2026-11-16（3670·domestic） | 2026-11-16（516·domestic） | 2026-11-16（22·domestic） | 2026-11-16（686·original_eps） | 2026-11-16（364·domestic） |
| 000986.SH | 全指能源 | 2026-11-16（4095·cache+tencent） | 2026-11-16（3670·domestic） | — | 2026-11-16（22·domestic） | — | — |
| 000987.SH | 全指材料 | 2026-11-16（4095·cache+tencent） | 2026-11-16（3670·domestic） | — | 2026-11-16（22·domestic） | — | — |
| 000988.SH | 全指工业 | 2026-11-16（5310·cache+tencent） | 2026-11-16（3670·domestic） | — | 2026-11-16（22·domestic） | — | — |
| 000989.SH | 全指可选 | 2026-11-16（4095·cache+tencent） | 2026-11-16（3670·domestic） | 2026-11-16（516·domestic） | 2026-11-16（22·domestic） | — | 2026-11-16（365·domestic） |
| 000990.SH | 全指消费 | 2026-11-16（5310·cache+tencent） | 2026-11-16（3670·domestic） | — | 2026-11-16（22·domestic） | — | — |
| 000991.SH | 全指医药 | 2026-11-16（4095·cache+tencent） | 2026-11-16（3670·domestic） | 2026-11-16（516·domestic） | 2026-11-16（22·domestic） | — | 2026-11-16（364·domestic） |
| 000992.SH | 全指金融 | 2026-11-16（4095·cache+tencent） | 2026-11-16（3670·domestic） | — | 2026-11-16（22·domestic） | — | — |
| 000993.SH | 全指信息 | 2026-11-16（4095·cache+tencent） | 2026-11-16（3670·domestic） | 2026-11-16（516·domestic） | 2026-11-16（22·domestic） | — | 2026-11-16（384·domestic） |
| 000994.SH | 全指通信 | 2026-11-16（5310·cache+tencent） | 2026-11-16（3670·domestic） | — | 2026-11-16（22·domestic） | — | — |
| 000995.SH | 全指公用 | 2026-11-16（5310·cache+tencent） | 2026-11-16（3670·domestic） | — | 2026-11-16（22·domestic） | — | — |
| H30184.CSI | 全指半导体 | 2026-11-16（5308·csi） | 2026-11-16（3253·domestic） | — | 2026-11-16（20·domestic） | — | — |
| H30202.CSI | 全指软件 | 2026-11-16（5308·csi） | 2026-11-16（3253·domestic） | — | 2026-11-16（20·domestic） | — | — |
| 931160.CSI | 全指通信设备 | 2026-11-16（1877·csi） | 2026-11-16（1876·domestic） | — | 2026-11-16（20·domestic） | — | — |
| 931775.CSI | 全指房地产 | 2026-11-16（5310·csi） | 2026-11-16（1263·csi） | — | 2026-11-16（20·domestic） | — | — |
| 930697.CSI | 全指家电 | 2026-11-16（5310·csi） | 2026-11-16（2771·csi） | — | 2026-11-16（20·domestic） | — | — |
| H30199.CSI | 全指电力 | 2026-11-16（5308·csi） | 2026-11-16（3253·domestic） | — | 2026-11-16（20·domestic） | — | — |
| 990001.CSI | 半导体芯片 | 2026-11-16（1630·csi） | 2026-11-16（1630·domestic） | — | 2026-11-16（20·domestic） | — | — |
| 930651.CSI | 中证计算机 | 2026-11-16（5310·csi） | 2026-11-16（2792·csi） | — | 2026-11-16（20·domestic） | — | — |
| 930713.CSI | 人工智能 | 2026-11-16（3492·csi） | 2026-11-16（2752·csi） | — | 2026-11-16（20·domestic） | — | — |
| H30590.CSI | 机器人 | 2026-11-16（3853·csi） | 2026-11-16（2870·csi） | — | 2026-11-16（20·domestic） | — | — |
| 931079.CSI | 5G通信 | 2026-11-16（2640·csi） | 2026-11-16（1837·csi） | 2026-11-16（390·domestic） | 2026-11-16（20·domestic） | — | 2026-11-16（390·domestic） |
| 931151.CSI | 光伏产业 | 2026-11-16（3367·csi） | 2026-11-16（1840·csi） | — | 2026-11-16（20·domestic） | — | — |
| 399976.SZ | 新能源车 | 2026-11-16（2740·tencent） | 2026-11-16（2794·domestic） | — | 2026-11-16（20·domestic） | — | — |
| 931719.CSI | 电池 | 2026-11-16（2884·csi） | 2026-11-16（1349·csi） | — | 2026-11-16（20·domestic） | — | — |
| 399989.SZ | 中证医疗 | 2026-11-16（2740·tencent） | 2026-11-16（2794·domestic） | 2026-11-16（516·domestic） | 2026-11-16（20·domestic） | — | 2026-11-16（516·domestic） |
| 931152.CSI | 创新药 | 2026-11-16（2884·csi） | 2026-11-16（1840·csi） | — | 2026-11-16（20·domestic） | — | — |
| 930743.CSI | 生物科技 | 2026-11-16（3609·csi） | 2026-11-16（2735·csi） | — | 2026-11-16（20·domestic） | — | — |
| 399997.SZ | 中证白酒 | 2026-11-16（2774·tencent） | 2026-11-16（2773·domestic） | 2026-11-16（516·domestic） | 2026-11-16（20·domestic） | — | 2026-11-16（365·domestic） |
| 930653.CSI | 食品饮料 | 2026-11-16（5310·csi） | 2026-11-16（2792·csi） | — | 2026-11-16（20·domestic） | — | — |
| 399998.SZ | 中证煤炭 | 2026-11-16（2774·tencent） | 2026-11-16（2773·domestic） | 2026-11-16（516·domestic） | 2026-11-16（20·domestic） | — | 2026-11-16（365·domestic） |
| 000819.SH | 有色金属 | 2026-11-16（5310·tencent） | 2026-11-16（3670·domestic） | — | 2026-11-16（20·domestic） | — | — |
| 930606.CSI | 中证钢铁 | 2026-11-16（4339·csi） | 2026-11-16（2839·csi） | — | 2026-11-16（20·domestic） | — | — |
| 000949.SH | 中证农业 | 2026-11-16（5310·tencent） | 2026-11-16（3670·domestic） | — | 2026-11-16（20·domestic） | — | — |
| 399973.SZ | 中证国防 | 2026-11-16（2735·tencent） | 2026-11-16（2922·domestic） | — | 2026-11-16（20·domestic） | — | — |
| 931066.CSI | 军工龙头 | 2026-11-16（3367·csi） | 2026-11-16（2140·csi） | — | 2026-11-16（20·domestic） | — | — |
| H30269.CSI | 红利低波 | 2026-11-16（5068·csi） | 2026-11-16（3146·csi） | 2026-11-16（516·domestic） | 2026-11-16（20·domestic） | — | 2026-11-16（365·domestic） |
| 399809.SZ | 保险主题 | 2026-11-16（2745·tencent） | 2026-11-16（2757·domestic） | — | 2026-11-16（20·domestic） | — | — |
| HSI.HK | 恒生指数 | 2026-11-16（5390·cache+tencent） | 2026-11-16（31·supplemental） | 2026-11-13（516·domestic） | 2026-11-16（31·supplemental） | — | 2026-11-13（364·domestic） |
| HSTECH.HK | 恒生科技 | 2026-11-16（1553·cache+tencent） | 2026-11-16（326·domestic） | 2026-11-16（326·domestic） | 2026-11-16（2·domestic） | — | 2026-11-16（326·domestic） |
| HSCEI.HK | 恒生国企 | 2026-11-16（5388·cache+tencent） | 2026-11-16（31·supplemental） | 2026-11-13（516·domestic） | 2026-11-16（31·supplemental） | — | 2026-11-13（365·domestic） |
| SPX.US | 标普500 | 2026-11-16（5506·cache+tencent） | 2026-11-13（1·supplemental） | 2026-11-13（516·domestic） | 2026-11-13（1·supplemental） | — | 2026-11-13（415·domestic） |
| IXIC.US | 纳斯达克综指 | 2026-11-16（5504·cache+tencent） | — | — | — | — | — |
| DJI.US | 道琼斯工业 | 2026-11-16（5507·cache+tencent） | 2026-11-16（2·supplemental） | — | 2026-11-16（2·supplemental） | — | — |

## 历史修订（上游改了旧日期的值；不拒收，只列出）

- 000688.SH.pb: 1 处，如 [('2026-11-16', 5.9621, 5.9608)]
- 000688.SH.roe: 1 处，如 [('2026-11-16', 6.74, 6.73)]
- HSTECH.HK.pe: 1 处，如 [('2026-11-16', 20.0131, 19.5328)]
- HSTECH.HK.pb: 1 处，如 [('2026-11-16', 2.053, 2.0499)]
- HSTECH.HK.roe: 1 处，如 [('2026-11-16', 10.26, 10.49)]

口径：EPS 唯一来源为李神奇数据网（计算口径未核实，元/每股，每 5 个交易日取 1 点）；与 PE 来源不同、不可互相换算。
