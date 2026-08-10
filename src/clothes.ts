/** 服の着る場所。上から順に重ねる想定 */
export type Slot = 'hat' | 'face' | 'neck' | 'top' | 'dress' | 'outer' | 'bottom' | 'shoes' | 'bag'

/** SVG の描き分けに使う形の種類 */
export type Shape =
  | 'tee'
  | 'shirt'
  | 'knit'
  | 'hoodie'
  | 'coat'
  | 'jacket'
  | 'dress'
  | 'pants'
  | 'skirt'
  | 'shorts'
  | 'sneaker'
  | 'boots'
  | 'cap'
  | 'beanie'
  | 'hat'
  | 'scarf'
  | 'glasses'
  | 'tote'
  | 'backpack'

export type Cloth = {
  id: string
  name: string
  slot: Slot
  shape: Shape
  /** 本体の色 */
  color: string
  /** 差し色（ボタン・靴底・ツバなど） */
  accent: string
  tags: string[]
}

/**
 * ワンピースは上下を占領する。逆に上か下を着ればワンピースは脱げる。
 * 着替えの排他ルールはここに集約しておく。
 */
export const conflicts: Partial<Record<Slot, Slot[]>> = {
  dress: ['top', 'bottom'],
  top: ['dress'],
  bottom: ['dress'],
}

