import { useEffect, useMemo, useRef, useState } from 'react'
import { words } from '../words'
import './UfoSearch.css'

/** 野に放たれる住民の数 */
const POP = 18
/** 中央のヒットチップに部分表示する単語の数 */
const SAMPLE = 8
/** 右上の報告書に見せる直近の回収数 */
const REPORT_ROWS = 8

const COWS = ['🐄', '🐂', '🐃']
const HUMANS = ['🧍', '🧑‍🌾', '🧍‍♀️', '👨‍🌾']

type CritterState = 'wander' | 'panic' | 'lifting' | 'gone'

type Critter = {
  id: number
  emoji: string
  species: '牛' | '人間'
  x: number
  dir: 1 | -1
  speed: number
  state: CritterState
  /** 0(地上) → 1(UFO 着) */
  lift: number
  /** 次に気まぐれで向きを変える時刻(秒) */
  flipAt: number
  /** ビームに選ばれた個体が背負わされる検索結果 */
  word: string | null
}

type UfoPhase = 'off' | 'move' | 'beam' | 'sweep' | 'leave'

type Ufo = {
  phase: UfoPhase
  x: number
  y: number
  /** sweep(収穫なし)のときの滞空期限 */
  until: number
}

type Catch = { key: number; word: string; species: string; emoji: string }

