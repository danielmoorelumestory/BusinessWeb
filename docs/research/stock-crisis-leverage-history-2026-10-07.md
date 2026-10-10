# 早期股市危机：杠杆与现金的历史参考

核对日期：2026-10-07。页面数据在 `src/features/macro/crisisHistory.ts`。

## 美联储公报原始值

下表单位均为百万美元，取月末值。1973–1974 年的债务取原表的 **Brokers** 总列，不包括银行融资，也不误取 **Margin stock / Brokers** 子列。现金为现金账户与保证金账户的自由贷方余额之和。

| 月份 | 券商融资 | 保证金账户现金 | 现金账户现金 | 现金合计 ÷ 融资 |
| --- | ---: | ---: | ---: | ---: |
| 1973-01 | 7,975 | 413 | 1,883 | 28.8% |
| 1974-10 | 4,080 | 431 | 1,419 | 45.3% |
| 1987-09 | 44,170 | 4,270 | 15,895 | 45.7% |
| 1987-10 | 38,250 | 8,415 | 18,455 | 70.2% |

原表已逐页渲染核对：

- [1974 年 1 月公报，A36 页，PDF 第 104 页](https://fraser.stlouisfed.org/files/docs/publications/FRB/1970s/frb_011974.pdf#page=104)：Stock Market Customer Financing。
- [1975 年 2 月公报，A31 页，PDF 第 100 页](https://fraser.stlouisfed.org/files/docs/publications/FRB/1970s/frb_021975.pdf#page=100)：Stock Market Customer Financing。
- [1988 年 6 月公报，A25 页，PDF 第 68 页](https://fraser.stlouisfed.org/files/docs/publications/FRB/1980s/frb_061988.pdf#page=68)：表 1.36，融资为第 10 行，保证金账户和现金账户余额为第 11、12 行。不要把年末列当成 9 月或 10 月。

## GDP 分母及单位换算

读取 [FRED GDP CSV](https://fred.stlouisfed.org/graph/fredgraph.csv?id=GDP) 的日期为 2026-10-07，口径为名义 GDP、季度、季调折年、十亿美元。对应季度的修订值：

| 季度 | GDP（十亿美元） | 券商融资 ÷ GDP |
| --- | ---: | ---: |
| 1973 Q1 | 1,377.490 | 0.58% |
| 1974 Q4 | 1,599.679 | 0.26% |
| 1987 Q3 | 4,884.555 | 0.90% |
| 1987 Q4 | 5,007.994 | 0.76% |

公式：`融资（百万美元） / 1000 / GDP（十亿美元） * 100`；现金比为 `(现金账户余额 + 保证金账户余额) / 融资 * 100`。页面展示美元金额时，百万美元除以 100 换成亿美元，十亿美元除以 1000 换成万亿美元。

这些分母不是当时实时公布版本，且当季 GDP 不一定已在参考月份公布；档案值为固定的事件参照，不随实时快照重算。

## 1929 年：可核实的代理，不能伪造可比比例

[1929 年 12 月公报，第 783 页，PDF 第 33 页](https://fraser.stlouisfed.org/files/docs/publications/FRB/1920s/frb_121929.pdf#page=33) 的 Brokers' Borrowings on Collateral in New York City Reported by the New York Stock Exchange 表记录：

- 1929 年 9 月末：8,549 百万美元，即 85.49 亿美元。
- 1929 年 10 月末：6,109 百万美元，即 61.09 亿美元。

这是经纪商的净抵押借款（活期及定期），不是现代 FINRA 客户保证金账户借方余额。本次核对的表中没有可比的客户现金余额。页面两项比例均显示“无可比比例”，附实际借款金额作为历史代理，不把经纪商借款或首付比例当成客户保证金债务或客户现金比。

## 与现代数据的关系

[FINRA 保证金统计](https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics) 提供 1997 年起的数据；2010 年 2 月起统一覆盖会员券商。NYSE 旧版融资的机构覆盖及证券类别与 FINRA 不完全一致，1983 年 Regulation T 修订也改变了旧版融资覆盖的证券范围，因此跨时期只能近似参照。

早期档案只加到危机参考表，不拼接到页面的长历史曲线，不改变现有历史分位与风险打灯。1997 年 10 月亚洲金融危机、1998 年 8 月俄罗斯违约及 9 月 LTCM 救助的读数继续来自页面现有 FINRA 月度历史。
