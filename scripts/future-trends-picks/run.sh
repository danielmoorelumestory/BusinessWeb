#!/bin/sh
# 刷新未来趋势七个赛道（及 AI 补充、AI/智能驾驶补充字段）的综合排序数据。
# 行情：腾讯 qt.gtimg.cn；财务：东方财富数据中心（A 股业绩报表、港股/美股主要指标）。
# 研究判断（壁垒、增长空间、风险、不建模原因）在 qual1–3.py 手工维护；数据刷新后须复核这些文字与汇总（emit.py 中的 S）是否仍成立。
# 海外行情用 yfinance，默认复用 yahoo-finance MCP 的虚拟环境（可用 YF_PYTHON 指定）；us.json 已有的代码不重复拉取，刷新前删除 .cache/us.json。
# 用法：npm run future-trends:picks（在 BusinessWeb 目录）
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
WORK=${FT_WORK:-$HERE/.cache}
mkdir -p "$WORK"
cd "$WORK"
python3 "$HERE/build_cos.py" "$ROOT/src/data/futureTrends.catalog.json"
python3 "$HERE/fetch_quotes.py" syms.txt quotes.json
python3 "$HERE/fetch_em.py"
python3 "$HERE/fetch_em_hkus.py"
python3 "$HERE/metrics.py" > metrics.txt
python3 "$HERE/gen.py" > gen.txt
"${YF_PYTHON:-$HOME/.cache/yahoo-finance-mcp/venv/bin/python}" "$HERE/fetch_us.py" "$ROOT/src/data/futureTrends.catalog.json"
python3 "$HERE/gen_us.py" > gen_us.txt
python3 "$HERE/emit.py" "$ROOT/src/data/futureTrendsSectorPicks.ts"
echo "已更新 src/data/futureTrendsSectorPicks.ts；分级明细见 $WORK/gen.txt"
