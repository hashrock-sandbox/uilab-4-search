import { useEffect, useMemo, useRef, useState } from 'react'
import { search, type Item } from '../data'
import './FishingSearch.css'

/** 待ち時間の下限・上振れ幅（ms）。ここがランダムだから焦らされる */
const WAIT_MIN = 1300
const WAIT_RAND = 2600
/** ヒキが来てから逃げるまでのチャンス窓（ms） */
const BITE_WINDOW = 850

type Phase = 'idle' | 'casting' | 'bite' | 'result'

type Catch = { key: number; item: Item; size: Size }

/** 関連度＝魚のサイズ。数字が大きいほど大物でレア */
type Size = 1 | 2 | 3

const SIZE_META: Record<Size, { label: string; fish: string; scale: number }> = {
  3: { label: '大物', fish: '🐟', scale: 1.6 },
  2: { label: '中物', fish: '🐟', scale: 1.2 },
  1: { label: '小物', fish: '🐟', scale: 0.85 },
}

/** name完全一致=大物、name部分一致=中物、kind/tag一致=小物 */
function sizeOf(item: Item, q: string): Size {
  if (item.name === q) return 3
  if (item.name.includes(q)) return 2
  return 1
}

/** 大物ほど出にくいよう重み付けして1匹選ぶ（weight = 4 - size） */
function hook(pool: Item[], q: string): Catch {
  const weighted = pool.map((item) => ({ item, size: sizeOf(item, q) }))
  const total = weighted.reduce((acc, w) => acc + (4 - w.size), 0)
  let r = Math.random() * total
  for (const w of weighted) {
    r -= 4 - w.size
    if (r <= 0) return { key: 0, item: w.item, size: w.size }
  }
  const last = weighted[weighted.length - 1]
  return { key: 0, item: last.item, size: last.size }
}

