import { useEffect, useState } from 'react'

const cache = new Map<string, Promise<unknown>>()

/** 同一文件只请求一次；失败不缓存，下次进入会重试 */
export function loadNt<T>(file: string): Promise<T> {
  const hit = cache.get(file)
  if (hit) return hit as Promise<T>
  const p = fetch(`${import.meta.env.BASE_URL}data/national-team/${file}`)
    .then(r => {
      if (!r.ok) throw new Error(`${file} ${r.status}`)
      return r.json() as Promise<T>
    })
    .catch(e => {
      cache.delete(file)
      throw e
    })
  cache.set(file, p)
  return p
}

export function useNt<T>(file: string | null): { data: T | null; error: boolean } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!file) return
    let live = true
    setError(false)
    loadNt<T>(file).then(d => { if (live) setData(d) }).catch(() => { if (live) setError(true) })
    return () => { live = false }
  }, [file])
  return { data, error }
}
