import { useEffect, useMemo, useRef, useState } from 'react'
import { search, type Item } from '../data'
import './PhysicsSearch.css'

/** 落下してくる一件。位置と速度を持ち、床や他の箱に積もる */
type Box = {
  id: number
  name: string
  mass: number // 関連度＝質量（3=重い / 1=軽い）
  w: number
  h: number
  x: number
  y: number
  vy: number
  settled: boolean
  releaseAt: number // この時刻を過ぎたら落下開始
}

const BIN_H = 300
const BOX_H = 34
const GRAVITY = 1400

/** クエリへの一致の強さを質量に変換 */
function massOf(item: Item, q: string): number {
  if (item.name === q) return 3
  if (item.name.includes(q)) return 2
  return 1 // kind / tag ヒット
}

export function PhysicsSearch() {
  const [query, setQuery] = useState('')
  const [boxes, setBoxes] = useState<Box[]>([])
  const boxesRef = useRef<Box[]>([])
  const nodesRef = useRef(new Map<number, HTMLDivElement>())
  const binRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(0)

  const results = useMemo(() => search(query), [query])

  const drop = () => {
    const q = query.trim()
    if (!q) return
    const bin = binRef.current
    const w = bin?.clientWidth ?? 480
    const now = performance.now()
    // 重いものから先に落として、下に沈むようにする
    const ranked = [...results].sort((a, b) => massOf(b, query) - massOf(a, query))
    const next: Box[] = ranked.map((item, i) => {
      const m = massOf(item, query)
      const bw = Math.min(w - 12, 60 + item.name.length * 18)
      return {
        id: idRef.current++,
        name: item.name,
        mass: m,
        w: bw,
        h: BOX_H,
        x: Math.random() * Math.max(1, w - bw),
        y: -BOX_H - i * 8,
        vy: 0,
        settled: false,
        releaseAt: now + i * 160,
      }
    })
    boxesRef.current = next
    setBoxes(next)
  }

  const clear = () => {
    boxesRef.current = []
    setBoxes([])
  }

  // 自前の簡易物理。重力で落として床・他の箱の上に積む
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.04, (now - last) / 1000)
      last = now
      const list = boxesRef.current
      for (const b of list) {
        if (b.settled) continue
        if (now < b.releaseAt) continue
        // 重いほど強い重力で速く落ちる
        b.vy += GRAVITY * (0.7 + b.mass * 0.25) * dt
        let ny = b.y + b.vy * dt
        // 着地面 = 床 or 水平に重なる既着地ボックスの天面
        let rest = BIN_H - b.h
        for (const o of list) {
          if (o === b || !o.settled) continue
          const overlap = b.x < o.x + o.w - 4 && b.x + b.w > o.x + 4
          if (overlap) rest = Math.min(rest, o.y - b.h)
        }
        if (ny >= rest) {
          ny = rest
          // 軽いものは少しだけ跳ねる
          if (b.mass === 1 && b.vy > 350) {
            b.vy = -b.vy * 0.28
            ny = rest
          } else {
            b.vy = 0
            b.settled = true
          }
        }
        b.y = ny
        const node = nodesRef.current.get(b.id)
        if (node) node.style.transform = `translate(${b.x}px, ${b.y}px)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>物理演算検索</h2>
      <p style={styles.lead}>関連度＝質量。重い一品ほど速く沈み、軽いものは上で跳ねます。</p>

      <div style={styles.field}>
        <input
          style={styles.input}
          type="search"
          autoComplete="off"
          value={query}
          placeholder="食べ物を検索して落とす"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') drop()
          }}
        />
        <button type="button" style={styles.btn} onClick={drop} disabled={!query.trim()}>
          落とす（{results.length}）
        </button>
        <button type="button" style={styles.btnGhost} onClick={clear}>
          片づける
        </button>
      </div>

      <div className="phys-bin" ref={binRef} style={{ height: BIN_H }} aria-live="polite">
        {boxes.length === 0 && <p className="phys-empty">ここに結果が降り積もります</p>}
        {boxes.map((b) => (
          <div
            key={b.id}
            className={`phys-box mass-${b.mass}`}
            ref={(el) => {
              if (el) nodesRef.current.set(b.id, el)
              else nodesRef.current.delete(b.id)
            }}
            style={{ width: b.w, height: b.h }}
          >
            {b.name}
            <span className="phys-mass" aria-hidden="true">
              {'●'.repeat(b.mass)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 520, margin: '0 auto', padding: '48px 24px 80px', textAlign: 'left' },
  heading: { fontSize: 22, margin: '0 0 6px' },
  lead: { margin: '0 0 24px', fontSize: 14, lineHeight: 1.7 },
  field: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  input: {
    flex: 1,
    minWidth: 180,
    padding: '10px 12px',
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg)',
    color: 'var(--text-h)',
    font: 'inherit',
    fontSize: 15,
  },
  btn: {
    padding: '10px 14px',
    border: '1px solid var(--accent-border)',
    borderRadius: 8,
    background: 'var(--accent-bg)',
    color: 'var(--accent)',
    font: 'inherit',
    fontSize: 14,
    cursor: 'pointer',
  },
  btnGhost: {
    padding: '10px 14px',
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'transparent',
    color: 'var(--text)',
    font: 'inherit',
    fontSize: 14,
    cursor: 'pointer',
  },
}