export const clothes: Cloth[] = [
  // --- トップス ---
  { id: 't1', name: '白T', slot: 'top', shape: 'tee', color: '#f7f5ef', accent: '#d9d5c8', tags: ['白', '夏', 'シンプル'] },
  { id: 't2', name: 'ボーダーT', slot: 'top', shape: 'tee', color: '#eef1f6', accent: '#3b5b8c', tags: ['青', '夏', 'マリン'] },
  { id: 't3', name: '黒T', slot: 'top', shape: 'tee', color: '#2a2a30', accent: '#4b4b55', tags: ['黒', '夏', 'シンプル'] },
  { id: 't4', name: 'オックスフォードシャツ', slot: 'top', shape: 'shirt', color: '#cfe0f2', accent: '#7f9bbd', tags: ['青', 'きれいめ', '春'] },
  { id: 't5', name: 'ネルシャツ', slot: 'top', shape: 'shirt', color: '#b8503f', accent: '#6f2f26', tags: ['赤', '秋', 'カジュアル'] },
  { id: 't6', name: 'ケーブルニット', slot: 'top', shape: 'knit', color: '#e3d3b4', accent: '#c0ab86', tags: ['ベージュ', '冬', 'あったかい'] },
  { id: 't7', name: 'モヘアニット', slot: 'top', shape: 'knit', color: '#c4b7de', accent: '#9c8cc4', tags: ['紫', '冬', 'あったかい'] },
  { id: 't8', name: 'パーカー', slot: 'top', shape: 'hoodie', color: '#8d99a6', accent: '#5f6a76', tags: ['グレー', '春', 'カジュアル'] },
  { id: 't9', name: 'スウェット', slot: 'top', shape: 'hoodie', color: '#e0a24f', accent: '#b47a2c', tags: ['オレンジ', '秋', 'カジュアル'] },

  // --- アウター ---
  { id: 'o1', name: 'トレンチコート', slot: 'outer', shape: 'coat', color: '#d8c39a', accent: '#a48d63', tags: ['ベージュ', '春', 'きれいめ'] },
  { id: 'o2', name: 'チェスターコート', slot: 'outer', shape: 'coat', color: '#3a4250', accent: '#20252e', tags: ['紺', '冬', 'きれいめ'] },
  { id: 'o3', name: 'ダッフルコート', slot: 'outer', shape: 'coat', color: '#6b4a33', accent: '#3f2b1d', tags: ['茶', '冬', 'あったかい'] },
  { id: 'o4', name: 'デニムジャケット', slot: 'outer', shape: 'jacket', color: '#5b7ba6', accent: '#e8d9a8', tags: ['青', '春', 'カジュアル'] },
  { id: 'o5', name: 'ライダース', slot: 'outer', shape: 'jacket', color: '#26262b', accent: '#8b8b93', tags: ['黒', '秋', 'ハード'] },
  { id: 'o6', name: 'マウンテンパーカー', slot: 'outer', shape: 'jacket', color: '#2f7a5f', accent: '#e6e2d5', tags: ['緑', '春', 'アウトドア'] },

  // --- ボトムス ---
  { id: 'b1', name: 'デニムパンツ', slot: 'bottom', shape: 'pants', color: '#4a6a94', accent: '#e0cf9a', tags: ['青', '通年', 'カジュアル'] },
  { id: 'b2', name: 'ブラックスキニー', slot: 'bottom', shape: 'pants', color: '#26262c', accent: '#44444d', tags: ['黒', '通年', 'ほそい'] },
  { id: 'b3', name: 'チノパン', slot: 'bottom', shape: 'pants', color: '#c8b58c', accent: '#a08f6b', tags: ['ベージュ', '春', 'きれいめ'] },
  { id: 'b4', name: 'ワイドスラックス', slot: 'bottom', shape: 'pants', color: '#6f7482', accent: '#4d515c', tags: ['グレー', '通年', 'ゆったり'] },
  { id: 'b5', name: 'プリーツスカート', slot: 'bottom', shape: 'skirt', color: '#8c4a63', accent: '#5f2f42', tags: ['赤', '秋', 'きれいめ'] },
  { id: 'b6', name: 'デニムスカート', slot: 'bottom', shape: 'skirt', color: '#5f80aa', accent: '#e0cf9a', tags: ['青', '春', 'カジュアル'] },
  { id: 'b7', name: 'ハーフパンツ', slot: 'bottom', shape: 'shorts', color: '#4f8f7a', accent: '#2f6153', tags: ['緑', '夏', 'カジュアル'] },

  // --- ワンピース ---
  { id: 'd1', name: 'リネンワンピース', slot: 'dress', shape: 'dress', color: '#efe6d6', accent: '#cbbda3', tags: ['白', '夏', 'ゆったり'] },
  { id: 'd2', name: '花柄ワンピース', slot: 'dress', shape: 'dress', color: '#7f9bd6', accent: '#f2d6e2', tags: ['青', '春', 'かわいい'] },
  { id: 'd3', name: 'ブラックドレス', slot: 'dress', shape: 'dress', color: '#25252b', accent: '#6d6d78', tags: ['黒', '通年', 'きれいめ'] },

  // --- 靴 ---
  { id: 's1', name: 'スニーカー', slot: 'shoes', shape: 'sneaker', color: '#f2f0ea', accent: '#c9c5b8', tags: ['白', '通年', 'カジュアル'] },
  { id: 's2', name: 'ランニングシューズ', slot: 'shoes', shape: 'sneaker', color: '#d94f4f', accent: '#2a2a30', tags: ['赤', '通年', 'スポーツ'] },
  { id: 's3', name: 'レザーブーツ', slot: 'shoes', shape: 'boots', color: '#5c3b26', accent: '#33210f', tags: ['茶', '冬', 'あったかい'] },
  { id: 's4', name: 'ローファー', slot: 'shoes', shape: 'boots', color: '#2c2c33', accent: '#8f8f99', tags: ['黒', '春', 'きれいめ'] },

  // --- 帽子・小物 ---
  { id: 'h1', name: 'キャップ', slot: 'hat', shape: 'cap', color: '#3b5b8c', accent: '#25395a', tags: ['青', '通年', 'カジュアル'] },
  { id: 'h2', name: 'ニット帽', slot: 'hat', shape: 'beanie', color: '#b8503f', accent: '#7d3428', tags: ['赤', '冬', 'あったかい'] },
  { id: 'h3', name: '中折れハット', slot: 'hat', shape: 'hat', color: '#7a6a55', accent: '#4a3f33', tags: ['茶', '秋', 'きれいめ'] },
  { id: 'h4', name: '麦わら帽子', slot: 'hat', shape: 'hat', color: '#e6cf94', accent: '#b39a5c', tags: ['ベージュ', '夏', 'かわいい'] },
  { id: 'n1', name: 'マフラー', slot: 'neck', shape: 'scarf', color: '#9c5f8c', accent: '#6c3d60', tags: ['紫', '冬', 'あったかい'] },
  { id: 'n2', name: 'ストール', slot: 'neck', shape: 'scarf', color: '#d8d2c4', accent: '#b0a894', tags: ['ベージュ', '春', 'ゆったり'] },
  { id: 'f1', name: 'メガネ', slot: 'face', shape: 'glasses', color: '#3a3a42', accent: '#cfe6f2', tags: ['黒', '通年', 'きれいめ'] },
  { id: 'f2', name: 'サングラス', slot: 'face', shape: 'glasses', color: '#1c1c22', accent: '#5a5a66', tags: ['黒', '夏', 'ハード'] },
  { id: 'g1', name: 'トートバッグ', slot: 'bag', shape: 'tote', color: '#e6e0cd', accent: '#8c8271', tags: ['ベージュ', '通年', 'カジュアル'] },
  { id: 'g2', name: 'リュック', slot: 'bag', shape: 'backpack', color: '#3f5a4a', accent: '#243428', tags: ['緑', '通年', 'アウトドア'] },
]

/** 名前・スロット名・タグをまとめて見る、ゆるい検索 */
export function searchClothes(query: string): Cloth[] {
  const q = query.trim()
  if (!q) return clothes
  const needle = q.toLowerCase()
  return clothes.filter((cloth) => {
    const hay = [cloth.name, slotLabel[cloth.slot], ...cloth.tags].join(' ').toLowerCase()
    return hay.includes(needle)
  })
}

export const slotLabel: Record<Slot, string> = {
  hat: '帽子',
  face: 'メガネ',
  neck: '首もと',
  top: 'トップス',
  dress: 'ワンピース',
  outer: 'アウター',
  bottom: 'ボトムス',
  shoes: '靴',
  bag: 'バッグ',
}

/** 着せる順（奥から手前へ） */
export const drawOrder: Slot[] = ['bag', 'bottom', 'dress', 'top', 'outer', 'shoes', 'neck', 'hat', 'face']
