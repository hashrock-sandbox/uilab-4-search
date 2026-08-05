import { useEffect, useMemo, useRef, useState } from 'react'
import { search, type Item } from '../data'
import './ImeCandidates.css'

/** 候補ウィンドウ1ページの行数 */
const PAGE = 9

/** ひらがな → カタカナ。IMEらしく「らーめん」で「ラーメン」に当てる */
function toKatakana(s: string): string {
  return s.replace(/[ぁ-ん]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60))
}

let meas: CanvasRenderingContext2D | null = null
function textWidth(text: string, font: string): number {
  if (!meas) meas = document.createElement('canvas').getContext('2d')
  if (!meas) return 0
  meas.font = font
  return meas.measureText(text).width
}

export function ImeCandidates() {
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const [open, setOpen] = useState(false)
  const [table, setTable] = useState(false)
  const [committed, setCommitted] = useState<Item | null>(null)
  const [convCount, setConvCount] = useState(0)
  const [caretX, setCaretX] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const cands = useMemo(() => {
    const q = query.trim()
    if (!q) return []
    const out: Item[] = []
    const seen = new Set<number>()
    for (const item of [...search(q), ...search(toKatakana(q))]) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        out.push(item)
      }
    }
    return out
  }, [query])

  const selc = Math.min(sel, Math.max(0, cands.length - 1))
  const page = Math.floor(selc / PAGE)
  const visible = cands.slice(page * PAGE, page * PAGE + PAGE)

  // 候補ウィンドウをキャレット(=入力済みテキストの末尾)に追従させる
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const style = getComputedStyle(input)
    const w = textWidth(query, `${style.fontSize} ${style.fontFamily}`)
    setCaretX(Math.min(w, input.clientWidth - 200))
  }, [query])

  const commit = (item: Item) => {
    setCommitted(item)
    setQuery(item.name)
    setOpen(false)
    setTable(false)
    setConvCount((n) => n + 1)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (!open || cands.length === 0) {
      if (e.key === 'Escape') setQuery('')
      return
    }
    if (e.key === ' ') {
      e.preventDefault()
      setSel((s) => (e.shiftKey ? s - 1 + cands.length : s + 1) % cands.length)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => (s + 1) % cands.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => (s - 1 + cands.length) % cands.length)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      setTable((t) => !t)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      commit(cands[selc])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setTable(false)
    } else if (/^[1-9]$/.test(e.key)) {
      const idx = page * PAGE + Number(e.key) - 1
      if (idx < cands.length) {
        e.preventDefault()
        commit(cands[idx])
      }
    }
  }

  const selected = cands[selc]

  return (
    <div style={styles.page}>
      <p style={styles.lead}>
        IMEの変換候補ウィンドウ、あれは検索結果です。全員が毎日何百回も検索しています。
        ここでは検索結果を変換候補として返します。
        <kbd style={styles.kbd}>Space</kbd> で次候補、数字キーで選択、
        <kbd style={styles.kbd}>Tab</kbd> で一覧、<kbd style={styles.kbd}>Enter</kbd> で確定=検索。
      </p>

      <div className="imec-field">
        <input
          ref={inputRef}
          className={`imec-input ${open && cands.length > 0 ? 'is-converting' : ''}`}
          type="text"
          value={query}
          autoComplete="off"
          spellCheck={false}
          placeholder="ひらがなでどうぞ(例: らーめん / あまい / よる)"
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setSel(0)
            setCommitted(null)
          }}
          onKeyDown={onKeyDown}
        />

        {open && query.trim() !== '' && (
          <div className="imec-window" style={{ left: Math.max(0, caretX) }}>
            {cands.length === 0 ? (
              <div className="imec-empty">変換候補なし</div>
            ) : table ? (
              <div className="imec-grid">
                {cands.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`imec-cell ${i === selc ? 'is-sel' : ''}`}
                    onMouseEnter={() => setSel(i)}
                    onClick={() => commit(item)}
                  >
                    <span className="imec-num">{(i % PAGE) + 1}</span>
                    {item.name}
                  </button>
                ))}
              </div>
            ) : (
              <ul className="imec-list">
                {visible.map((item, i) => {
                  const idx = page * PAGE + i
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`imec-row ${idx === selc ? 'is-sel' : ''}`}
                        onMouseEnter={() => setSel(idx)}
                        onClick={() => commit(item)}
                      >
                        <span className="imec-num">{i + 1}</span>
                        <span className="imec-cand">{item.name}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {cands.length > 0 && (
              <div className="imec-status">
                <span className="imec-anno">
                  {selected ? `${selected.kind}・${selected.tags.join('/')}` : ''}
                </span>
                <span className="imec-counter">
                  {selc + 1}/{cands.length}
                </span>
              </div>
            )}
            <div className="imec-brand">大喜利入力 ver 0.0.0</div>
          </div>
        )}
      </div>

      {committed && (
        <div style={styles.card}>
          <span style={styles.cardTag}>検索結果</span>
          <strong style={styles.cardName}>{committed.name}</strong>
          <span style={styles.cardMeta}>
            {committed.kind}・{committed.tags.join(' / ')}
          </span>
          <p style={styles.cardNote}>
            変換を確定した瞬間、それは検索でした。累計 {convCount} 変換 = {convCount} 検索。
          </p>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 560,
    margin: '0 auto',
    padding: '40px 24px 320px',
    textAlign: 'left',
  },
  lead: { margin: '0 0 22px', fontSize: 14, lineHeight: 1.8 },
  kbd: {
    padding: '1px 6px',
    margin: '0 2px',
    border: '1px solid var(--border)',
    borderRadius: 4,
    background: 'var(--code-bg)',
    fontFamily: 'var(--mono)',
    fontSize: 11,
  },
  card: {
    marginTop: 18,
    padding: '14px 18px',
    border: '1px solid var(--border)',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  cardTag: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'var(--accent)',
  },
  cardName: { fontSize: 18, color: 'var(--text-h)' },
  cardMeta: { fontSize: 13, opacity: 0.75 },
  cardNote: { margin: '6px 0 0', fontSize: 12, opacity: 0.65 },
}
