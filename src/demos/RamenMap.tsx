import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './RamenMap.css'

/**
 * 地図で探すラーメン検索。
 * 地図タイルは OpenStreetMap、店データは Overpass API（OSM のクエリ API）から
 * その場で取ってくる。ライブラリは使わず、タイル並べとメルカトル投影を手で書いている。
 *
 * Overpass QL の書き方・作法は docs/overpass.md にまとめてある。
 */

const TILE = 256
const MIN_ZOOM = 10
const MAX_ZOOM = 18
/** これ未満のズームだと範囲が広すぎて Overpass に怒られるので検索させない */
const SEARCH_MIN_ZOOM = 13
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OVERPASS = 'https://overpass-api.de/api/interpreter'

/** 初期位置は東京駅あたり。ラーメン屋の密度がちょうどよく、動作確認しやすい */
const INITIAL = { lat: 35.6812, lon: 139.7671, zoom: 15 }

type Shop = {
  id: string
  name: string
  lat: number
  lon: number
  /** OSM の cuisine から拾った系統。無ければ「ラーメン」 */
  genre: string
  hours?: string
  fake?: boolean
}

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; count: number }
  | { kind: 'error'; message: string }

// --- メルカトル投影（世界をピクセルの正方形に伸ばす） ---------------------

function lonToWorldX(lon: number, zoom: number) {
  return ((lon + 180) / 360) * TILE * 2 ** zoom
}

function latToWorldY(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180
  const y = Math.log(Math.tan(rad) + 1 / Math.cos(rad))
  return (0.5 - y / (2 * Math.PI)) * TILE * 2 ** zoom
}

function worldXToLon(x: number, zoom: number) {
  return (x / (TILE * 2 ** zoom)) * 360 - 180
}

function worldYToLat(y: number, zoom: number) {
  const n = Math.PI - 2 * Math.PI * (y / (TILE * 2 ** zoom))
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

/** 表示用のざっくり距離（m）。緯度差はそのまま、経度差は緯度で縮める */
function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = (a.lat - b.lat) * 111_320
  const dLon = (a.lon - b.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180)
  return Math.hypot(dLat, dLon)
}

// --- Overpass ------------------------------------------------------------

/** cuisine=ramen のほか、店名に麺系の語を持つ飲食店も拾う */
function overpassQuery(s: number, w: number, n: number, e: number) {
  const bbox = `${s},${w},${n},${e}`
  return `[out:json][timeout:25];
(
  nwr["cuisine"~"ramen"](${bbox});
  nwr["amenity"~"restaurant|fast_food"]["name"~"ラーメン|らーめん|ラー麺|中華そば|つけ麺|麺屋"](${bbox});
);
out center 300;`
}

type OverpassElement = {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

function toShops(elements: OverpassElement[]): Shop[] {
  const seen = new Set<string>()
  const shops: Shop[] = []

  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat
    const lon = el.lon ?? el.center?.lon
    const name = el.tags?.name
    if (lat === undefined || lon === undefined || !name) continue

    // 同じ店が node と way で二重に入ることがあるので名前+座標で潰す
    const key = `${name}@${lat.toFixed(4)},${lon.toFixed(4)}`
    if (seen.has(key)) continue
    seen.add(key)

    const cuisine = el.tags?.cuisine ?? ''
    shops.push({
      id: `${el.type}/${el.id}`,
      name,
      lat,
      lon,
      genre: cuisine.split(';').find((c) => c && c !== 'ramen') ?? 'ラーメン',
      hours: el.tags?.opening_hours,
    })
  }
  return shops
}

/** Overpass に届かないときの逃げ道。ネタ用のニセ店舗を中心のまわりに撒く */
const FAKE_NAMES = [
  '麺屋 ぐるぐる',
  'ラーメン大喜利軒',
  '中華そば 検索窓',
  'つけ麺 インデックス',
  '横浜家系 なんとか家',
  '味噌の湯',
  '油そば 全文一致',
  'らーめん 部分一致',
]

function fakeShops(lat: number, lon: number): Shop[] {
  return FAKE_NAMES.map((name, i) => {
    const angle = (i / FAKE_NAMES.length) * Math.PI * 2
    const r = 0.004 + (i % 3) * 0.002
    return {
      id: `fake/${i}`,
      name,
      lat: lat + Math.sin(angle) * r * 0.7,
      lon: lon + Math.cos(angle) * r,
      genre: 'ラーメン',
      fake: true,
    }
  })
}

// --- 本体 ----------------------------------------------------------------

