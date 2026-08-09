import { useEffect, useMemo, useRef, useState } from 'react'
import { items, search } from '../data'
import './SentoSearch.css'

/** 湯船にただよう一件の桶（他人 or 自分のクエリ） */
type Bubble = {
  id: number
  text: string
  guest: string
  mine: boolean
  x: number
  y: number
  vx: number
  phase: number // 縦揺れ用の位相
}

/** 常連客の名前。誰かの検索に相乗りする体験のための顔ぶれ */
const GUESTS = ['ふろ太郎', 'ゆのみ', '番台のぬし', 'サウナー', '湯上がり', '常連A', 'ケロリン', '長風呂さん']

/** items と tag から「他人が打ちそうな検索ワード」を作る */
const WORDS: string[] = Array.from(
  new Set([
    ...items.map((it) => it.name),
    ...items.flatMap((it) => it.tags),
    ...items.map((it) => it.kind),
  ]),
)

const MAX_BUBBLES = 9
const BATH_H = 200
const BUBBLE_H = 34

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function SentoSearch() {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState('')
  // 描画用のリスト。位置は ref 側で毎フレーム更新し、DOM に直接当てる
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const bubblesRef = useRef<Bubble[]>([])
  const nodesRef = useRef(new Map<number, HTMLButtonElement>())
  const bathRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(0)

  // 湯気。left% と長さだけ決めておき、あとは CSS アニメに任せる
  const steam = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        id: i,
        left: rand(6, 92),
        dur: rand(4.5, 8),
        delay: rand(0, 6),
        char: pick(['♨', '～', '˚']),
      })),
    [],
  )

  const spawn = (mine = false, text?: string) => {
    const bath = bathRef.current
    const w = bath?.clientWidth ?? 480
    const word = text ?? pick(WORDS)
    const b: Bubble = {
      id: idRef.current++,
      text: word,
      guest: mine ? 'あなた' : pick(GUESTS),
      mine,
      x: mine ? -140 : rand(-160, w),
      y: rand(6, BATH_H - BUBBLE_H - 6),
      vx: rand(14, 34) * (mine ? 1.2 : 1),
      phase: rand(0, Math.PI * 2),
    }
    const next = [...bubblesRef.current, b].slice(-MAX_BUBBLES)
    bubblesRef.current = next
    setBubbles(next)
  }

  // 初期の常連さん＋定期的な新規客
  useEffect(() => {
    for (let i = 0; i < 5; i++) spawn(false)
    const id = setInterval(() => spawn(false), 2600)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // お湯の流れ。桶を右へ流し、端まで行ったら左へ回り込ませる
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const w = bathRef.current?.clientWidth ?? 480
      const t = now / 1000
      for (const b of bubblesRef.current) {
        b.x += b.vx * dt
        if (b.x > w + 20) b.x = -180
        const node = nodesRef.current.get(b.id)
        if (node) {
          const bob = Math.sin(t * 1.4 + b.phase) * 5
          node.style.transform = `translate(${b.x}px, ${b.y + bob}px)`
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const active = picked || query
  const results = useMemo(() => search(active), [active])

  const adopt = (text: string) => {
    setPicked(text)
    setQuery('')
  }

  const release = () => {
    const q = query.trim()
    if (!q) return
    spawn(true, q)
    setPicked(q)
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>検索の銭湯</h2>
      <p style={styles.lead}>
        他人のクエリがゆるく流れてくる公衆検索場。湯船に浮かぶ桶を拾えば、その人の検索に相乗りできます。
        自分で打ったクエリも湯に放たれ、他の客に混ざって流れていきます。
      </p>

      <div className="sento-noren" aria-hidden="true">
        <span className="sento-noren-panel">ゆ</span>
        <span className="sento-noren-panel">検</span>
        <span className="sento-noren-panel">索</span>
      </div>

      <div className="sento-bath" ref={bathRef} aria-label="湯船。流れてくる桶をクリックで拾えます">
        {steam.map((s) => (
          <span
            key={s.id}
            className="sento-steam"
            style={{
              left: `${s.left}%`,
              animationDuration: `${s.dur}s`,
              animationDelay: `${s.delay}s`,
            }}
          >
            {s.char}
          </span>
        ))}
        {bubbles.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`sento-bubble${b.mine ? ' is-mine' : ''}`}
            ref={(el) => {
              if (el) nodesRef.current.set(b.id, el)
              else nodesRef.current.delete(b.id)
            }}
            onClick={() => adopt(b.text)}
            title={`${b.guest} さんの検索`}
          >
            <span className="sento-bubble-mark">🪣</span>
            {b.text}
            <span className="sento-guest">{b.guest}</span>
          </button>
        ))}
      </div>

      <p className="sento-hint">
        <span aria-hidden="true">♨</span>
        桶をクリックで相乗り／下の窓に打つと自分の桶を放流
      </p>

      <div className="sento-field">
        <label htmlFor="sento-input" className="sento-sr-only">
          自分のクエリを放流
        </label>
        <input
          id="sento-input"
          className="sento-input"
          type="search"
          autoComplete="off"
          value={query}
          placeholder="湯に放つ言葉を打つ…"
          onChange={(e) => {
            setQuery(e.target.value)
            setPicked('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') release()
          }}
        />
        <button type="button" className="sento-noren-panel" onClick={release} aria-label="放流">
          放
        </button>
      </div>

      <p style={styles.status} aria-live="polite">
        {active.trim() ? `「${active}」に相乗り中 · ${results.length} 件` : '桶を拾うか、言葉を放ってください'}
      </p>

      {active.trim() && (
        <ul style={styles.list}>
          {results.length === 0 ? (
            <li className="sento-option" style={{ opacity: 0.7 }}>
              その湯に合う一品は見つかりませんでした
            </li>
          ) : (
            results.map((item) => (
              <li key={item.id} className="sento-option">
                <span style={styles.name}>
                  <Highlight text={item.name} query={active} />
                </span>
                <span style={styles.meta}>
                  {item.kind} · {item.tags.join(' / ')}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

/** マッチした部分だけ <mark> で囲む */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const at = text.indexOf(q)
  if (at === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 520, margin: '0 auto', padding: '48px 24px 80px', textAlign: 'left' },
  heading: { fontSize: 22, margin: '0 0 6px' },
  lead: { margin: '0 0 24px', fontSize: 14, lineHeight: 1.7 },
  status: { margin: '14px 2px 6px', fontSize: 13, opacity: 0.75 },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 4,
    border: '1px solid var(--border)',
    borderRadius: 10,
  },
  name: { fontSize: 15, color: 'var(--text-h)' },
  meta: { fontSize: 12, opacity: 0.7, textAlign: 'right' },
}
