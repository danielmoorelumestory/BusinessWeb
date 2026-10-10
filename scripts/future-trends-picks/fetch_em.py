import json, subprocess, urllib.parse
syms=[s for s in open('syms.txt').read().split() if s[:2] in ('sh','sz','bj')]
codes=[s[2:] for s in syms]
cols='SECURITY_CODE,SECURITY_NAME_ABBR,REPORTDATE,BASIC_EPS,DEDUCT_BASIC_EPS,TOTAL_OPERATE_INCOME,PARENT_NETPROFIT,WEIGHTAVG_ROE,YSTZ,SJLTZ,MGJYXJJE,XSMLL,YSHZ,SJLHZ,BPS,PUBLISHNAME'
out={}
for rd in ('2026-06-30','2025-12-31','2025-06-30'):
  for i in range(0,len(codes),50):
    c=codes[i:i+50]
    flt='(SECURITY_CODE in ("'+'","'.join(c)+'"))(REPORTDATE=\''+rd+'\')'
    url='https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_LICO_FN_CPD&columns='+cols+'&pageSize=100&filter='+urllib.parse.quote(flt)
    j=json.loads(subprocess.run(['curl','-s','-m','30',url],capture_output=True).stdout)
    for r in (j.get('result') or {}).get('data',[]):
      out.setdefault(r['SECURITY_CODE'],{})[rd[:7]]=r
json.dump(out,open('em_a.json','w'),ensure_ascii=False)
print(len(codes),len(out),[c for c in codes if c not in out or '2026-06' not in out[c]])
