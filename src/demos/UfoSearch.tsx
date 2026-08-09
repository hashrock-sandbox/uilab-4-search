import { useEffect, useMemo, useRef, useState } from 'react'
import { words } from '../words'
import './UfoSearch.css'

/** 野に放たれる住民の数 */
const POP = 18
/** 住民どうしの最低間隔(px)。近すぎる配置を避ける */
const MIN_GAP = 46
/** 中央のヒットチップに部分表示する単語の数 */
const SAMPLE = 8
/** 右上の報告書に見せる直近の回収数 */
const REPORT_ROWS = 8
/** 草地の始まる高さ(ステージ高に対する割合)。背景のグラデーションと合わせる */
const FIELD_TOP = 0.72
/** 草地の縁に残す余白(px) */
const FIELD_PAD = 26

const COWS = ['🐄', '🐂', '🐃']
const HUMANS = ['🧍', '🧑‍🌾', '🧍‍♀️', '👨‍🌾']

/** 逃げ惑うときの悲鳴。全員が一斉に叫ぶとうるさいので散らして出す */
const CRIES = {
  牛: ['モ〜！！', 'モォォ！', 'モ゛ォ゛ー！'],
  人間: ['うわあ！', 'ぎゃー！', '出たー！', 'に、逃げろ！'],
} as const
/** 吸い上げられる瞬間の断末魔 */
const ABDUCT_CRIES = {
  牛: 'モ゛ォ゛ォ゛ー！！',
  人間: 'たすけてー！！',
} as const

type CritterState = 'wander' | 'panic' | 'lifting' | 'gone'

type Critter = {
  id: number
  emoji: string
  species: '牛' | '人間'
  /** 草地の上の座標。y は足元(大きいほど手前) */
  x: number
  y: number
  /** 速度ベクトル。縦横どちらへも歩く */
  vx: number
  vy: number
  /** 見た目の向き(vx の符号から決まる) */
  dir: 1 | -1
  state: CritterState
  /** 0(地上) → 1(UFO 着) */
  lift: number
  /** 次に気まぐれで進路を変える時刻(秒) */
  turnAt: number
  /** ビームに選ばれた個体が背負わされる検索結果 */
  word: string | null
  /** 跳ねている最中の進み(0..1)。0 は接地 */
  hop: number
  /** 次に跳ねる時刻(秒)。パニック中だけ使う */
  hopAt: number
  /** 悲鳴を出している期限(秒)。過ぎたら黙る */
  cryUntil: number
  /** 次に悲鳴を上げる時刻(秒) */
  cryAt: number
  /** いま口にしている悲鳴 */
  cry: string
}

type UfoPhase = 'off' | 'move' | 'beam' | 'sweep' | 'leave'

type Ufo = {
  phase: UfoPhase
  x: number
  y: number
  /** 速度。慣性を持たせて有機的に動かす */
  vx: number
  vy: number
  /** 機体の傾き(度)。横速度に遅れて追従する */
  tilt: number
  /** 揺らぎの位相。個体差というより毎回の気分 */
  seed: number
  /** sweep(収穫なし)のときの滞空期限 */
  until: number
}

type Catch = { key: number; word: string; species: string; emoji: string }

