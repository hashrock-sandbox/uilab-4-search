import { useEffect, useMemo, useRef, useState } from 'react'
import './BugHunt.css'

type Rarity = 1 | 2 | 3 | 4 | 5

type Bug = {
  id: string
  name: string
  emoji: string
  rarity: Rarity
  tags: string[]
}

/** 茂みにいるもの。ゴミも混ざる */
const BUGS: Bug[] = [
  { id: 'ari', name: 'アリ', emoji: '🐜', rarity: 1, tags: ['小さい', '行列', '昼'] },
  { id: 'mimizu', name: 'ミミズ', emoji: '🪱', rarity: 1, tags: ['土', 'ぬるぬる'] },
  { id: 'katatsumuri', name: 'カタツムリ', emoji: '🐌', rarity: 1, tags: ['雨', '殻', 'おそい'] },
  { id: 'hae', name: 'ハエ', emoji: '🪰', rarity: 1, tags: ['小さい', 'はやい', 'うるさい'] },
  { id: 'ishi', name: '石ころ', emoji: '🪨', rarity: 1, tags: ['ゴミ', 'はずれ', '虫ですらない'] },
  { id: 'imomushi', name: 'いも虫', emoji: '🐛', rarity: 2, tags: ['葉っぱ', 'やわらかい'] },
  { id: 'tentou', name: 'テントウムシ', emoji: '🐞', rarity: 2, tags: ['赤い', '小さい', '昼'] },
  { id: 'korogi', name: 'コオロギ', emoji: '🦗', rarity: 2, tags: ['夜', '鳴く', '跳ぶ'] },
  { id: 'hachi', name: 'ミツバチ', emoji: '🐝', rarity: 2, tags: ['あまい', '花', '危険'] },
  { id: 'kanabun', name: 'カナブン', emoji: '🪲', rarity: 3, tags: ['樹液', '甲虫', '昼'] },
  { id: 'ageha', name: 'アゲハチョウ', emoji: '🦋', rarity: 3, tags: ['花', '美しい', '昼'] },
  {
    id: 'kokuwa',
    name: 'コクワガタ',
    emoji: '🪲',
    rarity: 3,
    tags: ['樹液', '甲虫', '夜', 'クワガタ'],
  },
  {
    id: 'kabuto',
    name: 'カブトムシ',
    emoji: '🪲',
    rarity: 4,
    tags: ['樹液', '甲虫', '夜', '大きい', '角', 'カブト'],
  },
  {
    id: 'nokogiri',
    name: 'ノコギリクワガタ',
    emoji: '🪲',
    rarity: 4,
    tags: ['樹液', '甲虫', '夜', '大きい', '角', 'クワガタ'],
  },
  {
    id: 'hercules',
    name: 'ヘラクレスオオカブト',
    emoji: '🪲',
    rarity: 5,
    tags: ['樹液', '甲虫', '外国', '伝説', '大きい', '角', 'カブト'],
  },
]

/** レア度ごとの排出率(%) */
const RARITY_RATE: Record<Rarity, number> = { 1: 45, 2: 27, 3: 17, 4: 9, 5: 2 }
/** 狙いに合う虫はこの倍率で優遇される */
const AIM_BONUS = 3
/** レア度で標本のサイズが変わる */
const SIZE: Record<Rarity, number> = { 1: 20, 2: 23, 3: 26, 4: 30, 5: 36 }

/** フィールドを出る → 歩く → 茂みを探す → 帰る → フィールドに戻る */
type Phase = 'idle' | 'exiting' | 'walking' | 'searching' | 'returning' | 'entering'

const NEXT: Record<Phase, { next: Phase; ms: number } | null> = {
  idle: null,
  exiting: { next: 'walking', ms: 520 },
  walking: { next: 'searching', ms: 1100 },
  searching: { next: 'returning', ms: 1100 },
  returning: { next: 'entering', ms: 1100 },
  entering: { next: 'idle', ms: 520 },
}

type Caught = { key: number; bug: Bug; aimed: boolean }

