import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './Loupe.css'

type Mode = 'idle' | 'focus' | 'searching'

const W = 640
const H = 240
const CY = 120
const R0 = 32
const BL = 60
const BR = 580
const TEXT_X = 96
const LENS_HOME_X = 534
const LENS_Y = CY - 2.5 // 中央よりわずかに上へ
const SCAN_FROM = 128
const SCAN_TO = 438
const SCAN_HALF = 1.15
const SCAN_TOTAL = SCAN_HALF * 3
const MAG = 1.55
const GLASS_R = 27
const ICON_SZ = 0.45 // アイドル時のフラットアイコン縮尺

const EDGE = BR - BL - 2 * R0
const CAP = Math.PI * R0
const PERIM = 2 * EDGE + 2 * CAP
const N_PTS = 240
// feature flag: 枠のバネ波打ち(パルス・ヒット反応含む)
const WAVE_ENABLED = false

// 検索中にボックス内を流れるダミーコーパス
const STREAM_TEXTS = [
  'field notes — tide tables, bottle-green shards, a letter from the lighthouse keeper, salt maps, '.repeat(
    3,
  ),
  'lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore, '.repeat(
    3,
  ),
  'catalogue №4 · driftwood · quartz pebble · gull feather · fishing float · sea glass, frosted · '.repeat(
    3,
  ),
]
const STREAM_LEN = 1500
const STREAM_SPEEDS = [1, 1.45, 0.72]

// pill外周を周長sでパラメータ化し、位置と外向き法線を返す
function pillPoint(s: number): [number, number, number, number] {
  if (s < EDGE) {
    return [BL + R0 + s, CY - R0, 0, -1]
  }
  s -= EDGE
  if (s < CAP) {
    const a = -Math.PI / 2 + s / R0
    const nx = Math.cos(a)
    const ny = Math.sin(a)
    return [BR - R0 + R0 * nx, CY + R0 * ny, nx, ny]
  }
  s -= CAP
  if (s < EDGE) {
    return [BR - R0 - s, CY + R0, 0, 1]
  }
  s -= EDGE
  const a = Math.PI / 2 + s / R0
  const nx = Math.cos(a)
  const ny = Math.sin(a)
  return [BL + R0 + R0 * nx, CY + R0 * ny, nx, ny]
}

function outlinePath(disp: Float64Array): string {
  let d = 'M'
  for (let i = 0; i < N_PTS; i++) {
    const s = (i / N_PTS) * PERIM
    const [px, py, nx, ny] = pillPoint(s)
    const w = disp[i]
    d += `${i === 0 ? '' : 'L'}${(px + nx * w).toFixed(2)} ${(py + ny * w).toFixed(2)}`
  }
  return d + 'Z'
}

// 外周弧長s → バネノード番号
function nodeAt(s: number): number {
  return ((Math.round((s / PERIM) * N_PTS) % N_PTS) + N_PTS) % N_PTS
}

// ガウス状の速度キックを注入する
function poke(vel: Float64Array, node: number, amp: number, sigma: number) {
  const span = Math.ceil(sigma * 3)
  for (let di = -span; di <= span; di++) {
    const i = (node + di + N_PTS) % N_PTS
    vel[i] += amp * Math.exp(-((di / sigma) ** 2))
  }
}

function buildResults(q: string, n: number) {
  const pool = [
    { tag: 'Exact match', title: q, desc: 'Found right under the lens.' },
    {
      tag: 'Article',
      title: `${q} — field notes`,
      desc: 'Observations gathered while scanning.',
    },
    {
      tag: 'Collection',
      title: `Everything about ${q}`,
      desc: 'A drawer of loosely related findings.',
    },
    { tag: 'Thread', title: `Re: ${q}`, desc: 'People arguing about it, politely.' },
    { tag: 'Image', title: `${q}, photographed`, desc: 'Blurry but promising.' },
    { tag: 'Archive', title: `${q} (1998)`, desc: 'An older sighting, still legible.' },
  ]
  return pool.slice(0, Math.max(1, Math.min(n, pool.length)))
}

