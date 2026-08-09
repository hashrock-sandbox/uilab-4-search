import { useEffect, useMemo, useRef, useState } from 'react'
import { search } from '../data'
import './Mosaic.css'

type Mode = 'all' | 'danger' | 'off'

/** これを検索していると他人に知られてはならない */
const DANGER = ['にんにく', 'あぶら', 'ビール', '夜', '発酵', 'ねばねば']

/** モザイク1ブロックの大きさ(CSS px) */
const BLOCK = 6

const MODES: { id: Mode; label: string }[] = [
  { id: 'all', label: '全部モザイク' },
  { id: 'danger', label: '危険ワードのみ' },
  { id: 'off', label: '無防備' },
]

/** text の各文字を隠すべきかどうか */
function maskOf(text: string, mode: Mode): boolean[] {
  const chars = text.split('')
  if (mode === 'all') return chars.map(() => true)
  if (mode === 'off') return chars.map(() => false)
  const mask = chars.map(() => false)
  for (const word of DANGER) {
    let at = text.indexOf(word)
    while (at !== -1) {
      for (let i = at; i < at + word.length; i++) mask[i] = true
      at = text.indexOf(word, at + 1)
    }
  }
  return mask
}

/** 指定範囲を一度縮小してから拡大し直す = 本物のモザイク */
function pixelate(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  x0: number,
  x1: number,
  h: number,
  dpr: number,
) {
  const w = x1 - x0
  if (w <= 0) return
  const bw = Math.max(1, Math.round(w / BLOCK))
  const bh = Math.max(1, Math.round(h / BLOCK))
  const tmp = document.createElement('canvas')
  tmp.width = bw
  tmp.height = bh
  const tctx = tmp.getContext('2d')
  if (!tctx) return
  tctx.drawImage(src, x0 * dpr, 0, w * dpr, h * dpr, 0, 0, bw, bh)
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(x0, 0, w, h)
  ctx.drawImage(tmp, 0, 0, bw, bh, x0, 0, w, h)
  ctx.imageSmoothingEnabled = true
}

/** テキストを canvas に描いて、mask の範囲だけピクセル化する */
function drawMosaicText(canvas: HTMLCanvasElement, text: string, mask: boolean[], size: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const style = getComputedStyle(canvas)
  const font = `400 ${size}px ${style.fontFamily}`
  const dpr = window.devicePixelRatio || 1

  // 文字ごとの右端位置。モザイク範囲の切れ目に使う
  ctx.font = font
  const edges: number[] = []
  for (let i = 1; i <= text.length; i++) edges.push(ctx.measureText(text.slice(0, i)).width)
  const w = Math.max(1, Math.ceil(edges[text.length - 1] ?? 0) + 2)
  const h = Math.ceil(size * 1.5)

  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  ctx.scale(dpr, dpr)
  ctx.font = font
  ctx.textBaseline = 'middle'
  ctx.fillStyle = style.color
  ctx.fillText(text, 0, h / 2)

  // 連続する隠し文字をひとつの範囲にまとめる
  const ranges: [number, number][] = []
  for (let i = 0; i < text.length; i++) {
    if (!mask[i]) continue
    const x0 = i === 0 ? 0 : edges[i - 1]
    const x1 = edges[i]
    const last = ranges[ranges.length - 1]
    if (last && x0 <= last[1] + 0.5) last[1] = x1
    else ranges.push([x0, x1])
  }
  for (const [x0, x1] of ranges) pixelate(ctx, canvas, x0, x1, h, dpr)
}

/** 実際にグリフを描画してからモザイク化するテキスト。peek 中は素通し */
function MosaicLabel({
  text,
  mode,
  peek,
  size = 15,
}: {
  text: string
  mode: Mode
  peek: boolean
  size?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const mask = peek ? text.split('').map(() => false) : maskOf(text, mode)
    drawMosaicText(canvas, text, mask, size)
  }, [text, mode, peek, size])

  if (text === '') return null
  return <canvas ref={ref} className="mosaic-canvas" role="img" aria-label={text} />
}

type Entry = { key: number; q: string; count: number }

