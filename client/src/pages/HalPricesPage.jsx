import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Search } from 'lucide-react'
import * as api from '../api.js'

function fmt(n) {
  if (n == null) return '—'
  return n.toFixed(2) + ' ₺'
}

function PctBadge({ pct }) {
  if (pct == null) return null
  const up = pct > 0
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      padding: '2px 7px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: up ? '#fee2e2' : '#dcfce7',
      color: up ? '#dc2626' : '#16a34a',
    }}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? '+' : ''}{pct}%
    </span>
  )
}

function LineChart({ history, W = 240, H = 70 }) {
  if (!history || history.length < 2) {
    return <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12 }}>Veri yok</div>
  }
  const vals = history.map(h => h.highN)
  const min = Math.min(...vals), max = Math.max(...vals)
  const range = max - min || 1
  const pad = 8
  const points = history.map((h, i) => {
    const x = pad + (i / (history.length - 1)) * (W - pad * 2)
    const y = H - pad - ((h.highN - min) / range) * (H - pad * 2)
    return [x, y]
  })
  const polyline = points.map(p => p.join(',')).join(' ')
  const area = `M${points[0][0]},${points[0][1]} ` +
    points.slice(1).map(p => `L${p[0]},${p[1]}`).join(' ') +
    ` L${points[points.length-1][0]},${H} L${points[0][0]},${H} Z`

  const last = points[points.length - 1]
  const first = points[0]
  const trend = vals[vals.length - 1] >= vals[0]

  return (
    <svg width={W} height={H} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={`g${W}${H}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={trend ? '#3b82f6' : '#ef4444'} stopOpacity="0.15" />
          <stop offset="100%" stopColor={trend ? '#3b82f6' : '#ef4444'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g${W}${H})`} />
      <polyline points={polyline} fill="none" stroke={trend ? '#3b82f6' : '#ef4444'} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill={trend ? '#3b82f6' : '#ef4444'} />
      {/* min/max labels */}
      <text x={pad} y={H - 2} fontSize={9} fill="#9ca3af">{fmt(min)}</text>
      <text x={pad} y={11} fontSize={9} fill="#9ca3af">{fmt(max)}</text>
    </svg>
  )
}

function TrackedCard({ item }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{item.label}</div>
          {item.latest && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
              {item.latest.name !== item.label ? item.latest.name : ''}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#1d4ed8' }}>{fmt(item.latest?.highN)}</div>
          <div style={{ marginTop: 2 }}><PctBadge pct={item.pct} /></div>
        </div>
      </div>
      <LineChart history={item.history} W={240} H={65} />
      <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>
        {item.history.length} günlük veri
      </div>
    </div>
  )
}

