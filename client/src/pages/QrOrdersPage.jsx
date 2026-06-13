import React, { useState, useEffect, useCallback } from 'react'
import { QrCode, RefreshCw, Utensils, CupSoda, Store, AlertTriangle } from 'lucide-react'
import * as api from '../api.js'

// yyyy-MM-dd (yerel)
const iso = d => {
  const z = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }
const nf = n => (n || 0).toLocaleString('tr-TR')
const asArr = x => (Array.isArray(x) ? x : [])
const errOf = (...xs) => { const e = xs.find(x => x && x.error); return e ? e.error : null }
const sumv = arr => asArr(arr).reduce((s, r) => s + (r.value || 0), 0)

function Card({ children, style }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, ...style }}>
      {children}
    </div>
  )
}

function Kpi({ label, value, sub, color = 'var(--text)' }) {
  return (
    <Card style={{ flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-xdim)', marginTop: 4 }}>{sub}</div>}
    </Card>
  )
}

// Yatay bar listesi
function BarList({ rows, color, max, empty = 'Veri yok' }) {
  if (!rows.length) return <div style={{ color: 'var(--text-xdim)', fontSize: 13, padding: '8px 0' }}>{empty}</div>
  const m = max || Math.max(...rows.map(r => r.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 150, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name}</div>
          <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 4, height: 18, position: 'relative', overflow: 'hidden' }}>
            <div style={{ width: `${(r.value / m) * 100}%`, background: color, height: '100%', borderRadius: 4, minWidth: 2, transition: 'width .3s' }} />
          </div>
          <div style={{ width: 64, textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{nf(r.value)}</div>
        </div>
      ))}
    </div>
  )
}

