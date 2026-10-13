// Collection only; apply retained data with normalize-market-refresh.py after reviewing timestamps.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
const { fileURLToPath } = await import('node:url')
const root = fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'')
const kind=process.argv[2]??'universe'
const asOf=process.argv[3]??new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Yerevan',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||Number.isNaN(Date.parse(asOf+'T00:00:00Z')))throw new Error('Invalid snapshot date')
if(!['universe','universe-after','macro','indexes','yahoo-quotes','apply-companies'].includes(kind))throw new Error('Unknown collection mode')
const out = `${root}/public/research/data-refresh-${asOf}`
await mkdir(out, { recursive: true })
const read = async name => JSON.parse(await readFile(`${root}/${name}`, 'utf8'))
const save = async (name, value) => writeFile(`${out}/${name}`, JSON.stringify(value, null, 2) + '\n')
const beganAt = new Date().toISOString()
if(kind === 'apply-companies'){
  const {applyCompanyMarketRefresh}=await import(`${root}/src/data/companyMarketRefresh.ts`)
  const snapshot=await read('src/data/companyMarketSnapshot.json'),results={}
  for(const market of ['us','cn','hk','adr']){
    const file=`public/data/${market}.json`,previous=await read(file)
    const rows=previous.map(c=>applyCompanyMarketRefresh(c,snapshot[`${market}:${c.code}`]))
    await writeFile(`${root}/${file}`,JSON.stringify(rows,null,['us','cn'].includes(market)?undefined:2)+'\n')
    results[market]={total:rows.length,changed:rows.filter((c,i)=>c!==previous[i]).length,quoteDates:[...new Set(rows.map(c=>c.marketRefresh?.priceDate).filter(Boolean))].sort()}
  }
  await save('company-json-results.json',results)
  console.log(JSON.stringify({kind,results}))
} else if (kind === 'macro') {
  const { buildSnapshots } = await import(`${root}/server/macro.mjs`)
  const previous = Object.fromEntries(await Promise.all(['us','cn','hk'].map(async k => [k, await read(`public/data/macro-${k}.json`)])))
  const data = await buildSnapshots(previous)
  await save('macro-collected.json', { beganAt, completedAt: new Date().toISOString(), ...data })
  console.log(JSON.stringify({ kind, warnings: data.warnings, latest: Object.fromEntries(['us','cn','hk'].map(k => [k,Object.fromEntries(Object.entries(data[k].series).map(([key,v]) => [key,{...v.latest,live:v.live}]))])) }))
} else if (kind === 'yahoo-quotes') {
  const symbols=await read(`public/research/data-refresh-${asOf}/universe-symbols.json`)
  const valid=symbols.filter(s=>/^[A-Z0-9^][A-Z0-9^.-]*$/.test(s))
  const ua={'User-Agent':'Mozilla/5.0'}
  const first=await fetch('https://fc.yahoo.com',{headers:ua,redirect:'manual',signal:AbortSignal.timeout(15000)})
  const cookie=(first.headers.getSetCookie?.()??[]).map(x=>x.split(';')[0]).join('; ')
  const cr=await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb',{headers:{...ua,cookie},signal:AbortSignal.timeout(15000)})
  if(!cr.ok)throw new Error(`Yahoo anonymous session: ${cr.status}`)
  const crumb=await cr.text(),quotes={},errors=[]
  const batches=[];for(let i=0;i<valid.length;i+=35)batches.push(valid.slice(i,i+35))
  let cursor=0
  await Promise.all(Array.from({length:3},async()=>{
    while(cursor<batches.length){
      const batch=batches[cursor++],source=`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${batch.join(',')}`
      try{
        const r=await fetch(`${source}&crumb=${encodeURIComponent(crumb)}`,{headers:{...ua,cookie},signal:AbortSignal.timeout(20000)})
        if(!r.ok)throw new Error(`HTTP ${r.status}`)
        const data=await r.json(),checkedAt=new Date().toISOString()
        for(const q of data.quoteResponse.result)quotes[q.symbol]={...q,checkedAt,source}
      }catch(e){errors.push({symbols:batch,error:String(e)})}
    }
  }))
  await save('yahoo-quote-batch.json',{requested:valid.length,checkedAt:new Date().toISOString(),quotes,errors})
  console.log(JSON.stringify({kind,requested:valid.length,quotes:Object.keys(quotes).length,errors:errors.length}))
} else if (kind === 'indexes') {
  const { buildIndexSnapshot } = await import(`${root}/server/indexes.mjs`)
  const data = await buildIndexSnapshot(await read('public/data/index-history.json'))
  await save('indexes-collected.json', { beganAt, completedAt: new Date().toISOString(), ...data })
  console.log(JSON.stringify({ kind, warnings:data.warnings, latest:Object.fromEntries(Object.entries(data.snapshot.indexes).map(([k,v])=>[k,{latest:v.latest,agg:v.agg?.date,ref:v.ref?.points.at(-1)}])) }))
} else if (kind === 'universe' || kind === 'universe-after') {
  const { createServer } = await import(`${root}/node_modules/vite/dist/node/index.js`)
  const server = await createServer({ root, server:{middlewareMode:true,hmr:false}, appType:'custom' })
  const originalFetch = globalThis.fetch
  globalThis.fetch = async input => {
    const match=String(input).match(/data\/(us|cn|hk|adr|ndx)\.json$/)
    if (!match) throw new Error(`Unexpected network request during local universe extraction: ${input}`)
    try { return new Response(JSON.stringify(await read(`public/data/${match[1]}.json`)),{status:200}) }
    catch { return new Response('[]',{status:404}) }
  }
  try {
    const mod = await server.ssrLoadModule('/src/data/companies.ts')
    const companies = (await Promise.all(['us','cn','hk','adr','ndx'].map(k=>mod.loadCompanies(k)))).flat()
    await save(kind === 'universe-after' ? 'company-universe-after.json' : 'company-universe.json',companies.map(({market,code,name,metrics,asOf,scenarios,ratioNote})=>({market,code,name,metrics,asOf,scenarios,ratioNote})))
    if(kind === 'universe'){
      const symbols=new Set()
      for(const c of companies){
        const symbol=c.market==='cn'?c.code+(/^(92|8|4)/.test(c.code)?'.BJ':/^[69]/.test(c.code)?'.SS':'.SZ')
          :c.market==='hk'?c.code.replace(/^0+/,'').padStart(4,'0')+'.HK':c.code.replace('BRK.B','BRK-B').replace('BF.B','BF-B')
        symbols.add(symbol)
      }
      const future=await read('src/data/futureTrendsResearch.index.json')
      for(const c of future){let s=c.key.split(':')[1];if(/^\d{6}$/.test(s))s+=/^(92|8|4)/.test(s)?'.BJ':/^[69]/.test(s)?'.SS':'.SZ';if(/^[A-Z0-9^][A-Z0-9^.-]*$/.test(s))symbols.add(s)}
      const solid=await read('src/data/solidState/mcpSnapshot.json')
      for(const c of solid.companies)for(const l of c.listings)symbols.add(l.symbol)
      await save('universe-symbols.json',[...symbols].filter(s=>/^[A-Z0-9^][A-Z0-9^.-]*$/.test(s)).sort())
    }
    console.log(JSON.stringify({kind,total:companies.length,markets:Object.fromEntries(['us','cn','hk','adr','ndx'].map(k=>[k,companies.filter(c=>c.market===k).length]))}))
  } finally { globalThis.fetch=originalFetch; await server.close() }
}