export function UfoSearch() {
  const [query, setQuery] = useState('')
  const [, setTick] = useState(0)
  const [catches, setCatches] = useState<Catch[]>([])
  const [message, setMessage] = useState('平穏')

  const stageRef = useRef<HTMLDivElement>(null)
  /** ステージの実寸。全画面なのでリサイズで変わる */
  const dims = useRef({ w: 0, h: 0 })

  const critterSeq = useRef(0)
  /** 草地の範囲(y の下限・上限)。背景の割り付けに合わせる */
  const fieldOf = (w: number, h: number) => ({
    left: FIELD_PAD,
    right: Math.max(FIELD_PAD + 1, w - FIELD_PAD),
    top: h * FIELD_TOP + 14,
    bottom: Math.max(h * FIELD_TOP + 15, h - 18),
  })

  /** 既存の住民から MIN_GAP 以上離れた地点を探す(なければ一番マシな候補で妥協) */
  const pickSpot = (w: number, h: number, existing: Critter[]) => {
    const f = fieldOf(w, h)
    let best = { x: f.left, y: f.top }
    let bestGap = -Infinity
    for (let i = 0; i < 12; i++) {
      const cand = {
        x: f.left + Math.random() * (f.right - f.left),
        y: f.top + Math.random() * (f.bottom - f.top),
      }
      const gap =
        existing.length === 0
          ? Infinity
          : Math.min(...existing.map((c) => Math.hypot(c.x - cand.x, c.y - cand.y)))
      if (gap >= MIN_GAP) return cand
      if (gap > bestGap) {
        bestGap = gap
        best = cand
      }
    }
    return best
  }

  const spawnOne = (w: number, h: number, existing: Critter[] = critters.current): Critter => {
    const cow = Math.random() < 0.5
    const id = critterSeq.current++
    const spot = pickSpot(w, h, existing)
    const angle = Math.random() * Math.PI * 2
    const speed = 12 + Math.random() * 20
    return {
      id,
      emoji: cow ? COWS[id % COWS.length] : HUMANS[id % HUMANS.length],
      species: cow ? '牛' : '人間',
      x: spot.x,
      y: spot.y,
      // 縦は草地が浅いので動きを圧縮しておく
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.45,
      dir: Math.random() < 0.5 ? 1 : -1,
      state: 'wander',
      lift: 0,
      turnAt: 0,
      word: null,
      hop: 0,
      hopAt: 0,
      cryUntil: 0,
      cryAt: 0,
      cry: '',
    }
  }

  const critters = useRef<Critter[]>([])
  const ufo = useRef<Ufo>({
    phase: 'off',
    x: -60,
    y: -40,
    vx: 0,
    vy: 0,
    tilt: 0,
    seed: 0,
    until: 0,
  })
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
      const f = fieldOf(dims.current.w, dims.current.h)
      for (const c of critters.current) {
        c.x = Math.min(Math.max(c.x, f.left), f.right)
        c.y = Math.min(Math.max(c.y, f.top), f.bottom)
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

      // 実寸が分かってから住民を放つ(重ならないよう1体ずつ既存分を見ながら配置)
      if (critters.current.length === 0 && w > 0) {
        const seeded: Critter[] = []
        for (let i = 0; i < POP; i++) seeded.push(spawnOne(w, h, seeded))
        critters.current = seeded
      }
      const all = critters.current
      const cruise = Math.max(90, h * 0.26)
      const f = fieldOf(w, h)

      for (const c of all) {
        if (c.state === 'wander' || c.state === 'panic') {
          const panic = c.state === 'panic'
          // 気まぐれに進路を変える。パニック中はもっと落ち着きがない
          if (t > c.turnAt) {
            const angle = Math.random() * Math.PI * 2
            const sp = panic ? 130 + Math.random() * 90 : 12 + Math.random() * 20
            c.vx = Math.cos(angle) * sp
            c.vy = Math.sin(angle) * sp * 0.45
            c.turnAt = t + (panic ? 0.25 + Math.random() * 0.5 : 1 + Math.random() * 3)
          }
          // UFO から遠ざかる向きへ押される(近いほど強く効く)
          if (panic && u.phase !== 'off') {
            const dx = c.x - u.x
            const dy = c.y - (u.y + 120)
            const d = Math.hypot(dx, dy) || 1
            if (d < 320) {
              const push = (1 - d / 320) * 260
              c.vx += (dx / d) * push * dt * 6
              c.vy += (dy / d) * push * 0.45 * dt * 6
            }
          }
          c.x += c.vx * dt
          c.y += c.vy * dt
          // 草地の縁で跳ね返る
          if (c.x < f.left) {
            c.x = f.left
            c.vx = Math.abs(c.vx)
          } else if (c.x > f.right) {
            c.x = f.right
            c.vx = -Math.abs(c.vx)
          }
          if (c.y < f.top) {
            c.y = f.top
            c.vy = Math.abs(c.vy)
          } else if (c.y > f.bottom) {
            c.y = f.bottom
            c.vy = -Math.abs(c.vy)
          }
          if (Math.abs(c.vx) > 1) c.dir = c.vx > 0 ? 1 : -1

          if (panic) {
            // たまに跳ねる。跳んでいる間は hop が 0→1 へ進む
            if (c.hop > 0) {
              c.hop += dt / 0.42
              if (c.hop >= 1) {
                c.hop = 0
                c.hopAt = t + 0.5 + Math.random() * 1.8
              }
            } else if (t > c.hopAt) {
              c.hop = 0.0001
            }
            // 悲鳴は出しっぱなしにせず、間を置いて散発的に
            if (t > c.cryUntil && t > c.cryAt) {
              const list = CRIES[c.species]
              c.cry = list[Math.floor(Math.random() * list.length)]
              c.cryUntil = t + 0.6 + Math.random() * 0.7
              c.cryAt = c.cryUntil + 0.4 + Math.random() * 2.2
            }
          } else {
            c.hop = 0
            c.cryUntil = 0
          }
        }
      }

      // 近づきすぎた組を平面上で押し離す。数回まわすと連なりもほどける
      {
        const movers = all.filter((c) => c.state === 'wander' || c.state === 'panic')
        for (let pass = 0; pass < 3; pass++) {
          for (let i = 0; i < movers.length; i++) {
            for (let j = i + 1; j < movers.length; j++) {
              const a = movers[i]
              const b = movers[j]
              let dx = b.x - a.x
              // 縦は見た目の重なりが浅いので、間隔の判定も浅くする
              let dy = (b.y - a.y) * 2.2
              let d = Math.hypot(dx, dy)
              if (d >= MIN_GAP) continue
              if (d < 0.001) {
                dx = Math.random() - 0.5
                dy = Math.random() - 0.5
                d = Math.hypot(dx, dy) || 1
              }
              const shift = (MIN_GAP - d) / 2
              const nx = (dx / d) * shift
              const ny = ((dy / d) * shift) / 2.2
              a.x -= nx
              a.y -= ny
              b.x += nx
              b.y += ny
            }
          }
        }
        for (const c of movers) {
          c.x = Math.min(Math.max(c.x, f.left), f.right)
          c.y = Math.min(Math.max(c.y, f.top), f.bottom)
        }
      }

      for (const c of all) {
        if (c.state === 'lifting') {
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

      // UFO の行動。目標へバネで引かれつつ、常にふらふら揺れている
      const target = all.find((c) => c.id === queue.current[0])
      /** 目標点へバネ + 減衰で寄せる。硬さを変えるだけで挙動の性格が変わる */
      const glide = (tx: number, ty: number, stiff: number) => {
        const s = u.seed
        // 周期の違う波を重ねると、機械的な直線運動に見えなくなる
        const driftX = Math.sin(t * 0.9 + s) * 26 + Math.sin(t * 2.3 + s * 1.7) * 9
        const driftY = Math.cos(t * 1.3 + s * 0.6) * 14 + Math.sin(t * 3.1 + s) * 4
        u.vx += (tx + driftX - u.x) * stiff * dt
        u.vy += (ty + driftY - u.y) * stiff * dt
        // 減衰。効かせすぎると止まり、緩めるとオーバーシュートして漂う
        const damp = Math.exp(-dt * 2.6)
        u.vx *= damp
        u.vy *= damp
        u.x += u.vx * dt
        u.y += u.vy * dt
      }

      if (u.phase === 'move') {
        if (!target || target.state === 'gone') {
          queue.current.shift()
          if (queue.current.length === 0) u.phase = 'leave'
        } else {
          glide(target.x, cruise, 15)
          if (Math.abs(u.x - target.x) < 26 && Math.abs(u.y - cruise) < 40) {
            u.phase = 'beam'
            target.state = 'lifting'
            target.lift = 0
            target.hop = 0
            // 吸われている間はずっと叫ばせる
            target.cry = ABDUCT_CRIES[target.species]
          }
        }
      } else if (u.phase === 'beam') {
        if (!target || target.state === 'gone') {
          queue.current.shift()
          u.phase = queue.current.length > 0 ? 'move' : 'leave'
        } else {
          // ビーム中もじりじり追う(逃げても無駄)。真上で小さく揺れる
          glide(target.x, cruise, 26)
        }
      } else if (u.phase === 'sweep') {
        glide(w / 2, cruise, 9)
        if (t > u.until) u.phase = 'leave'
      } else if (u.phase === 'leave') {
        u.vx += 460 * dt
        u.vy -= 210 * dt
        u.x += u.vx * dt
        u.y += u.vy * dt
        if (u.x > w + 90) {
          u.phase = 'off'
          // 生き残りは日常へ、減ったぶんは新しい住民が何食わぬ顔で補充される
          const survivors = all.filter((c) => c.state !== 'gone')
          for (const c of survivors) c.state = 'wander'
          while (survivors.length < POP) survivors.push(spawnOne(w, h, survivors))
          critters.current = survivors
          setMessage('撤収')
        }
      }

      // 進行方向へ機体を傾ける(速度に遅れて追従させると重みが出る)
      const wantTilt = Math.max(-22, Math.min(22, -u.vx * 0.05))
      u.tilt += (wantTilt - u.tilt) * (1 - Math.exp(-dt * 4))

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
    const now = performance.now() / 1000
    for (const c of alive) {
      c.state = 'panic'
      // 跳ねる時刻も叫ぶ時刻も散らす(揃うと一斉に跳んで気持ち悪い)
      c.hop = 0
      c.hopAt = now + Math.random() * 1.6
      c.cryUntil = 0
      c.cryAt = now + Math.random() * 1.2
    }
    u.x = -60
    u.y = -30
    u.vx = 0
    u.vy = 0
    u.tilt = 0
    u.seed = Math.random() * Math.PI * 2

    if (matches.length === 0) {
      queue.current = []
      u.phase = 'sweep'
      u.until = now + 2.2
      setMessage('空振り')
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
    setMessage(`${k} 体 回収`)
  }

  const u = ufo.current
  const recent = catches.slice(-REPORT_ROWS).reverse()
  // 悲鳴の表示期限を判定するための現在時刻(tick と同じ時計)
  const tNow = performance.now() / 1000
  const field = fieldOf(dims.current.w, dims.current.h)
  const invaded = u.phase !== 'off'

  return (
    <div ref={stageRef} className={`ufo-stage${invaded ? ' is-invaded' : ''}`}>
      {u.phase === 'beam' && (
        <div
          className="ufo-beam"
          style={{ left: u.x, top: u.y + 20, height: Math.max(0, field.bottom + 8 - (u.y + 20)) }}
        />
      )}

      {critters.current.map((c) => {
        if (c.state === 'gone') return null
        const lifting = c.state === 'lifting'
        // 跳ねている間は sin 半周ぶん浮く
        const hopY = c.hop > 0 ? Math.sin(c.hop * Math.PI) * 30 : 0
        const footY = lifting ? c.y - c.lift * (c.y - (u.y + 30)) : c.y - hopY
        // 吸われるほど大きく見せる(遠ざかるのに拡大するのが可笑しい)。
        // 回転は絵文字だけにかける — 悲鳴や単語まで回すと読めなくなる
        const spin = lifting
          ? ` rotate(${(c.lift * 560).toFixed(1)}deg) scale(${(1 + c.lift * 0.9).toFixed(3)})`
          : ''
        const crying = lifting || (c.state === 'panic' && tNow < c.cryUntil)
        return (
          <div
            key={c.id}
            className={`ufo-critter is-${c.state}`}
            style={{
              transform: `translate(${c.x.toFixed(1)}px, ${footY.toFixed(1)}px)`,
              // 手前(y が大きい)ほど前に描く
              zIndex: 2 + Math.round(c.y),
            }}
          >
            <div className="ufo-critter-inner">
              {lifting && c.word && <span className="ufo-name">{c.word}</span>}
              <span className="ufo-em" style={{ transform: `scaleX(${c.dir})${spin}` }}>
                {c.emoji}
              </span>
              {crying && c.cry && (
                <span className={`ufo-cry${lifting ? ' is-abduct' : ''}`}>{c.cry}</span>
              )}
            </div>
          </div>
        )
      })}

      {invaded && (
        <div
          className={`ufo-ship ${u.phase === 'beam' ? 'is-beaming' : ''}`}
          style={{
            transform: `translate(${u.x.toFixed(1)}px, ${u.y.toFixed(1)}px) rotate(${u.tilt.toFixed(1)}deg)`,
          }}
        >
          🛸
        </div>
      )}

      {/* 中央の検索ボックス。襲来中は引っ込める */}
      <div className={`ufo-center${invaded ? ' is-hidden' : ''}`}>
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
      </div>

      {/* 状況ラベルだけは襲来中も残す */}
      <p className="ufo-msg">{message}</p>

      {/* 右上のコンパクト報告書 */}
      {catches.length > 0 && (
        <div className="ufo-report">
          <div className="ufo-report-head">
            <span>🛸 報告書</span>
            <span className="ufo-report-total">{catches.length} 体</span>
            <button
              type="button"
              className="ufo-report-clear"
              onClick={() => setCatches([])}
              aria-label="報告書をクリア"
              title="報告書をクリア"
            >
              ✕
            </button>
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