export function FishingSearch() {
  const [query, setQuery] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState('まず狙う言葉を決めて、ポイントに投げ込もう。')
  const [catches, setCatches] = useState<Catch[]>([])
  const [misses, setMisses] = useState(0)

  const waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const windowTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keySeq = useRef(0)

  const pool = useMemo(() => search(query), [query])
  const canCast = pool.length > 0 && phase === 'idle'

  const clearTimers = () => {
    if (waitTimer.current) clearTimeout(waitTimer.current)
    if (windowTimer.current) clearTimeout(windowTimer.current)
    waitTimer.current = null
    windowTimer.current = null
  }

  // unmount時にタイマーを掃除する
  useEffect(() => clearTimers, [])

  const cast = () => {
    if (!canCast) return
    clearTimers()
    setPhase('casting')
    setMessage('ウキが着水。アタリを待つ……')
    // ランダムな待ち時間のあとヒキが来る
    waitTimer.current = setTimeout(
      () => {
        setPhase('bite')
        setMessage('ヒキが来た！ いま合わせろ！')
        // チャンス窓を逃すと逃げられる
        windowTimer.current = setTimeout(() => {
          setPhase('idle')
          setMisses((n) => n + 1)
          setMessage('……スッと軽くなった。合わせが遅い、逃げられた。')
        }, BITE_WINDOW)
      },
      WAIT_MIN + Math.random() * WAIT_RAND,
    )
  }

  const strike = () => {
    if (phase === 'casting') {
      // 早合わせ：気配を消して逃げられる
      clearTimers()
      setPhase('idle')
      setMisses((n) => n + 1)
      setMessage('早すぎた。魚が警戒して沖へ逃げていった。')
      return
    }
    if (phase !== 'bite') return

    clearTimers()
    const got = hook(pool, query.trim())
    got.key = keySeq.current++
    setCatches((prev) => [got, ...prev])
    setPhase('result')
    setMessage(
      got.size === 3
        ? `${SIZE_META[got.size].label}だ！「${got.item.name}」が上がった！`
        : `${SIZE_META[got.size].label}の「${got.item.name}」が釣れた。`,
    )
  }

  const reset = () => {
    clearTimers()
    setPhase('idle')
    setMessage('次のポイントへ。もう一度投げよう。')
  }

  const onPondClick = () => {
    if (phase === 'bite' || phase === 'casting') strike()
  }

  const bigCount = catches.filter((c) => c.size === 3).length
  const floatClass =
    phase === 'idle' || phase === 'result'
      ? 'is-hidden'
      : phase === 'casting'
        ? 'is-waiting'
        : 'is-biting'

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>釣り検索</h2>
      <p style={styles.lead}>
        投げて待つ。ヒキの一瞬で合わせないと逃げる。
        <strong style={{ color: 'var(--text-h)' }}>大物ほど関連度が高く、釣れにくい</strong>。
      </p>

      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          reset()
        }}
        placeholder="狙う言葉（例: ラーメン / あまい / 麺）"
        style={styles.input}
        aria-label="狙う言葉"
      />

      <div
        className={`fish-pond ${phase === 'idle' || phase === 'result' ? 'is-idle' : ''}`}
        onClick={onPondClick}
        role="presentation"
      >
        <span className={`fish-float ${floatClass}`} aria-hidden="true">
          {phase === 'bite' ? '🎣' : '🔴'}
        </span>
        {phase === 'bite' && (
          <span className="fish-alert" aria-hidden="true">
            ！
          </span>
        )}
        <span className="fish-pond-label">
          {phase === 'bite'
            ? 'クリック or「引く」で合わせる'
            : phase === 'casting'
              ? '静かに待つ…（早合わせは禁物）'
              : `ポイントの候補 ${pool.length} 匹`}
        </span>
      </div>

      <div style={styles.controls}>
        <button type="button" className="fish-button" disabled={!canCast} onClick={cast}>
          投げる
        </button>
        <button
          type="button"
          className={`fish-button ${phase === 'bite' ? 'is-strike' : ''}`}
          disabled={phase !== 'bite' && phase !== 'casting'}
          onClick={strike}
        >
          引く
        </button>
      </div>

      <p style={styles.status} aria-live="polite">
        {message}
      </p>

      {query.trim() !== '' && pool.length === 0 && (
        <p style={styles.note}>その言葉に魚は寄っていない。別の言葉を試そう。</p>
      )}

      <div style={styles.stats}>
        <span>
          釣果 <strong style={{ color: 'var(--text-h)' }}>{catches.length}</strong> 匹
        </span>
        <span>
          大物 <strong style={{ color: 'var(--text-h)' }}>{bigCount}</strong> 匹
        </span>
        <span>ボウズ {misses} 回</span>
      </div>

      {catches.length > 0 && (
        <div style={styles.grid}>
          {catches.map((c) => {
            const meta = SIZE_META[c.size]
            return (
              <div key={c.key} className={`fish-catch ${c.size === 3 ? 'is-big' : ''}`}>
                <span style={{ fontSize: 26 * meta.scale, lineHeight: 1 }} aria-hidden="true">
                  {meta.fish}
                </span>
                <span style={styles.name}>{c.item.name}</span>
                <span style={styles.size}>
                  {meta.label} · {c.item.kind}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 520,
    margin: '0 auto',
    padding: '48px 24px 80px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  heading: { fontSize: 22, margin: 0 },
  lead: { margin: 0, fontSize: 14, lineHeight: 1.7 },
  input: {
    padding: '12px 16px',
    border: '1px solid var(--border)',
    borderRadius: 10,
    background: 'var(--bg)',
    color: 'var(--text-h)',
    font: 'inherit',
    fontSize: 16,
    outline: 'none',
  },
  controls: { display: 'flex', gap: 10 },
  status: { margin: 0, fontSize: 14, lineHeight: 1.6, minHeight: 22 },
  note: { margin: 0, fontSize: 14, opacity: 0.7 },
  stats: { display: 'flex', gap: 20, fontSize: 14, flexWrap: 'wrap' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 10,
  },
  name: { fontSize: 14, color: 'var(--text-h)', textAlign: 'center', padding: '0 2px' },
  size: { fontSize: 11, opacity: 0.7, textAlign: 'center' },
}
