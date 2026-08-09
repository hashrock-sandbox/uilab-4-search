import { useMemo, useRef, useState } from 'react'
import { items, type Item } from '../data'
import './GachaSearch.css'

type Rarity = 'SSR' | 'SR' | 'R' | 'N'

/** 提供割合。関連度が高いものほど出にくいのがこのガチャの残酷なところ */
const RATES: { rarity: Rarity; rate: number; label: string }[] = [
  { rarity: 'SSR', rate: 0.03, label: '完全一致' },
  { rarity: 'SR', rate: 0.12, label: '名前に含む' },
  { rarity: 'R', rate: 0.35, label: 'カテゴリ・タグが一致' },
  { rarity: 'N', rate: 0.5, label: '無関係' },
]

/** この回数 SSR が出なければ次は確定 */
const PITY = 30

const STARS: Record<Rarity, string> = {
  SSR: '★★★',
  SR: '★★',
  R: '★',
  N: '☆',
}

type Draw = { key: number; item: Item; rarity: Rarity }

function rarityOf(item: Item, query: string): Rarity {
  const q = query.trim()
  if (!q) return 'N'
  if (item.name === q) return 'SSR'
  if (item.name.includes(q)) return 'SR'
  if (item.kind.includes(q) || item.tags.some((tag) => tag.includes(q))) return 'R'
  return 'N'
}

export function GachaSearch() {
  const [query, setQuery] = useState('')
  const [draws, setDraws] = useState<Draw[]>([])
  const [pity, setPity] = useState(0)
  const [total, setTotal] = useState(0)
  const [ssrCount, setSsrCount] = useState(0)
  const keySeq = useRef(0)

  const pools = useMemo(() => {
    const grouped: Record<Rarity, Item[]> = { SSR: [], SR: [], R: [], N: [] }
    for (const item of items) grouped[rarityOf(item, query)].push(item)
    return grouped
  }, [query])

  const canDraw = query.trim().length > 0

  const roll = (count: number) => {
    let localPity = pity
    let localSsr = 0
    const rolled: Draw[] = []

    for (let i = 0; i < count; i++) {
      const forced = localPity + 1 >= PITY && pools.SSR.length > 0
      const rarity = forced ? 'SSR' : pickRarity(pools)
      const pool = pools[rarity]
      const item = pool[Math.floor(Math.random() * pool.length)]

      rolled.push({ key: keySeq.current++, item, rarity })
      if (rarity === 'SSR') {
        localPity = 0
        localSsr++
      } else {
        localPity++
      }
    }

    setDraws(rolled)
    setPity(localPity)
    setTotal((n) => n + count)
    setSsrCount((n) => n + localSsr)
  }

  return (
    <div style={styles.page}>
      <p style={styles.lead}>
        1件ずつ引き当てる検索。関連度がレア度なので、
        <strong style={{ color: 'var(--text-h)' }}>欲しい結果ほど出ません</strong>。
      </p>

      <div style={styles.controls}>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setDraws([])
          }}
          placeholder="狙う言葉（例: たい焼き / あまい / 麺）"
          style={styles.input}
        />
        <button
          type="button"
          className="gacha-button"
          disabled={!canDraw}
          onClick={() => roll(1)}
        >
          引く
        </button>
        <button
          type="button"
          className="gacha-button"
          disabled={!canDraw}
          onClick={() => roll(10)}
        >
          10連
        </button>
      </div>

      {!canDraw && <p style={styles.note}>まず狙う言葉を決めてください。</p>}

      {draws.length > 0 && (
        <div style={styles.grid}>
          {draws.map((draw, i) => (
            <div
              key={draw.key}
              className={`gacha-card is-${draw.rarity.toLowerCase()}`}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <span style={styles.rarity}>{STARS[draw.rarity]}</span>
              <span style={styles.name}>{draw.item.name}</span>
              <span style={styles.kind}>{draw.item.kind}</span>
            </div>
          ))}
        </div>
      )}

      <div style={styles.panel}>
        <div style={styles.stats}>
          <span>
            累計 <strong style={{ color: 'var(--text-h)' }}>{total}</strong> 連
          </span>
          <span>
            SSR <strong style={{ color: 'var(--text-h)' }}>{ssrCount}</strong> 枚
          </span>
          <span>天井まであと {Math.max(0, PITY - pity)} 連</span>
        </div>

        <table style={styles.table}>
          <tbody>
            {RATES.map(({ rarity, rate, label }) => (
              <tr key={rarity}>
                <td style={{ ...styles.cell, width: 60 }}>{STARS[rarity]}</td>
                <td style={styles.cell}>{label}</td>
                <td style={{ ...styles.cell, textAlign: 'right', width: 56 }}>
                  {(rate * 100).toFixed(0)}%
                </td>
                <td style={{ ...styles.cell, textAlign: 'right', width: 64, opacity: 0.6 }}>
                  {pools[rarity].length} 件
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={styles.disclaimer}>
          ※ 該当0件のレア度は抽選から除外され、他のレア度に振り分けられます
        </p>
      </div>
    </div>
  )
}

/** 中身が0件のレア度を除いて正規化してから抽選する */
function pickRarity(pools: Record<Rarity, Item[]>): Rarity {
  const available = RATES.filter(({ rarity }) => pools[rarity].length > 0)
  const sum = available.reduce((acc, { rate }) => acc + rate, 0)
  let r = Math.random() * sum
  for (const { rarity, rate } of available) {
    r -= rate
    if (r <= 0) return rarity
  }
  return available[available.length - 1].rarity
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 680,
    margin: '0 auto',
    padding: '40px 24px 80px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  lead: { margin: 0, fontSize: 15, lineHeight: 1.6 },
  controls: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  input: {
    flex: '1 1 240px',
    padding: '12px 16px',
    border: '1px solid var(--border)',
    borderRadius: 10,
    background: 'var(--bg)',
    color: 'var(--text-h)',
    font: 'inherit',
    fontSize: 16,
    outline: 'none',
  },
  note: { margin: 0, fontSize: 14, opacity: 0.7 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 10,
  },
  rarity: { fontSize: 13, letterSpacing: 1, color: 'var(--text-h)' },
  name: { fontSize: 15, color: 'var(--text-h)', textAlign: 'center', padding: '0 4px' },
  kind: { fontSize: 12, opacity: 0.7 },
  panel: {
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  stats: { display: 'flex', gap: 20, fontSize: 14, flexWrap: 'wrap' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  cell: { padding: '4px 0', borderTop: '1px solid var(--border)' },
  disclaimer: { margin: 0, fontSize: 12, opacity: 0.6 },
}
