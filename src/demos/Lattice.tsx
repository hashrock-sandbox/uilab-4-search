import { useMemo, useState } from 'react'
import './Lattice.css'

/** かな1文字ぶんの横幅 */
const CHW = 44
/** ノード1段ぶんの縦幅 */
const ROWH = 36
const NODE_H = 26
/** かなルーラーの高さ */
const RULER_H = 34
/** ラティス左端(BOSぶん) */
const LX = 34
/** 文節をまたぐたびに加算されるコスト */
const EDGE_COST = 1
/** 辞書にない文字を1文字ノードにするときのコスト */
const UNK_COST = 12

type DictEntry = { kana: string; surface: string; cost: number }

/** ミニ変換辞書。コストが小さいほど「もっともらしい」 */
const DICT: DictEntry[] = [
  // きょうはいしゃにいく
  { kana: 'きょう', surface: '今日', cost: 4 },
  { kana: 'きょう', surface: '京', cost: 7 },
  { kana: 'きょう', surface: '強', cost: 8 },
  { kana: 'は', surface: 'は', cost: 2 },
  { kana: 'は', surface: '歯', cost: 5 },
  { kana: 'は', surface: '葉', cost: 6 },
  { kana: 'はいしゃ', surface: '歯医者', cost: 6 },
  { kana: 'はいしゃ', surface: '廃車', cost: 8 },
  { kana: 'はいしゃ', surface: '敗者', cost: 9 },
  { kana: 'いしゃ', surface: '医者', cost: 5 },
  { kana: 'いしゃ', surface: '慰謝', cost: 9 },
  { kana: 'い', surface: '胃', cost: 8 },
  { kana: 'い', surface: '井', cost: 9 },
  { kana: 'しゃ', surface: '車', cost: 8 },
  { kana: 'しゃ', surface: '社', cost: 8 },
  { kana: 'に', surface: 'に', cost: 2 },
  { kana: 'に', surface: '荷', cost: 7 },
  { kana: 'に', surface: '二', cost: 6 },
  { kana: 'いく', surface: '行く', cost: 3 },
  { kana: 'いく', surface: '逝く', cost: 9 },
  // ここではきものをぬぐ
  { kana: 'ここ', surface: 'ここ', cost: 3 },
  { kana: 'で', surface: 'で', cost: 2 },
  { kana: 'では', surface: 'では', cost: 4 },
  { kana: 'はきもの', surface: '履物', cost: 5 },
  { kana: 'きもの', surface: '着物', cost: 5 },
  { kana: 'き', surface: '木', cost: 6 },
  { kana: 'き', surface: '気', cost: 7 },
  { kana: 'もの', surface: '物', cost: 5 },
  { kana: 'もの', surface: '者', cost: 7 },
  { kana: 'を', surface: 'を', cost: 2 },
  { kana: 'ぬぐ', surface: '脱ぐ', cost: 4 },
  // うらにわにはにわにわとりがいる
  { kana: 'うら', surface: '裏', cost: 4 },
  { kana: 'うら', surface: '浦', cost: 8 },
  { kana: 'にわ', surface: '庭', cost: 4 },
  { kana: 'にわ', surface: '二羽', cost: 7 },
  { kana: 'には', surface: 'には', cost: 3 },
  { kana: 'にわとり', surface: '鶏', cost: 5 },
  { kana: 'とり', surface: '鳥', cost: 5 },
  { kana: 'とり', surface: '取り', cost: 6 },
  { kana: 'が', surface: 'が', cost: 2 },
  { kana: 'いる', surface: 'いる', cost: 3 },
  { kana: 'いる', surface: '要る', cost: 6 },
  { kana: 'いる', surface: '射る', cost: 8 },
  // ぱんつくったことある
  { kana: 'ぱん', surface: 'パン', cost: 4 },
  { kana: 'ぱんつ', surface: 'パンツ', cost: 6 },
  { kana: 'つくった', surface: '作った', cost: 4 },
  { kana: 'くった', surface: '食った', cost: 6 },
  { kana: 'こと', surface: 'こと', cost: 3 },
  { kana: 'こと', surface: '琴', cost: 8 },
  { kana: 'ある', surface: 'ある', cost: 3 },
]

const EXAMPLES = [
  'きょうはいしゃにいく',
  'ここではきものをぬぐ',
  'うらにわにはにわにわとりがいる',
  'ぱんつくったことある',
]

type LEntry = {
  id: string
  i: number
  j: number
  surface: string
  cost: number
  unknown: boolean
  row: number
}

type Lattice = {
  n: number
  entries: LEntry[]
  rows: number
  /** 前向きビタビ: bpF[pos] = pos に最小コストで到達する最後のノード */
  bpF: (LEntry | null)[]
  /** 後ろ向きビタビ: bpB[pos] = pos から最小コストで抜ける最初のノード */
  bpB: (LEntry | null)[]
  f: number[]
  b: number[]
}

