// 测试用：用 Node 内置的 node:sqlite 跑真实 SQL，包装成 D1 的形状（prepare/bind/first/batch），并应用 d1/schema.sql。
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import type { D1Like, D1Statement } from './d1Snapshot'

type Binding = string | number | null

export type TestD1 = D1Like & { raw: DatabaseSync; failNext(error: Error): void }

export function createTestD1(options: { schema?: boolean } = {}): TestD1 {
  const raw = new DatabaseSync(':memory:')
  if (options.schema !== false) raw.exec(readFileSync(new URL('../d1/schema.sql', import.meta.url), 'utf8'))
  let pending: Error | null = null
  const check = () => { if (pending) { const e = pending; pending = null; throw e } }

  const statement = (sql: string, values: Binding[] = []): D1Statement & { run(): { changes: number } } => ({
    bind: (...next: unknown[]) => statement(sql, next as Binding[]),
    first: async <T,>() => { check(); return (raw.prepare(sql).get(...values) as T | undefined) ?? null },
    run: () => { const r = raw.prepare(sql).run(...values); return { changes: Number(r.changes) } },
  })
  return {
    raw,
    failNext(error) { pending = error },
    prepare: sql => statement(sql),
    async batch(statements) {
      check()
      raw.exec('BEGIN')
      try {
        const results = statements.map(s => ({ meta: (s as ReturnType<typeof statement>).run() }))
        raw.exec('COMMIT')
        return results
      } catch (error) {
        raw.exec('ROLLBACK')
        throw error
      }
    },
  }
}