export function RamenMap() {
  const [center, setCenter] = useState({ lat: INITIAL.lat, lon: INITIAL.lon })
  const [zoom, setZoom] = useState(INITIAL.zoom)
  const [size, setSize] = useState({ w: 800, h: 480 })
  const [shops, setShops] = useState<Shop[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [selected, setSelected] = useState<string | null>(null)
  const [tilesBroken, setTilesBroken] = useState(false)

  const mapRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null)
  const tileErrorsRef = useRef(0)

  // 地図の実サイズを測る。タイルの敷き詰め範囲がこれで決まる
  useEffect(() => {
    const el = mapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ w: Math.max(1, width), h: Math.max(1, height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const centerX = lonToWorldX(center.lon, zoom)
  const centerY = latToWorldY(center.lat, zoom)
  const originX = centerX - size.w / 2
  const originY = centerY - size.h / 2

  const toScreen = useCallback(
    (lat: number, lon: number) => ({
      x: lonToWorldX(lon, zoom) - originX,
      y: latToWorldY(lat, zoom) - originY,
    }),
    [zoom, originX, originY],
  )

  // 画面に映るタイルだけ列挙する
  const tiles = useMemo(() => {
    const max = 2 ** zoom
    const x0 = Math.floor(originX / TILE)
    const y0 = Math.floor(originY / TILE)
    const x1 = Math.floor((originX + size.w) / TILE)
    const y1 = Math.floor((originY + size.h) / TILE)
    const list: { key: string; url: string; left: number; top: number }[] = []

    for (let y = y0; y <= y1; y++) {
      if (y < 0 || y >= max) continue
      for (let x = x0; x <= x1; x++) {
        const wrapped = ((x % max) + max) % max
        list.push({
          key: `${zoom}/${x}/${y}`,
          url: TILE_URL.replace('{z}', String(zoom))
            .replace('{x}', String(wrapped))
            .replace('{y}', String(y)),
          left: x * TILE - originX,
          top: y * TILE - originY,
        })
      }
    }
    return list
  }, [zoom, originX, originY, size.w, size.h])

  // --- 操作 ---

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.id !== e.pointerId) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
    setCenter((c) => ({
      lat: worldYToLat(latToWorldY(c.lat, zoom) - dy, zoom),
      lon: worldXToLon(lonToWorldX(c.lon, zoom) - dx, zoom),
    }))
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.id === e.pointerId) dragRef.current = null
  }

  /** ポインタ位置を固定したままズームする */
  const zoomAt = useCallback(
    (delta: number, screenX?: number, screenY?: number) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta))
      if (next === zoom) return
      const px = screenX ?? size.w / 2
      const py = screenY ?? size.h / 2
      // カーソル下の緯度経度を求め、ズーム後もそこが同じ画面位置に来るよう中心をずらす
      const lat = worldYToLat(originY + py, zoom)
      const lon = worldXToLon(originX + px, zoom)
      const nx = lonToWorldX(lon, next) - (px - size.w / 2)
      const ny = latToWorldY(lat, next) - (py - size.h / 2)
      setCenter({ lat: worldYToLat(ny, next), lon: worldXToLon(nx, next) })
      setZoom(next)
    },
    [zoom, originX, originY, size.w, size.h],
  )

  // wheel は passive 既定なので preventDefault のために手で登録する
  useEffect(() => {
    const el = mapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomAt(e.deltaY < 0 ? 1 : -1, e.clientX - rect.left, e.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  // --- この範囲を検索 ---

  async function searchHere() {
    if (zoom < SEARCH_MIN_ZOOM) return
    setStatus({ kind: 'loading' })
    tileErrorsRef.current = 0

    const north = worldYToLat(originY, zoom)
    const south = worldYToLat(originY + size.h, zoom)
    const west = worldXToLon(originX, zoom)
    const east = worldXToLon(originX + size.w, zoom)

    try {
      const res = await fetch(OVERPASS, {
        method: 'POST',
        body: new URLSearchParams({ data: overpassQuery(south, west, north, east) }),
      })
      if (!res.ok) throw new Error(`Overpass ${res.status}`)
      const json = (await res.json()) as { elements: OverpassElement[] }
      const found = toShops(json.elements ?? [])
      setShops(found)
      setStatus({ kind: 'done', count: found.length })
    } catch (err) {
      // 通信が塞がっている環境でも大喜利は続行する
      setShops(fakeShops(center.lat, center.lon))
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const q = query.trim()
  const matches = useMemo(() => {
    if (!q) return shops
    return shops.filter((s) => s.name.includes(q) || s.genre.includes(q))
  }, [shops, q])

  const matchIds = useMemo(() => new Set(matches.map((s) => s.id)), [matches])

  const nearby = useMemo(
    () =>
      [...matches]
        .map((s) => ({ shop: s, dist: distanceMeters(center, s) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 20),
    [matches, center],
  )

  return (
    <div className="ramen-page">
      <header className="ramen-head">
        <h1>ラーメン検索（地図）</h1>
        <p className="ramen-lead">
          地図を動かして「この範囲を検索」。OpenStreetMap の実データから
          <code>cuisine=ramen</code> の店を拾ってきて、湯気を立てる。
        </p>
      </header>

      <div className="ramen-controls">
        <label className="ramen-field">
          <span aria-hidden>🍜</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="店名で絞り込む（家系 / つけ麺 / 二郎 …）"
            aria-label="店名で絞り込む"
          />
          {q && (
            <button type="button" className="ramen-clear" onClick={() => setQuery('')}>
              ×
            </button>
          )}
        </label>
        <button
          type="button"
          className="ramen-search"
          onClick={searchHere}
          disabled={status.kind === 'loading' || zoom < SEARCH_MIN_ZOOM}
        >
          {status.kind === 'loading' ? '茹でています…' : 'この範囲を検索'}
        </button>
      </div>

      <div className="ramen-body">
        <div
          ref={mapRef}
          className="ramen-map"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {tiles.map((t) => (
            <img
              key={t.key}
              className="ramen-tile"
              src={t.url}
              alt=""
              draggable={false}
              loading="lazy"
              style={{ left: t.left, top: t.top }}
              onError={() => {
                tileErrorsRef.current += 1
                if (tileErrorsRef.current > 3) setTilesBroken(true)
              }}
            />
          ))}

          {shops.map((shop) => {
            const { x, y } = toScreen(shop.lat, shop.lon)
            if (x < -40 || y < -60 || x > size.w + 40 || y > size.h + 40) return null
            const hit = matchIds.has(shop.id)
            return (
              <button
                key={shop.id}
                type="button"
                className="ramen-pin"
                data-hit={hit || undefined}
                data-selected={selected === shop.id || undefined}
                style={{ left: x, top: y }}
                onClick={() => setSelected((s) => (s === shop.id ? null : shop.id))}
                title={shop.name}
              >
                <span className="ramen-steam" aria-hidden>
                  ♨
                </span>
                <span className="ramen-bowl" aria-hidden>
                  🍜
                </span>
                <span className="ramen-label">{shop.name}</span>
              </button>
            )
          })}

          <div className="ramen-zoom">
            <button type="button" onClick={() => zoomAt(1)} aria-label="拡大">
              ＋
            </button>
            <button type="button" onClick={() => zoomAt(-1)} aria-label="縮小">
              －
            </button>
          </div>

          {tilesBroken && (
            <p className="ramen-tilenote">
              地図タイルを読み込めませんでした（オフライン、または tile.openstreetmap.org
              がブロックされています）
            </p>
          )}

          <p className="ramen-attr">
            地図データ ©{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              OpenStreetMap
            </a>{' '}
            contributors
          </p>
        </div>

        <aside className="ramen-side">
          <p className="ramen-status">
            {status.kind === 'idle' && 'まだ茹でていません。地図を合わせて検索。'}
            {status.kind === 'loading' && 'Overpass に問い合わせ中…'}
            {status.kind === 'done' &&
              (status.count === 0
                ? 'この範囲には見つかりませんでした。動かして再検索。'
                : `${status.count} 軒ヒット / 表示中 ${matches.length} 軒`)}
            {status.kind === 'error' && `通信できないのでダミーの店を出しています（${status.message}）`}
          </p>

          {zoom < SEARCH_MIN_ZOOM && (
            <p className="ramen-note">ズームが足りません。z{SEARCH_MIN_ZOOM} 以上まで寄せてください。</p>
          )}

          <ul className="ramen-list">
            {nearby.map(({ shop, dist }) => (
              <li key={shop.id}>
                <button
                  type="button"
                  className="ramen-row"
                  data-selected={selected === shop.id || undefined}
                  onClick={() => {
                    setSelected(shop.id)
                    setCenter({ lat: shop.lat, lon: shop.lon })
                  }}
                >
                  <span className="ramen-row-name">
                    {shop.name}
                    {shop.fake && <span className="ramen-fake">ダミー</span>}
                  </span>
                  <span className="ramen-row-meta">
                    {dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`}
                    {shop.hours && ` ・ ${shop.hours}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {status.kind !== 'idle' && nearby.length === 0 && (
            <p className="ramen-note">絞り込みに合う店がありません。</p>
          )}
        </aside>
      </div>
    </div>
  )
}