export function BugHunt() {
  const [query, setQuery] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [carrying, setCarrying] = useState<Bug | null>(null)
  const [collection, setCollection] = useState<Caught[]>([])
  const [message, setMessage] = useState('狙いを入れて、茂みに行かせてください。')
  const catchSeq = useRef(0)
  const pending = useRef<Caught | null>(null)

  const aimed = useMemo(() => aimedBugs(query), [query])

  // 歩く → 探す → 帰る、を時間で進める
  useEffect(() => {
    const step = NEXT[phase]
    if (!step) return

    const id = setTimeout(() => {
      if (step.next === 'walking') {
        setMessage('茂みに向かっています…')
      }
      if (step.next === 'searching') {
        setMessage('がさがさ……茂みの中を探しています')
      }
      if (step.next === 'returning') {
        setCarrying(pending.current?.bug ?? null)
        setMessage('何か持って帰ってきます')
      }
      // 標本箱に置いてからフィールドに戻る
      if (step.next === 'entering') {
        const caught = pending.current
        setCarrying(null)
        if (caught) {
          setCollection((prev) => [...prev, caught])
          setMessage(
            caught.bug.rarity === 5
              ? `${caught.bug.name}！！ とんでもないものを持ってきました`
              : caught.aimed
                ? `「${caught.bug.name}」を採ってきました。狙い通りです`
                : `「${caught.bug.name}」でした。狙いとは違います`,
          )
        }
        pending.current = null
      }
      setPhase(step.next)
    }, step.ms)

    return () => clearTimeout(id)
  }, [phase])

  const go = () => {
    if (phase !== 'idle') return
    const bug = pickBug(query)
    pending.current = { key: catchSeq.current++, bug, aimed: aimed.has(bug.id) }
    setMessage('虫眼鏡がフィールドから抜け出しました')
    setPhase('exiting')
  }

  // 地面に降りている間 / 茂みの手前 / 足を動かしている間
  const onGround = phase !== 'idle' && phase !== 'entering'
  const atBush = phase === 'walking' || phase === 'searching'
  const walking = phase === 'walking' || phase === 'returning'

  const found = new Set(collection.map((c) => c.bug.id))
  const best = collection.reduce<Rarity>((max, c) => (c.bug.rarity > max ? c.bug.rarity : max), 1)

  return (
    <div style={styles.page}>
      <p style={styles.lead}>
        検索を虫眼鏡本人にやらせます。茂みまで歩いて行って、何か持って帰ってきます。
      </p>

      <div className="hunt-stage">
        <div className="hunt-field-row">
          <div className="hunt-field">
            <input
              className="hunt-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && go()}
              placeholder="狙い（例: カブト / クワガタ / 樹液 / 夜）"
            />
          </div>
          <button type="button" className="hunt-button" onClick={go} disabled={phase !== 'idle'}>
            {phase === 'idle' ? '行かせる' : '出張中…'}
          </button>
        </div>

        {phase === 'searching' && <span className="hunt-rustle">がさがさ……</span>}
        <span className={`hunt-bush ${phase === 'searching' ? 'is-shaking' : ''}`}>🌳</span>

        {/* フィールドの左端にいて、行かせると外へ出ていく */}
        <div
          className={[
            'hunt-lens',
            onGround ? 'on-ground is-big' : '',
            atBush ? 'at-bush' : '',
            walking ? 'is-walking' : '',
            phase === 'searching' ? 'is-hidden' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="hunt-lens-scale">
            <div className="hunt-lens-body">
              <LensWithLegs />
            </div>
          </div>
          {carrying && <span className="hunt-carry">{carrying.emoji}</span>}
        </div>
      </div>

      <p style={styles.message}>{message}</p>
      {query.trim() !== '' && (
        <p style={styles.aim}>
          狙いに合うのは {aimed.size} 種（出会いやすさ {AIM_BONUS} 倍）
        </p>
      )}

      <div style={styles.boxHeader}>
        <strong style={{ color: 'var(--text-h)', fontSize: 15 }}>標本箱</strong>
        <span style={styles.boxStats}>
          {collection.length} 匹・{found.size} / {BUGS.length} 種・最高 {'★'.repeat(best)}
        </span>
      </div>

      {collection.length === 0 ? (
        <p style={styles.empty}>まだ空です。</p>
      ) : (
        <div style={styles.grid}>
          {collection.map((caught) => (
            <div key={caught.key} className={`hunt-cell rarity-${caught.bug.rarity}`}>
              <span style={{ fontSize: SIZE[caught.bug.rarity], lineHeight: 1 }}>
                {caught.bug.emoji}
              </span>
              <span style={styles.cellName}>{caught.bug.name}</span>
              <span style={styles.cellStars}>{'★'.repeat(caught.bug.rarity)}</span>
            </div>
          ))}
        </div>
      )}

      <table style={styles.table}>
        <tbody>
          {([5, 4, 3, 2, 1] as Rarity[]).map((rarity) => {
            const group = BUGS.filter((bug) => bug.rarity === rarity)
            return (
              <tr key={rarity}>
                <td style={{ ...styles.cell, width: 64 }}>{'★'.repeat(rarity)}</td>
                <td style={{ ...styles.cell, textAlign: 'right', width: 48 }}>
                  {RARITY_RATE[rarity]}%
                </td>
                <td style={{ ...styles.cell, opacity: 0.75 }}>
                  {group
                    .map((bug) => (found.has(bug.id) ? bug.name : '？？？'))
                    .join('・')}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** 足の生えた虫眼鏡 */
function LensWithLegs() {
  return (
    <svg width="58" height="68" viewBox="0 0 44 52" fill="none" aria-hidden="true">
      {/* 足 */}
      <path
        className="hunt-leg hunt-leg-l"
        d="M17 33 L12 43 L7 45"
        stroke="var(--text)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        className="hunt-leg hunt-leg-r"
        d="M24 33 L27 43 L33 45"
        stroke="var(--text)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* 柄 */}
      <path
        d="M26 26 L21 35"
        stroke="var(--text)"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      {/* レンズ */}
      <circle cx="21" cy="16" r="12" fill="rgba(140, 200, 255, 0.22)" />
      <circle cx="21" cy="16" r="12" stroke="var(--text-h)" strokeWidth="3" />
      <path
        d="M14 11 A9 9 0 0 1 20 7"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** 狙いに合う虫の id */
function aimedBugs(query: string): Set<string> {
  const q = query.trim()
  if (!q) return new Set()
  return new Set(
    BUGS.filter((bug) => bug.name.includes(q) || bug.tags.some((tag) => tag.includes(q))).map(
      (bug) => bug.id,
    ),
  )
}

/** レア度別の排出率を保ったまま、狙いに合う虫だけ優遇して1匹選ぶ */
function pickBug(query: string): Bug {
  const aimed = aimedBugs(query)
  const perRarity = BUGS.reduce<Record<number, number>>((acc, bug) => {
    acc[bug.rarity] = (acc[bug.rarity] ?? 0) + 1
    return acc
  }, {})

  const weights = BUGS.map((bug) => {
    const base = RARITY_RATE[bug.rarity] / perRarity[bug.rarity]
    return aimed.has(bug.id) ? base * AIM_BONUS : base
  })

  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < BUGS.length; i++) {
    r -= weights[i]
    if (r <= 0) return BUGS[i]
  }
  return BUGS[BUGS.length - 1]
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 560,
    margin: '0 auto',
    padding: '40px 24px 80px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  lead: { margin: 0, fontSize: 15, lineHeight: 1.6 },
  message: { margin: 0, fontSize: 14, color: 'var(--text-h)' },
  aim: { margin: '-8px 0 0', fontSize: 12, opacity: 0.7 },
  boxHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 8,
  },
  boxStats: { fontSize: 13, opacity: 0.75 },
  empty: { margin: 0, fontSize: 14, opacity: 0.6 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 },
  cellName: { fontSize: 10, textAlign: 'center', lineHeight: 1.25, padding: '0 3px' },
  cellStars: { fontSize: 9, letterSpacing: -0.5, opacity: 0.8 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 },
  cell: { padding: '5px 0', borderTop: '1px solid var(--border)', verticalAlign: 'top' },
}
