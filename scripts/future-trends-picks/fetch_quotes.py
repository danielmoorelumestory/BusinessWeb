import json, subprocess, sys
syms=open(sys.argv[1]).read().split()
out={}
for i in range(0,len(syms),40):
    batch=syms[i:i+40]
    raw=subprocess.run(['curl','-s','-m','20','https://qt.gtimg.cn/q='+','.join(batch)],capture_output=True).stdout.decode('gbk','ignore')
    for line in raw.split(';'):
        if '="' not in line: continue
        k=line.split('=')[0].strip()[2:]
        f=line.split('"')[1].split('~')
        if len(f)<50: out[k]=None; continue
        mk=k[:2]
        if mk in('sh','sz','bj'):
            r=dict(name=f[1],price=f[3],time=f[30],pe=f[39],cap=f[45],pb=f[46],hi=f[67],lo=f[68],cur='CNY')
        else:
            r=dict(name=f[1],price=f[3],time=f[30],pe=f[39],cap=f[45],hi=f[48],lo=f[49],cur=('HKD' if mk=='hk' else 'USD'))
        out[k]=r
json.dump(out,open(sys.argv[2],'w'),ensure_ascii=False,indent=0)
print(len(out), [k for k,v in out.items() if not v])
