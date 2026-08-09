import { useMemo, useRef, useState } from 'react'
import { search, type Item } from '../data'
import './TsundereSearch.css'

/**
 * 逆ギレ検索。
 * 候補が何件あっても、まず1件だけを絶対の自信で断言して出す。
 * 「違う」と言われるたびに検索エンジンが不機嫌になり、しぶしぶ次を出す。
 * 押し続けると全候補を出し尽くし、最後は拗ねて投げ出す。
 * 逆に最初の一撃で「これ！」を押すと機嫌が直る。
 */

/** 態度のレベル（0=自信満々 → 上がるほど不機嫌） */
type Phase = 'idle' | 'answering' | 'confirmed' | 'giveup' | 'nothing'

/** 断言のセリフ。anger のレベルごとに口が悪くなる */
const DECLARE: string[][] = [
  ['これでしょ。', 'はい、これ。何か問題でも？', 'どう考えてもこれだって。'],
  ['…は？ じゃあこれ。', 'ちっ…これでいいんだろ。', 'あぁ？ ならこれ。'],
  ['じゃあ何なんだよ。ほら。', 'はいはい、これね。', 'これじゃないなら何だよ。'],
  ['しつこいな…これ。', 'もう…これで最後にしてよ。', 'いい加減これで手を打てよ。'],
  ['……もう、これ。', '知らないってば。これ。', '勝手にしろよ。これ。'],
]

/** 「これ！」で確定したときのセリフ。anger が高いほど照れ隠しが増す */
const HAPPY = [
  'でしょ？ 最初からそう言ってるじゃん。',
  '……ふん。まあ、分かればいいんだよ。',
  'は、はじめから これって言ってたし……。',
  '……べつに、当てて欲しかったわけじゃないから。',
]

/** 候補を出し尽くして拗ねたときのセリフ */
const GIVEUP = [
  'もう無い。全部出したし。……知らない。',
  'これ以上どうしろって言うんだよ。もう帰る。',
  'ふんっ。あんたに合う答えなんて無いんだよ。',
]

/** そもそもヒットが無かったとき */
const NOTHING = [
  'そんなの無いし。……知らない。',
  'は？ 聞いたことないんだけど。',
]

/** anger に応じた表情 */
function faceFor(anger: number, phase: Phase): string {
  if (phase === 'confirmed') return anger === 0 ? '😌' : '😳'
  if (phase === 'giveup') return '😤'
  if (phase === 'nothing') return '🙄'
  const faces = ['😏', '😒', '😠', '😡', '🤬']
  return faces[Math.min(anger, faces.length - 1)]
}

/** anger からその場のセリフを1つ選ぶ（候補 id で毎回変える） */
function pick(bank: string[], seed: number): string {
  return bank[seed % bank.length]
}

