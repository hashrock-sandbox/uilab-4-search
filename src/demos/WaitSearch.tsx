import { useEffect, useRef, useState } from 'react'
import { items, type Item } from '../data'
import './WaitSearch.css'

/** 遠くから歩いてくる途中の一件 */
type Incoming = {
  id: number
  item: Item
  emoji: string
}

const FOOD_EMOJI = ['🍜', '🍙', '🍡', '🍥', '🍣', '🍤', '🥟', '🍚', '🍢', '🍰', '🍦', '🥢']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function WaitSearch() {
  const [arrived, setArrived] = useState<Incoming[]>([])
  const [incoming, setIncoming] = useState<Incoming | null>(null)
  const [dots, setDots] = useState(1)
  const [nudge, setNudge] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idRef = useRef(0)
  const poolRef = useRef<Item[]>([...items].sort(() => Math.random() - 0.5))

  // 「…」がゆっくり増える。待っている時間の可視化
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d % 3) + 1), 700)
    return () => clearInterval(id)
  }, [])

  // 待っていると、探し物が向こうからひとつずつやって来る
  useEffect(() => {
    let alive = true

    const schedule = () => {
      const delay = 3500 + Math.random() * 4500
      timerRef.current = setTimeout(() => {
        if (!alive) return
        const pool = poolRef.current
        if (pool.length === 0) {
          poolRef.current = [...items].sort(() => Math.random() - 0.5)
        }
        const item = poolRef.current.shift()!
        const one: Incoming = { id: idRef.current++, item, emoji: pick(FOOD_EMOJI) }
        // まず遠くに出現させ、歩いてこさせる
        setIncoming(one)
        // 歩行アニメの尺のあと、静かに積もる
        timerRef.current = setTimeout(() => {
          if (!alive) return
          setArrived((prev) => [one, ...prev])
          setIncoming(null)
          schedule()
        }, 2600)
      }, delay)
    }

    schedule()
    return () => {
      alive = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // せっかちに操作しようとすると、そっと諭す
  const soothe = () => {
    setNudge('　まあ、待ってください。探し物のほうから来ます。')
    setTimeout(() => setNudge(''), 2400)
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>待つ検索</h2>
      <p style={styles.lead}>検索しません。ただ待つと、探し物のほうから歩いてきます。</p>

      <button
        type="button"
        className="wait-fake-field"
        onClick={soothe}
        aria-label="検索窓（機能しません）"
      >
        <span className="wait-fake-icon" aria-hidden="true">
          🔍
        </span>
        <span className="wait-fake-placeholder">検索しないでください{'…'.slice(0, dots)}</span>
      </button>

      {nudge && (
        <p className="wait-nudge" role="status">
          {nudge}
        </p>
      )}

      <div className="wait-road" aria-hidden={!incoming}>
        <div className="wait-horizon" />
        {incoming ? (
          <span key={incoming.id} className="wait-walker" title={incoming.item.name}>
            {incoming.emoji}
          </span>
        ) : (
          <span className="wait-quiet">{'…'.repeat(dots)}</span>
        )}
      </div>

      <p style={styles.status} aria-live="polite">
        {incoming
          ? `${incoming.item.name} が、こちらへ歩いてきています…`
          : arrived.length > 0
            ? `${arrived.length} 件、向こうから来ました`
            : 'まだ何も来ていません。待ちましょう'}
      </p>

      <ul style={styles.list}>
        {arrived.map((a) => (
          <li key={a.id} className="wait-arrived">
            <span className="wait-arrived-emoji" aria-hidden="true">
              {a.emoji}
            </span>
            <span style={styles.name}>{a.item.name}</span>
            <span style={styles.meta}>
              {a.item.kind} · {a.item.tags.join(' / ')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 520, margin: '0 auto', padding: '48px 24px 80px', textAlign: 'left' },
  heading: { fontSize: 22, margin: '0 0 6px' },
  lead: { margin: '0 0 24px', fontSize: 14, lineHeight: 1.7 },
  status: { margin: '14px 2px 10px', fontSize: 13, opacity: 0.75 },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 },
  name: { fontSize: 15, color: 'var(--text-h)' },
  meta: { fontSize: 12, opacity: 0.7 },
}
