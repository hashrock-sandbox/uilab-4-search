import type { ComponentType } from 'react'
import { BinaryTournament } from './demos/BinaryTournament'
import { BugHunt } from './demos/BugHunt'
import { ClothingSpace } from './demos/ClothingSpace'
import { FishingSearch } from './demos/FishingSearch'
import { GachaSearch } from './demos/GachaSearch'
import { GrowingField } from './demos/GrowingField'
import { ImeCandidates } from './demos/ImeCandidates'
import { Lattice } from './demos/Lattice'
import { Loupe } from './demos/Loupe'
import { Mosaic } from './demos/Mosaic'
import { MozcIme } from './demos/MozcIme'
import { OneChar } from './demos/OneChar'
import { PhysicsSearch } from './demos/PhysicsSearch'
import { PlainSearch } from './demos/PlainSearch'
import { RamenMap } from './demos/RamenMap'
import { RunawaySearch } from './demos/RunawaySearch'
import { SentoSearch } from './demos/SentoSearch'
import { ShoutSearch } from './demos/ShoutSearch'
import { SweatyField } from './demos/SweatyField'
import { TasteAxes } from './demos/TasteAxes'
import { TrieSuggest } from './demos/TrieSuggest'
import { TsundereSearch } from './demos/TsundereSearch'
import { UfoSearch } from './demos/UfoSearch'
import { WaitSearch } from './demos/WaitSearch'

export type Demo = {
  /** URL の /:id になる */
  id: string
  title: string
  summary: string
  /** 未実装のネタは undefined。一覧には並ぶがリンクにはならない */
  Component?: ComponentType
}

/** ここに1行足すと、ルート・ナビ・一覧が同時に増える */
export const demos: Demo[] = [
  {
    id: 'plain',
    title: '普通の検索フィールド',
    summary: '虫眼鏡アイコン付きのまっとうな検索。すべての大喜利の基準線',
    Component: PlainSearch,
  },
  {
    id: 'loupe',
    title: 'ルーペ検索',
    summary: 'アイコンが本物のルーペに化けて文字の上を走査する。ヒットがpillで溜まり結果へモーフ',
    Component: Loupe,
  },
  {
    id: 'runaway',
    title: '逃げる検索窓',
    summary: 'マウスを近づけると避ける。キーボードでしか捕まえられない',
    Component: RunawaySearch,
  },
  {
    id: 'bughunt',
    title: '虫捕り検索',
    summary: '虫眼鏡に足が生えて茂みまで歩き、カブトムシを採ってくる。標本箱に並ぶ',
    Component: BugHunt,
  },
  {
    id: 'sweaty',
    title: '汗をかく検索窓',
    summary: '重いクエリを書くと発汗し、震え、限界を超えると気絶する',
    Component: SweatyField,
  },
  {
    id: 'mosaic',
    title: 'モザイク検索',
    summary: 'クエリも履歴もcanvasで本当にピクセル化。危険ワードだけ隠すモードも',
    Component: Mosaic,
  },
  {
    id: 'ufo',
    title: 'キャトルミューティレーション検索',
    summary: '英単語1万語を検索するとUFOが出動。ヒット規模に応じて牛と人間が吸われる(演出)',
    Component: UfoSearch,
  },
  {
    id: 'trie',
    title: 'ツリー走査サジェスト',
    summary: '英単語1万語のパトリシア木。絞り込めた枝だけが暗闇から姿を現す',
    Component: TrieSuggest,
  },
  {
    id: 'ime',
    title: '変換候補ウィンドウ検索',
    summary: '検索結果がIMEの変換候補として出てくる。スペースで次候補、確定した瞬間それは検索になる',
    Component: ImeCandidates,
  },
  {
    id: 'mozc',
    title: 'IME内蔵検索',
    summary: 'OSのIMEを使わせない。窓の中に本物のMozc(WebAssembly)が住んでいて、ページ内で文節変換が完結する',
    Component: MozcIme,
  },
  {
    id: 'lattice',
    title: '変換ラティス可視化',
    summary: 'かな漢字変換の中身は最短経路探索。ラティスをビタビが走り、ノードをクリックすると経路が捻じ曲がる',
    Component: Lattice,
  },
  {
    id: 'growing',
    title: '育つ検索窓',
    summary: '文字数に比例して窓が巨大化し、15文字で画面を覆い尽くす',
    Component: GrowingField,
  },
  {
    id: 'onechar',
    title: '1文字しか入らない検索',
    summary: '打つと前の文字が消える。純度100%のあいまい検索',
    Component: OneChar,
  },
  {
    id: 'shout',
    title: '叫ぶ検索',
    summary: 'マイク音量が大きいほど検索範囲が広がる。ヒソヒソ声だと完全一致',
    Component: ShoutSearch,
  },
  {
    id: 'gacha',
    title: 'ガチャ検索',
    summary: '1回引くと1件。10連あり。関連度が★レア度になる',
    Component: GachaSearch,
  },
  {
    id: 'fishing',
    title: '釣り検索',
    summary: '投げて待つ。ヒキのタイミングで引かないと逃げる。大物ほど関連度が高い',
    Component: FishingSearch,
  },
  {
    id: 'physics',
    title: '物理演算検索',
    summary: '結果が降ってきて積まれる。関連度＝質量なので重いものが沈む',
    Component: PhysicsSearch,
  },
  {
    id: 'akinator',
    title: '二択トーナメント',
    summary: '2択で勝ち上がったものが答え。大喜利なのに実用に化ける裏切り',
    Component: BinaryTournament,
  },
  {
    id: 'clothing',
    title: '試着室のカーソル',
    summary: '空間に服が浮いていて、カーソルは人間。触れた服から順に着ていく',
    Component: ClothingSpace,
  },
  {
    id: 'taste',
    title: '味覚の3軸',
    summary: '甘い / 辛い / すっぱい の3軸で絞る',
    Component: TasteAxes,
  },
  {
    id: 'sento',
    title: '検索の銭湯',
    summary: '他人のクエリがゆるく流れてくる公衆検索場',
    Component: SentoSearch,
  },
  {
    id: 'tsundere',
    title: '逆ギレ検索',
    summary: 'まず1件だけ絶対の自信で出す。違うと言うと不機嫌になる',
    Component: TsundereSearch,
  },
  {
    id: 'ramen-map',
    title: 'ラーメン検索（地図）',
    summary: 'OpenStreetMap の実データを Overpass で引いて、地図の上に湯気の立つ店を並べる',
    Component: RamenMap,
  },
  {
    id: 'wait',
    title: '待つ検索',
    summary: '検索しない。じっと待つと探し物が向こうから来る',
    Component: WaitSearch,
  },
]

export const buildableDemos = demos.filter(
  (demo): demo is Demo & { Component: ComponentType } => Boolean(demo.Component),
)
