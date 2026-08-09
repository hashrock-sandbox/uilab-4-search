import { useEffect, useMemo, useRef, useState } from 'react'
import { search } from '../data'
import './MozcIme.css'

/**
 * IME内蔵検索。OS の IME を使わず、ページの中に本物の Mozc（hechima-wasm）が住んでいる。
 * 変換セッション層は hechima（MIT）、変換エンジンは Mozc の Emscripten ビルド（BSD-3-Clause）。
 * 配布物は public/vendor/ に同梱（出典: https://github.com/msonrm/hechima ）。
 */

// UMD グローバル（型は public/vendor/hechima/hechima.d.ts 参照。ここでは緩く扱う）
declare global {
  interface Window {
    Hechima?: any
    KeymapEngine?: any
  }
}

type SegmentView = {
  text: string
  kind: 'yomi' | 'focus' | 'other'
  candidates?: string[]
  candidateIndex?: number
}

type Status = 'loading' | 'downloading' | 'ready' | 'error'

const BASE = import.meta.env.BASE_URL

// 2 回目以降は「タグがあるか」ではなく最初の Promise を返す。
// タグの存在で resolve すると、StrictMode の二重マウントで
// まだ実行されていない script を「読み込み済み」と誤認して
// window.KeymapEngine が undefined のまま先へ進んでしまう。
const scriptCache = new Map<string, Promise<void>>()

function loadScript(src: string): Promise<void> {
  const cached = scriptCache.get(src)
  if (cached) return cached
  const p = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => {
      scriptCache.delete(src) // 失敗は握らない（リロードで再試行できる）
      reject(new Error(`script load failed: ${src}`))
    }
    document.head.appendChild(s)
  })
  scriptCache.set(src, p)
  return p
}

