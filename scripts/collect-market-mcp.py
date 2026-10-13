"""Read-only refresh collector. Run with the pinned Yahoo MCP Python environment; see docs/data-maintenance.md.
Launchers are shared at ../.agents/mcp, and collection never changes their configuration.
"""
import asyncio, datetime as dt, json, os, re, sys, concurrent.futures, urllib.request, argparse, shutil
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

parser=argparse.ArgumentParser(description='Read-only MCP and public-quote evidence collection')
parser.add_argument('--date',required=True)
parser.add_argument('--mode',default='probe',choices=['probe','collect','quotes','quotes-etf','ak-financial','retry-core','retry-info'])
cli=parser.parse_args()
AS_OF=dt.date.fromisoformat(cli.date)
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/f'public/research/data-refresh-{AS_OF.isoformat()}/mcp'
OUT.mkdir(parents=True,exist_ok=True)
YF_PYTHON=sys.executable
SERVERS={
 'yfinance':dict(command=YF_PYTHON,args=[str(ROOT.parent/'.agents/mcp/yfinance_server.py')]),
 'akshare':dict(command=shutil.which('uvx') or str(Path.home()/'.local/bin/uvx'),args=['--offline','--python','3.12','--from','akshare-mcp==0.1.3','python',str(ROOT.parent/'.agents/mcp/akshare_server.py')]),
}
def decode(r):
 text='\n'.join(c.text for c in r.content if getattr(c,'type',None)=='text')
 try: data=json.loads(text)
 except ValueError:data={'text':text}
 for _ in range(3):
  if not isinstance(data,str):break
  try:data=json.loads(data)
  except ValueError:break
 return {'error':data} if getattr(r,'isError',False) else data
def write(path,data):path.write_text(json.dumps(data,ensure_ascii=False,allow_nan=False,default=str,indent=2)+'\n')
async def call(session,server,tool,args,path,timeout=90):
 began=dt.datetime.now(dt.timezone.utc).isoformat()
 try: data=decode(await asyncio.wait_for(session.call_tool(tool,args),timeout))
 except Exception as e:data={'error':type(e).__name__+': '+str(e)}
 row=dict(server=server,tool=tool,arguments=args,requestedAt=began,retrievedAt=dt.datetime.now(dt.timezone.utc).isoformat(),data=data)
 write(path,row);return row
