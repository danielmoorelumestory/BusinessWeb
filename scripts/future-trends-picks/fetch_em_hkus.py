import json, subprocess, urllib.parse
syms=open('syms.txt').read().split()
out={}
def get(base,rep,secu,sortcol):
    flt=f'(SECUCODE="{secu}")'
    url=f'{base}?reportName={rep}&columns=ALL&pageSize=6&sortColumns={sortcol}&sortTypes=-1&filter='+urllib.parse.quote(flt)
    j=json.loads(subprocess.run(['curl','-s','-m','30',url],capture_output=True).stdout or b'{}')
    return (j.get('result') or {}).get('data',[])
B='https://datacenter.eastmoney.com/securities/api/data/v1/get'
for s in syms:
    if s.startswith('hk'):
        d=get(B,'RPT_HKF10_FN_MAININDICATOR',s[2:]+'.HK','STD_REPORT_DATE')
    elif s.startswith('us'):
        d=[]
        for suf in ('.O','.N','.A'):
            d=get(B,'RPT_USF10_FN_GMAININDICATOR',s[2:]+suf,'REPORT_DATE')
            if d: break
    else: continue
    out[s]=d
json.dump(out,open('em_hkus.json','w'),ensure_ascii=False)
print({k:len(v) for k,v in out.items() if not v})