export function MozcIme() {
  const [status, setStatus] = useState<Status>('loading')
  const [progress, setProgress] = useState({ loaded: 0, total: 0 })
  const [segments, setSegments] = useState<SegmentView[]>([])
  const [committed, setCommitted] = useState('')
  const fepRef = useRef<any>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let dead = false
    let worker: Worker | null = null

    const boot = async () => {
      await loadScript(`${BASE}vendor/keymap-engine/keymap-engine.js`)
      await loadScript(`${BASE}vendor/hechima/hechima.js`)
      if (dead) return
      const Hechima = window.Hechima
      const KeymapEngine = window.KeymapEngine

      worker = new Worker(`${BASE}vendor/hechima/hechima-worker.js`)
      // worker のロード失敗は connectWorker からは見えない（EMBEDDING.md の注意）
      worker.addEventListener('error', () => {
        if (!dead) setStatus('error')
      })

      const conn = Hechima.connectWorker(worker, {
        maxCands: 24,
        onProgress: (loaded: number, total: number) => {
          if (dead) return // 破棄済みセッションの進捗で ready を巻き戻さない
          setStatus('downloading')
          setProgress({ loaded, total })
        },
      })
      conn.init({
        wasmJs: `${BASE}vendor/hechima-wasm/hechima-wasm.js`,
        dataUrl: `${BASE}vendor/hechima-wasm/mozc.data`,
      })

      const fep = Hechima.createFep({
        show: (segs: SegmentView[]) => setSegments(segs),
        hide: () => setSegments([]),
        commit: (text: string) => {
          setSegments([])
          setCommitted((prev) => prev + text)
        },
        // cb.hostKey は内蔵ローマ字経路専用。engine（配列）を挿しているこのデモでは
        // 呼ばれず、未確定が空のときの編集キーは feed() が false を返してホストに戻る。
        // → 確定済みクエリの編集は onKeyDown 側で受け持つ。
        ...conn.callbacks(),
      })

      // 内蔵ローマ字経路は畳む方針なので配列 JSON を必ず挿す（VENDOR.md）
      const raw = await (await fetch(`${BASE}vendor/keymaps/romaji.json`)).json()
      if (dead) return
      const engine = new KeymapEngine.InputEngine(KeymapEngine.decodeKeymap(raw))
      engine.onStateChange = () => fep.pumpEngine()
      fep.setEngine(engine, (tap: KeyboardEvent) => KeymapEngine.keyEventFromBrowser(tap))
      fep.setActive(true)
      fepRef.current = fep

      await conn.init()
      if (!dead) setStatus('ready')
    }

    boot().catch(() => setStatus('error'))
    return () => {
      dead = true
      fepRef.current?.setActive(false)
      fepRef.current = null
      worker?.terminate()
    }
  }, [])

  const results = useMemo(() => search(committed), [committed])
  const focusSeg = segments.find((s) => s.kind === 'focus' && s.candidates?.length)

  const onKeyDown = (e: React.KeyboardEvent) => {
    const fep = fepRef.current
    if (!fep) return
    if (e.nativeEvent.isComposing) return // OS の IME が挟まったら触らない
    if (fep.feed(e.nativeEvent)) {
      e.preventDefault()
      return
    }
    // 飲まれなかった編集キー = 未確定が空。確定済みクエリを削る
    if (e.key === 'Backspace') {
      e.preventDefault()
      setCommitted((prev) => Array.from(prev).slice(0, -1).join('')) // 🍜 も 1 文字
    }
  }
  const onKeyUp = (e: React.KeyboardEvent) => {
    fepRef.current?.feedUp(e.nativeEvent)
  }

  const pct = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>IME内蔵検索</h2>
      <p style={styles.lead}>
        OS の IME はお休みください。この窓には本物の Mozc（WebAssembly）が住んでいます。
        <strong style={{ color: 'var(--text-h)' }}>OS 側は英数モードのまま</strong>
        ローマ字で打つと、ページの中だけで文節変換が動きます。
      </p>

      {status !== 'ready' && (
        <div className="mozc-boot" role="status">
          {status === 'loading' && 'エンジンを読み込んでいます…'}
          {status === 'downloading' && (
            <>
              辞書をダウンロード中（18.9MB・初回のみ） {pct}%
              <span className="mozc-boot-bar">
                <span className="mozc-boot-fill" style={{ width: `${pct}%` }} />
              </span>
            </>
          )}
          {status === 'error' && 'エンジンの起動に失敗しました。リロードしてみてください。'}
        </div>
      )}

      <div
        ref={stageRef}
        className={`mozc-field${status === 'ready' ? '' : ' is-disabled'}`}
        tabIndex={0}
        role="textbox"
        aria-label="ローマ字で入力（ページ内IMEで変換）"
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      >
        {committed === '' && segments.length === 0 && (
          <span className="mozc-placeholder">クリックして ra-men と打って Space</span>
        )}
        <span className="mozc-committed">{committed}</span>
        {segments.map((seg, i) => (
          <span key={i} className={`mozc-seg is-${seg.kind}`}>
            {seg.text}
          </span>
        ))}
        <span className="mozc-caret" aria-hidden="true" />

        {focusSeg && (
          <ul className="mozc-cands" role="listbox" aria-label="変換候補">
            {focusSeg.candidates!.map((cand, i) => (
              <li
                key={`${cand}-${i}`}
                role="option"
                aria-selected={i === focusSeg.candidateIndex}
                className={i === focusSeg.candidateIndex ? 'is-active' : ''}
                onMouseDown={(e) => {
                  e.preventDefault() // フォーカスを奪わない
                  fepRef.current?.selectCandidate(i)
                }}
              >
                {cand}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p style={styles.status} aria-live="polite">
        {committed.trim() !== '' ? `「${committed}」 ${results.length} 件` : ' '}
        {committed !== '' && (
          <button type="button" style={styles.clear} onClick={() => setCommitted('')}>
            クリア
          </button>
        )}
      </p>

      {committed.trim() !== '' && (
        <ul style={styles.list}>
          {results.length === 0 ? (
            <li style={styles.empty}>一致する食べ物はありません</li>
          ) : (
            results.slice(0, 30).map((item) => (
              <li key={item.id} style={styles.row}>
                <span style={styles.name}>{item.name}</span>
                <span style={styles.meta}>
                  {item.kind}
                  {item.tags.length > 0 && ` · ${item.tags.join(' / ')}`}
                </span>
              </li>
            ))
          )}
        </ul>
      )}

      <p style={styles.keys}>
        <kbd style={styles.kbd}>Space</kbd> 変換/次候補・<kbd style={styles.kbd}>←</kbd>
        <kbd style={styles.kbd}>→</kbd> 文節移動・<kbd style={styles.kbd}>Enter</kbd> 確定・
        <kbd style={styles.kbd}>Esc</kbd> 取消 — powered by Mozc (hechima-wasm)
      </p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 520, margin: '0 auto', padding: '48px 24px 80px', textAlign: 'left' },
  heading: { fontSize: 22, margin: '0 0 6px' },
  lead: { margin: '0 0 24px', fontSize: 14, lineHeight: 1.7 },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: '12px 2px 8px',
    fontSize: 13,
    opacity: 0.8,
    minHeight: 24,
  },
  clear: {
    padding: '2px 10px',
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--text)',
    font: 'inherit',
    fontSize: 12,
    cursor: 'pointer',
  },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  row: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    padding: '9px 2px',
    borderBottom: '1px solid var(--border)',
  },
  empty: { padding: '10px 2px', fontSize: 14, opacity: 0.7 },
  name: { fontSize: 15, color: 'var(--text-h)' },
  meta: { fontSize: 12, opacity: 0.7, textAlign: 'right' },
  keys: { marginTop: 28, fontSize: 12, opacity: 0.7 },
  kbd: {
    padding: '1px 6px',
    margin: '0 2px',
    border: '1px solid var(--border)',
    borderRadius: 4,
    background: 'var(--code-bg)',
    fontFamily: 'var(--mono)',
    fontSize: 11,
  },
}
