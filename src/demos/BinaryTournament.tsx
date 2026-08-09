import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { items, type Item } from '../data'
import './BinaryTournament.css'

const BRACKET_SIZE = 8
const REVEAL_MS = 360

/** 食べ物ごとの絵文字。無ければ皿で代用。大喜利の見栄え用。 */
const EMOJI: Record<string, string> = {
  ラーメン: '🍜',
  つけ麺: '🍜',
  そば: '🍲',
  うどん: '🍲',
  焼きそば: '🍳',
  カレー: '🍛',
  牛丼: '🍚',
  カツ丼: '🍚',
  オムライス: '🍳',
  チャーハン: '🍚',
  おにぎり: '🍙',
  寿司: '🍣',
  天ぷら: '🍤',
  唐揚げ: '🍗',
  餃子: '🥟',
  焼き鳥: '🍢',
  刺身: '🐟',
  肉じゃが: '🥘',
  味噌汁: '🥣',
  豚汁: '🥣',
  ラーメンサラダ: '🥗',
  ポテトサラダ: '🥗',
  たい焼き: '🐟',
  どら焼き: '🥞',
  みたらし団子: '🍡',
  かき氷: '🍧',
  プリン: '🍮',
  あんみつ: '🍨',
  梅干し: '🍑',
  ぬか漬け: '🥒',
  キムチ: '🌶️',
  納豆: '🫘',
}

const emojiOf = (item: Item) => EMOJI[item.name] ?? '🍽️'

/** items からランダムに n 件だけ引いてシードにする。 */
function pickSeeds(n: number): Item[] {
  const pool = [...items]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(n, pool.length))
}

type Reveal = { winnerId: number; loserId: number } | null

export function BinaryTournament() {
  // 現在ラウンドの出場者・勝ち上がり・進行中の対戦位置
  const [round, setRound] = useState<Item[]>(() => pickSeeds(BRACKET_SIZE))
  const [winners, setWinners] = useState<Item[]>([])
  const [matchIndex, setMatchIndex] = useState(0)
  const [champion, setChampion] = useState<Item | null>(null)
  const [reveal, setReveal] = useState<Reveal>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const left = round[matchIndex]
  const right = round[matchIndex + 1]

  // 進捗：全体で必要な対戦数と、消化済みの対戦数
  const totalMatches = BRACKET_SIZE - 1
  const roundName = useMemo(() => {
    if (round.length <= 2) return '決勝'
    if (round.length <= 4) return '準決勝'
    if (round.length <= 8) return '準々決勝'
    return `ベスト${round.length}`
  }, [round.length])

  // 前ラウンドまでで消化済み + 今ラウンドで決まった数（= winners.length）
  const decidedMatches = champion
    ? totalMatches
    : BRACKET_SIZE - round.length + winners.length

  const advance = useCallback(
    (winner: Item, loser: Item) => {
      if (reveal) return
      setReveal({ winnerId: winner.id, loserId: loser.id })
      timer.current = setTimeout(() => {
        const nextWinners = [...winners, winner]
        const nextIndex = matchIndex + 2
        if (nextIndex < round.length) {
          // 同ラウンドの次の対戦へ
          setWinners(nextWinners)
          setMatchIndex(nextIndex)
        } else if (nextWinners.length === 1) {
          // 優勝決定
          setChampion(nextWinners[0])
          setWinners([])
        } else {
          // 次ラウンドへ（勝者を出場者に繰り上げ）
          setRound(nextWinners)
          setWinners([])
          setMatchIndex(0)
        }
        setReveal(null)
      }, REVEAL_MS)
    },
    [reveal, winners, matchIndex, round.length],
  )

  const restart = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setRound(pickSeeds(BRACKET_SIZE))
    setWinners([])
    setMatchIndex(0)
    setChampion(null)
    setReveal(null)
  }, [])

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>二択トーナメント</h2>
      <p style={styles.lead}>2択で勝ち上がった1つが検索結果になります。</p>

      {!champion && left && right && (
        <>
          <div style={styles.progressRow}>
            <span style={styles.roundLabel}>{roundName}</span>
            <span style={styles.matchLabel}>
              {clampMatches(decidedMatches, totalMatches)} / {totalMatches} 試合
            </span>
          </div>
          <div style={styles.track} aria-hidden="true">
            <div
              style={{
                ...styles.trackFill,
                width: `${(clampMatches(decidedMatches, totalMatches) / totalMatches) * 100}%`,
              }}
            />
          </div>

          <p style={styles.question} aria-live="polite">
            どっちが食べたい？
          </p>

          <div className="bt-arena" role="group" aria-label="二択">
            <Card
              key={`L-${left.id}`}
              item={left}
              side="left"
              reveal={reveal}
              onPick={() => advance(left, right)}
            />
            <span className="bt-vs">VS</span>
            <Card
              key={`R-${right.id}`}
              item={right}
              side="right"
              reveal={reveal}
              onPick={() => advance(right, left)}
            />
          </div>

          <p style={styles.hint}>
            残り {round.length - matchIndex + winners.length} 品から絞り込み中
          </p>
        </>
      )}

      {champion && (
        <div style={{ marginTop: 8 }}>
          <p style={styles.resultLabel} aria-live="polite">
            あなたの答えは…
          </p>
          <div className="bt-champion">
            <span className="bt-emoji" aria-hidden="true">
              {emojiOf(champion)}
            </span>
            <span className="bt-name">{champion.name}</span>
            <span className="bt-tags">
              {champion.kind} · {champion.tags.join(' / ')}
            </span>
          </div>
          <p style={styles.resultNote}>
            {BRACKET_SIZE} 品のトーナメントを勝ち抜きました。
          </p>
        </div>
      )}

      <button type="button" style={styles.restart} onClick={restart}>
        {champion ? 'もう一度やる' : '別の顔ぶれで引き直す'}
      </button>
    </div>
  )
}