export function UfoSearch() {
  const [query, setQuery] = useState('')
  const [, setTick] = useState(0)
  const [catches, setCatches] = useState<Catch[]>([])
  const [message, setMessage] = useState('平和な牧場です。検索すると UFO が来ます。')

  const stageRef = useRef<HTMLDivElement>(null)
  /** ステージの実寸。全画面なのでリサイズで変わる */
  const dims = useRef({ w: 0, h: 0 })

  const critterSeq = useRef(0)
  const spawnOne = (w: number): Critter => {
    const cow = Math.random() < 0.5
    const id = critterSeq.current++
    return {
      id,
      emoji: cow ? COWS[id % COWS.length] : HUMANS[id % HUMANS.length],
      species: cow ? '牛' : '人間',
      x: 30 + Math.random() * Math.max(60, w - 60),
      dir: Math.random() < 0.5 ? 1 : -1,
      speed: 12 + Math.random() * 20,
      state: 'wander',
      lift: 0,
      flipAt: 0,
      word: null,
    }
  }

  const critters = useRef<Critter[]>([])
  const ufo = useRef<Ufo>({ phase: 'off', x: -60, y: -40, until: 0 })
  const queue = useRef<number[]>([])
  const catchSeq = useRef(0)

  // ヒットは本物の検索。回収はあくまで演出
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return words.filter((w) => w.includes(q))
  }, [query])

  // ステージの実寸を追いかける
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const update = () => {
      dims.current = { w: el.clientWidth, h: el.clientHeight }
      for (const c of critters.current) {
        c.x = Math.min(Math.max(c.x, 22), Math.max(44, dims.current.w - 22))
      }
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const t = now / 1000
      const { w, h } = dims.current
      const u = ufo.current

      // 実寸が分かってから住民を放つ
      if (critters.current.length === 0 && w > 0) {
        critters.current = Array.from({ length: POP }, () => spawnOne(w))
      }
      const all = critters.current
      const cruise = Math.max(90, h * 0.26)

      for (const c of all) {
        if (c.state === 'wander' || c.state === 'panic') {
          const panic = c.state === 'panic'
          if (t > c.flipAt) {
            c.dir = Math.random() < 0.5 ? 1 : -1
            c.speed = panic ? 110 + Math.random() * 80 : 12 + Math.random() * 20
            c.flipAt = t + (panic ? 0.4 + Math.random() * 0.8 : 1 + Math.random() * 3)
          }
          // UFO が近いときは反対方向へ逃げる
          if (panic && u.phase !== 'off' && Math.abs(u.x - c.x) < 180) {
            c.dir = u.x > c.x ? -1 : 1
          }
          c.x += c.dir * c.speed * dt
          if (c.x < 22) {
            c.x = 22
            c.dir = 1
          } else if (c.x > w - 22) {
            c.x = w - 22
            c.dir = -1
          }
        } else if (c.state === 'lifting') {
          c.lift += dt / 1.1
          if (c.lift >= 1) {
            c.state = 'gone'
            setCatches((prev) => [
              ...prev,
              {
                key: catchSeq.current++,
                word: c.word ?? '???',
                species: c.species,
                emoji: c.emoji,
              },
            ])
          }
        }
      }

      // UFO の行動
      const target = all.find((c) => c.id === queue.current[0])
      if (u.phase === 'move') {
        if (!target || target.state === 'gone') {
          queue.current.shift()
          if (queue.current.length === 0) u.phase = 'leave'
        } else {
          const rate = 1 - Math.exp(-dt * 3.2)
          u.x += (target.x - u.x) * rate
          u.y += (cruise - u.y) * rate
          if (Math.abs(u.x - target.x) < 7 && Math.abs(u.y - cruise) < 12) {
            u.phase = 'beam'
            target.state = 'lifting'
            target.lift = 0
          }
        }
      } else if (u.phase === 'beam') {
        if (!target || target.state === 'gone') {
          queue.current.shift()
          u.phase = queue.current.length > 0 ? 'move' : 'leave'
        } else {
          // ビーム中もじりじり追う(逃げても無駄)
          u.x += (target.x - u.x) * (1 - Math.exp(-dt * 6))
        }
      } else if (u.phase === 'sweep') {
        u.x += (w / 2 - u.x) * (1 - Math.exp(-dt * 2))
        u.y += (cruise - u.y) * (1 - Math.exp(-dt * 2))
        if (t > u.until) u.phase = 'leave'
      } else if (u.phase === 'leave') {
        u.x += 320 * dt
        u.y -= 180 * dt
        if (u.x > w + 70) {
          u.phase = 'off'
          // 生き残りは日常へ、減ったぶんは新しい住民が何食わぬ顔で補充される
          const survivors = all.filter((c) => c.state !== 'gone')
          for (const c of survivors) c.state = 'wander'
          while (survivors.length < POP) survivors.push(spawnOne(w))
          critters.current = survivors
          setMessage('作戦終了。住民の数はなぜか元に戻っています。誰も何も覚えていません。')
        }
      }

      setTick((n) => n + 1)
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const busy = ufo.current.phase !== 'off'

  const start = () => {
    const u = ufo.current
    if (u.phase !== 'off') return
    const q = query.trim().toLowerCase()
    if (!q) return

    const alive = critters.current.filter((c) => c.state !== 'gone')
    for (const c of alive) c.state = 'panic'
    u.x = -60
    u.y = -30

    if (matches.length === 0) {
      queue.current = []
      u.phase = 'sweep'
      u.until = performance.now() / 1000 + 1.6
      setMessage(`「${q}」は 0 語。UFO は様子だけ見て帰ります。`)
      return
    }

    // ヒット数の対数に比例して回収数が増える(全件回収すると牧場が滅ぶので)
    const k = Math.min(alive.length, Math.max(1, Math.round(Math.log2(matches.length + 1))))
    const picked = [...alive].sort(() => Math.random() - 0.5).slice(0, k)
    for (const c of picked) {
      c.word = matches[Math.floor(Math.random() * matches.length)]
    }
    queue.current = picked.map((c) => c.id)
    u.phase = 'move'
    setMessage(
      `「${q}」に ${matches.length.toLocaleString()} 語がヒット。規模に応じて ${k} 体を回収します。`,
    )
  }

  const u = ufo.current
  const ground = dims.current.h - 36
  const recent = catches.slice(-REPORT_ROWS).reverse()

  return (
    <div ref={stageRef} className="ufo-stage">
      {/* 草むら(ステージ幅に対する割合で配置) */}
      {['8%', '24%', '43%', '61%', '78%', '93%'].map((left, i) => (
        <span key={left} className="ufo-grass" style={{ left }}>
          {i % 2 === 0 ? '🌾' : '🌿'}
        </span>
      ))}

      {u.phase === 'beam' && (
        <div
          className="ufo-beam"
          style={{ left: u.x, top: u.y + 14, height: ground + 8 - (u.y + 14) }}
        />
      )}

      {critters.current.map((c) => {
        if (c.state === 'gone') return null
        const footY = c.state === 'lifting' ? ground - c.lift * (ground - (u.y + 26)) : ground
        const spin =
          c.state === 'lifting'
            ? ` rotate(${(c.lift * 560).toFixed(1)}deg) scale(${(1 - c.lift * 0.5).toFixed(3)})`
            : ''
        return (
          <div
            key={c.id}
            className={`ufo-critter is-${c.state}`}
            style={{ transform: `translate(${c.x.toFixed(1)}px, ${footY.toFixed(1)}px)` }}
          >
            <div
              className="ufo-critter-inner"
              style={spin ? { transform: `translate(-50%, -100%)${spin}` } : undefined}
            >
              {c.state === 'lifting' && c.word && <span className="ufo-name">{c.word}</span>}
              <span className="ufo-em" style={{ transform: `scaleX(${c.dir})` }}>
                {c.emoji}
              </span>
              {c.state === 'panic' && (
                <span className="ufo-cry">{c.species === '牛' ? 'モ〜！！' : 'うわあ！'}</span>
              )}
            </div>
          </div>
        )
      })}

      {u.phase !== 'off' && (
        <div
          className={`ufo-ship ${u.phase === 'beam' ? 'is-beaming' : ''}`}
          style={{ transform: `translate(${u.x.toFixed(1)}px, ${u.y.toFixed(1)}px)` }}
        >
          🛸
        </div>
      )}

      {/* 中央の検索ボックス */}
      <div className="ufo-center">
        <div className="ufo-box">
          <input
            className="ufo-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && start()}
            placeholder="英単語で検索(例: cat / search / micro)"
            spellCheck={false}
          />
          <button type="button" className="ufo-button" onClick={start} disabled={busy}>
            {busy ? '作戦中…' : 'UFO 出動'}
          </button>
        </div>
        {query.trim() !== '' && (
          <div className="ufo-hits">
            <span className="ufo-hit-count">{matches.length.toLocaleString()} 語</span>
            {matches.slice(0, SAMPLE).map((w) => (
              <code key={w} className="ufo-word">
                {w}
              </code>
            ))}
            {matches.length > SAMPLE && (
              <span className="ufo-more">+{(matches.length - SAMPLE).toLocaleString()}</span>
            )}
          </div>
        )}
        <p className="ufo-msg">{message}</p>
      </div>

      {/* 右上のコンパクト報告書 */}
      {catches.length > 0 && (
        <div className="ufo-report">
          <div className="ufo-report-head">
            <span>🛸 報告書</span>
            <span className="ufo-report-total">{catches.length} 体</span>
          </div>
          <ul className="ufo-report-list">
            {recent.map((c) => (
              <li key={c.key}>
                <span className="ufo-report-em">{c.emoji}</span>
                <code className="ufo-word">{c.word}</code>
              </li>
            ))}
          </ul>
          {catches.length > REPORT_ROWS && (
            <div className="ufo-report-more">ほか {catches.length - REPORT_ROWS} 体</div>
          )}
        </div>
      )}
    </div>
  )
}
