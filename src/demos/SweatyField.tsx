import { useEffect, useMemo, useRef, useState } from 'react'
import { items, type Item } from '../data'
import './SweatyField.css'

/** このコストで負荷 100%。超えると気絶する */
const LIMIT = 80
/** 気絶する負荷 */
const FAINT_AT = 1.05

type Drop = { id: number; x: number; dur: number; dist: number }

type Stage = { label: string; color: string; note: string }

function stageOf(load: number, fainted: boolean): Stage {
  if (fainted)
    return { label: '気絶', color: '#8b8b8b', note: '無理をさせました' }
  if (load < 0.2)
    return { label: '平常', color: '#3fb27f', note: '余裕があります' }
  if (load < 0.45)
    return { label: 'ぬるい', color: '#8bb23f', note: 'すこし汗ばんできました' }
  if (load < 0.75)
    return { label: '発汗', color: '#e0a020', note: 'そのクエリ、重いです' }
  if (load < FAINT_AT)
    return { label: '限界', color: '#e2673a', note: 'ちょっと…待って…' }
  return { label: '限界', color: '#d93636', note: 'もうだめです' }
}

export function SweatyField() {
  const [query, setQuery] = useState('')
  const [load, setLoad] = useState(0)
  const [fainted, setFainted] = useState(false)
  const [excuse, setExcuse] = useState('')
  const [drops, setDrops] = useState<Drop[]>([])
  const [result, setResult] = useState<Result>({ ok: true, items: [] })
  const [searching, setSearching] = useState(false)

  const loadRef = useRef(0)
  loadRef.current = load
  const dropSeq = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const cost = useMemo(() => costOf(query), [query])
  const target = fainted ? 0 : cost / LIMIT
  const stage = stageOf(load, fainted)

  // 負荷はゆっくり追従する。汗は遅れてかき、なかなか引かない
  useEffect(() => {
    const id = setInterval(() => {
      setLoad((prev) => {
        const rate = fainted ? 0.22 : target > prev ? 0.05 : 0.03
        const next = prev + (target - prev) * rate
        return Math.abs(next - target) < 0.002 ? target : next
      })
    }, 40)
    return () => clearInterval(id)
  }, [target, fainted])

  // 発汗。負荷が高いほど粒が増え、速く流れる
  useEffect(() => {
    const id = setInterval(() => {
      const current = loadRef.current
      if (fainted || current < 0.25) return
      if (Math.random() > (current - 0.2) * 0.9) return
      setDrops((prev) => [
        ...prev.slice(-20),
        {
          id: dropSeq.current++,
          x: 6 + Math.random() * 88,
          dur: 900 - Math.min(500, current * 400) + Math.random() * 300,
          dist: 60 + Math.random() * 40,
        },
      ])
    }, 170)
    return () => clearInterval(id)
  }, [fainted])

  // 限界を超えたら気絶する
  useEffect(() => {
    if (fainted || load < FAINT_AT) return
    setFainted(true)
    setDrops([])
    setSearching(false)
  }, [fainted, load])

  // 気絶からの復帰。依存は fainted だけ（load を混ぜると自分のタイマーを消してしまう）
  useEffect(() => {
    if (!fainted) return
    const id = setTimeout(() => {
      setQuery((prev) => {
        const cut = prev.slice(0, Math.max(1, Math.floor(prev.length / 2))).trimEnd()
        setExcuse(`重すぎたので後半を切り捨てました（「${cut}」で検索します）`)
        return cut
      })
      setFainted(false)
      inputRef.current?.focus()
    }, 2600)
    return () => clearTimeout(id)
  }, [fainted])

  // 重いクエリは実際に遅い
  const delay = Math.min(2400, 120 + cost * 18)
  useEffect(() => {
    if (fainted) return
    if (!query.trim()) {
      setResult({ ok: true, items: [] })
      setSearching(false)
      return
    }
    setSearching(true)
    const id = setTimeout(() => {
      setResult(runSearch(query))
      setSearching(false)
    }, delay)
    return () => clearTimeout(id)
  }, [query, delay, fainted])

  const percent = Math.round(load * 100)

  return (
    <div style={styles.page}>
      <p style={styles.lead}>
        重いクエリを書くと検索窓が汗をかきます。無理をさせると気絶します。
      </p>

      <div style={styles.status}>
        <span style={{ color: stage.color }}>
          {stage.label} {percent}%
        </span>
        <span style={styles.note}>{stage.note}</span>
      </div>
      <div className="sweaty-meter">
        <div style={{ width: `${Math.min(100, percent)}%`, background: stage.color }} />
      </div>

      <div
        className={[
          'sweaty-wrap',
          load > 0.5 && !fainted ? 'is-trembling' : '',
          fainted ? 'is-fainted' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={
          {
            '--amp': `${Math.min(1.6, Math.max(0, load - 0.5) * 3)}px`,
            borderColor: load > 0.3 ? stage.color : 'var(--border)',
            background: `rgba(226, 103, 58, ${Math.max(0, load - 0.4) * 0.14})`,
          } as React.CSSProperties
        }
      >
        <input
          ref={inputRef}
          className="sweaty-input"
          value={query}
          disabled={fainted}
          onChange={(e) => {
            setQuery(e.target.value)
            setExcuse('')
          }}
          placeholder={fainted ? '…' : 'あまい | すっぱい -納豆'}
        />
        {drops.map((drop) => (
          <span
            key={drop.id}
            className="sweaty-drop"
            style={
              {
                left: `${drop.x}%`,
                animationDuration: `${drop.dur}ms`,
                '--dist': `${drop.dist}px`,
              } as React.CSSProperties
            }
            onAnimationEnd={() =>
              setDrops((prev) => prev.filter((d) => d.id !== drop.id))
            }
          />
        ))}
      </div>

      <p style={styles.syntax}>
        空白＝AND　<code>|</code>＝OR　<code>*</code>＝ワイルドカード
        <code>-語</code>＝除外　<code>/正規表現/</code>
        <br />
        コスト {cost.toFixed(0)} / {LIMIT}・応答 {delay.toFixed(0)}ms
      </p>

      {excuse && <p style={styles.excuse}>{excuse}</p>}

      <div style={styles.results}>
        {fainted ? (
          <p style={styles.pending}>…</p>
        ) : searching ? (
          <p style={styles.pending}>検索中…</p>
        ) : !result.ok ? (
          <p style={styles.error}>正規表現が壊れています（でも汗はかきました）</p>
        ) : query.trim() === '' ? (
          <p style={styles.pending}>クエリを入れてください。</p>
        ) : result.items.length === 0 ? (
          <p style={styles.pending}>0 件</p>
        ) : (
          <ul style={styles.list}>
            {result.items.map((item) => (
              <li key={item.id} style={styles.item}>
                <strong style={{ color: 'var(--text-h)' }}>{item.name}</strong>
                <span style={styles.tags}>{item.tags.join(' / ')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** `あまい|すっぱい` と `あまい | すっぱい` を同じ OR として扱う */
function tokenize(query: string): string[] {
  return query
    .replace(/\s*\|\s*/g, '|')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

/** クエリの重さ。書き手の欲張り具合がそのまま効く */
function costOf(query: string): number {
  const terms = tokenize(query)
  if (terms.length === 0) return 0

  let cost = query.trim().length * 0.8 + terms.length ** 1.7 * 4.5

  for (const term of terms) {
    if (/^\/.*\/$/.test(term)) cost += 45 + term.length * 1.5
    cost += (term.match(/\*/g)?.length ?? 0) * 20
    cost += (term.match(/\|/g)?.length ?? 0) * 20
    if (term.startsWith('-')) cost += 8
  }
  return cost
}

type Result = { ok: true; items: Item[] } | { ok: false; items: never[] }

function runSearch(query: string): Result {
  const terms = tokenize(query)

  try {
    const matchers = terms.map((term) => {
      const negate = term.startsWith('-')
      const body = negate ? term.slice(1) : term
      const alts = body.split('|').filter(Boolean)
      const regexes = alts.map((alt) => toRegExp(alt))
      return { negate, regexes }
    })

    const matched = items.filter((item) => {
      const hay = `${item.name} ${item.kind} ${item.tags.join(' ')}`
      return matchers.every(({ negate, regexes }) => {
        const hit = regexes.some((re) => re.test(hay))
        return negate ? !hit : hit
      })
    })
    return { ok: true, items: matched }
  } catch {
    return { ok: false, items: [] }
  }
}

function toRegExp(token: string): RegExp {
  if (/^\/.*\/$/.test(token)) return new RegExp(token.slice(1, -1))
  const escaped = token.replace(/[.+?^${}()[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(escaped)
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 560,
    margin: '0 auto',
    padding: '48px 24px 80px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  lead: { margin: '0 0 12px', fontSize: 15, lineHeight: 1.6 },
  status: { display: 'flex', justifyContent: 'space-between', fontSize: 14 },
  note: { opacity: 0.7 },
  syntax: { margin: '4px 0 0', fontSize: 12, lineHeight: 1.9, opacity: 0.75 },
  excuse: { margin: 0, fontSize: 13, color: '#e2673a' },
  results: { marginTop: 8, minHeight: 120 },
  pending: { margin: 0, fontSize: 14, opacity: 0.6 },
  error: { margin: 0, fontSize: 14, color: '#d93636' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    padding: '8px 14px',
    borderRadius: 8,
    background: 'var(--code-bg)',
    fontSize: 15,
  },
  tags: { fontSize: 12, opacity: 0.7 },
}