export function TsundereSearch() {
  const [query, setQuery] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [results, setResults] = useState<Item[]>([])
  const [index, setIndex] = useState(0)
  const [anger, setAnger] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const current = results[index]

  // 機嫌メーター（100 → 0）。anger が上がるほど下がる
  const mood = useMemo(() => Math.max(0, 100 - anger * 22), [anger])

  const runSearch = () => {
    const hits = search(query)
    setResults(hits)
    setIndex(0)
    setAnger(0)
    setPhase(hits.length === 0 ? 'nothing' : 'answering')
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim() === '') return
    runSearch()
  }

  // 「違う」→ 不機嫌になって次をしぶしぶ出す。尽きたら拗ねる
  const reject = () => {
    if (index + 1 >= results.length) {
      setAnger((a) => a + 1)
      setPhase('giveup')
      return
    }
    setIndex((i) => i + 1)
    setAnger((a) => a + 1)
  }

  // 「これ！」→ 当ててやったんだから機嫌が直る（照れる）
  const confirm = () => setPhase('confirmed')

  const reset = () => {
    setQuery('')
    setResults([])
    setIndex(0)
    setAnger(0)
    setPhase('idle')
    inputRef.current?.focus()
  }

  const declareLine =
    current && pick(DECLARE[Math.min(anger, DECLARE.length - 1)], current.id + anger)

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>逆ギレ検索</h2>
      <p style={styles.lead}>
        候補が何件あっても、まず<strong style={{ color: 'var(--text-h)' }}>1件だけ</strong>を
        絶対の自信で断言してきます。「違う」と言うたびに不機嫌になり、しぶしぶ次を出します。
        最初の一撃で「これ！」を押せば、機嫌が直る……かも。
      </p>

      <form onSubmit={onSubmit} className="tsun-field">
        <SearchIcon />
        <input
          ref={inputRef}
          className="tsun-input"
          type="search"
          autoComplete="off"
          value={query}
          placeholder="食べ物を検索（麺・あまい・ビール…）"
          aria-label="食べ物を検索"
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="tsun-go" disabled={query.trim() === ''}>
          検索
        </button>
      </form>

      {phase !== 'idle' && (
        <section className="tsun-stage" aria-live="polite">
          <div className="tsun-avatar" data-phase={phase} aria-hidden="true">
            <span className="tsun-face" key={`${phase}-${index}-${anger}`}>
              {faceFor(anger, phase)}
            </span>
          </div>

          <div className="tsun-mood">
            <span className="tsun-mood-label">機嫌</span>
            <div className="tsun-mood-track">
              <div
                className="tsun-mood-fill"
                data-low={mood <= 40}
                style={{ width: `${mood}%` }}
              />
            </div>
          </div>

          {phase === 'nothing' && (
            <>
              <p className="tsun-say" data-tone="mad">
                「{pick(NOTHING, query.length)}」
              </p>
              <div className="tsun-actions">
                <button type="button" className="tsun-btn ghost" onClick={reset}>
                  ……ごめん
                </button>
              </div>
            </>
          )}

          {phase === 'answering' && current && (
            <>
              <p className="tsun-say" data-tone={anger === 0 ? 'proud' : 'grumpy'}>
                「{declareLine}」
              </p>
              <div className="tsun-answer">
                <span className="tsun-answer-name">{current.name}</span>
                <span className="tsun-answer-meta">
                  {current.kind} · {current.tags.join(' / ')}
                </span>
              </div>
              <div className="tsun-actions">
                <button type="button" className="tsun-btn primary" onClick={confirm}>
                  これ！
                </button>
                <button type="button" className="tsun-btn" onClick={reject}>
                  違う
                </button>
              </div>
              <p className="tsun-hint">
                {anger === 0
                  ? '（自信満々。ここで「これ！」を押すと機嫌が直ります）'
                  : `残り ${results.length - index - 1} 件。押すほど機嫌が悪くなります…`}
              </p>
            </>
          )}

          {phase === 'confirmed' && current && (
            <>
              <p className="tsun-say" data-tone="happy">
                「{pick(HAPPY, anger)}」
              </p>
              <div className="tsun-answer" data-confirmed>
                <span className="tsun-answer-name">{current.name}</span>
                <span className="tsun-answer-meta">
                  {current.kind} · {current.tags.join(' / ')}
                </span>
              </div>
              <div className="tsun-actions">
                <button type="button" className="tsun-btn ghost" onClick={reset}>
                  もう一度検索
                </button>
              </div>
            </>
          )}

          {phase === 'giveup' && (
            <>
              <p className="tsun-say" data-tone="mad">
                「{pick(GIVEUP, anger)}」
              </p>
              <div className="tsun-sulk">＝＝＝ 全 {results.length} 件、出し尽くした ＝＝＝</div>
              <div className="tsun-actions">
                <button type="button" className="tsun-btn ghost" onClick={reset}>
                  ……出直す
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg className="tsun-icon" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12.9 12.9 17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 520, margin: '0 auto', padding: '48px 24px 80px' },
  heading: { fontSize: 22, margin: '0 0 6px' },
  lead: { margin: '0 0 24px', fontSize: 14, lineHeight: 1.7 },
}
