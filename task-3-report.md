# Task 3 Report

- 修复 `loadCloudPremiums` 的历史起点：仅使用 UI 可见的 `noteDates` 与今天往前 30 天的截止日，取两者中更早日期。
- 抽取 `visibleNoteDates` 和 `premiumHistoryFrom`，渲染与云端加载共用同一可见日期窗口。
- 新增回归测试，覆盖默认 5 日窗口、30 日截止日及可见日期早于截止日的情况。
