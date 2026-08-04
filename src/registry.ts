import type { ComponentType } from 'react'
import { BugHunt } from './demos/BugHunt'
import { GachaSearch } from './demos/GachaSearch'
import { PlainSearch } from './demos/PlainSearch'
import { RunawaySearch } from './demos/RunawaySearch'
import { SweatyField } from './demos/SweatyField'

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
    id: 'growing',
    title: '育つ検索窓',
    summary: '文字数に比例して窓が巨大化し、15文字で画面を覆い尽くす',
  },
  {
    id: 'onechar',
    title: '1文字しか入らない検索',
    summary: '打つと前の文字が消える。純度100%のあいまい検索',
  },
  {
    id: 'shout',
    title: '叫ぶ検索',
    summary: 'マイク音量が大きいほど検索範囲が広がる。ヒソヒソ声だと完全一致',
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
  },
  {
    id: 'physics',
    title: '物理演算検索',
    summary: '結果が降ってきて積まれる。関連度＝質量なので重いものが沈む',
  },
  {
    id: 'akinator',
    title: '二択トーナメント',
    summary: '2択で勝ち上がったものが答え。大喜利なのに実用に化ける裏切り',
  },
  {
    id: 'taste',
    title: '味覚の3軸',
    summary: '甘い / 辛い / すっぱい の3軸で絞る',
  },
  {
    id: 'sento',
    title: '検索の銭湯',
    summary: '他人のクエリがゆるく流れてくる公衆検索場',
  },
  {
    id: 'tsundere',
    title: '逆ギレ検索',
    summary: 'まず1件だけ絶対の自信で出す。違うと言うと不機嫌になる',
  },
  {
    id: 'wait',
    title: '待つ検索',
    summary: '検索しない。じっと待つと探し物が向こうから来る',
  },
]

export const buildableDemos = demos.filter(
  (demo): demo is Demo & { Component: ComponentType } => Boolean(demo.Component),
)
