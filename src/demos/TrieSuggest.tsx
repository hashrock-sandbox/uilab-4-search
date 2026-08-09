import { useMemo, useState } from 'react'
import { words } from '../words'
import './TrieSuggest.css'

/** 半角1文字ぶんの横幅(等幅フォント前提) */
const CH = 9
/** 葉ひとつぶんの縦幅 */
const ROW = 21
/** 親子間の横方向の余白 */
const GAP = 16
const PAD_X = 20
const PAD_Y = 14
/** この語数以下の枝は全部並べる。超える枝は件数つきで畳む */
const FOLD_AT = 12

type TNode = {
  id: number
  /** このノードが持つ文字列(パトリシア木なので複数文字) */
  label: string
  children: TNode[]
  /** ここで終わる単語 */
  word?: string
  /** この枝の下にある単語の数 */
  count: number
}

function buildTrie() {
  let seq = 0
  const mk = (label: string): TNode => ({ id: seq++, label, children: [], count: 0 })

  // まず1文字1ノードのトライを作る
  const root = mk('')
  for (const w of words) {
    let node = root
    for (const ch of w) {
      let next = node.children.find((c) => c.label === ch)
      if (!next) {
        next = mk(ch)
        node.children.push(next)
      }
      node = next
    }
    node.word = w
  }

  // 一本道の枝を1ノードにまとめる(パトリシア木)
  const compress = (n: TNode) => {
    for (const c of n.children) {
      while (!c.word && c.children.length === 1) {
        const only = c.children[0]
        c.label += only.label
        c.word = only.word
        c.children = only.children
      }
      compress(c)
    }
  }
  compress(root)

  // 並び順と、枝ごとの単語数
  const finish = (n: TNode): number => {
    n.children.sort((a, b) => a.label.localeCompare(b.label))
    n.count = (n.word ? 1 : 0) + n.children.reduce((sum, c) => sum + finish(c), 0)
    return n.count
  }
  finish(root)

  return { root }
}

const TRIE = buildTrie()

type Walk = {
  /** 走査が止まったノード */
  frontier: TNode
  /** frontier のラベル内で一致した文字数 */
  matched: number
  /** 途中で行き止まりになったか */
  dead: boolean
}

function walkTrie(root: TNode, q: string): Walk {
  let node = root
  let i = 0
  while (i < q.length) {
    const next = node.children.find((c) => c.label[0] === q[i])
    if (!next) return { frontier: node, matched: node.label.length, dead: true }
    let j = 0
    while (j < next.label.length && i < q.length) {
      if (next.label[j] !== q[i]) return { frontier: next, matched: j, dead: true }
      j++
      i++
    }
    if (j < next.label.length) return { frontier: next, matched: j, dead: false }
    node = next
  }
  return { frontier: node, matched: node.label.length, dead: false }
}

/**
 * 表示用ツリー: クエリを根にして frontier から先を並べる。
 * FOLD_AT を超える枝は子を持たない「畳まれたノード」になり、件数だけ見せる
 */
type DNode = {
  key: string
  label: string
  full: string
  isWord: boolean
  folded: boolean
  count: number
  children: DNode[]
  x: number
  y: number
}

function toD(n: TNode, prefix: string): DNode {
  const full = prefix + n.label
  const folded = n.count > FOLD_AT && n.children.length > 0
  return {
    key: `n${n.id}`,
    label: n.label,
    full,
    isWord: Boolean(n.word),
    folded,
    count: n.count,
    children: folded ? [] : n.children.map((c) => toD(c, full)),
    x: 0,
    y: 0,
  }
}

