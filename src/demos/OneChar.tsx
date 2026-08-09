import { useMemo, useRef, useState } from 'react'
import { search } from '../data'
import './OneChar.css'

/**
 * 1文字しか入らない検索。
 * 新しい文字を打つと前の文字が即座に消えて上書きされる。
 * 「最後に打った1文字」でだけ部分一致検索が走る、純度100%のあいまい検索。
 */
export function OneChar() {
  const [char, setChar] = useState('')
  const [pop, setPop] = useState(0) // 上書きのたびに増やしてアニメを付け替える
  const stageRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 何が来ても「最後の1文字」だけ残す
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Array.from(e.target.value).pop() ?? ''
    setChar(next)
    if (next) setPop((n) => n + 1)
  }

  const results = useMemo(() => search(char), [char])

  const focus = () => inputRef.current?.focus()

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>1文字しか入らない検索</h2>
      <p style={styles.lead}>打つと前の文字が消える、1文字しか入らない検索です。</p>

      <div
        ref={stageRef}
        className="onechar-stage"
        onClick={focus}
        role="search"
        aria-label="1文字検索"
      >
        <input
          ref={inputRef}
          className="onechar-input"
          type="text"
          value={char}
          onChange={onChange}
          aria-label="食べ物を1文字で検索"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
        />
        {char ? (
          <span key={pop} className="onechar-glyph is-hit" aria-hidden="true">
            {char}
          </span>
        ) : (
          <p className="onechar-empty">
            ここに文字を打ってください
            <span className="onechar-caret" aria-hidden="true" />
          </p>
        )}
      </div>

      <p style={styles.status} aria-live="polite">
        {char ? `「${char}」を含む ${results.length} 件` : ' '}
      </p>

      {char && (
        <ul className="onechar-list" aria-label="検索結果">
          {results.length === 0 ? (
            <li style={styles.empty}>「{char}」を含む食べ物はありません</li>
          ) : (
            results.map((item) => (
              <li key={item.id} className="onechar-option">
                <span style={styles.name}>
                  <Highlight text={item.name} query={char} />
                </span>
                <span style={styles.meta}>
                  <Highlight text={`${item.kind} · ${item.tags.join(' / ')}`} query={char} />
                </span>
              </li>
            ))
          )}
        </ul>
      )}

      <p style={styles.keys}>
        キーを打つたびに前の文字は蒸発します。<kbd style={styles.kbd}>Backspace</kbd> で空に戻せます。
      </p>
    </div>
  )
}

/** マッチした部分だけ <mark> で囲む */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>

  const parts: React.ReactNode[] = []
  let rest = text
  let key = 0

  while (rest) {
    const at = rest.indexOf(q)
    if (at === -1) {
      parts.push(rest)
      break
    }
    if (at > 0) parts.push(rest.slice(0, at))
    parts.push(<mark key={key++}>{rest.slice(at, at + q.length)}</mark>)
    rest = rest.slice(at + q.length)
  }
  return <>{parts}</>
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 520, margin: '0 auto', padding: '48px 24px 80px' },
  heading: { fontSize: 22, margin: '0 0 6px' },
  lead: { margin: '0 0 24px', fontSize: 14, lineHeight: 1.7 },
  status: { margin: '10px 2px', fontSize: 13, opacity: 0.7 },
  empty: { padding: '10px 12px', fontSize: 14, opacity: 0.7 },
  name: { fontSize: 15, color: 'var(--text-h)' },
  meta: { fontSize: 12, opacity: 0.7, textAlign: 'right' },
  keys: { marginTop: 28, fontSize: 12, opacity: 0.7 },
  kbd: {
    padding: '1px 6px',
    border: '1px solid var(--border)',
    borderRadius: 4,
    background: 'var(--code-bg)',
    fontFamily: 'var(--mono)',
    fontSize: 11,
  },
}