export function Mosaic() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<Mode>('all')
  const [peek, setPeek] = useState(false)
  const [composing, setComposing] = useState(false)
  const [focused, setFocused] = useState(false)
  const [history, setHistory] = useState<Entry[]>([])
  const seq = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => search(query), [query])
  const open = query.trim() !== ''

  // 隠すべき文字がひとつでもあるときだけ入力を覆う(IME変換中は覆えない)
  const covered = !composing && query !== '' && maskOf(query, mode).some(Boolean)
  const dropdown = focused && history.length > 0

  const record = () => {
    const q = query.trim()
    if (!q) return
    setHistory((prev) => [
      { key: seq.current++, q, count: results.length },
      ...prev.filter((entry) => entry.q !== q),
    ].slice(0, 8))
  }

  return (
    <div style={styles.page}>
      <p style={styles.lead}>検索クエリを canvas で本当にピクセル化します。履歴も同様に隠れます。</p>

      <div style={styles.modes}>
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`mosaic-mode ${mode === m.id ? 'is-active' : ''}`}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      {mode === 'danger' && (
        <p style={styles.dangerHint}>危険ワード: {DANGER.join('・')}</p>
      )}

      <div className="mosaic-field">
        <div className="mosaic-box">
          <div className="mosaic-inputwrap">
            <input
              ref={inputRef}
              className={`mosaic-input ${covered ? 'is-covered' : ''}`}
              type="text"
              value={query}
              maxLength={20}
              autoComplete="off"
              placeholder="検索(例: ラーメン / にんにく)"
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={() => setComposing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) record()
                if (e.key === 'Escape') setQuery('')
              }}
            />
            {covered && (
              <div className="mosaic-overlay" aria-hidden="true">
                <MosaicLabel text={query} mode={mode} peek={peek} size={17} />
              </div>
            )}
          </div>
          {mode !== 'off' && (
            <button
              type="button"
              className={`mosaic-peek ${peek ? 'is-on' : ''}`}
              title="押している間だけ見える"
              aria-label="押している間だけ見える"
              onPointerDown={(e) => {
                e.preventDefault()
                setPeek(true)
              }}
              onPointerUp={() => setPeek(false)}
              onPointerLeave={() => setPeek(false)}
            >
              👁
            </button>
          )}
        </div>

        {/* フォーカス中だけ出てくる検索履歴 */}
        {dropdown && (
          <div className="mosaic-drop" onMouseDown={(e) => e.preventDefault()}>
            {history.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className="mosaic-drop-row"
                onClick={() => setQuery(entry.q)}
              >
                <MosaicLabel text={entry.q} mode={mode} peek={peek} size={14} />
                <span style={styles.dropCount}>{entry.count} 件</span>
              </button>
            ))}
            <div className="mosaic-drop-foot">
              <span style={styles.dropNote}>Enter で履歴に残ります</span>
              <button type="button" className="mosaic-wipe" onClick={() => setHistory([])}>
                🗑 証拠隠滅
              </button>
            </div>
          </div>
        )}
      </div>

      {open && (
        <>
          <p style={styles.status} aria-live="polite">
            {results.length} 件
          </p>
          <ul style={styles.list}>
            {results.length === 0 ? (
              <li style={styles.empty}>一致する結果はありません(何と検索したかは秘密です)</li>
            ) : (
              results.map((item) => (
                <li key={item.id} className="mosaic-row">
                  <span style={styles.name}>
                    <MosaicLabel text={item.name} mode={mode} peek={peek} />
                  </span>
                  <span style={styles.meta}>
                    <MosaicLabel
                      text={`${item.kind} · ${item.tags.join(' / ')}`}
                      mode={mode}
                      peek={peek}
                      size={12}
                    />
                  </span>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 520,
    margin: '0 auto',
    padding: '40px 24px 80px',
    textAlign: 'left',
  },
  lead: { margin: '0 0 20px', fontSize: 14, lineHeight: 1.7 },
  modes: { display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  dangerHint: { margin: '-6px 0 14px', fontSize: 12, opacity: 0.65 },
  status: { margin: '14px 2px 6px', fontSize: 13, opacity: 0.7 },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 4,
    border: '1px solid var(--border)',
    borderRadius: 10,
  },
  empty: { margin: 0, padding: '10px 4px', fontSize: 13, opacity: 0.65 },
  name: { fontSize: 15, color: 'var(--text-h)' },
  meta: { fontSize: 12, opacity: 0.7, textAlign: 'right' },
  dropCount: { fontSize: 12, opacity: 0.6, flex: 'none' },
  dropNote: { fontSize: 11, opacity: 0.55 },
}
