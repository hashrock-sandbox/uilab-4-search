import { useEffect, useMemo, useRef, useState } from 'react'
import { items, type Item } from '../data'
import './ShoutSearch.css'

/**
 * 叫ぶ検索。
 * マイクの音量（声の大きさ）で検索のあいまい度が変わる。
 * ヒソヒソ声だと完全一致、叫ぶほど検索範囲が広がってヒットが増える。
 * マイクが使えない環境では「声の大きさ」スライダーにフォールバックする。
 */

type MicState = 'idle' | 'requesting' | 'on' | 'denied' | 'unsupported'

type Level = {
  /** この段に入るための音量しきい値（0..1） */
  min: number
  /** メーター上の呼び名 */
  voice: string
  /** 検索の効き方の説明 */
  rule: string
  /** クエリ q に対して item がヒットするか */
  match: (item: Item, q: string) => boolean
}

/** 文字が順番どおりに含まれるか（叫び段のゆるゆる一致用） */
function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0
  for (const ch of haystack) {
    if (ch === needle[i]) i++
    if (i === needle.length) return true
  }
  return needle.length === 0
}

// 下ほど厳しく、上ほどゆるい。上の段は下の段を必ず含む（叫ぶほど範囲が広がる）。
const LEVELS: Level[] = [
  {
    min: 0,
    voice: 'ヒソヒソ声',
    rule: '完全一致だけ',
    match: (item, q) => item.name === q,
  },
  {
    min: 0.14,
    voice: '小声',
    rule: '名前の前方一致',
    match: (item, q) => item.name.startsWith(q),
  },
  {
    min: 0.34,
    voice: '普通の声',
    rule: '名前の部分一致',
    match: (item, q) => item.name.includes(q),
  },
  {
    min: 0.56,
    voice: '大きい声',
    rule: '種類まで拾う',
    match: (item, q) => item.name.includes(q) || item.kind.includes(q),
  },
  {
    min: 0.8,
    voice: '叫び',
    rule: 'タグまで総ざらい＋あいまい',
    match: (item, q) =>
      item.name.includes(q) ||
      item.kind.includes(q) ||
      item.tags.some((t) => t.includes(q)) ||
      isSubsequence(q, item.name),
  },
]

function levelIndexFor(loudness: number): number {
  let idx = 0
  for (let i = 0; i < LEVELS.length; i++) {
    if (loudness >= LEVELS[i].min) idx = i
  }
  return idx
}

function shoutSearch(query: string, loudness: number): Item[] {
  const q = query.trim()
  if (!q) return []
  const level = LEVELS[levelIndexFor(loudness)]
  return items.filter((item) => level.match(item, q))
}

