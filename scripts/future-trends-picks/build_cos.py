"""从 src/data/futureTrends.catalog.json 取出各赛道的中国公司（按代码去重），并生成腾讯行情代码表。
用法：python3 build_cos.py <catalog.json>，在工作目录写出 cos.json 与 syms.txt。"""
import json, re, sys

d = json.load(open(sys.argv[1]))
out = {}
for t in d['trends']:
    seen = {}
    for l in t['chain']:
        for c in l['cn']:
            if c['code'] in seen:
                seen[c['code']]['links'].append(l['link'])
                continue
            seen[c['code']] = {'name': c['name'], 'code': c['code'], 'links': [l['link']], 'role': c['role']}
    out[t['id']] = list(seen.values())
json.dump(out, open('cos.json', 'w'), ensure_ascii=False, indent=1)

syms = set()
for l in out.values():
    for c in l:
        for part in re.split(r'\s*/\s*', c['code']):
            part = part.strip()
            if re.fullmatch(r'\d{6}', part): syms.add(('sh' if part[0] in '69' else 'sz') + part)
            elif part.endswith('.BJ'): syms.add('bj' + part[:6])
            elif part.endswith('.HK'): syms.add('hk' + part[:-3].zfill(5))
            elif re.fullmatch(r'[A-Z]+', part): syms.add('us' + part)
open('syms.txt', 'w').write('\n'.join(sorted(syms)))
print(len(syms), 'symbols')
