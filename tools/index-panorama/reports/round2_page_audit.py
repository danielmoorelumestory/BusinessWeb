"""在专属 Orca QA tab 逐个打开真实指数页，实际切换六指标并记录显示状态。

python3 reports/round2_page_audit.py <browserPageId>
仅使用 Orca CLI，不读取用户登录或网络配置。不是 coordinator polling。
"""
import datetime as dt
import json
from pathlib import Path
import subprocess
import sys
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
PAGE = sys.argv[1]
OUTPUT = ROOT / "reports" / (sys.argv[2] if len(sys.argv) > 2 else "round2-browser-baseline.json")
raw = (ROOT / "data-bundle.js").read_text()
data = json.loads(raw.split("window.PANO_DATA=", 1)[1].strip().removesuffix(";"))
base = (ROOT / "index.html").as_uri()


def orca(*args):
    p = subprocess.run(["orca", *args, "--json"], text=True, capture_output=True)
    try:
        r = json.loads(p.stdout)
    except ValueError:
        raise RuntimeError((p.stderr + p.stdout)[:500])
    if not r.get("ok"):
        raise RuntimeError(str(r.get("error")))
    return r["result"]


expression = r"""JSON.stringify((()=>{
const result={title:document.querySelector('.pd-title')?.textContent,metrics:[],coverage:[]};
for(const metric of ['price','pe','pb','dy','mcap','amt']){
 const btn=document.querySelector('[data-pd-metric="'+metric+'"]');
 if(!btn){result.metrics.push({metric,error:'button missing'});continue;}
 btn.click();
 const main=document.querySelector('.pd-main');
 const empty=main?.querySelector('.pd-empty')?.textContent||null;
 const latest=main?.querySelector('.pd-stat-value')?.textContent||null;
 result.metrics.push({metric,selected:document.querySelector('[data-pd-metric="'+metric+'"]')?.getAttribute('aria-pressed'),
  heading:main?.querySelector('h3')?.textContent,empty:main?.querySelector('.pd-empty')?.textContent||null,
  latest,dataMissing:!!empty&&!latest,insufficientHistory:!!empty&&!!latest,chart:!!main?.querySelector('canvas')});
}
result.coverage=Array.from(document.querySelectorAll('.pd-cov tbody tr')).map(tr=>Array.from(tr.children).map(td=>td.textContent));
result.sectionHeadings=Array.from(document.querySelectorAll('#view h3')).map(el=>el.textContent);
result.documentOverflow=document.body.scrollWidth>innerWidth+1;
result.explicitError=Array.from(document.querySelectorAll('#view .banner.error')).map(el=>el.textContent);
return result;
})())"""

orca("viewport", "--page", PAGE, "--width", "1440", "--height", "1000")
out = {"generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(), "baselineAsOf": data["asOf"], "pages": []}
for s in data["indices"]:
    try:
        action = orca("goto", "--page", PAGE, "--url", base + "#/index/" + quote(s["code"], safe="") + "?range=10&metric=price")
        val = orca("eval", "--page", PAGE, "--expression", expression)["result"]
        page = json.loads(val)
        page.update(code=s["code"], expectedTitle=s["name"], consoleErrors=action.get("effects", {}).get("consoleErrors", []))
        page["titleMatches"] = page["title"] == s["name"]
    except Exception as e:
        page = {"code": s["code"], "error": str(e)}
    out["pages"].append(page)
    OUTPUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(s["code"], "OK" if page.get("titleMatches") and not page.get("explicitError") else "CHECK", flush=True)
orca("goto", "--page", PAGE, "--url", base + "#/panorama")
out["console"] = orca("console", "--page", PAGE, "--limit", "50")
out["summary"] = {
    "pages": len(out["pages"]),
    "metricViews": sum(len(p.get("metrics", [])) for p in out["pages"]),
    "pageErrors": sum(bool(p.get("error") or p.get("explicitError") or not p.get("titleMatches")) for p in out["pages"]),
    "emptyMetricViews": sum(bool(m.get("empty")) for p in out["pages"] for m in p.get("metrics", [])),
    "missingDataViews": sum(bool(m.get("dataMissing")) for p in out["pages"] for m in p.get("metrics", [])),
    "insufficientHistoryViews": sum(bool(m.get("insufficientHistory")) for p in out["pages"] for m in p.get("metrics", [])),
}
OUTPUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
print(json.dumps(out["summary"], ensure_ascii=False), flush=True)