function Card({
  item,
  side,
  reveal,
  onPick,
}: {
  item: Item
  side: 'left' | 'right'
  reveal: Reveal
  onPick: () => void
}) {
  const className = [
    'bt-card',
    side === 'left' ? 'bt-card-left' : 'bt-card-right',
    reveal?.winnerId === item.id ? 'bt-card-winner' : '',
    reveal?.loserId === item.id ? 'bt-card-loser' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={className}
      onClick={onPick}
      disabled={reveal !== null}
      aria-label={`${item.name}（${item.kind}）を選ぶ`}
    >
      <span className="bt-emoji" aria-hidden="true">
        {emojiOf(item)}
      </span>
      <span className="bt-name">{item.name}</span>
      <span className="bt-tags">{item.tags.join(' / ')}</span>
    </button>
  )
}

function clampMatches(n: number, max: number): number {
  return Math.max(0, Math.min(Math.round(n), max))
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 520, margin: '0 auto', padding: '48px 24px 80px' },
  heading: { fontSize: 22, margin: '0 0 6px' },
  lead: { margin: '0 0 24px', fontSize: 14, lineHeight: 1.7 },
  progressRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    margin: '0 2px 8px',
  },
  roundLabel: { fontSize: 15, fontWeight: 700, color: 'var(--text-h)' },
  matchLabel: { fontSize: 12, opacity: 0.7, fontFamily: 'var(--mono)' },
  track: {
    height: 6,
    borderRadius: 999,
    background: 'var(--code-bg)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    background: 'var(--accent)',
    borderRadius: 999,
    transition: 'width 0.3s ease',
  },
  question: {
    textAlign: 'center',
    fontSize: 15,
    color: 'var(--text-h)',
    margin: '22px 0 0',
  },
  hint: { textAlign: 'center', fontSize: 12, opacity: 0.6, marginTop: 10 },
  resultLabel: { textAlign: 'center', fontSize: 14, opacity: 0.8, margin: '0 0 12px' },
  resultNote: { textAlign: 'center', fontSize: 12, opacity: 0.7, marginTop: 14 },
  restart: {
    display: 'block',
    margin: '28px auto 0',
    padding: '9px 18px',
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    cursor: 'pointer',
  },
}