function buildLattice(s: string): Lattice {
  const n = s.length
  const entries: LEntry[] = []
  for (let i = 0; i < n; i++) {
    for (const d of DICT) {
      if (s.startsWith(d.kana, i)) {
        entries.push({
          id: `${i}-${d.kana.length}-${d.surface}`,
          i,
          j: i + d.kana.length,
          surface: d.surface,
          cost: d.cost,
          unknown: false,
          row: 0,
        })
      }
    }
    // 辞書に同じ1文字がないときだけ、未知語フォールバックを足す
    const ch = s[i]
    if (!entries.some((e) => e.i === i && e.j === i + 1 && e.surface === ch)) {
      entries.push({ id: `u${i}`, i, j: i + 1, surface: ch, cost: UNK_COST, unknown: true, row: 0 })
    }
  }

  // 前向き・後ろ向きの最短経路(ビタビ)
  const INF = 1e9
  const f = Array<number>(n + 1).fill(INF)
  const b = Array<number>(n + 1).fill(INF)
  const bpF = Array<LEntry | null>(n + 1).fill(null)
  const bpB = Array<LEntry | null>(n + 1).fill(null)
  f[0] = 0
  b[n] = 0
  const asc = [...entries].sort((x, y) => x.i - y.i)
  for (const e of asc) {
    const cand = f[e.i] + e.cost + EDGE_COST
    if (cand < f[e.j]) {
      f[e.j] = cand
      bpF[e.j] = e
    }
  }
  const desc = [...entries].sort((x, y) => y.j - x.j)
  for (const e of desc) {
    const cand = b[e.j] + e.cost + EDGE_COST
    if (cand < b[e.i]) {
      b[e.i] = cand
      bpB[e.i] = e
    }
  }

  // 横に重ならないように段を割り当てる
  const rows: LEntry[][] = []
  const packed = [...entries].sort(
    (x, y) => x.i - y.i || x.j - x.i - (y.j - y.i) || x.cost - y.cost,
  )
  for (const e of packed) {
    let r = rows.findIndex((row) => row.every((o) => o.j <= e.i || o.i >= e.j))
    if (r === -1) {
      rows.push([])
      r = rows.length - 1
    }
    rows[r].push(e)
    e.row = r
  }

  return { n, entries, rows: rows.length, bpF, bpB, f, b }
}

/** forced を必ず通る最小コスト経路 */
function bestPath(lat: Lattice, forced: LEntry | null): LEntry[] {
  const { n, bpF, bpB } = lat
  if (n === 0) return []
  const back = (pos: number): LEntry[] => {
    const out: LEntry[] = []
    while (pos > 0) {
      const e = bpF[pos]
      if (!e) return []
      out.unshift(e)
      pos = e.i
    }
    return out
  }
  const fwd = (pos: number): LEntry[] => {
    const out: LEntry[] = []
    while (pos < n) {
      const e = bpB[pos]
      if (!e) return []
      out.push(e)
      pos = e.j
    }
    return out
  }
  if (!forced) return back(n)
  return [...back(forced.i), forced, ...fwd(forced.j)]
}

const cost = (path: LEntry[]) =>
  path.reduce((sum, e) => sum + e.cost + EDGE_COST, 0)