async def connect_probe(server):
 cfg=SERVERS[server]
 async with stdio_client(StdioServerParameters(**cfg,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'})) as (r,w):
  async with ClientSession(r,w) as s:
   await s.initialize();ts=await s.list_tools();write(OUT/(server+'-tools.json'),[t.model_dump() for t in ts.tools])
   print(json.dumps({'server':server,'tools':[t.name for t in ts.tools]}),flush=True)
   if server=='yfinance':
    for tool,args in [('get_multiple_tickers_info',{'symbols':['AAPL','0700.HK','300750.SZ','PEP']}),('get_earnings_estimates',{'symbol':'PEP'})]:
     row=await call(s,server,tool,args,OUT/(server+'-probe-'+tool+'.json'));print(json.dumps({'server':server,'tool':tool,'keys':list(row['data']) if isinstance(row['data'],dict) else str(type(row['data']))}),flush=True)
   else:
    for tool,args in [('stock_zh_a_hist_tx',{'symbol':'sz300750','start_date':(AS_OF-dt.timedelta(days=4)).strftime('%Y%m%d'),'end_date':AS_OF.strftime('%Y%m%d'),'timeout':15}),('stock_financial_abstract_ths',{'symbol':'300450','indicator':'按报告期'})]:
     row=await call(s,server,tool,args,OUT/(server+'-probe-'+tool+'.json'),40);print(json.dumps({'server':server,'tool':tool,'ok':not(isinstance(row['data'],dict) and row['data'].get('error'))}),flush=True)
async def worker(queue,number):
 cfg=SERVERS['yfinance']
 async with stdio_client(StdioServerParameters(**cfg,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'})) as (r,w):
  async with ClientSession(r,w) as s:
   await s.initialize()
   while not queue.empty():
    try:tool,args,filename=queue.get_nowait()
    except asyncio.QueueEmpty:break
    path=OUT/filename
    if path.exists():queue.task_done();continue
    row=await call(s,'yfinance',tool,args,path,120)
    print(json.dumps({'worker':number,'tool':tool,'symbols':args.get('symbols',args.get('symbol')),'ok':not(isinstance(row['data'],dict) and row['data'].get('error')),'at':row['retrievedAt']}),flush=True)
    queue.task_done()
async def collect():
 symbols=[s for s in json.loads((OUT.parent/'universe-symbols.json').read_text()) if re.fullmatch(r'[A-Z0-9^][A-Z0-9^.-]*',s)]
 queue=asyncio.Queue()
 for i in range(0,len(symbols),12):queue.put_nowait(('get_multiple_tickers_info',{'symbols':symbols[i:i+12]},f'yfinance-info-{i//12:03}.json'))
 # Supplement actual financial tables and dated forecasts for the solid-state pool and PEP.
 solid=json.loads((ROOT/'src/data/solidState/mcpSnapshot.json').read_text())
 focus=list(dict.fromkeys([l['symbol'] for c in solid['companies'] for l in c['listings'] if l.get('available')]+['PEP']))
 for symbol in focus:
  for tool in ['get_income_statement','get_balance_sheet','get_cash_flow','get_earnings_estimates']:
   args={'symbol':symbol}
   if tool!='get_earnings_estimates':args['quarterly']=True
   queue.put_nowait((tool,args,f'yfinance-{tool}-{symbol}.json'))
 print(json.dumps({'tasks':queue.qsize(),'symbols':len(symbols),'financial_focus':len(focus)}),flush=True)
 await asyncio.gather(*(worker(queue,i) for i in range(2)))
async def ak_financial():
 cfg=SERVERS['akshare']
 solid=json.loads((ROOT/'src/data/solidState/mcpSnapshot.json').read_text())
 symbols=list(dict.fromkeys(l['symbol'].split('.')[0] for c in solid['companies'] for l in c['listings'] if l['symbol'].endswith(('.SZ','.SS'))))
 async with stdio_client(StdioServerParameters(**cfg,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'})) as (r,w):
  async with ClientSession(r,w) as s:
   await s.initialize()
   for symbol in symbols:
    row=await call(s,'akshare','stock_financial_abstract_ths',{'symbol':symbol,'indicator':'按报告期'},OUT/f'akshare-financial-{symbol}.json',35)
    data=row['data'];print(json.dumps({'symbol':symbol,'ok':isinstance(data,dict) and '报告期' in data,'at':row['retrievedAt']}),flush=True)
async def retry_info():
 cfg=SERVERS['yfinance'];missing=[]
 for path in sorted(OUT.glob('yfinance-info-*.json')):
  for symbol,data in json.loads(path.read_text()).get('data',{}).get('results',{}).items():
   if data.get('error') and re.fullmatch(r'[A-Z0-9^][A-Z0-9^.-]*',symbol):missing.append(symbol)
 async with stdio_client(StdioServerParameters(**cfg,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'})) as (r,w):
  async with ClientSession(r,w) as session:
   await session.initialize()
   for i in range(0,len(missing),10):
    symbols=missing[i:i+10];row=await call(session,'yfinance','get_multiple_tickers_info',{'symbols':symbols},OUT/f'retry-info-{i//10:03}.json',120)
    success=sum(not v.get('error') and bool(v.get('regularMarketTime')) for v in row['data'].get('results',{}).values())
    print(json.dumps({'batch':i//10,'success':success,'count':len(symbols),'at':row['retrievedAt']}),flush=True)
    await asyncio.sleep(1)
async def retry_core():
 cfg=SERVERS['yfinance'];solid=json.loads((ROOT/'src/data/solidState/mcpSnapshot.json').read_text());review=json.loads((ROOT/'src/data/solidState/reviewSnapshot.json').read_text())
 names={c['name'] for c in review['companies'] if c.get('forecast')}
 symbols=[next((l['symbol'] for l in c['listings'] if l.get('available')),None) for c in solid['companies'] if c['name'] in names]+['PEP']
 async with stdio_client(StdioServerParameters(**cfg,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'})) as (r,w):
  async with ClientSession(r,w) as s:
   await s.initialize()
   for symbol in filter(None,symbols):
    for tool in ['get_earnings_estimates','get_income_statement','get_balance_sheet','get_cash_flow']:
     kwargs={'symbol':symbol}
     if tool!='get_earnings_estimates':kwargs['quarterly']=True
     row=await call(s,'yfinance',tool,kwargs,OUT/f'retry-{tool}-{symbol}.json',90)
     data=row['data'];ok=isinstance(data,dict) and not data.get('error') and bool(data.get('earnings_estimate',{}).get('rows') or data.get('data',{}).get('rows'))
     print(json.dumps({'symbol':symbol,'tool':tool,'ok':ok,'at':row['retrievedAt']}),flush=True)
     await asyncio.sleep(.5)
def quotes(etf_only=False):
 symbols=[r['c']+('.SS' if r['c'].startswith('5') else '.SZ') for r in json.loads((ROOT/'public/data/national-team/etf.json').read_text())['etfs']] if etf_only else json.loads((OUT.parent/'universe-symbols.json').read_text())
 targets={}
 for symbol in symbols:
  code=symbol.split('.')[0]
  if symbol.endswith('.SS'):q='sh'+code
  elif symbol.endswith('.SZ'):q='sz'+code
  elif symbol.endswith('.BJ'):q='bj'+code
  elif symbol.endswith('.HK'):q='hk'+code.zfill(5)
  elif '.' not in symbol:q='us'+symbol.replace('-','.')
  else:continue
  targets.setdefault(q,[]).append(symbol)
 def batch(codes):
  url='https://qt.gtimg.cn/q='+','.join(codes)
  at=dt.datetime.now(dt.timezone.utc).isoformat()
  for attempt in range(3):
   try:
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
    text=urllib.request.urlopen(req,timeout=20).read().decode('gbk','replace')
    rows={}
    for q,raw in re.findall(r'v_([^=]+)="([^"]*)"',text):
     f=raw.split('~')
     if len(f)<31 or q not in targets:continue
     try:price=float(f[3])
     except ValueError:continue
     if price<=0:continue
     rows[q]={'symbols':targets[q],'price':price,'name':f[1],'marketTime':f[30],'retrievedAt':at,'currency':'CNY' if q[:2] in ('sh','sz','bj') else 'HKD' if q.startswith('hk') else 'USD','source':url,'raw':f}
    return rows
   except Exception as e:
    if attempt==2:return {'_error_'+codes[0]:{'error':str(e),'source':url,'retrievedAt':at}}
  return {}
 keys=list(targets);result={}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for r in pool.map(batch,[keys[i:i+30] for i in range(0,len(keys),30)]):result.update(r)
 write(OUT.parent/('etf-quotes.json' if etf_only else 'tencent-quotes.json'),{'retrievedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'requested':len(targets),'quotes':result,'missing':[q for q in targets if q not in result]})
 print(json.dumps({'requested':len(targets),'returned':sum('price' in x for x in result.values()),'missing':[q for q in targets if q not in result]},ensure_ascii=False),flush=True)
if __name__=='__main__':
 if cli.mode=='retry-info':asyncio.run(retry_info())
 elif cli.mode=='retry-core':asyncio.run(retry_core())
 elif cli.mode=='quotes-etf':quotes(True)
 elif cli.mode=='ak-financial':asyncio.run(ak_financial())
 elif cli.mode=='quotes':quotes()
 elif cli.mode=='collect':asyncio.run(collect())
 else:
  for server in SERVERS:asyncio.run(connect_probe(server))
