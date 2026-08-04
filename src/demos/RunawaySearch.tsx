import { useEffect, useRef, useState } from 'react'
import { search } from '../data'

/** これより近づくと逃げ出す距離(px) */
const FLEE_RADIUS = 170
/** 定位置からずれられる上限(px) */
const LIMIT = 240

export function RunawaySearch() {
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [query, setQuery] = useState('')
  const [caught, setCaught] = useState(false)
  const [flees, setFlees] = useState(0)

  useEffect(() => {
    if (caught) return

    const onMove = (e: MouseEvent) => {
      const el = boxRef.current
      if (!el) return

      const rect = el.getBoundingClientRect()
      const dx = rect.left + rect.width / 2 - e.clientX
      const dy = rect.top + rect.height / 2 - e.clientY
      const dist = Math.hypot(dx, dy) || 1
      if (dist > FLEE_RADIUS) return

      // カーソルと逆方向へ、近いほど強く押しのけられる
      const push = (FLEE_RADIUS - dist) * 0.35
      setOffset((prev) => ({
        x: clamp(prev.x + (dx / dist) * push, LIMIT),
        y: clamp(prev.y + (dy / dist) * push, LIMIT),
      }))
      setFlees((n) => n + 1)
    }

    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [caught])

  const results = search(query)

  return (
    <div style={styles.stage}>
      <p style={styles.hint}>
        {caught
          ? '観念したようです。検索してください。'
          : flees > 40
            ? 'マウスでは捕まりません。Tab キーを押してみてください。'
            : 'この検索窓をクリックしてください。'}
      </p>

      <div
        ref={boxRef}
        style={{
          ...styles.box,
          transform: `translate(${offset.x}px, ${offset.y}px)`,
          transition: caught ? 'transform .4s ease-out' : 'transform .12s ease-out',
          borderColor: caught ? 'var(--accent)' : 'var(--border)',
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setCaught(true)
            setOffset({ x: 0, y: 0 })
          }}
          onBlur={() => setCaught(false)}
          placeholder="なにか食べたい"
          style={styles.input}
        />
      </div>

      {caught && query && (
        <ul style={styles.results}>
          {results.length === 0 && <li style={styles.empty}>見つかりません</li>}
          {results.map((item) => (
            <li key={item.id} style={styles.item}>
              <strong style={{ color: 'var(--text-h)' }}>{item.name}</strong>
              <span style={styles.kind}>{item.kind}</span>
            </li>
          ))}
        </ul>
      )}

      {!caught && flees > 0 && (
        <p style={styles.counter}>{flees} 回 逃げられました</p>
      )}
    </div>
  )
}

function clamp(value: number, limit: number) {
  return Math.max(-limit, Math.min(limit, value))
}

const styles: Record<string, React.CSSProperties> = {
  stage: {
    minHeight: 'calc(100vh - 60px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    padding: 40,
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  hint: { margin: 0, fontSize: 15 },
  box: {
    background: 'var(--bg)',
    border: '1px solid',
    borderRadius: 12,
    boxShadow: 'var(--shadow)',
    padding: 4,
  },
  input: {
    width: 280,
    padding: '12px 16px',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'var(--text-h)',
    font: 'inherit',
    fontSize: 17,
  },
  results: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    width: 300,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 14px',
    borderRadius: 8,
    background: 'var(--code-bg)',
    fontSize: 15,
  },
  kind: { fontSize: 13, opacity: 0.7 },
  empty: { padding: '8px 14px', fontSize: 15, opacity: 0.7 },
  counter: { margin: 0, fontSize: 13, opacity: 0.6 },
}
