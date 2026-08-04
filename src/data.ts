export type Item = {
  id: number
  name: string
  kind: string
  tags: string[]
}

/** どのネタでも使い回す検索対象。適当に和食まわりで揃えてある。 */
export const items: Item[] = [
  { id: 1, name: 'ラーメン', kind: '麺', tags: ['あつい', 'しょっぱい', '夜'] },
  { id: 2, name: 'つけ麺', kind: '麺', tags: ['しょっぱい', '濃い'] },
  { id: 3, name: 'そば', kind: '麺', tags: ['さっぱり', 'つめたい'] },
  { id: 4, name: 'うどん', kind: '麺', tags: ['あつい', 'やわらかい'] },
  { id: 5, name: '焼きそば', kind: '麺', tags: ['ソース', '祭り'] },
  { id: 6, name: 'カレー', kind: 'ごはん', tags: ['からい', 'あつい'] },
  { id: 7, name: '牛丼', kind: 'ごはん', tags: ['はやい', 'しょっぱい'] },
  { id: 8, name: 'カツ丼', kind: 'ごはん', tags: ['あぶら', 'ボリューム'] },
  { id: 9, name: 'オムライス', kind: 'ごはん', tags: ['たまご', 'あまい'] },
  { id: 10, name: 'チャーハン', kind: 'ごはん', tags: ['あぶら', 'はやい'] },
  { id: 11, name: 'おにぎり', kind: 'ごはん', tags: ['てがる', 'つめたい'] },
  { id: 12, name: '寿司', kind: 'ごはん', tags: ['つめたい', 'ごうか'] },
  { id: 13, name: '天ぷら', kind: 'おかず', tags: ['あぶら', 'さくさく'] },
  { id: 14, name: '唐揚げ', kind: 'おかず', tags: ['あぶら', 'ビール'] },
  { id: 15, name: '餃子', kind: 'おかず', tags: ['にんにく', 'ビール'] },
  { id: 16, name: '焼き鳥', kind: 'おかず', tags: ['けむり', 'ビール'] },
  { id: 17, name: '刺身', kind: 'おかず', tags: ['つめたい', 'さっぱり'] },
  { id: 18, name: '肉じゃが', kind: 'おかず', tags: ['あまい', 'ほっとする'] },
  { id: 19, name: '味噌汁', kind: 'しる', tags: ['あつい', 'ほっとする'] },
  { id: 20, name: '豚汁', kind: 'しる', tags: ['あつい', 'ボリューム'] },
  { id: 21, name: 'ラーメンサラダ', kind: 'サラダ', tags: ['つめたい', '北海道'] },
  { id: 22, name: 'ポテトサラダ', kind: 'サラダ', tags: ['やわらかい', 'ビール'] },
  { id: 23, name: 'たい焼き', kind: 'おやつ', tags: ['あまい', 'あんこ'] },
  { id: 24, name: 'どら焼き', kind: 'おやつ', tags: ['あまい', 'あんこ'] },
  { id: 25, name: 'みたらし団子', kind: 'おやつ', tags: ['あまい', 'しょっぱい'] },
  { id: 26, name: 'かき氷', kind: 'おやつ', tags: ['つめたい', '夏'] },
  { id: 27, name: 'プリン', kind: 'おやつ', tags: ['あまい', 'たまご'] },
  { id: 28, name: 'あんみつ', kind: 'おやつ', tags: ['あまい', 'あんこ'] },
  { id: 29, name: '梅干し', kind: 'つけもの', tags: ['すっぱい', 'しょっぱい'] },
  { id: 30, name: 'ぬか漬け', kind: 'つけもの', tags: ['すっぱい', '発酵'] },
  { id: 31, name: 'キムチ', kind: 'つけもの', tags: ['からい', '発酵'] },
  { id: 32, name: '納豆', kind: 'つけもの', tags: ['発酵', 'ねばねば'] },
]

/** 素朴な部分一致検索。ネタ側で使い回す。 */
export function search(query: string): Item[] {
  const q = query.trim()
  if (!q) return []
  return items.filter(
    (item) =>
      item.name.includes(q) ||
      item.kind.includes(q) ||
      item.tags.some((tag) => tag.includes(q)),
  )
}