export default function HalPricesPage({ token, menus }) {
  const [tab, setTab] = useState('tracked')
  const [latest, setLatest] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [products, setProducts] = useState([])
  const [tracked, setTracked] = useState([])
  const [search, setSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [history, setHistory] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [syncFrom, setSyncFrom] = useState('')
  const [syncTo, setSyncTo] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(false)

  const load = useCallback(async () => {
    const [lat, alts, prods, trk] = await Promise.all([
      api.halLatest(token),
      api.halAlerts(token),
      api.halProducts(token),
      api.halTracked(token),
    ])
    setLatest(lat)
    setAlerts(Array.isArray(alts) ? alts : [])
    setProducts(Array.isArray(prods) ? prods : [])
    setTracked(Array.isArray(trk) ? trk : [])
  }, [token])

  useEffect(() => { load() }, [load])

  async function handleSync() {
    setSyncing(true)
    setSyncMsg('Bugünün fiyatları çekiliyor...')
    const r = await api.halSync(token, null)
    setSyncMsg(r.ok ? `${r.count} ürün güncellendi (${r.date})` : r.skipped ? 'Bugün zaten mevcut' : r.error || 'Hata')
    setSyncing(false)
    load()
  }

  async function handleSyncRange() {
    if (!syncFrom || !syncTo) return
    setSyncing(true)
    setSyncMsg('Aralık çekiliyor, arka planda devam ediyor...')
    await api.halSyncRange(token, syncFrom, syncTo)
    setSyncing(false)
    setTimeout(load, 3000)
  }

  async function loadHistory(product) {
    if (!product) return
    setLoadingHistory(true)
    const h = await api.halHistory(token, product)
    setHistory(Array.isArray(h) ? h : [])
    setLoadingHistory(false)
  }

  const filtered = latest?.items?.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  const menuDishNames = []
  menus?.forEach(m => (m.stations || []).forEach(s => (s.dishes || []).forEach(d => {
    if (d.name) menuDishNames.push(d.name.toLowerCase())
  })))

  function inMenu(productName) {
    const p = productName.toLowerCase()
    return menuDishNames.some(d => d.includes(p) || p.includes(d.split(' ')[0]))
  }

  const tabStyle = (key) => ({
    padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13, fontWeight: 500,
    background: tab === key ? '#1d4ed8' : 'transparent',
    color: tab === key ? '#fff' : 'var(--text-dim)',
  })

  const TABS = [
    { key: 'tracked', label: 'Fiyat Takibi' },
    { key: 'today',   label: 'Bugünün Fiyatları' },
    { key: 'history', label: 'Ürün Geçmişi' },
    { key: 'menu',    label: 'Menü Eşleştirme' },
    { key: 'sync',    label: 'Veri Çek' },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Hal Fiyatları</h1>
          {latest && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
              Son güncelleme: {latest.date} · {latest.region} · {latest.items?.length} ürün
            </div>
          )}
        </div>
        <button
          onClick={handleSync} disabled={syncing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8,
            cursor: syncing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
            opacity: syncing ? 0.7 : 1,
          }}
        >
          <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          Bugünü Güncelle
        </button>
      </div>

      {syncMsg && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 13, color: '#0369a1' }}>
          {syncMsg}
        </div>
      )}

      {/* Uyarılar */}
      {alerts.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#92400e' }}>
            <AlertTriangle size={14} /> Fiyat Değişim Uyarıları (7g ort. vs bugün, ≥%10)
          </div>
          {[
            { label: '📈 Artanlar', items: alerts.filter(a => a.pct > 0), color: '#dc2626', border: '#fecaca' },
            { label: '📉 Azalanlar', items: alerts.filter(a => a.pct < 0), color: '#16a34a', border: '#bbf7d0' },
          ].filter(g => g.items.length > 0).map(g => (
            <div key={g.label} style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: g.color, marginBottom: 6 }}>
                {g.label} ({g.items.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {g.items.map(a => (
                  <div key={a.name} style={{ background: '#fff', border: `1px solid ${g.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>{a.name}</span>
                    <span style={{ color: 'var(--text-dim)', margin: '0 6px' }}>{a.days}g ort. {fmt(a.avg)} →</span>
                    <span style={{ fontWeight: 600 }}>{fmt(a.curHigh)}</span>
                    <span style={{ marginLeft: 6 }}><PctBadge pct={a.pct} /></span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-alt)', padding: 4, borderRadius: 8, width: 'fit-content' }}>
        {TABS.map(t => <button key={t.key} style={tabStyle(t.key)} onClick={() => setTab(t.key)}>{t.label}</button>)}
      </div>

      {/* FİYAT TAKİBİ */}
      {tab === 'tracked' && (
        <div>
          {tracked.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 13 }}>
              Önce "Veri Çek" sekmesinden geçmiş veri çekin.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {tracked.map(item => <TrackedCard key={item.label} item={item} />)}
            </div>
          )}
        </div>
      )}

      {/* BUGÜNÜN FİYATLARI */}
      {tab === 'today' && (
        <div>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-xdim)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ürün ara..."
              style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          {!latest ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Henüz veri yok. "Bugünü Güncelle" butonuna tıklayın.</div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-alt)' }}>
                    {['Ürün','Min','Max','Birim','Menüde'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Min' || h === 'Max' ? 'right' : h === 'Birim' || h === 'Menüde' ? 'center' : 'left', fontWeight: 600, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, i) => (
                    <tr key={item.name} style={{ background: i % 2 ? 'var(--bg-alt)' : '#fff' }}>
                      <td style={{ padding: '7px 14px', fontWeight: 500 }}>{item.name}</td>
                      <td style={{ padding: '7px 14px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{fmt(item.lowN)}</td>
                      <td style={{ padding: '7px 14px', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{fmt(item.highN)}</td>
                      <td style={{ padding: '7px 14px', textAlign: 'center', color: 'var(--text-dim)' }}>{item.unit}</td>
                      <td style={{ padding: '7px 14px', textAlign: 'center' }}>
                        {inMenu(item.name) && <span style={{ background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>Var</span>}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)' }}>Ürün bulunamadı</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ÜRÜN GEÇMİŞİ */}
      {tab === 'history' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Ürün Seç</label>
            <select value={selectedProduct} onChange={e => { setSelectedProduct(e.target.value); loadHistory(e.target.value) }}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', minWidth: 240 }}>
              <option value="">— Ürün seçin —</option>
              {products.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {loadingHistory && <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Yükleniyor...</div>}
          {!loadingHistory && selectedProduct && history.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
              <div style={{ fontWeight: 600, marginBottom: 16 }}>{selectedProduct} — Son {history.length} gün</div>
              <LineChart history={history} W={600} H={120} />
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 16 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-alt)' }}>
                    {['Tarih','Min','Max','Birim','Değişim'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Min' || h === 'Max' ? 'right' : h === 'Değişim' ? 'center' : 'left', fontWeight: 600, color: 'var(--text-dim)', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.slice().reverse().map((h, i, arr) => {
                    const prev = arr[i + 1]
                    const pct = prev?.highN && h.highN ? Math.round(((h.highN - prev.highN) / prev.highN) * 100) : null
                    return (
                      <tr key={h.date}>
                        <td style={{ padding: '7px 12px' }}>{h.date}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{fmt(h.lowN)}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{fmt(h.highN)}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'center', color: 'var(--text-dim)' }}>{h.unit}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'center' }}><PctBadge pct={pct} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loadingHistory && selectedProduct && history.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Bu ürün için geçmiş veri bulunamadı.</div>
          )}
        </div>
      )}

      {/* MENÜ EŞLEŞTİRME */}
      {tab === 'menu' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 0 }}>Menüdeki yemek adlarıyla hal ürünlerini kelime bazlı karşılaştırır.</p>
          {!latest ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Önce fiyat verisi çekin.</div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-alt)' }}>
                    {['Hal Ürünü','Min Fiyat','Max Fiyat','Menüdeki Yemek'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: h.includes('Fiyat') ? 'right' : 'left', fontWeight: 600, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {latest.items.filter(i => inMenu(i.name)).map((item, idx) => {
                    const matchedDishes = [...new Set(menuDishNames.filter(d => d.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(d.split(' ')[0])))]
                    return (
                      <tr key={item.name} style={{ background: idx % 2 ? 'var(--bg-alt)' : '#fff' }}>
                        <td style={{ padding: '8px 14px', fontWeight: 500 }}>{item.name}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{fmt(item.lowN)}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{fmt(item.highN)}</td>
                        <td style={{ padding: '8px 14px', color: 'var(--text-dim)', fontSize: 12 }}>{matchedDishes.slice(0, 3).join(', ')}</td>
                      </tr>
                    )
                  })}
                  {latest.items.filter(i => inMenu(i.name)).length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)' }}>Eşleşen ürün bulunamadı</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VERİ ÇEK */}
      {tab === 'sync' && (
        <div style={{ maxWidth: 480 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Tarih Aralığı Çek</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>Başlangıç</label>
                <input type="date" value={syncFrom} onChange={e => setSyncFrom(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>Bitiş</label>
                <input type="date" value={syncTo} onChange={e => setSyncTo(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            </div>
            <button onClick={handleSyncRange} disabled={syncing || !syncFrom || !syncTo}
              style={{ width: '100%', padding: '9px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: (syncing || !syncFrom || !syncTo) ? 0.6 : 1 }}>
              Aralığı Çek (max 30 gün)
            </button>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>Zaten olan günler atlanır. Her gün aralarında 2sn beklenir.</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Otomatik Güncelleme</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Sunucu her gün <strong>11:05</strong>'te bugünün fiyatlarını otomatik çeker.</div>
          </div>
          {syncMsg && <div style={{ marginTop: 12, background: '#f0f9ff', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#0369a1' }}>{syncMsg}</div>}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
