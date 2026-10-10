"""把 SoFi（SOFI）补录进「美股非标普」：写入 public/data/adr.json 的基础行（幂等）。
完整研究内容在 src/data/details/sofi.ts（覆盖基础行）与 public/research/sofi-2026-10-07/。
review-adr-2026-10-07.py 重新生成会覆盖 adr.json，之后需重新运行本脚本。"""
import json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'public/data/adr.json'
rows = json.loads(path.read_text())
text = (ROOT / 'src/data/details/sofi.ts').read_text()
block = text.split('@adr:SOFI\n', 1)[1].rsplit('`', 1)[0]
def first(key):
    return next(l.split(': ', 1)[1].strip() for l in block.splitlines() if l.startswith(key + ': '))
def many(key):
    return [l.split(': ', 1)[1].strip() for l in block.splitlines() if l.startswith(key + ': ')]
row = dict(code='SOFI', name='SoFi Technologies', market='adr', sector='美股本土成长', batch='金融科技',
           rating=first('rt'), headline=first('h'),
           metrics=[m.split('|', 1) for m in many('m')],
           thesis=many('t'), risk=many('rk'), next=many('c'),
           asOf='研究2026-10-07；价格2026-10-06收盘（aktools第三方）；财报期2026Q2（期末2026-06-30，SEC 8-K/10-Q原件）',
           researchReport='research/sofi-2026-10-07/SOFI.html')
rows = [r for r in rows if r['code'] != 'SOFI'] + [row]
path.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
print(f'adr.json now {len(rows)} companies (SOFI upserted)')
