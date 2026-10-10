"""Download SEC filing content, preserving primary URL versus Yahoo mirror provenance."""
import json,re,hashlib,concurrent.futures,urllib.request,urllib.parse,time,sys
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1];LOCAL=ROOT/'.local/adr-2026-10-07';LOCAL.mkdir(exist_ok=True)
class Text(HTMLParser):
 def __init__(self):super().__init__();self.lines=[];self.skip=0
 def handle_starttag(self,tag,attrs):
  if tag in ('script','style'):self.skip+=1
  if tag in ('p','div','tr','br','h1','h2','h3','table'):self.lines.append('\n')
 def handle_endtag(self,tag):
  if tag in ('script','style'):self.skip=max(0,self.skip-1)
  if tag in ('td','th'):self.lines.append(' | ')
  if tag in ('p','div','tr','table'):self.lines.append('\n')
 def handle_data(self,data):
  if not self.skip:self.lines.append(data)
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'Company research contact research@example.com','Accept':'text/html,application/pdf,*/*'})
 with urllib.request.urlopen(req,timeout=40) as r:return r.read()
def extract(data):
 if data.startswith(b'%PDF'):
  import fitz
  doc=fitz.open(stream=data,filetype='pdf');return '\n'.join(p.get_text() for p in doc)
 parser=Text();parser.feed(data.decode('utf-8',errors='replace'))
 return '\n'.join(re.sub(r'\s+',' ',s).strip() for s in ''.join(parser.lines).splitlines() if s.strip())
def process(task):
 symbol,f,key,mirror=task;parts=mirror.split('/');is_mirror='cdn.yahoofinance.com/prod/sec-filings/' in mirror
 primary=f'https://www.sec.gov/Archives/edgar/data/{int(parts[-3])}/{parts[-2]}/{parts[-1]}' if is_mirror else mirror
 directory=LOCAL/symbol;directory.mkdir(exist_ok=True);safe_key=re.sub(r'[^A-Za-z0-9_-]','_',key);stem=f'{f["date"]}-{parts[-2] if is_mirror else hashlib.sha256(mirror.encode()).hexdigest()[:16]}-{safe_key}'
 raw=directory/(stem+'.raw');txt=directory/(stem+'.txt');meta=directory/(stem+'.json')
 if meta.exists():
  cached=json.loads(meta.read_text())
  if 'error' not in cached:return cached
 row=dict(symbol=symbol,date=f['date'],form=f['type'],exhibit=key,primaryUrl=primary,mirrorUrl=mirror,path=str(txt.relative_to(ROOT)))
 try:
  # The filing index connector identifies the issuer filing; Yahoo hosts a mirror of that content.
  # Direct SEC access is attempted separately for the selected financial filings after indexing.
  data=get(mirror);text=extract(data);raw.write_bytes(data);txt.write_text(text)
  row.update(status='监管申报内容镜像，待SEC直接核验' if is_mirror else '公司/监管原件已下载',downloadUrl=mirror,sha256=hashlib.sha256(data).hexdigest(),characters=len(text),financial=bool(re.search(r'(consolidated.{0,45}(income|operations|financial|balance)|quarter.{0,30}(results|revenue)|financial results|six months ended|half.year results|annual results)',text,re.I)))
 except Exception as e:row.update(status='[MISSING]',error=str(e),financial=False)
 meta.write_text(json.dumps(row,ensure_ascii=False,indent=2));return row
if '--verify-primary' in sys.argv:
 selected={c:(date,key) for c,date,key in (line.split('|') for line in (LOCAL/'selected.tsv').read_text().splitlines())}
 def verify(path):
  row=json.loads(path.read_text())
  chosen=selected.get(row['symbol']);is_selected=chosen and row['date']==chosen[0] and path.stem.endswith(chosen[1])
  if 'error' in row or row.get('primaryVerified') or not (row.get('financial') or is_selected):return None
  try:
   data=get(row['primaryUrl']);text=extract(data)
   if len(text)<500 or 'Access Denied' in text:raise ValueError('primary URL returned error page')
   old=(ROOT/row['path']).read_text()
   match=re.sub(r'\s+',' ',old).strip()==re.sub(r'\s+',' ',text).strip()
   sec='www.sec.gov/' in row['primaryUrl']
   check=('原始监管内容与镜像文本一致' if sec else '公司IR原网址直接读取，文本与已存档内容一致')
   row.update(primaryVerified=match,primarySha256=hashlib.sha256(data).hexdigest(),primaryCheck=check if match else '原始页已取得，内容差异待核实')
   if match:row['status']='监管原件已核验' if sec else '公司IR原件已核读'
   path.with_suffix('.primary.raw').write_bytes(data)
  except Exception as e:row['primaryCheck']='直接获取失败；保留镜像证据：'+str(e)
  path.write_text(json.dumps(row,ensure_ascii=False,indent=2));return row.get('primaryVerified',False)
 paths=[p for d in LOCAL.iterdir() if d.is_dir() for p in d.glob('*.json')]
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  checked=[x for x in pool.map(verify,paths) if x is not None]
 rows=[json.loads(p.read_text()) for p in paths]
 (LOCAL/'manifest.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
 print(f'Primary checks {len(checked)}; matching original texts {sum(checked)}');sys.exit()
tasks=[]
for file in sorted(LOCAL.glob('filings-*.json')):
 symbol=file.stem[8:];filings=json.loads(file.read_text()).get('sec_filings',[])
 eligible=[f for f in filings if '2026-05-01'<=f['date']<='2026-10-07' and f['type'] in ('6-K','6-K/A','8-K','10-Q','10-K','20-F','40-F')]
 annual=next((f for f in filings if '2025-10-07'<=f['date']<='2026-10-07' and f['type'] in ('10-K','20-F','40-F')),None)
 if annual and annual not in eligible:eligible.append(annual)
 for f in eligible:
  for key,url in f.get('exhibits',{}).items():
   if key not in ('6-K','6-K/A','8-K','10-Q','10-K','20-F','40-F','EX-99','EX-99.1','EX-99.2','EX-99.3') and not (symbol=='INFY' and key.startswith('EX-99.')) and not (symbol=='BTI' and key=='EX-1'):continue
   if 'cdn.yahoofinance.com/prod/sec-filings/' not in url:continue
   tasks.append((symbol,f,key,url))
if (LOCAL/'extra-urls.tsv').exists():
 for line in (LOCAL/'extra-urls.tsv').read_text().splitlines():
  if not line.strip():continue
  symbol,date,url=line.split('|');tasks.append((symbol,dict(date=date,type='IR'), 'RESULTS',url))
print(f'Indexing {len(tasks)} filing documents across {len(list(LOCAL.glob("filings-*.json")))} companies',flush=True)
rows=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 for row in pool.map(process,tasks):
  rows.append(row)
  if len(rows)%50==0:print(f'{len(rows)}/{len(tasks)}; failed {sum("error" in r for r in rows)}',flush=True)
(LOCAL/'manifest.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
print(f'Done {len(rows)}; financial candidates {sum(r["financial"] for r in rows)}; failed {sum("error" in r for r in rows)}',flush=True)
