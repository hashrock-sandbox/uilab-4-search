import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  clothes,
  conflicts,
  drawOrder,
  searchClothes,
  slotLabel,
  type Cloth,
  type Shape,
  type Slot,
} from '../clothes'
import './ClothingSpace.css'

/**
 * 服はすべて 0..100 のローカル座標で描く。
 * 空間に浮かんでいるときも、人が着ているときも、同じ形をそのまま使う。
 */
const shapes: Record<Shape, (c: string, a: string) => ReactNode> = {
  tee: (c, a) => (
    <>
      <path d="M30 20 L44 15 Q50 23 56 15 L70 20 L86 31 L77 45 L70 39 L70 84 L30 84 L30 39 L23 45 L14 31 Z" fill={c} />
      <path d="M44 15 Q50 23 56 15" fill="none" stroke={a} strokeWidth="3" />
      <path d="M30 78 H70" stroke={a} strokeWidth="3" fill="none" />
    </>
  ),
  shirt: (c, a) => (
    <>
      <path d="M30 20 L44 15 Q50 23 56 15 L70 20 L86 31 L77 45 L70 39 L70 84 L30 84 L30 39 L23 45 L14 31 Z" fill={c} />
      <path d="M44 15 L38 25 L48 24 Z M56 15 L62 25 L52 24 Z" fill={a} />
      <path d="M50 26 V82" stroke={a} strokeWidth="2" fill="none" />
      <circle cx="50" cy="40" r="1.8" fill={a} />
      <circle cx="50" cy="56" r="1.8" fill={a} />
      <circle cx="50" cy="72" r="1.8" fill={a} />
    </>
  ),
  knit: (c, a) => (
    <>
      <path d="M28 21 L44 16 Q50 24 56 16 L72 21 L88 34 L81 50 L72 44 L72 86 L28 86 L28 44 L19 50 L12 34 Z" fill={c} />
      <path d="M40 30 V80 M50 30 V80 M60 30 V80" stroke={a} strokeWidth="2" fill="none" opacity="0.7" />
      <path d="M28 80 H72" stroke={a} strokeWidth="4" fill="none" />
      <path d="M40 18 Q50 27 60 18" fill="none" stroke={a} strokeWidth="4" />
    </>
  ),
  hoodie: (c, a) => (
    <>
      <path d="M29 21 L44 16 Q50 24 56 16 L71 21 L87 32 L78 47 L71 41 L71 85 L29 85 L29 41 L22 47 L13 32 Z" fill={c} />
      <path d="M38 15 Q50 6 62 15 Q58 32 50 32 Q42 32 38 15 Z" fill={a} />
      <path d="M36 60 H64 V74 H36 Z" fill={a} opacity="0.55" />
      <path d="M46 28 V40 M54 28 V40" stroke={a} strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  coat: (c, a) => (
    <>
      <path d="M29 19 L44 14 Q50 22 56 14 L71 19 L87 31 L79 48 L72 42 L72 94 L28 94 L28 42 L21 48 L13 31 Z" fill={c} />
      <path d="M44 14 L40 34 L50 30 Z M56 14 L60 34 L50 30 Z" fill={a} />
      <path d="M50 30 V90" stroke={a} strokeWidth="2" fill="none" />
      <path d="M30 56 H42 M58 56 H70" stroke={a} strokeWidth="2.5" fill="none" opacity="0.8" />
      <circle cx="44" cy="48" r="2" fill={a} />
      <circle cx="44" cy="66" r="2" fill={a} />
    </>
  ),
  jacket: (c, a) => (
    <>
      <path d="M30 20 L44 15 Q50 23 56 15 L70 20 L86 31 L78 46 L70 40 L70 76 L30 76 L30 40 L22 46 L14 31 Z" fill={c} />
      <path d="M44 15 L41 32 L50 28 Z M56 15 L59 32 L50 28 Z" fill={a} />
      <path d="M50 28 V74" stroke={a} strokeWidth="2" fill="none" />
      <path d="M30 70 H70" stroke={a} strokeWidth="4" fill="none" />
    </>
  ),
  dress: (c, a) => (
    <>
      <path d="M33 18 L44 14 Q50 21 56 14 L67 18 L73 30 L67 39 L65 48 Q81 78 84 92 L16 92 Q19 78 35 48 L33 39 L27 30 Z" fill={c} />
      <path d="M44 14 Q50 21 56 14" fill="none" stroke={a} strokeWidth="2.5" />
      <path d="M35 48 Q50 54 65 48" fill="none" stroke={a} strokeWidth="3" />
      <circle cx="38" cy="66" r="2.4" fill={a} />
      <circle cx="58" cy="72" r="2.4" fill={a} />
      <circle cx="48" cy="82" r="2.4" fill={a} />
    </>
  ),
  pants: (c, a) => (
    <>
      <path d="M30 18 H70 L74 92 H56 L50 48 L44 92 H26 Z" fill={c} />
      <path d="M30 18 H70 V26 H30 Z" fill={a} opacity="0.8" />
      <path d="M50 30 V48" stroke={a} strokeWidth="2" fill="none" opacity="0.7" />
    </>
  ),
  skirt: (c, a) => (
    <>
      <path d="M33 18 H67 L80 76 Q50 88 20 76 Z" fill={c} />
      <path d="M33 18 H67 V26 H33 Z" fill={a} opacity="0.8" />
      <path d="M42 28 L36 80 M50 28 V84 M58 28 L64 80" stroke={a} strokeWidth="2" fill="none" opacity="0.6" />
    </>
  ),
  shorts: (c, a) => (
    <>
      <path d="M30 18 H70 L74 62 H56 L50 40 L44 62 H26 Z" fill={c} />
      <path d="M30 18 H70 V26 H30 Z" fill={a} opacity="0.8" />
    </>
  ),
  sneaker: (c, a) => (
    <>
      <path d="M10 44 H30 L42 60 Q50 63 50 70 H10 Z" fill={c} />
      <path d="M10 68 H50 V74 H10 Z" fill={a} />
      <path d="M18 50 L26 58 M24 46 L32 55" stroke={a} strokeWidth="2" fill="none" />
      <path d="M90 44 H70 L58 60 Q50 63 50 70 H90 Z" fill={c} />
      <path d="M50 68 H90 V74 H50 Z" fill={a} />
      <path d="M82 50 L74 58 M76 46 L68 55" stroke={a} strokeWidth="2" fill="none" />
    </>
  ),
  boots: (c, a) => (
    <>
      <path d="M16 24 H34 V52 L46 62 Q50 64 50 70 H16 Z" fill={c} />
      <path d="M16 66 H50 V74 H16 Z" fill={a} />
      <path d="M84 24 H66 V52 L54 62 Q50 64 50 70 H84 Z" fill={c} />
      <path d="M50 66 H84 V74 H50 Z" fill={a} />
    </>
  ),
  cap: (c, a) => (
    <>
      <path d="M20 60 Q20 24 50 24 Q80 24 80 60 Z" fill={c} />
      <path d="M78 50 Q98 54 96 64 L62 64 Z" fill={a} />
      <circle cx="50" cy="26" r="4" fill={a} />
    </>
  ),
  beanie: (c, a) => (
    <>
      <path d="M20 60 Q20 22 50 22 Q80 22 80 60 Z" fill={c} />
      <rect x="16" y="54" width="68" height="14" rx="6" fill={a} />
      <circle cx="50" cy="16" r="8" fill={a} />
    </>
  ),
  hat: (c, a) => (
    <>
      <path d="M30 58 Q28 22 50 22 Q72 22 70 58 Z" fill={c} />
      <ellipse cx="50" cy="60" rx="42" ry="10" fill={c} />
      <path d="M29 52 Q50 60 71 52 L71 60 Q50 68 29 60 Z" fill={a} />
    </>
  ),
  scarf: (c, a) => (
    <>
      <path d="M20 36 Q50 58 80 36 L86 50 Q50 76 14 50 Z" fill={c} />
      <rect x="54" y="60" width="16" height="34" rx="5" fill={c} />
      <path d="M54 84 H70" stroke={a} strokeWidth="4" fill="none" />
      <path d="M26 44 L30 56 M74 44 L70 56" stroke={a} strokeWidth="3" fill="none" opacity="0.7" />
    </>
  ),
  glasses: (c, a) => (
    <>
      <circle cx="31" cy="50" r="16" fill={a} opacity="0.5" />
      <circle cx="69" cy="50" r="16" fill={a} opacity="0.5" />
      <circle cx="31" cy="50" r="16" fill="none" stroke={c} strokeWidth="4" />
      <circle cx="69" cy="50" r="16" fill="none" stroke={c} strokeWidth="4" />
      <path d="M47 50 H53 M15 46 H6 M85 46 H94" stroke={c} strokeWidth="4" fill="none" />
    </>
  ),
  tote: (c, a) => (
    <>
      <path d="M28 38 H72 L76 90 H24 Z" fill={c} />
      <path d="M38 38 Q38 16 50 16 Q62 16 62 38" fill="none" stroke={a} strokeWidth="5" />
      <path d="M30 58 H70" stroke={a} strokeWidth="3" fill="none" opacity="0.6" />
    </>
  ),
  backpack: (c, a) => (
    <>
      <rect x="26" y="30" width="48" height="60" rx="12" fill={c} />
      <path d="M36 30 Q34 14 50 14 Q66 14 64 30" fill="none" stroke={a} strokeWidth="5" />
      <rect x="34" y="60" width="32" height="20" rx="6" fill={a} />
    </>
  ),
}

function ClothShape({ cloth }: { cloth: Cloth }) {
  return <>{shapes[cloth.shape](cloth.color, cloth.accent)}</>
}

/** 服のローカル 0..100 を人体座標に配置する。size は 100 で等倍 */
function place(cx: number, cy: number, size: number) {
  const s = size / 100
  return `translate(${cx - 50 * s} ${cy - 50 * s}) scale(${s})`
}

/** スロットごとの着せ位置。人体は viewBox 0 0 120 226 */
const fitting: Record<Slot, string> = {
  bag: place(96, 112, 58),
  bottom: place(60, 162, 100),
  dress: place(60, 112, 108),
  top: place(60, 97, 100),
  outer: place(60, 102, 112),
  shoes: place(60, 192, 66),
  neck: place(60, 66, 66),
  hat: place(60, 36, 82),
  face: place(60, 40, 58),
}

/** カーソルの正体。服を着せられるマネキン人間 */
function Person({ worn, walking }: { worn: Cloth[]; walking: boolean }) {
  return (
    <svg className={`cs-person${walking ? ' cs-walking' : ''}`} viewBox="0 0 120 226" aria-hidden="true">
      <ellipse className="cs-shadow" cx="60" cy="214" rx="34" ry="7" />
      <g className="cs-body">
        <g className="cs-legs">
          <rect x="48" y="126" width="10" height="80" rx="5" />
          <rect x="62" y="126" width="10" height="80" rx="5" />
        </g>
        <rect x="30" y="66" width="9" height="62" rx="4.5" />
        <rect x="81" y="66" width="9" height="62" rx="4.5" />
        <path d="M42 64 Q60 56 78 64 L80 132 H40 Z" />
        <rect x="55" y="50" width="10" height="16" rx="4" />
        <circle cx="60" cy="38" r="19" />
      </g>
      {drawOrder.map((slot) => {
        const cloth = worn.find((c) => c.slot === slot)
        if (!cloth) return null
        return (
          <g key={slot} className="cs-worn" transform={fitting[slot]}>
            <ClothShape cloth={cloth} />
          </g>
        )
      })}
    </svg>
  )
}

/** 空間の座標。index から決めるので再レンダーでも動かない */
function scatter(index: number, total: number) {
  const cols = 7
  const rows = Math.ceil(total / cols)
  const col = index % cols
  const row = Math.floor(index / cols)
  // 決定的な擬似ランダムで、格子をほどよく崩す（端で見切れない程度に）
  const n = Math.sin(index * 12.9898) * 43758.5453
  const jx = (n - Math.floor(n) - 0.5) * 5
  const m = Math.sin(index * 78.233) * 12345.6789
  const jy = (m - Math.floor(m) - 0.5) * 4
  const padX = 8
  const padY = 9
  return {
    left: `${padX + ((col + 0.5) / cols) * (100 - padX * 2) + jx}%`,
    top: `${padY + ((row + 0.5) / rows) * (100 - padY * 2) + jy}%`,
    delay: `${((index * 37) % 40) / 10}s`,
  }
}

export function ClothingSpace() {
  const [query, setQuery] = useState('')
  const [wornIds, setWornIds] = useState<Partial<Record<Slot, string>>>({})
  const [walking, setWalking] = useState(false)
  const [entered, setEntered] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const personRef = useRef<HTMLDivElement>(null)
  const target = useRef({ x: -999, y: -999 })
  const pos = useRef({ x: -999, y: -999 })
  const stopTimer = useRef(0)

  const hits = useMemo(() => searchClothes(query), [query])
  const hitIds = useMemo(() => new Set(hits.map((c) => c.id)), [hits])

  const worn = useMemo(
    () => drawOrder.map((slot) => clothes.find((c) => c.id === wornIds[slot])).filter((c): c is Cloth => Boolean(c)),
    [wornIds],
  )
  const wornSet = useMemo(() => new Set(worn.map((c) => c.id)), [worn])

  // 人はカーソルを追いかける。少し遅れてついてくるので生き物っぽく見える
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const p = pos.current
      const t = target.current
      p.x += (t.x - p.x) * 0.22
      p.y += (t.y - p.y) * 0.22
      const node = personRef.current
      if (node) {
        const lean = Math.max(-10, Math.min(10, (t.x - p.x) * 0.6))
        node.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${lean * 0.4}deg)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => () => window.clearTimeout(stopTimer.current), [])

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    target.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    if (!entered) {
      pos.current = { ...target.current }
      setEntered(true)
    }
    setWalking(true)
    window.clearTimeout(stopTimer.current)
    stopTimer.current = window.setTimeout(() => setWalking(false), 140)
  }

  /** 触れたら着る。同じ場所の服と、ワンピース系の衝突は自動で脱ぐ */
  const wear = (cloth: Cloth) => {
    if (!hitIds.has(cloth.id) || wornSet.has(cloth.id)) return
    setWornIds((prev) => {
      const next = { ...prev }
      for (const slot of conflicts[cloth.slot] ?? []) delete next[slot]
      next[cloth.slot] = cloth.id
      return next
    })
  }

  const takeOff = (slot: Slot) => setWornIds((prev) => {
    const next = { ...prev }
    delete next[slot]
    return next
  })

  return (
    <div className="cs-page">
      <header className="cs-head">
        <h2 className="cs-title">試着室のカーソル</h2>
        <p className="cs-lead">
          空間に服が浮いています。カーソルは人間です。触れた服から順に、どんどん着ていきます。
        </p>
        <div className="cs-searchbar">
          <svg className="cs-searchicon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M16.5 16.5 L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            className="cs-input"
            type="search"
            value={query}
            placeholder="ニット / 冬 / 青 / きれいめ …"
            onChange={(e) => setQuery(e.target.value)}
            aria-label="服を検索"
          />
          <span className="cs-count">{hits.length} 着</span>
        </div>
      </header>

      <div
        ref={stageRef}
        className="cs-stage"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setWalking(false)}
      >
        {clothes.map((cloth, i) => {
          const spot = scatter(i, clothes.length)
          const dimmed = !hitIds.has(cloth.id)
          return (
            <div
              key={cloth.id}
              className={`cs-item${dimmed ? ' cs-dim' : ''}${wornSet.has(cloth.id) ? ' cs-taken' : ''}`}
              style={{ left: spot.left, top: spot.top, animationDelay: spot.delay }}
              onPointerEnter={() => wear(cloth)}
            >
              <svg className="cs-item-svg" viewBox="0 0 100 100" aria-hidden="true">
                <ClothShape cloth={cloth} />
              </svg>
              <span className="cs-item-name">{cloth.name}</span>
            </div>
          )
        })}

        <div ref={personRef} className={`cs-cursor${entered ? '' : ' cs-away'}`}>
          <Person worn={worn} walking={walking} />
        </div>

        {!entered && <p className="cs-hint">カーソルを空間に入れてください</p>}
      </div>

      <section className="cs-outfit">
        <h3 className="cs-outfit-title">
          いま着ているもの <span className="cs-outfit-num">{worn.length}</span>
        </h3>
        {worn.length === 0 ? (
          <p className="cs-outfit-empty">まだ裸です。</p>
        ) : (
          <ul className="cs-chips">
            {worn.map((cloth) => (
              <li key={cloth.id} className="cs-chip">
                <span className="cs-swatch" style={{ background: cloth.color }} />
                <span className="cs-chip-slot">{slotLabel[cloth.slot]}</span>
                {cloth.name}
                <button className="cs-off" onClick={() => takeOff(cloth.slot)} aria-label={`${cloth.name}を脱ぐ`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {worn.length > 0 && (
          <button className="cs-strip" onClick={() => setWornIds({})}>
            全部脱ぐ
          </button>
        )}
      </section>
    </div>
  )
}