function layoutView(q: string, walk: Walk) {
  // 走査がラベルの途中で止まっていたら、残りを1ノードとして挟む
  const rest = walk.frontier.label.slice(walk.matched)
  const root: DNode = {
    key: 'root',
    label: q,
    full: q,
    isWord: false,
    folded: false,
    count: walk.frontier.count,
    children: [],
    x: 0,
    y: 0,
  }
  if (rest !== '') {
    const restFolded = walk.frontier.count > FOLD_AT && walk.frontier.children.length > 0
    root.children = [
      {
        key: `n${walk.frontier.id}`,
        label: rest,
        full: q + rest,
        isWord: Boolean(walk.frontier.word),
        folded: restFolded,
        count: walk.frontier.count,
        children: restFolded
          ? []
          : walk.frontier.children.map((c) => toD(c, q + rest)),
        x: 0,
        y: 0,
      },
    ]
  } else {
    root.isWord = Boolean(walk.frontier.word)
    root.children = walk.frontier.children.map((c) => toD(c, q))
  }

  let leaf = 0
  let maxX = 0
  const place = (n: DNode, chars: number, depth: number) => {
    n.x = PAD_X + chars * CH + depth * GAP
    // ラベル + 語末マーカー + 件数バッジのぶんまで幅を確保
    const extra = (n.isWord ? 14 : 0) + (n.folded ? 12 + String(n.count).length * 8 : 0)
    maxX = Math.max(maxX, n.x + n.label.length * CH + extra)
    if (n.children.length === 0) {
      n.y = PAD_Y + leaf * ROW + ROW / 2
      leaf++
    } else {
      for (const c of n.children) place(c, chars + n.label.length, depth + 1)
      n.y = (n.children[0].y + n.children[n.children.length - 1].y) / 2
    }
  }
  place(root, 0, 0)

  const nodes: DNode[] = []
  const edges: { from: DNode; to: DNode }[] = []
  const collect = (n: DNode) => {
    nodes.push(n)
    for (const c of n.children) {
      edges.push({ from: n, to: c })
      collect(c)
    }
  }
  collect(root)

  return { root, nodes, edges, width: maxX + PAD_X + 20, height: PAD_Y * 2 + leaf * ROW }
}

export function TrieSuggest() {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const walk = useMemo(() => walkTrie(TRIE.root, q), [q])
  const aliveCount = walk.dead ? 0 : walk.frontier.count

  const view = useMemo(() => (walk.dead ? null : layoutView(q, walk)), [q, walk])

  return (
    <div style={styles.page}>
      <p style={styles.lead}>
        検索サジェストの正体はツリー走査です。{FOLD_AT} 語を超える枝は畳まれ、クリックで掘り進めます。
      </p>

      <input
        className="trie-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
        placeholder="前方一致で入力(例: alg / micro / zo)"
        spellCheck={false}
      />

      <p style={styles.stats}>
        {walk.dead
          ? 'この枝の先には何もありません(行き止まり)'
          : `候補 ${aliveCount.toLocaleString()} 語`}
      </p>

      {view ? (
        <div className="trie-scroll">
          <svg
            className="trie-svg"
            width={view.width}
            height={view.height}
            viewBox={`0 0 ${view.width} ${view.height}`}
          >
            {view.edges.map((e) => {
              const x1 = e.from.x + e.from.label.length * CH + (e.from.isWord ? 14 : 5)
              const x2 = e.to.x - 4
              const mx = (x1 + x2) / 2
              return (
                <path
                  key={e.to.key}
                  className="trie-edge"
                  d={`M ${x1} ${e.from.y} C ${mx} ${e.from.y}, ${mx} ${e.to.y}, ${x2} ${e.to.y}`}
                />
              )
            })}

            {view.nodes.map((n) => {
              const isRoot = n.key === 'root'
              const clickable = !isRoot && (n.isWord || n.folded)
              const markX = n.x + n.label.length * CH + 8
              return (
                <g
                  key={n.key}
                  className={`trie-node ${isRoot ? 'is-root' : ''} ${clickable ? 'clickable' : ''}`}
                  onClick={clickable ? () => setQuery(n.full) : undefined}
                >
                  <text x={n.x} y={n.y} dominantBaseline="central">
                    {n.label}
                  </text>
                  {/* 根は走査カーソルが同じ位置に来るのでマーカーを省く */}
                  {n.isWord && !isRoot && (
                    <circle className="trie-end" cx={markX} cy={n.y} r={3} />
                  )}
                  {n.folded && (
                    <text
                      className="trie-fold"
                      x={markX + (n.isWord ? 8 : 0)}
                      y={n.y}
                      dominantBaseline="central"
                    >
                      ▸{n.count.toLocaleString()}
                    </text>
                  )}
                </g>
              )
            })}

            <g
              className="trie-cursor"
              style={{
                transform: `translate(${view.root.x + q.length * CH + 9}px, ${view.root.y}px)`,
              }}
            >
              <circle r={6} />
            </g>
          </svg>
        </div>
      ) : (
        <div className="trie-dark">
          <p style={styles.darkHint}>🥀 走査失敗。1文字消して戻ってください。</p>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '40px 24px 80px',
    textAlign: 'left',
  },
  lead: { margin: '0 0 18px', fontSize: 14, lineHeight: 1.7 },
  stats: { margin: '10px 2px 8px', fontSize: 13, color: 'var(--text-h)' },
  darkHint: { margin: 0, fontSize: 13, opacity: 0.75 },
}