export function Loupe() {
  const [value, setValue] = useState('')
  const [mode, setMode] = useState<Mode>('idle')
  const [results, setResults] = useState<ReturnType<typeof buildResults> | null>(
    null,
  )
  const [hits, setHits] = useState(0)
  const [filter, setFilter] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const framePathRef = useRef<SVGPathElement>(null)
  const glowPathRef = useRef<SVGPathElement>(null)
  const magFramePathRef = useRef<SVGPathElement>(null)
  const lensGroupRef = useRef<SVGGElement>(null)
  const magGroupRef = useRef<SVGGElement>(null)
  const magLayerRef = useRef<SVGGElement>(null)
  const flatIconRef = useRef<SVGGElement>(null)
  const realLensRef = useRef<SVGGElement>(null)
  const textScrollRef = useRef<SVGGElement>(null)
  const clipCircleRef = useRef<SVGCircleElement>(null)
  const shadowRef = useRef<SVGEllipseElement>(null)
  const dotsRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLElement>(null)
  const streamRef = useRef<SVGGElement>(null)
  const streamMagRef = useRef<SVGGElement>(null)

  const anim = useRef({
    mode: 'idle' as Mode,
    query: '',
    x: LENS_HOME_X,
    prevX: LENS_HOME_X,
    scale: 1,
    tilt: 0,
    morph: 0,
    streamX: 0,
    scanT: 0,
    hover: false,
    disp: new Float64Array(N_PTS),
    vel: new Float64Array(N_PTS),
    hitTimes: [] as number[],
    hitWidths: [] as number[],
    hitsFired: 0,
  })

  useEffect(() => {
    const a = anim.current
    a.mode = mode
    if (mode === 'searching') a.scanT = 0
  }, [mode])

  // 完了判定はrAFと独立させる(タブが隠れてrAFが止まっても検索は終わる)
  useEffect(() => {
    if (mode !== 'searching') return
    const t = setTimeout(() => {
      const a = anim.current
      setResults(buildResults(a.query, a.hitTimes.length))
      setHits(a.hitTimes.length)
      setMode(document.activeElement === inputRef.current ? 'focus' : 'idle')
    }, SCAN_TOTAL * 1000)
    return () => clearTimeout(t)
  }, [mode])

  useEffect(() => {
    const a = anim.current
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const searching = a.mode === 'searching'

      // 枠のバネ物理: 復元 + 隣接結合(伝播) + 減衰
      const K = 80
      const C = 2500
      const DAMP = 3.5
      if (WAVE_ENABLED && !reduce) {
        const sub = Math.max(1, Math.ceil(dt / 0.012))
        const h = dt / sub
        const { disp, vel } = a
        for (let st = 0; st < sub; st++) {
          for (let i = 0; i < N_PTS; i++) {
            const prev = disp[(i - 1 + N_PTS) % N_PTS]
            const next = disp[(i + 1) % N_PTS]
            const lap = prev + next - 2 * disp[i]
            vel[i] += (-K * disp[i] + C * lap - DAMP * vel[i]) * h
          }
          for (let i = 0; i < N_PTS; i++) {
            disp[i] += vel[i] * h
            if (disp[i] > 9) disp[i] = 9
            else if (disp[i] < -9) disp[i] = -9
          }
        }
      }

      const d = outlinePath(a.disp)
      framePathRef.current?.setAttribute('d', d)
      magFramePathRef.current?.setAttribute('d', d)
      glowPathRef.current?.setAttribute('d', d)
      let peak = 0
      for (let i = 0; i < N_PTS; i++) {
        const v = Math.abs(a.disp[i])
        if (v > peak) peak = v
      }
      glowPathRef.current?.setAttribute(
        'opacity',
        (Math.min(1, peak / 6.5) * 0.5).toFixed(3),
      )

      // ルーペの位置
      let targetX = LENS_HOME_X
      let targetScale = a.hover && !searching ? 1.06 : 1
      if (searching) {
        a.scanT += dt
        targetScale = 1.13
        const p = 0.5 - 0.5 * Math.cos((a.scanT / SCAN_HALF) * Math.PI)
        targetX = SCAN_FROM + (SCAN_TO - SCAN_FROM) * p

        // ヒット: レンズ直下の上下エッジが内側にへこむ。数が増えるほど強く
        while (
          a.hitsFired < a.hitTimes.length &&
          a.scanT >= a.hitTimes[a.hitsFired]
        ) {
          if (WAVE_ENABLED) {
            const kick = -(70 + a.hitsFired * 16)
            poke(a.vel, nodeAt(a.x - (BL + R0)), kick, 4.5)
            poke(a.vel, nodeAt(EDGE + CAP + (BR - R0 - a.x)), kick, 4.5)
          }
          a.hitsFired++
          setHits(a.hitsFired)
        }
      }
      const followRate = 1 - Math.exp(-dt * (searching ? 14 : 6))
      a.x += (targetX - a.x) * followRate
      a.scale += (targetScale - a.scale) * (1 - Math.exp(-dt * 8))

      const vx = (a.x - a.prevX) / Math.max(dt, 1e-4)
      a.prevX = a.x
      const targetTilt = reduce ? 0 : Math.max(-10, Math.min(10, vx * 0.028))
      a.tilt += (targetTilt - a.tilt) * (1 - Math.exp(-dt * 10))

      // フラットアイコン(0) ⇔ リアルルーペ(1) のモーフ
      const targetMorph = searching ? 1 : 0
      if (reduce) a.morph = targetMorph
      else
        a.morph +=
          (targetMorph - a.morph) * (1 - Math.exp(-dt * (searching ? 9 : 5)))
      const sz = ICON_SZ + (1 - ICON_SZ) * a.morph
      const worldScale = a.scale * sz

      lensGroupRef.current?.setAttribute(
        'transform',
        `translate(${a.x.toFixed(2)} ${LENS_Y}) rotate(${a.tilt.toFixed(2)}) scale(${worldScale.toFixed(3)})`,
      )
      flatIconRef.current?.setAttribute('opacity', (1 - a.morph).toFixed(3))
      realLensRef.current?.setAttribute('opacity', a.morph.toFixed(3))
      magLayerRef.current?.setAttribute('opacity', a.morph.toFixed(3))

      // ダミーテキストのストリーム(通常世界と拡大世界の両方を同期スクロール)
      if (!reduce && a.morph > 0.01) a.streamX += dt * 240
      for (const ref of [streamRef, streamMagRef]) {
        const g = ref.current
        if (!g) continue
        for (let ri = 0; ri < g.children.length; ri++) {
          const off = -((a.streamX * STREAM_SPEEDS[ri]) % STREAM_LEN)
          g.children[ri].setAttribute('transform', `translate(${off.toFixed(1)} 0)`)
        }
      }
      streamRef.current?.setAttribute('opacity', a.morph.toFixed(3))
      textScrollRef.current?.setAttribute('opacity', (1 - a.morph).toFixed(3))

      // レンズ下の拡大世界: p' = L + MAG * (p - L)
      const rEff = GLASS_R * worldScale
      clipCircleRef.current?.setAttribute('cx', a.x.toFixed(2))
      clipCircleRef.current?.setAttribute('r', rEff.toFixed(2))
      magGroupRef.current?.setAttribute(
        'transform',
        `translate(${(a.x * (1 - MAG)).toFixed(2)} ${(LENS_Y * (1 - MAG)).toFixed(2)}) scale(${MAG})`,
      )

      // 入力の横スクロールに拡大テキストを追随させる
      const scroll = inputRef.current?.scrollLeft ?? 0
      textScrollRef.current?.setAttribute('transform', `translate(${-scroll} 0)`)

      // 浮き上がりに応じて影が離れる(フラットアイコン時は影なし)
      const lift = Math.max(0, (a.scale - 1) / 0.13)
      shadowRef.current?.setAttribute('cx', (a.x + 6 + lift * 10).toFixed(2))
      shadowRef.current?.setAttribute('cy', (LENS_Y + 38 + lift * 6).toFixed(2))
      shadowRef.current?.setAttribute('rx', ((24 + lift * 9) * sz).toFixed(2))
      shadowRef.current?.setAttribute(
        'opacity',
        ((0.22 - lift * 0.1) * a.morph).toFixed(3),
      )

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // ドット → 結果カードへのFLIPモーフ
  useLayoutEffect(() => {
    if (!results) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const dots = dotsRef.current?.querySelectorAll<HTMLElement>('.hit-pill')
    const cards = resultsRef.current?.querySelectorAll<HTMLElement>('.result-card')
    if (!dots?.length || !cards?.length) return
    cards.forEach((card, i) => {
      const dot = dots[Math.min(i, dots.length - 1)]
      const dr = dot.getBoundingClientRect()
      const cr = card.getBoundingClientRect()
      // マウント直後で未レイアウトのときは名目サイズで代用
      const dw = dr.width || 30
      const dh = dr.height || 6
      const dx = dr.left + dr.width / 2 - (cr.left + cr.width / 2)
      const dy = dr.top + dr.height / 2 - (cr.top + cr.height / 2)
      card.animate(
        [
          {
            transform: `translate(${dx}px, ${dy}px) scale(${dw / cr.width}, ${dh / cr.height})`,
            borderRadius: '999px',
            background: 'var(--text)',
            borderColor: 'transparent',
          },
          {
            transform: 'none',
            borderRadius: '14px',
            background: 'var(--bg)',
            borderColor: 'var(--border)',
          },
        ],
        {
          duration: 800,
          delay: 500 + i * 110,
          easing: 'cubic-bezier(0.25, 0.7, 0.2, 1)',
          fill: 'backwards',
        },
      )
      for (const child of Array.from(card.children))
        (child as HTMLElement).animate(
          [{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }],
          {
            duration: 1000,
            delay: 500 + i * 110,
            easing: 'ease-out',
            fill: 'backwards',
          },
        )
    })
  }, [results])

  const startSearch = () => {
    if (mode === 'searching') return
    const q = value.trim()
    if (!q) {
      inputRef.current?.focus()
      return
    }
    const a = anim.current
    a.query = q
    // ヒット時刻をランダム生成(3〜6件)。件数が結果数にもなる
    const count = 3 + Math.floor(Math.random() * 4)
    a.hitTimes = Array.from(
      { length: count },
      () => 0.35 + Math.random() * (SCAN_TOTAL - 0.75),
    ).sort((x, y) => x - y)
    a.hitWidths = a.hitTimes.map(() => Math.round(22 + Math.random() * 42))
    a.hitsFired = 0
    setHits(0)
    setFilter(null)
    setResults(null)
    inputRef.current?.blur()
    setMode('searching')
    // 検索開始のパルス: ルーペのホーム位置(右キャップ)から波紋が走る
    if (WAVE_ENABLED) poke(a.vel, nodeAt(EDGE + CAP / 2), 100, 9)
  }

  return (
    <main className="loupe">
      <div className={`search-wrap mode-${mode}`}>
        <svg
          className="frame-layer"
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          aria-hidden="true"
        >
          <defs>
            <clipPath id="loupeBoxClip">
              <rect x={BL + 4} y={92} width={BR - BL - 8} height={56} rx={28} />
            </clipPath>
          </defs>
          <path ref={glowPathRef} className="frame-glow" />
          <path ref={framePathRef} className="frame-line" />
          <g ref={streamRef} clipPath="url(#loupeBoxClip)" opacity={0}>
            {STREAM_TEXTS.map((t, ri) => (
              <g key={ri}>
                <text className="stream-text" x={68} y={102 + ri * 17}>
                  {t}
                </text>
                <text className="stream-text" x={68 + STREAM_LEN} y={102 + ri * 17}>
                  {t}
                </text>
              </g>
            ))}
          </g>
        </svg>

        <input
          ref={inputRef}
          className="search-input"
          type="text"
          value={value}
          maxLength={40}
          placeholder="search anything"
          readOnly={mode === 'searching'}
          onChange={(e) => {
            setValue(e.target.value)
            if (results) {
              setResults(null)
              setHits(0)
              setFilter(null)
            }
          }}
          onFocus={() => {
            if (anim.current.mode !== 'searching') setMode('focus')
          }}
          onBlur={() => {
            if (anim.current.mode !== 'searching') setMode('idle')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) startSearch()
            if (e.key === 'Escape') {
              setValue('')
              setResults(null)
              setHits(0)
              setFilter(null)
            }
          }}
        />

        <svg
          className="lens-layer"
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          aria-hidden="true"
        >
          <defs>
            <clipPath id="loupeLensClip">
              <circle
                ref={clipCircleRef}
                cx={LENS_HOME_X}
                cy={LENS_Y}
                r={GLASS_R}
              />
            </clipPath>
            <radialGradient id="loupeGlassGrad" cx="35%" cy="30%" r="80%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
              <stop offset="55%" stopColor="rgba(210,225,240,0.10)" />
              <stop offset="82%" stopColor="rgba(150,175,205,0.24)" />
              <stop offset="100%" stopColor="rgba(80,105,140,0.38)" />
            </radialGradient>
            <linearGradient id="loupeRimGrad" x1="0" y1="0" x2="0.4" y2="1">
              <stop offset="0" stopColor="#f2f3f6" />
              <stop offset="0.45" stopColor="#c3c6ce" />
              <stop offset="0.55" stopColor="#93969f" />
              <stop offset="1" stopColor="#5c5f68" />
            </linearGradient>
            <linearGradient id="loupeGripGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6a6a76" />
              <stop offset="0.3" stopColor="#2e2e38" />
              <stop offset="1" stopColor="#101016" />
            </linearGradient>
            <linearGradient id="loupeFerruleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f0f1f4" />
              <stop offset="0.5" stopColor="#a7aab2" />
              <stop offset="1" stopColor="#63666e" />
            </linearGradient>
            <filter id="loupeSoft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.1" />
            </filter>
          </defs>

          <ellipse
            ref={shadowRef}
            className="lens-shadow"
            cx={LENS_HOME_X}
            cy={LENS_Y + 38}
            rx={24}
            ry={5.5}
            opacity={0}
          />

          <g ref={magLayerRef} clipPath="url(#loupeLensClip)" opacity={0}>
            <rect className="mag-bg" x={0} y={0} width={W} height={H} />
            <g ref={magGroupRef}>
              <path ref={magFramePathRef} className="frame-line" />
              <g ref={streamMagRef} clipPath="url(#loupeBoxClip)">
                {STREAM_TEXTS.map((t, ri) => (
                  <g key={ri}>
                    <text className="stream-text" x={68} y={102 + ri * 17}>
                      {t}
                    </text>
                    <text
                      className="stream-text"
                      x={68 + STREAM_LEN}
                      y={102 + ri * 17}
                    >
                      {t}
                    </text>
                  </g>
                ))}
              </g>
              <g ref={textScrollRef}>
                {value ? (
                  <>
                    <text className="mag-text chroma-r" x={TEXT_X - 0.6} y={CY}>
                      {value}
                    </text>
                    <text className="mag-text chroma-b" x={TEXT_X + 0.6} y={CY}>
                      {value}
                    </text>
                    <text className="mag-text" x={TEXT_X} y={CY}>
                      {value}
                    </text>
                  </>
                ) : (
                  <text className="mag-text placeholder" x={TEXT_X} y={CY}>
                    search anything
                  </text>
                )}
              </g>
            </g>
          </g>

          <g
            ref={lensGroupRef}
            className="lens"
            transform={`translate(${LENS_HOME_X} ${LENS_Y}) scale(${ICON_SZ})`}
          >
            {/* フラットアイコン(アイドル時) */}
            <g ref={flatIconRef} className="lens-flat">
              <circle r={GLASS_R} fill="none" strokeWidth={6.5} />
              <line
                x1={GLASS_R + 2}
                y1={0}
                x2={GLASS_R + 30}
                y2={0}
                strokeWidth={10}
                strokeLinecap="round"
                transform="rotate(47)"
              />
            </g>
            {/* リアルルーペ(検索中) */}
            <g ref={realLensRef} opacity={0}>
              <g transform="rotate(47)">
                <rect
                  x={GLASS_R + 9}
                  y={-6.5}
                  width={52}
                  height={13}
                  rx={6.5}
                  fill="url(#loupeGripGrad)"
                />
                <rect
                  x={GLASS_R + 1}
                  y={-5.5}
                  width={12}
                  height={11}
                  rx={2}
                  fill="url(#loupeFerruleGrad)"
                />
              </g>
              <circle r={GLASS_R} fill="url(#loupeGlassGrad)" />
              <circle
                r={GLASS_R + 3}
                fill="none"
                stroke="url(#loupeRimGrad)"
                strokeWidth={6}
              />
              <circle
                r={GLASS_R + 0.4}
                fill="none"
                stroke="rgba(40,40,50,0.55)"
                strokeWidth={1}
              />
              <path
                d="M -19 -8 A 20.5 20.5 0 0 1 -7 -19"
                stroke="#fff"
                strokeWidth={4.5}
                strokeLinecap="round"
                fill="none"
                opacity={0.65}
                filter="url(#loupeSoft)"
              />
              <circle
                cx={11}
                cy={-13}
                r={2.4}
                fill="#fff"
                opacity={0.8}
                filter="url(#loupeSoft)"
              />
            </g>
          </g>
        </svg>

        <button
          type="button"
          className="lens-hit"
          aria-label="Search"
          disabled={mode === 'searching'}
          onClick={startSearch}
          onMouseEnter={() => (anim.current.hover = true)}
          onMouseLeave={() => (anim.current.hover = false)}
        />

        <div
          ref={dotsRef}
          className={`hit-pills${results ? ' consumed' : ''}`}
          aria-hidden="true"
        >
          {anim.current.hitWidths.slice(0, hits).map((w, i) => (
            <span className="hit-pill" key={i} style={{ width: w }} />
          ))}
        </div>
      </div>

      <section ref={resultsRef} className="results" aria-live="polite">
        {results && (
          <div className="filter-bar">
            {results.map((r) => (
              <button
                type="button"
                key={r.tag}
                className={filter === r.tag ? 'chip active' : 'chip'}
                onClick={() => setFilter(filter === r.tag ? null : r.tag)}
              >
                {r.tag}
              </button>
            ))}
          </div>
        )}
        {results
          ?.filter((r) => filter === null || r.tag === filter)
          .map((r, i) => (
          <article
            className="result-card"
            key={r.tag}
            style={{ '--i': i } as React.CSSProperties}
          >
            <span className="result-tag">{r.tag}</span>
            <h2>{r.title}</h2>
            <p>{r.desc}</p>
          </article>
        ))}
      </section>
    </main>
  )
}

