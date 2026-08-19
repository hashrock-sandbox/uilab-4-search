# Overpass API の使い方

`src/demos/RamenMap.tsx`（ラーメン検索・地図）で使っている **Overpass API** のメモ。
OpenStreetMap のデータを「タグと範囲で問い合わせる」ための読み取り専用 API で、
このデモの店舗データは全部ここから来ている。

- 公式: <https://wiki.openstreetmap.org/wiki/Overpass_API>
- 言語リファレンス（Overpass QL）: <https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL>
- ブラウザで試す: <https://overpass-turbo.eu/>（**まずこれで書いてからコードに移すのが速い**）

---

## 1. 全体像

OSM のデータは 3 種類の要素でできている。

| 要素 | 実体 | 例 |
| --- | --- | --- |
| `node` | 緯度経度を持つ点 | 店、信号、ベンチ |
| `way` | node を並べた線・面 | 道路、建物の輪郭 |
| `relation` | 要素をまとめた集合 | バス路線、複数棟の施設 |

どれにも **タグ**（`key=value` の集まり）が付く。`amenity=restaurant`、`cuisine=ramen`、
`name=天下一品` のような。Overpass は「このタグを持つ要素を、この範囲から取ってこい」を書く言語。

タグそのものは自由記述に近いので、**何のタグが使われているかは事前に調べる**必要がある。
[taginfo](https://taginfo.openstreetmap.org/) で実際の使用数を確認できる。

## 2. 最小の形

```
[out:json][timeout:25];
node["amenity"="cafe"](35.68,139.76,35.69,139.78);
out;
```

3 つのパートからなる。

1. **設定** `[out:json][timeout:25];` — セミコロンで終わる
2. **クエリ本体** — 何を、どこから
3. **出力** `out;` — 何を返すか

### 設定でよく使うもの

| 設定 | 意味 |
| --- | --- |
| `[out:json]` | JSON で返す（既定は XML）。JS から扱うならこれ |
| `[out:csv(name,::lat,::lon)]` | CSV。列を明示する |
| `[timeout:25]` | サーバー側の実行上限（秒）。既定 180。**短く区切ると失敗が早く分かる** |
| `[maxsize:1073741824]` | メモリ上限（バイト）。巨大クエリのときだけ |
| `[bbox:s,w,n,e]` | 全ステートメント共通の範囲。個別に書く代わりに使える |

## 3. 要素の選び方

```
node[...]     点だけ
way[...]      線・面だけ
relation[...] 関係だけ
nwr[...]      node + way + relation ぜんぶ
nw[...] / wr[...]  組み合わせ
```

店は「点で登録されている」ことも「建物のポリゴンに付いている」こともある。
**取りこぼしたくないなら `nwr`** を使う。デモもそうしている。

## 4. タグフィルタ

```
["amenity"="restaurant"]      完全一致
["amenity"!="restaurant"]     不一致
["cuisine"~"ramen"]           正規表現の部分一致
["name"~"ラーメン|つけ麺"]     正規表現の OR
["name"~"ramen",i]            大文字小文字を無視
["opening_hours"]             そのキーが存在する
[!"name"]                     そのキーが存在しない
["cuisine"~"."]["name"~"."]   並べると AND
```

正規表現は POSIX 拡張。値が `ramen;noodle` のようにセミコロン区切りの複数値になることが
あるので、**`=` より `~` の方が実データには当たりやすい**。

## 5. 範囲の指定

### bbox（矩形）

```
node["amenity"="cafe"](35.68,139.76,35.69,139.78);
```

引数の順は **`(south, west, north, east)`** = `(最小緯度, 最小経度, 最大緯度, 最大経度)`。
緯度が先、しかも南西→北東の順。よく間違える。

デモでは画面の四隅を緯度経度に逆変換して、この bbox にしている（`RamenMap.tsx` の `searchHere`）。

### around（円）

```
node["amenity"="cafe"](around:500,35.6812,139.7671);
```

`(around:半径メートル, 緯度, 経度)`。「現在地から 500m」はこれ。

### area（行政区画などの中）

```
area["name"="渋谷区"]->.a;
node["amenity"="cafe"](area.a);
```

`->.a` で結果に名前を付け、`(area.a)` でその中に絞る。範囲が広くなりがちで重い。

## 6. 複数条件をまとめる（union）

丸括弧で囲んで `;` で並べると和集合になる。

```
(
  nwr["cuisine"~"ramen"](35.68,139.76,35.69,139.78);
  nwr["amenity"~"restaurant|fast_food"]["name"~"ラーメン"](35.68,139.76,35.69,139.78);
);
out center 300;
```

差集合は `-`、積集合は `.` で書ける（`(.a; - .b;)` など）。

## 7. 出力

| 書き方 | 返るもの |
| --- | --- |
| `out;` / `out body;` | 要素とタグ。way は構成 node の **id だけ**で座標は付かない |
| `out center;` | way / relation に **重心 `center: {lat, lon}` を付ける**。地図にピンを打つならこれ |
| `out geom;` | way の全頂点座標。輪郭を描くとき |
| `out skel;` | タグなしの骨組みだけ |
| `out count;` | 件数のみ。**まず件数を見る**のに便利（下記） |
| `out 300;` | 最大 300 件（他の指定と併用可: `out center 300;`） |

`>;` を挟むと way の構成 node を再帰的に取得できる（`out geom` がない時代の定石）。

`out count;` は要素の代わりにこの 1 件が返る。重いクエリを投げる前の当たり見に使う。

```jsonc
{ "type": "count", "id": 0,
  "tags": { "nodes": "11", "ways": "0", "relations": "0", "total": "11" } }
```

### 返ってくる JSON

```jsonc
{
  "version": 0.6,
  "generator": "Overpass API ...",
  "elements": [
    { "type": "node", "id": 123, "lat": 35.68, "lon": 139.76,
      "tags": { "name": "天下一品", "cuisine": "ramen" } },
    { "type": "way", "id": 456, "center": { "lat": 35.69, "lon": 139.77 },
      "tags": { "name": "...", "amenity": "restaurant" } }
  ]
}
```

**node は `lat`/`lon`、way / relation は `center`** に座標が入る。取り出し側は両方見る必要がある。
デモの `toShops()` が `el.lat ?? el.center?.lat` と書いているのはこのため。

同じ店が「点」と「建物ポリゴン」の両方で登録されていて二重に返ることもあるので、
**名前＋座標で重複を潰す**処理を入れている。

## 8. 呼び出し方

エンドポイントは `https://overpass-api.de/api/interpreter`。GET でも POST でも良い。

```sh
# GET（URL エンコードが必要。短いクエリ向け）
curl -G 'https://overpass-api.de/api/interpreter' \
  --data-urlencode 'data=[out:json][timeout:25];node["amenity"="cafe"](35.68,139.76,35.685,139.77);out center 20;'

# POST（クエリが長いときはこちら。デモも POST）
curl 'https://overpass-api.de/api/interpreter' \
  --data-urlencode 'data=[out:json][timeout:25];nwr["cuisine"~"ramen"](35.68,139.76,35.69,139.78);out center 50;'
```

JS からは `URLSearchParams` に `data` を入れて POST するのが素直。

```ts
const res = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  body: new URLSearchParams({ data: query }),
})
const json = await res.json()
```

CORS は許可されているので、ブラウザから直接叩ける（プロキシ不要）。

## 9. デモで実際に使っているクエリ

`RamenMap.tsx` の `overpassQuery()`：

```
[out:json][timeout:25];
(
  nwr["cuisine"~"ramen"](s,w,n,e);
  nwr["amenity"~"restaurant|fast_food"]["name"~"ラーメン|らーめん|ラー麺|中華そば|つけ麺|麺屋"](s,w,n,e);
);
out center 300;
```

読み下すと:

- `[out:json][timeout:25]` — JSON で、25 秒で諦める
- `nwr["cuisine"~"ramen"]` — **タグがちゃんと付いている店**を拾う（本命だが、付いていない店も多い）
- 2 本目 — `cuisine` が未入力でも、**店名に麺系の語が入っていれば拾う**（実データの穴埋め）
- `(...)` — 2 つの和集合。重複は取り出し側で潰す
- `out center 300` — way でも座標が返るように `center`、上限 300 件

**タグの網羅性を信用せず、名前でも引く**——これが実 OSM データを扱うときの現実的な妥協点。

## 10. 使うときの作法・ハマりどころ

### 公開インスタンスは共有資源

`overpass-api.de` はボランティア運営。**負荷をかけないことが利用条件**（[Fair Use](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances)）。

- ユーザーの操作ごとに自動で投げない。デモが「この範囲を検索」ボタンを押させているのはこのため
  （地図をドラッグするたびに投げるとすぐ弾かれる）
- 結果はキャッシュする。OSM のデータは秒単位で変わるものではない
- 本番規模で使うなら**自前インスタンスを立てる**か、ミラーを使う
  （`https://overpass.kumi.systems/api/interpreter` など）

### 返ってくるエラー

| 状況 | 挙動 |
| --- | --- |
| レート制限 | `429 Too Many Requests` |
| サーバー側タイムアウト | `504 Gateway Timeout`、または 200 でボディに `remark: runtime error` |
| クエリの文法ミス | `400 Bad Request`（HTML でエラー箇所が返る） |

**200 で返ってきても `elements` が空で `remark` が入っている**ことがあるので、
`res.ok` だけ見て安心しない方がいい。

### 範囲が広すぎると死ぬ

bbox の面積に比例して重くなる。デモがズーム 13 未満で検索ボタンを無効化しているのは、
**都道府県規模の bbox を投げるとまず timeout する**から。

### ライセンス

OSM のデータは **ODbL**。表示するなら `© OpenStreetMap contributors` の帰属が必要
（デモは地図の右下に出している）。タイル画像も別途 [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) がある。

---

## 練習してみる

overpass turbo で以下を順に書き換えていくと感覚がつかめる。

1. 自分の家のまわり 500m のコンビニ — `node["shop"="convenience"](around:500,緯度,経度);`
2. それを `out count;` に変えて件数だけ見る
3. `nwr` にして建物ポリゴン登録の店も拾えるか比べる
4. `["name"~"セブン|ローソン"]` を足して名前で絞る
5. `[out:csv(name,::lat,::lon)]` にして表計算に貼れる形で出す
