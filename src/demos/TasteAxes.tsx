import { useMemo, useState } from 'react'
import { items, type Item } from '../data'
import './TasteAxes.css'

/** 3軸の味覚プロファイル。0〜100。 */
type Taste = { sweet: number; spicy: number; sour: number }

/**
 * items.ts は編集不可なので、ここで id ごとに味覚スコアを手当てする。
 * tags の「あまい / からい / すっぱい」を起点に、常識的な味の記憶で微調整した。
 * （寿司の酢飯、餃子の酢醤油、唐揚げのレモン…など tag に出てこない酸味も拾う）
 */
const TASTE: Record<number, Taste> = {
  1: { sweet: 10, spicy: 25, sour: 5 }, // ラーメン
  2: { sweet: 15, spicy: 20, sour: 5 }, // つけ麺
  3: { sweet: 10, spicy: 5, sour: 10 }, // そば
  4: { sweet: 15, spicy: 5, sour: 5 }, // うどん
  5: { sweet: 45, spicy: 20, sour: 15 }, // 焼きそば
  6: { sweet: 30, spicy: 80, sour: 10 }, // カレー
  7: { sweet: 40, spicy: 10, sour: 5 }, // 牛丼
  8: { sweet: 45, spicy: 10, sour: 5 }, // カツ丼
  9: { sweet: 55, spicy: 10, sour: 25 }, // オムライス（ケチャップ）
  10: { sweet: 15, spicy: 15, sour: 5 }, // チャーハン
  11: { sweet: 10, spicy: 5, sour: 25 }, // おにぎり（梅）
  12: { sweet: 20, spicy: 15, sour: 40 }, // 寿司（酢飯・わさび）
  13: { sweet: 15, spicy: 5, sour: 5 }, // 天ぷら
  14: { sweet: 15, spicy: 15, sour: 20 }, // 唐揚げ（レモン）
  15: { sweet: 15, spicy: 30, sour: 25 }, // 餃子（にんにく・酢醤油）
  16: { sweet: 40, spicy: 20, sour: 5 }, // 焼き鳥（タレ）
  17: { sweet: 10, spicy: 15, sour: 10 }, // 刺身（わさび）
  18: { sweet: 65, spicy: 5, sour: 5 }, // 肉じゃが
  19: { sweet: 15, spicy: 5, sour: 10 }, // 味噌汁
  20: { sweet: 20, spicy: 10, sour: 5 }, // 豚汁
  21: { sweet: 25, spicy: 5, sour: 30 }, // ラーメンサラダ（ドレッシング）
  22: { sweet: 30, spicy: 5, sour: 35 }, // ポテトサラダ（マヨ・酢）
  23: { sweet: 90, spicy: 0, sour: 5 }, // たい焼き
  24: { sweet: 90, spicy: 0, sour: 5 }, // どら焼き
  25: { sweet: 80, spicy: 5, sour: 5 }, // みたらし団子
  26: { sweet: 70, spicy: 0, sour: 30 }, // かき氷（レモンシロップ）
  27: { sweet: 85, spicy: 0, sour: 10 }, // プリン
  28: { sweet: 85, spicy: 0, sour: 15 }, // あんみつ
  29: { sweet: 5, spicy: 10, sour: 95 }, // 梅干し
  30: { sweet: 5, spicy: 10, sour: 80 }, // ぬか漬け
  31: { sweet: 15, spicy: 85, sour: 60 }, // キムチ
  32: { sweet: 10, spicy: 10, sour: 45 }, // 納豆（発酵）
}

/** 万一 id が漏れていても落ちないように、tags から粗く推定して補う */
function tasteOf(item: Item): Taste {
  const known = TASTE[item.id]
  if (known) return known
  const has = (t: string) => item.tags.includes(t)
  return {
    sweet: has('あまい') ? 80 : has('あんこ') ? 70 : 15,
    spicy: has('からい') ? 80 : has('にんにく') ? 40 : 10,
    sour: has('すっぱい') ? 85 : has('発酵') ? 45 : 10,
  }
}

