"""Collect dated HKEX filings; retain source originals, pages and hashes."""
import concurrent.futures as cf, json, urllib.request, urllib.parse, time, re, hashlib, html
from pathlib import Path
import fitz
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.local/hk-2026-10-07'
OUT.mkdir(parents=True,exist_ok=True)
HOST='https://www1.hkexnews.hk'
def get(url,path):
 if path.exists(): return path.read_bytes()
 error=None
 for n in range(3):
  try:
   data=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=60).read()
   path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data);return data
  except Exception as e: error=e;time.sleep(n+1)
 raise error
stocks=json.loads(get(HOST+'/ncms/script/eds/activestock_sehk_e.json',OUT/'stocks.json'))
ids={s['c']:s for s in stocks}
companies=json.loads((ROOT/'public/research/hk-2026-10-07/previous.json').read_text())['companies']
def collect(c):
 code=c['code'];folder=OUT/code;folder.mkdir(exist_ok=True)
 result={'code':code,'name':c['name'],'stock':ids.get(code),'documents':[],'errors':[]}
 if code not in ids: result['errors'].append('Active HKEX identity missing');return result
 try:
  params=dict(sortDir=0,sortByOptions='DateTime',category=0,market='SEHK',stockId=ids[code]['i'],documentType=-1,fromDate='20260101',toDate='20261007',title='',searchType=1,t1code=-2,t2Gcode=-2,t2code=-2,rowRange=400,lang='EN')
  raw=json.loads(get(HOST+'/search/titleSearchServlet.do?'+urllib.parse.urlencode(params),folder/'titles.json'))
  rows=json.loads(raw['result']); result['recordCnt']=raw.get('recordCnt');result['hasNextRow']=raw.get('hasNextRow');result['titleCount']=len(rows)
  for r in rows:
   r['LONG_TEXT']=html.unescape(r['LONG_TEXT']);r['TITLE']=html.unescape(r['TITLE'])
  exclude=r'SUPPLEMENTAL|BOARD OF DIRECTORS|BOARD MEETING|AUDIT COMMITTEE|Presentation|Webcast|AGM|DELAY|CLARIFICATION|EXPRESS'
  candidates=[r for r in rows if (re.search(r'Interim Results|Final Results|Quarterly Results',r['LONG_TEXT'],re.I) or re.search(r'Interim/Half-Year Report',r['LONG_TEXT'],re.I) and re.search(r'RESULTS',r['TITLE'],re.I)) and not re.search(exclude,r['TITLE'],re.I)]
  reports=[r for r in rows if re.search(r'Interim/Half-Year Report|Annual Report',r['LONG_TEXT'],re.I) and not re.search(r'Sustainability|SUPPLEMENTAL',r['TITLE'],re.I)]
  selected=candidates[:2] if candidates else reports[:1]
  monthly=[r for r in rows if 'Monthly Returns' in r['LONG_TEXT']];selected+=monthly[:1]
  result['events']=[r for r in rows if re.search(r'Inside Information|Acquisition|Disposal|Capital Reorganisation|Suspension|Profit Warning|Profit Alert',r['LONG_TEXT'],re.I)][:12]
  important=[r for r in result['events'] if not re.search(r'Date of Board|Meeting|CONNECTED TRANSACTION|CONTINUING CONNECTED|RULE 13.51|ELECTION|APPOINTMENT|DIRECTOR',r['TITLE'],re.I)]
  business=[r for r in rows if re.search(r'Business Update',r['LONG_TEXT'],re.I)]
  selected+=important[:1] if important else business[:1]
  selected=list({r['NEWS_ID']:r for r in selected}.values())
  result['reportTitles']=reports[:3]
  for r in selected:
   url=HOST+r['FILE_LINK'];ident=r['NEWS_ID'];pdf=folder/(ident+'.pdf')
   try:
    data=get(url,pdf);doc=fitz.open(stream=data,filetype='pdf');pages=[p.get_text(sort=True) for p in doc]
    (folder/(ident+'.json')).write_text(json.dumps(pages,ensure_ascii=False))
    result['documents'].append(dict(title=r['TITLE'],category=r['LONG_TEXT'],date=r['DATE_TIME'],url=url,id=ident,pages=len(pages),sha256=hashlib.sha256(data).hexdigest(),textPath=str(folder/(ident+'.json'))))
   except Exception as e:result['errors'].append(str(e)+' '+url)
 except Exception as e:result['errors'].append(str(e))
 (folder/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));return result
with cf.ThreadPoolExecutor(max_workers=4) as pool:
 results=[]
 for r in pool.map(collect,companies):
  results.append(r);print(r['code'],len(r['documents']),r['errors'],flush=True)
  (OUT/'manifest.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print('TOTAL',len(results),'WITH DOCS',sum(bool(r['documents']) for r in results),flush=True)