export function ShoutSearch() {
  const [query, setQuery] = useState('')
  const [micState, setMicState] = useState<MicState>('idle')
  // マイクから拾った音量（0..1、なめらかに減衰する）
  const [micLoudness, setMicLoudness] = useState(0)
  // マイクが使えないときのフォールバック（声の大きさスライダー）
  const [sliderLoudness, setSliderLoudness] = useState(0.34)

  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const smoothRef = useRef(0)

  const usingMic = micState === 'on'
  const loudness = usingMic ? micLoudness : sliderLoudness
  const levelIndex = levelIndexFor(loudness)
  const level = LEVELS[levelIndex]

  const results = useMemo(() => shoutSearch(query, loudness), [query, loudness])
  const open = query.trim() !== ''

  // マイク一式を確実に片付ける
  const teardownMic = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      void ctxRef.current.close()
    }
    ctxRef.current = null
    smoothRef.current = 0
    setMicLoudness(0)
  }

  // unmount 時にマイク／AudioContext を必ず停止・close する
  useEffect(() => teardownMic, [])

  const startMic = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') {
      setMicState('unsupported')
      return
    }
    setMicState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const ctx = new AudioContext()
      ctxRef.current = ctx
      // Safari などで suspended 状態のことがあるので念のため resume
      if (ctx.state === 'suspended') await ctx.resume()

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)

      const buf = new Uint8Array(analyser.fftSize)
      setMicState('on')

      const tick = () => {
        analyser.getByteTimeDomainData(buf)
        // RMS を 0..1 に。少しゲインをかけて普通の声でも段が上がるように。
        let sum = 0
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / buf.length)
        const raw = Math.min(1, rms * 3.2)
        // アタックは速く、リリースはゆっくり（叫んだ余韻が少し残る）
        const prev = smoothRef.current
        const next = raw > prev ? prev + (raw - prev) * 0.6 : prev + (raw - prev) * 0.12
        smoothRef.current = next
        setMicLoudness(next)
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      // 権限拒否・デバイス無しなど。スライダーにフォールバック。
      teardownMic()
      setMicState('denied')
    }
  }

  const pct = Math.round(loudness * 100)

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>叫ぶ検索</h2>
      <p style={styles.lead}>
        声の大きさで検索範囲が決まる。ヒソヒソ声なら<strong>完全一致</strong>、叫ぶほど範囲が広がる。
      </p>

      <label htmlFor="shout-search" className="shout-sr-only">
        食べ物を検索
      </label>
      <div className="shout-field" data-level={levelIndex}>
        <MicIcon on={usingMic} />
        <input
          id="shout-search"
          className="shout-input"
          type="search"
          autoComplete="off"
          value={query}
          placeholder="食べ物を検索（例：らーめん）"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* 音量メーター */}
      <div className="shout-meter" role="group" aria-label="声の大きさ">
        <div className="shout-meter-track">
          <div
            className="shout-meter-fill"
            data-level={levelIndex}
            style={{ width: `${pct}%` }}
          />
          {LEVELS.slice(1).map((l) => (
            <span
              key={l.min}
              className="shout-meter-tick"
              style={{ left: `${l.min * 100}%` }}
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="shout-meter-legend">
          {LEVELS.map((l, i) => (
            <span
              key={l.min}
              className="shout-meter-step"
              data-active={i === levelIndex}
            >
              {l.voice}
            </span>
          ))}
        </div>
      </div>

      <p style={styles.mode} aria-live="polite">
        いまは <strong style={{ color: 'var(--text-h)' }}>{level.voice}</strong>
        （{level.rule}）
        {open ? ` ・ ${results.length} 件` : ''}
      </p>

      {/* マイク制御 / フォールバック */}
      <div className="shout-control">
        {usingMic ? (
          <button type="button" className="shout-btn" onClick={teardownMic}>
            マイクを止める
          </button>
        ) : (
          <>
            <button
              type="button"
              className="shout-btn shout-btn-primary"
              onClick={startMic}
              disabled={micState === 'requesting' || micState === 'unsupported'}
            >
              {micState === 'requesting' ? 'マイク許可を待っています…' : 'マイクで叫ぶ'}
            </button>
            <div className="shout-slider-row">
              <span className="shout-slider-label">声の大きさ</span>
              <input
                type="range"
                className="shout-slider"
                min={0}
                max={1}
                step={0.01}
                value={sliderLoudness}
                onChange={(e) => setSliderLoudness(Number(e.target.value))}
                aria-label="声の大きさ（マイクの代わり）"
              />
            </div>
            <p className="shout-hint">
              {micState === 'denied' &&
                'マイクを使えませんでした。スライダーで声の大きさを動かしてください。'}
              {micState === 'unsupported' &&
                'この環境ではマイクを使えません。スライダーで声の大きさを動かしてください。'}
              {micState === 'idle' &&
                'マイクを許可すると、実際の声の大きさで範囲が変わります。'}
            </p>
          </>
        )}
      </div>

      {open && (
        <ul className="shout-results" role="listbox" aria-label="検索結果">
          {results.length === 0 ? (
            <li className="shout-empty">
              「{query.trim()}」に一致する結果はありません。もっと大きな声で。
            </li>
          ) : (
            results.map((item) => (
              <li key={item.id} className="shout-option" role="option" aria-selected={false}>
                <span style={styles.name}>{item.name}</span>
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

function MicIcon({ on }: { on: boolean }) {
  return (
    <svg
      className={`shout-icon${on ? ' shout-icon-on' : ''}`}
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <rect x="7" y="2" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.5 9a5.5 5.5 0 0 0 11 0M10 14.5V18M7 18h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 520, margin: '0 auto', padding: '48px 24px 80px' },
  heading: { fontSize: 22, margin: '0 0 6px' },
  lead: { margin: '0 0 24px', fontSize: 14, lineHeight: 1.7 },
  mode: { margin: '14px 2px 0', fontSize: 13, opacity: 0.85 },
  name: { fontSize: 15, color: 'var(--text-h)' },
  meta: { fontSize: 12, opacity: 0.7, textAlign: 'right' },
}
