import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Search, Calendar, ChevronDown } from 'lucide-react'
import * as api from '../api.js'

function fmt(n) {
  if (n == null) return '—'
  return n.toFixed(2) + ' ₺'
}

function PctBadge({ pct }) {
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

function MiniChart({ history }) {
  if (!history || history.length < 2) return <div style={{ color: 'var(--text-xdim)', fontSize: 12 }}>Yeterli veri yok</div>
  const vals = history.map(h => h.lowN).filter(v => v != null)
  if (!vals.length) return null
  const min = Math.min(...vals), max = Math.max(...vals)
  const range = max - min || 1
  const W = 280, H = 60, pad = 8
  const points = history
    .filter(h => h.lowN != null)
    .map((h, i, arr) => {
      const x = pad + (i / (arr.length - 1)) * (W - pad * 2)
      const y = H - pad - ((h.lowN - min) / range) * (H - pad * 2)
      return `${x},${y}`
    }).join(' ')
  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" />
      {history.filter(h => h.lowN != null).map((h, i, arr) => {
        const x = pad + (i / (arr.length - 1)) * (W - pad * 2)
        const y = H - pad - ((h.lowN - min) / range) * (H - pad * 2)
        return <circle key={i} cx={x} cy={y} r={3} fill="#3b82f6" />
      })}
    </svg>
  )
}

export default function HalPricesPage({ token, menus }) {
  const [tab, setTab] = useState('today')
  const [latest, setLatest] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [history, setHistory] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [syncFrom, setSyncFrom] = useState('')
  const [syncTo, setSyncTo] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(false)

  const load = useCallback(async () => {
    const [lat, alts, prods] = await Promise.all([
      api.halLatest(token),
      api.halAlerts(token),
      api.halProducts(token),
    ])
    setLatest(lat)
    setAlerts(alts || [])
    setProducts(prods || [])
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
    setHistory(h || [])
    setLoadingHistory(false)
  }

  function handleProductSelect(p) {
    setSelectedProduct(p)
    loadHistory(p)
  }

  const filtered = latest?.items?.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  // Menüdeki tüm yemek adlarını düzleştir
  const menuDishNames = []
  menus?.forEach(m => m.stations?.forEach(s => s.dishes?.forEach(d => {
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
          onClick={handleSync}
          disabled={syncing}
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
            <AlertTriangle size={14} /> Fiyat Değişim Uyarıları (≥%10)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {alerts.map(a => (
              <div key={a.name} style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>{a.name}</span>
                <span style={{ color: 'var(--text-dim)', margin: '0 6px' }}>{a.days}g ort. {fmt(a.avg)} →</span>
                <span style={{ fontWeight: 600 }}>{fmt(a.curLow)}</span>
                <span style={{ marginLeft: 6 }}><PctBadge pct={a.pct} /></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-alt)', padding: 4, borderRadius: 8, width: 'fit-content' }}>
        <button style={tabStyle('today')} onClick={() => setTab('today')}>Bugünün Fiyatları</button>
        <button style={tabStyle('history')} onClick={() => setTab('history')}>Ürün Geçmişi</button>
        <button style={tabStyle('menu')} onClick={() => setTab('menu')}>Menü Eşleştirme</button>
        <button style={tabStyle('sync')} onClick={() => setTab('sync')}>Veri Çek</button>
      </div>

      {/* TODAY TAB */}
      {tab === 'today' && (
        <div>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-xdim)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Ürün ara..."
              style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
          {!latest ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
              Henüz veri yok. "Bugünü Güncelle" butonuna tıklayın.
            </div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-alt)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>Ürün</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>Min</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>Max</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>Birim</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>Menüde</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, i) => (
                    <tr key={item.name} style={{ background: i % 2 ? 'var(--bg-alt)' : '#fff' }}>
                      <td style={{ padding: '8px 14px', fontWeight: 500 }}>{item.name}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{fmt(item.lowN)}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{fmt(item.highN)}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'center', color: 'var(--text-dim)' }}>{item.unit}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                        {inMenu(item.name) && (
                          <span style={{ background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>Var</span>
                        )}
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

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Ürün Seç</label>
            <select
              value={selectedProduct}
              onChange={e => handleProductSelect(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', minWidth: 240 }}
            >
              <option value="">— Ürün seçin —</option>
              {products.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {loadingHistory && <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Yükleniyor...</div>}
          {!loadingHistory && selectedProduct && history.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>{selectedProduct} — Son {history.length} gün</div>
              <MiniChart history={history} />
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 16 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-alt)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)' }}>Tarih</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-dim)' }}>Min</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-dim)' }}>Max</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-dim)' }}>Birim</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-dim)' }}>Değişim</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice().reverse().map((h, i, arr) => {
                    const prev = arr[i + 1]
                    const pct = prev?.lowN && h.lowN ? Math.round(((h.lowN - prev.lowN) / prev.lowN) * 100) : null
                    return (
                      <tr key={h.date}>
                        <td style={{ padding: '7px 12px' }}>{h.date}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{fmt(h.lowN)}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{fmt(h.highN)}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'center', color: 'var(--text-dim)' }}>{h.unit}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'center' }}>{pct != null && <PctBadge pct={pct} />}</td>
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

      {/* MENU MATCHING TAB */}
      {tab === 'menu' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 0 }}>
            Menüdeki yemek adlarıyla hal ürünlerini karşılaştırır. Eşleşme kelime bazlı arama ile yapılır.
          </p>
          {!latest ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Önce fiyat verisi çekin.</div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-alt)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>Hal Ürünü</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>Min Fiyat</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>Max Fiyat</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>Menüdeki Yemek</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.items.filter(i => inMenu(i.name)).map((item, idx) => {
                    const matchedDishes = [...new Set(
                      menuDishNames.filter(d => d.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(d.split(' ')[0]))
                    )]
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

      {/* SYNC TAB */}
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
            <button
              onClick={handleSyncRange}
              disabled={syncing || !syncFrom || !syncTo}
              style={{
                width: '100%', padding: '9px', background: '#1d4ed8', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                opacity: (syncing || !syncFrom || !syncTo) ? 0.6 : 1,
              }}
            >
              Aralığı Çek (max 30 gün)
            </button>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
              Her gün arka planda ayrı ayrı çekilir. Zaten olan günler atlanır.
            </div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Otomatik Güncelleme</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Sunucu her sabah <strong>07:00</strong>'de bugünün fiyatlarını otomatik olarak çeker.
            </div>
          </div>
          {syncMsg && (
            <div style={{ marginTop: 12, background: '#f0f9ff', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#0369a1' }}>
              {syncMsg}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