const AXES = [
  { key: 'sweet', label: '甘い', emoji: '🍯', color: '#e86aa6' },
  { key: 'spicy', label: '辛い', emoji: '🌶️', color: '#e5533c' },
  { key: 'sour', label: 'すっぱい', emoji: '🍋', color: '#d0b400' },
] as const

const MAX_DIST = Math.sqrt(3 * 100 * 100)

/** 目標プロファイルとの近さ（0〜1、1が完全一致） */
function affinity(target: Taste, t: Taste): number {
  const d = Math.sqrt(
    (target.sweet - t.sweet) ** 2 +
      (target.spicy - t.spicy) ** 2 +
      (target.sour - t.sour) ** 2,
  )
  return 1 - d / MAX_DIST
}

export function TasteAxes() {
  const [target, setTarget] = useState<Taste>({ sweet: 50, spicy: 50, sour: 50 })

  const ranked = useMemo(() => {
    return items
      .map((item) => {
        const t = tasteOf(item)
        return { item, taste: t, score: affinity(target, t) }
      })
      .sort((a, b) => b.score - a.score)
  }, [target])

  const set = (key: keyof Taste, value: number) =>
    setTarget((prev) => ({ ...prev, [key]: value }))

  const best = ranked[0]

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>味覚の3軸</h2>
      <p style={styles.lead}>
        文字は打たない。<strong style={styles.em}>甘い / 辛い / すっぱい</strong>{' '}
        の3本のつまみだけで食べ物を探す検索。今の口が求める味の座標に、いちばん近い一皿から並びます。
      </p>

      {/* 目標プロファイルの三角レーダー */}
      <div style={styles.radarWrap}>
        <TriangleRadar target={target} />
        <p style={styles.radarCaption} aria-hidden="true">
          いまの舌の形
        </p>
      </div>

      {/* 3軸スライダー */}
      <div style={styles.sliders} role="group" aria-label="味覚の3軸">
        {AXES.map((axis) => {
          const v = target[axis.key]
          return (
            <div key={axis.key} className="taste-slider">
              <label className="taste-slider-head" htmlFor={`taste-${axis.key}`}>
                <span className="taste-slider-name">
                  <span aria-hidden="true">{axis.emoji}</span> {axis.label}
                </span>
                <span className="taste-slider-val" style={{ color: axis.color }}>
                  {v}
                </span>
              </label>
              <input
                id={`taste-${axis.key}`}
                className="taste-range"
                type="range"
                min={0}
                max={100}
                step={1}
                value={v}
                aria-valuetext={`${axis.label} ${v}`}
                style={{ accentColor: axis.color }}
                onChange={(e) => set(axis.key, Number(e.target.value))}
              />
            </div>
          )
        })}
      </div>

      {best && (
        <p style={styles.verdict} aria-live="polite">
          いまの舌には <strong style={styles.em}>{best.item.name}</strong> がいちばん近い（
          {Math.round(best.score * 100)}% 一致）
        </p>
      )}

      {/* 近い順に並んだ結果 */}
      <ol style={styles.list} aria-label="味の近い順">
        {ranked.map(({ item, taste, score }, i) => {
          const pct = Math.round(score * 100)
          // 近いものほど濃く、遠いものは静かに沈める
          const dim = i === 0 ? 1 : Math.max(0.35, score)
          return (
            <li
              key={item.id}
              className="taste-row"
              style={{ opacity: dim }}
              data-top={i === 0 || undefined}
            >
              <div style={styles.rowHead}>
                <span style={styles.rowRank}>{i + 1}</span>
                <span style={styles.rowName}>{item.name}</span>
                <span style={styles.rowKind}>{item.kind}</span>
                <span
                  className="taste-match"
                  style={{ ['--pct' as string]: `${pct}%` }}
                >
                  {pct}%
                </span>
              </div>
              <div style={styles.bars} aria-hidden="true">
                {AXES.map((axis) => (
                  <div key={axis.key} className="taste-bar" title={`${axis.label} ${taste[axis.key]}`}>
                    <span
                      className="taste-bar-fill"
                      style={{
                        width: `${taste[axis.key]}%`,
                        background: axis.color,
                      }}
                    />
                  </div>
                ))}
              </div>
            </li>
          )
        })}
      </ol>

      <p style={styles.foot}>
        つまみを動かすたび、32品が味の座標系の近さで並び替わります。
        辛さを振り切ればカレーとキムチが、酸味を上げれば梅干しが浮かび上がる。
      </p>
    </div>
  )
}

