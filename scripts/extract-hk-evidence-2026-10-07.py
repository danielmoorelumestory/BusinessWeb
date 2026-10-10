"""Extract inspectable snippets, never infer table units or accounting definitions."""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];LOCAL=ROOT/'.local/hk-2026-10-07'
manifest=json.loads((LOCAL/'manifest.json').read_text())
rows=[]
patterns=[r'^\s*(?:Total |Consolidated |Net )?Revenue\b',r'^\s*(?:Net )?Profit attributable',r'^\s*Basic earnings per share',r'^\s*(?:Net )?(?:cash (?:generated|from)|Operating cash)',r'^\s*(?:Underlying|Core|Adjusted|Reported) (?:net )?(?:profit|earnings)',r'^\s*(?:Net interest margin|Non-performing loan ratio|Common Equity Tier|New business value|Value of new business|Annualised.*ROE|Return on.*equity)',r'^\s*(?:Earnings per share|Distributable income|Distribution per unit)',r'^\s*(?:Gross profit|Gross margin|Free cash flow)']
regex=re.compile('|'.join(patterns),re.I)
for r in manifest:
 docs=[]
 for d in r['documents']:
  if 'Monthly Returns' in d['category']:continue
  pages=json.loads(Path(d['textPath']).read_text());hits=[]
  for pn,p in enumerate(pages):
   lines=p.splitlines()
   for n,line in enumerate(lines):
    if regex.search(line):
     context='\n'.join(lines[max(0,n-2):min(len(lines),n+4)])
     hits.append(dict(page=pn+1,line=line.strip(),context=context))
  docs.append(dict(**{k:v for k,v in d.items() if k!='textPath'},hits=hits))
 rows.append(dict(code=r['code'],name=r['name'],stock=r['stock'],documents=docs,events=r.get('events',[]),reportTitles=r.get('reportTitles',[]),titleCount=r.get('titleCount'),hasNextRow=r.get('hasNextRow'),errors=r['errors']))
(LOCAL/'evidence.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
print(len(rows),'companies,',sum(len(d['hits']) for r in rows for d in r['documents']),'source rows')