export function Lattice() {
  const [query, setQuery] = useState(EXAMPLES[0])
  const [forcedId, setForcedId] = useState<string | null>(null)
  const q = query.trim()

  const lat = useMemo(() => buildLattice(q), [q])
  const forced = lat.entries.find((e) => e.id === forcedId) ?? null
  const path = useMemo(() => bestPath(lat, forced), [lat, forced])
  const optimal = useMemo(() => bestPath(lat, null), [lat])

  const onPath = new Set(path.map((e) => e.id))
  const pathEdges = new Set<string>()
  for (let i = 0; i + 1 < path.length; i++) pathEdges.add(`${path[i].id}|${path[i + 1].id}`)

  const width = LX + lat.n * CHW + 40
  const height = RULER_H + 12 + lat.rows * ROWH + 14
  const x = (pos: number) => LX + pos * CHW
  const nodeY = (row: number) => RULER_H + 12 + row * ROWH
  const bosY = nodeY(0) + NODE_H / 2

  // 隣接エッジ(全部薄く描いてラティスらしさを出す)
  const allEdges: { from: LEntry; to: LEntry }[] = []
  for (const a of lat.entries)
    for (const c of lat.entries) if (a.j === c.i) allEdges.push({ from: a, to: c })

  const extra = forced ? cost(path) - cost(optimal) : 0

  return (
    <div style={styles.page}>
      <p style={styles.lead}>
        かな漢字変換の正体は最短経路探索です。数字はコスト、最小コストの経路が変換結果になります。
        ノードをクリックすると、そこを通るよう経路が曲がります。
      </p>

      <div style={styles.exRow}>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            className={`lat-ex ${query === ex ? 'is-active' : ''}`}
            onClick={() => {
              setQuery(ex)
              setForcedId(null)
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      <input
        className="lat-input"
        value={query}
        maxLength={16}
        spellCheck={false}
        placeholder="ひらがなで入力"
        onChange={(e) => {
          setQuery(e.target.value)
          setForcedId(null)
        }}
      />

      {/* 変換結果(経路上の文節を並べる) */}
      <div className="lat-result">
        {path.length === 0 ? (
          <span style={styles.hint}>ここに変換結果が出ます</span>
        ) : (
          <>
            {path.map((e, i) => (
              <span key={`${e.id}-${i}`} className={`lat-seg ${e.unknown ? 'is-unk' : ''}`}>
                {e.surface}
              </span>
            ))}
            <span className="lat-total">計 {cost(path)}</span>
            {forced && extra > 0 && <span className="lat-extra">最適より +{extra}</span>}
          </>
        )}
      </div>

      <div className="lat-scroll">
        <svg
          className="lat-svg"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
        >
          {/* かなルーラーと桁線 */}
          {q.split('').map((ch, i) => (
            <g key={i}>
              <text className="lat-kana" x={x(i) + CHW / 2} y={18} textAnchor="middle">
                {ch}
              </text>
              <line
                className="lat-grid"
                x1={x(i)}
                y1={RULER_H}
                x2={x(i)}
                y2={height - 6}
              />
            </g>
          ))}
          <line
            className="lat-grid"
            x1={x(lat.n)}
            y1={RULER_H}
            x2={x(lat.n)}
            y2={height - 6}
          />

          {/* 全エッジ(薄) → 経路エッジ(濃) */}
          {allEdges.map(({ from, to }) => {
            const active = pathEdges.has(`${from.id}|${to.id}`)
            const x1 = x(from.j) - 3
            const y1 = nodeY(from.row) + NODE_H / 2
            const x2 = x(to.i) + 3
            const y2 = nodeY(to.row) + NODE_H / 2
            return (
              <path
                key={`${from.id}|${to.id}`}
                className={`lat-edge ${active ? 'is-on' : ''}`}
                d={`M ${x1} ${y1} C ${x1 + 14} ${y1}, ${x2 - 14} ${y2}, ${x2} ${y2}`}
              />
            )
          })}

          {/* BOS / EOS */}
          <circle className="lat-bos" cx={LX - 18} cy={bosY} r={5} />
          {path.length > 0 && (
            <path
              className="lat-edge is-on"
              d={`M ${LX - 13} ${bosY} C ${LX - 4} ${bosY}, ${x(path[0].i) - 8} ${
                nodeY(path[0].row) + NODE_H / 2
              }, ${x(path[0].i) + 3} ${nodeY(path[0].row) + NODE_H / 2}`}
            />
          )}
          <circle className="lat-bos" cx={x(lat.n) + 18} cy={bosY} r={5} />
          {path.length > 0 && (
            <path
              className="lat-edge is-on"
              d={`M ${x(lat.n) - 3} ${
                nodeY(path[path.length - 1].row) + NODE_H / 2
              } C ${x(lat.n) + 6} ${nodeY(path[path.length - 1].row) + NODE_H / 2}, ${
                x(lat.n) + 9
              } ${bosY}, ${x(lat.n) + 13} ${bosY}`}
            />
          )}

          {/* ノード */}
          {lat.entries.map((e) => {
            const active = onPath.has(e.id)
            const isForced = forcedId === e.id
            return (
              <g
                key={e.id}
                className={`lat-node ${active ? 'is-on' : ''} ${e.unknown ? 'is-unk' : ''} ${
                  isForced ? 'is-forced' : ''
                }`}
                onClick={() => setForcedId(isForced ? null : e.id)}
              >
                <rect
                  x={x(e.i) + 3}
                  y={nodeY(e.row)}
                  width={(e.j - e.i) * CHW - 6}
                  height={NODE_H}
                  rx={6}
                />
                <text
                  className="lat-surface"
                  x={x(e.i) + ((e.j - e.i) * CHW) / 2}
                  y={nodeY(e.row) + NODE_H / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {e.surface}
                </text>
                <text
                  className="lat-cost"
                  x={x(e.j) - 8}
                  y={nodeY(e.row) + 2}
                  textAnchor="end"
                >
                  {e.cost}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <p style={styles.note}>
        辞書 {DICT.length} 語 + 未知語(点線)。文節をまたぐたび +{EDGE_COST}
        されるので、長い単語ほど有利です。
      </p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 760,
    margin: '0 auto',
    padding: '40px 24px 80px',
    textAlign: 'left',
  },
  lead: { margin: '0 0 16px', fontSize: 14, lineHeight: 1.7 },
  exRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  hint: { fontSize: 13, opacity: 0.6 },
  note: { margin: '10px 0 0', fontSize: 12, opacity: 0.65 },
}
