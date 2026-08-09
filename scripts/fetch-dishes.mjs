// Wikidata から料理名を全件取得して src/dishes.ts を生成する。
// 実行: node scripts/fetch-dishes.mjs
// データは CC0 (https://creativecommons.org/publicdomain/zero/1.0/)

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ENDPOINT = 'https://query.wikidata.org/sparql'

// 料理 (Q746549) のサブクラス配下すべて。日本語ラベル + 種別 + 原産国 + 材料
const QUERY = `
SELECT ?item ?label
       (SAMPLE(?typeLabel) AS ?type)
       (SAMPLE(?countryLabel) AS ?country)
       (GROUP_CONCAT(DISTINCT ?ingLabel; separator="|") AS ?ings)
WHERE {
  ?item wdt:P31/wdt:P279* wd:Q746549 .
  ?item rdfs:label ?label . FILTER(LANG(?label)="ja")
  OPTIONAL { ?item wdt:P31 ?t . ?t rdfs:label ?typeLabel . FILTER(LANG(?typeLabel)="ja") }
  OPTIONAL { ?item wdt:P495 ?c . ?c rdfs:label ?countryLabel . FILTER(LANG(?countryLabel)="ja") }
  OPTIONAL { ?item wdt:P527 ?ing . ?ing rdfs:label ?ingLabel . FILTER(LANG(?ingLabel)="ja") }
}
GROUP BY ?item ?label
`

/** 日本語の文字(かな・漢字)を含むラベルだけ通す。ローマ字のままの流入データを弾く */
const HAS_JAPANESE = /[぀-ヿ一-鿿]/

/** 意味の薄い種別はまとめて「料理」にする */
const GENERIC_TYPES = new Set(['', '食物', '商品', '食品', '料理'])

const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(QUERY)}`, {
  headers: {
    Accept: 'application/sparql-results+json',
    'User-Agent': 'uilab-4-search/0.1 (personal experiment)',
  },
})
if (!res.ok) throw new Error(`SPARQL ${res.status}`)
const json = await res.json()

const seen = new Set()
const dishes = []
for (const row of json.results.bindings) {
  const name = row.label.value.trim()
  if (!HAS_JAPANESE.test(name)) continue
  if (seen.has(name)) continue
  seen.add(name)

  let kind = row.type?.value?.trim() ?? ''
  if (GENERIC_TYPES.has(kind) || kind === name) kind = '料理'

  const tags = []
  const country = row.country?.value?.trim()
  if (country) tags.push(country)
  const ings = (row.ings?.value ?? '').split('|').filter((s) => s && HAS_JAPANESE.test(s))
  tags.push(...ings.slice(0, 4))

  dishes.push({ name, kind, tags })
}

dishes.sort((a, b) => a.name.localeCompare(b.name, 'ja'))

const header = `// このファイルは scripts/fetch-dishes.mjs が生成する。手で編集しない。
// 出典: Wikidata (CC0) — 料理 (Q746549) のサブクラス配下で日本語ラベルを持つもの。
// 取得日: ${new Date().toISOString().slice(0, 10)} / ${dishes.length} 件
import type { Item } from './data'

export const dishes: Item[] = [
`
const body = dishes
  .map(
    (d, i) =>
      `  { id: ${1000 + i}, name: ${JSON.stringify(d.name)}, kind: ${JSON.stringify(d.kind)}, tags: ${JSON.stringify(d.tags)} },`,
  )
  .join('\n')

const out = `${header}${body}\n]\n`
const dest = join(dirname(fileURLToPath(import.meta.url)), '../src/dishes.ts')
writeFileSync(dest, out)
console.log(`wrote ${dest}: ${dishes.length} dishes`)