/** 目標プロファイルを正三角形のレーダーとして描く */
function TriangleRadar({ target }: { target: Taste }) {
  const size = 160
  const cx = size / 2
  const cy = size / 2 + 8
  const r = 58
  // 上=甘い, 右下=辛い, 左下=すっぱい
  const angles = [-90, 30, 150].map((d) => (d * Math.PI) / 180)
  const vals = [target.sweet, target.spicy, target.sour]
  const colors = AXES.map((a) => a.color)
  const labels = AXES.map((a) => `${a.emoji}${a.label}`)

  const point = (radius: number, i: number) => ({
    x: cx + radius * Math.cos(angles[i]),
    y: cy + radius * Math.sin(angles[i]),
  })

  const outer = angles.map((_, i) => point(r, i))
  const shape = vals.map((v, i) => point((v / 100) * r, i))
  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <svg
      width={size}
      height={size + 16}
      viewBox={`0 0 ${size} ${size + 16}`}
      role="img"
      aria-label={`甘い${target.sweet}、辛い${target.spicy}、すっぱい${target.sour}の味覚バランス`}
    >
      {/* グリッド */}
      {[0.33, 0.66, 1].map((f) => (
        <polygon
          key={f}
          points={toPath(angles.map((_, i) => point(r * f, i)))}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1}
        />
      ))}
      {outer.map((p, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={p.x}
          y2={p.y}
          stroke="var(--border)"
          strokeWidth={1}
        />
      ))}
      {/* 現在の形 */}
      <polygon
        points={toPath(shape)}
        fill="var(--accent-bg)"
        stroke="var(--accent)"
        strokeWidth={1.5}
      />
      {shape.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill={colors[i]} />
      ))}
      {/* 頂点ラベル */}
      {outer.map((p, i) => (
        <text
          key={i}
          x={p.x}
          y={p.y + (i === 0 ? -8 : 16)}
          textAnchor="middle"
          fontSize={11}
          fill="var(--text)"
        >
          {labels[i]}
        </text>
      ))}
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 520, margin: '0 auto', padding: '48px 24px 80px' },
  heading: { fontSize: 22, margin: '0 0 6px', color: 'var(--text-h)' },
  lead: { margin: '0 0 24px', fontSize: 14, lineHeight: 1.7 },
  em: { color: 'var(--text-h)' },
  radarWrap: { display: 'grid', placeItems: 'center', margin: '4px 0 20px' },
  radarCaption: { margin: '2px 0 0', fontSize: 12, opacity: 0.7 },
  sliders: { display: 'grid', gap: 18, marginBottom: 8 },
  verdict: {
    margin: '18px 2px',
    fontSize: 14,
    padding: '10px 12px',
    border: '1px solid var(--accent-border)',
    background: 'var(--accent-bg)',
    borderRadius: 10,
  },
  list: {
    listStyle: 'none',
    margin: '8px 0 0',
    padding: 0,
    display: 'grid',
    gap: 8,
  },
  rowHead: { display: 'flex', alignItems: 'baseline', gap: 10 },
  rowRank: {
    fontFamily: 'var(--mono)',
    fontSize: 12,
    opacity: 0.6,
    minWidth: 18,
  },
  rowName: { fontSize: 15, color: 'var(--text-h)' },
  rowKind: { fontSize: 12, opacity: 0.6 },
  bars: { display: 'grid', gap: 4, marginTop: 8 },
  foot: { marginTop: 28, fontSize: 12, lineHeight: 1.7, opacity: 0.7 },
}