export default function QrOrdersPage({ token }) {
  const [from, setFrom] = useState(daysAgo(7))
  const [to, setTo] = useState(daysAgo(0))
  const [unitId, setUnitId] = useState('')
  const [units, setUnits] = useState([])
  const [food, setFood] = useState([])
  const [drink, setDrink] = useState([])
  const [unitTotals, setUnitTotals] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [err, setErr] = useState('')
  const [configured, setConfigured] = useState(null)

  // Açılışta: yapılandırma + şube listesi
  useEffect(() => {
    (async () => {
      try {
        const st = await api.qrStatus(token)
        setConfigured(!!st.configured)
        if (st.configured) {
          const u = await api.qrUnits(token)
          setUnits(asArr(u))
        }
      } catch { setConfigured(false) }
    })()
  }, [token])

  const runAnalysis = useCallback(async () => {
    // Ana analiz (hızlı: 2 çağrı) — hemen göster
    setLoading(true); setErr('')
    try {
      const [f, d] = await Promise.all([
        api.qrSales(token, { kind: 'food',  startDate: from, endDate: to, restId: unitId || undefined }),
        api.qrSales(token, { kind: 'drink', startDate: from, endDate: to, restId: unitId || undefined }),
      ])
      const e = errOf(f, d)
      if (e) setErr(e)
      setFood(asArr(f)); setDrink(asArr(d))
    } catch (e) { setErr(e.message || 'Veri alınamadı') }
    setLoading(false)

    // Şube karşılaştırması (yavaş: tüm şubeler) — arkada yüklensin, ana görünümü bekletmesin
    setLoadingUnits(true)
    try {
      const ut = await api.qrUnitTotals(token, { startDate: from, endDate: to })
      setUnitTotals(asArr(ut))
    } catch { /* sessiz: ana analiz yine de gösterilir */ }
    setLoadingUnits(false)
  }, [token, from, to, unitId])

  // Yapılandırma tamamsa otomatik bir kez çalıştır
  useEffect(() => { if (configured) runAnalysis() }, [configured]) // eslint-disable-line

  const totalFood = sumv(food), totalDrink = sumv(drink)
  const total = totalFood + totalDrink
  const variety = food.length + drink.length
  const topAll = [...food, ...drink].sort((a, b) => b.value - a.value)[0]
  const foodPct = total ? Math.round((totalFood / total) * 100) : 0

  const inputStyle = { padding: '8px 10px', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontFamily: 'inherit' }
  const scopeLabel = unitId ? (units.find(u => String(u.id) === String(unitId))?.name || 'Şube') : 'Şirket geneli'

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <QrCode size={22} />
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>QR Siparişler</h1>
      </div>
      <div style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 20 }}>
        Otelde verilen siparişlerin (DigyBI POS) satış analizi.
      </div>

      {configured === false && (
        <Card style={{ borderColor: 'var(--gold)', background: 'var(--gold-bg)', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertTriangle size={18} style={{ color: 'var(--gold)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13 }}>
            <b>DigyBI kimlik bilgileri eksik.</b> Sunucuda <code>server/.env</code> içine
            <code> DIGYBI_CLIENT_ID</code>, <code>DIGYBI_CLIENT_SECRET</code>, <code>DIGYBI_COMPANY_ID</code> girilmeli.
          </div>
        </Card>
      )}

      {/* Filtre çubuğu */}
      <Card style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Başlangıç</div>
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Bitiş</div>
          <input type="date" value={to} min={from} max={daysAgo(0)} onChange={e => setTo(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Kapsam</div>
          <select value={unitId} onChange={e => setUnitId(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
            <option value="">Şirket geneli</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading || configured === false}
          style={{ padding: '9px 18px', fontSize: 14, fontWeight: 600, color: '#fff', background: 'var(--blue)', border: 'none', borderRadius: 6, cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, opacity: (loading || configured === false) ? 0.6 : 1 }}>
          <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
          {loading ? 'Yükleniyor…' : 'Analiz Et'}
        </button>
      </Card>

      {err && (
        <Card style={{ borderColor: 'var(--red)', background: 'var(--red-bg)', marginBottom: 16, fontSize: 13, color: 'var(--red)' }}>
          {err}
        </Card>
      )}

      {/* KPI'lar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Kpi label="Toplam Sipariş Adedi" value={nf(total)} sub={scopeLabel} />
        <Kpi label="Çeşit Sayısı" value={nf(variety)} sub={`${nf(food.length)} yemek · ${nf(drink.length)} içecek`} />
        <Kpi label="En Çok Satan" value={topAll ? nf(topAll.value) : '—'} sub={topAll ? topAll.name : 'Veri yok'} color="var(--green)" />
        <Kpi label="Yemek / İçecek" value={`%${foodPct} / %${100 - foodPct}`} sub={`${nf(totalFood)} / ${nf(totalDrink)}`} color="var(--blue)" />
      </div>

      {/* Yemek vs İçecek dağılımı */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Yemek vs İçecek</div>
        <div style={{ display: 'flex', height: 26, borderRadius: 6, overflow: 'hidden', background: 'var(--surface2)' }}>
          <div style={{ width: `${foodPct}%`, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 600 }}>
            {foodPct >= 10 && `Yemek %${foodPct}`}
          </div>
          <div style={{ width: `${100 - foodPct}%`, background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a1a1a', fontSize: 12, fontWeight: 600 }}>
            {(100 - foodPct) >= 10 && `İçecek %${100 - foodPct}`}
          </div>
        </div>
      </Card>

      {/* En çok satanlar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            <Utensils size={16} style={{ color: 'var(--blue)' }} /> En Çok Satan Yemekler
          </div>
          <BarList rows={food.slice(0, 10)} color="var(--blue)" empty="Bu aralıkta yemek satışı yok" />
        </Card>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            <CupSoda size={16} style={{ color: 'var(--gold)' }} /> En Çok Satan İçecekler
          </div>
          <BarList rows={drink.slice(0, 10)} color="var(--gold)" empty="Bu aralıkta içecek satışı yok" />
        </Card>
      </div>

      {/* Şube karşılaştırması */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          <Store size={16} /> Şube Karşılaştırması (toplam adet)
          {loadingUnits && <span style={{ fontSize: 12, color: 'var(--text-xdim)', fontWeight: 400 }}>· yükleniyor…</span>}
        </div>
        <BarList
          rows={unitTotals.map(u => ({ name: u.name, value: u.total }))}
          color="var(--green)"
          empty={loadingUnits ? 'Şubeler yükleniyor…' : 'Şube verisi yok'}
        />
      </Card>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
