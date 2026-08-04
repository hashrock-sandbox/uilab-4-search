import { useEffect, useMemo, useRef, useState } from 'react'
import { search, type Item } from '../data'
import './PlainSearch.css'

const DEBOUNCE = 120

export function PlainSearch() {
  const [query, setQuery] = useState('')
  const [deferred, setDeferred] = useState('')
  const [active, setActive] = useState(-1)
  const [selected, setSelected] = useState<Item | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // 入力のたびに検索し直さず、少しだけ待つ
  useEffect(() => {
    const id = setTimeout(() => setDeferred(query), DEBOUNCE)
    return () => clearTimeout(id)
  }, [query])

  const results = useMemo(() => search(deferred), [deferred])
  const open = deferred.trim() !== ''

  // 結果が変わったら選択位置を戻す
  useEffect(() => setActive(-1), [deferred])

  // キーボードで動かした行を視界に入れる
  useEffect(() => {
    if (active < 0) return
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const commit = (item: Item) => {
    setSelected(item)
    setQuery(item.name)
    inputRef.current?.focus()
  }

  const clear = () => {
    setQuery('')
    setSelected(null)
    inputRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      clear()
      return
    }
    if (!open || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      commit(results[active])
    }
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>普通の検索フィールド</h2>
      <p style={styles.lead}>
        大喜利の基準線。虫眼鏡・クリアボタン・インクリメンタルサーチ・キーボード操作・
        ハイライトが入った、まっとうな実装です。
      </p>

      <label htmlFor="plain-search" className="plain-sr-only">
        食べ物を検索
      </label>
      <div className="plain-field">
        <SearchIcon />
        <input
          id="plain-search"
          ref={inputRef}
          className="plain-input"
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls="plain-results"
          aria-activedescendant={active >= 0 ? `plain-option-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          placeholder="食べ物を検索"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {query && (
          <button type="button" className="plain-clear" onClick={clear} aria-label="クリア">
            <ClearIcon />
          </button>
        )}
      </div>

      <p style={styles.status} aria-live="polite">
        {open ? `${results.length} 件` : ' '}
      </p>

      {open && (
        <ul id="plain-results" ref={listRef} role="listbox" style={styles.list}>
          {results.length === 0 ? (
            <li style={styles.empty}>「{deferred}」に一致する結果はありません</li>
          ) : (
            results.map((item, i) => (
              <li
                key={item.id}
                id={`plain-option-${i}`}
                className="plain-option"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(item)}
              >
                <span style={styles.name}>
                  <Highlight text={item.name} query={deferred} />
                </span>
                <span style={styles.meta}>
                  <Highlight text={`${item.kind} · ${item.tags.join(' / ')}`} query={deferred} />
                </span>
              </li>
            ))
          )}
        </ul>
      )}

      {selected && (
        <p style={styles.selected}>
          選択：<strong style={{ color: 'var(--text-h)' }}>{selected.name}</strong>（
          {selected.kind}）
        </p>
      )}

      <p style={styles.keys}>
        <kbd style={styles.kbd}>↑</kbd> <kbd style={styles.kbd}>↓</kbd> で移動・
        <kbd style={styles.kbd}>Enter</kbd> で決定・<kbd style={styles.kbd}>Esc</kbd> でクリア
      </p>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg
      className="plain-icon"
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
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
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M6 6l8 8M14 6l-8 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
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
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 4,
    border: '1px solid var(--border)',
    borderRadius: 10,
    maxHeight: 320,
    overflowY: 'auto',
  },
  empty: { padding: '10px 12px', fontSize: 14, opacity: 0.7 },
  name: { fontSize: 15, color: 'var(--text-h)' },
  meta: { fontSize: 12, opacity: 0.7, textAlign: 'right' },
  selected: { marginTop: 16, fontSize: 14 },
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
