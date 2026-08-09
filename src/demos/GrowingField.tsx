import { useMemo, useRef, useState } from 'react'
import { search } from '../data'
import './GrowingField.css'

/** これ以上打っても育たない、満開の文字数 */
const FULL = 15

/** t を [0,1] に丸める */
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t)

/** a→b を t で線形補間 */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function GrowingField() {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // 文字数（trim しない。空白を連打しても律儀に育つ方が可笑しい）
  const len = query.length
  // 0（空）→ 1（15文字で満開）
  const grow = clamp01(len / FULL)

  const results = useMemo(() => search(query), [query])

  // grow に比例して各寸法を補間。CSS 変数に流し込む
  const stageStyle = {
    '--grow': grow,
    '--grow-font': `${lerp(18, 96, grow)}px`,
    '--grow-w': `${lerp(360, 1200, grow)}px`,
    '--grow-pad-x': `${lerp(14, 44, grow)}px`,
    '--grow-pad-y': `${lerp(10, 40, grow)}px`,
    '--grow-icon': `${lerp(18, 64, grow)}px`,
    '--grow-clear': `${lerp(24, 72, grow)}px`,
    '--grow-lift': `${lerp(2, 30, grow)}px`,
  } as React.CSSProperties

  const clear = () => {
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>育つ検索窓</h2>
      <p style={styles.lead}>文字数に比例して窓が巨大化し、15文字で画面を覆い尽くします。</p>

      <label htmlFor="growing-search" className="grow-sr-only">
        食べ物を検索
      </label>
      <div className="grow-stage" style={stageStyle}>
        <div className="grow-field">
          <SearchIcon />
          <input
            id="growing-search"
            ref={inputRef}
            className="grow-input"
            type="search"
            autoComplete="off"
            value={query}
            placeholder="麺"
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="grow-clear"
              onClick={clear}
              aria-label="クリアして元のサイズに戻す"
            >
              <ClearIcon />
            </button>
          )}
        </div>
      </div>

      <p style={styles.meter} aria-live="polite">
        {len === 0
          ? 'まだ苗。1文字打つごとに育ちます'
          : len >= FULL
            ? `${len}文字 — 満開。もう画面に収まりません`
            : `${len}文字 — 育成度 ${Math.round(grow * 100)}%`}
      </p>

      {query && (
        <div style={styles.resultBlock}>
          <p style={styles.resultHead}>
            検索結果 {results.length} 件
            {results.length > 0 && grow > 0.6 && '（窓に押されて下の方にいます）'}
          </p>
          {results.length === 0 ? (
            <p style={styles.empty}>「{query}」に一致する結果はありません</p>
          ) : (
            <ul className="grow-results">
              {results.map((item) => (
                <li key={item.id} className="grow-chip">
                  {item.name}
                  <small>{item.kind}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg className="grow-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12.9 12.9 17 17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg
      width="60%"
      height="60%"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 6l8 8M14 6l-8 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 520, margin: '0 auto', padding: '48px 24px 80px' },
  heading: { fontSize: 22, margin: '0 0 6px', color: 'var(--text-h)' },
  lead: { margin: '0 0 24px', fontSize: 14, lineHeight: 1.7 },
  meter: { margin: '18px 2px 0', fontSize: 13, opacity: 0.7 },
  resultBlock: { marginTop: 20 },
  resultHead: { margin: '0 0 10px', fontSize: 13, opacity: 0.7 },
  empty: { fontSize: 14, opacity: 0.7 },
}
