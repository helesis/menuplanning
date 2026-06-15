import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { QrCode, RefreshCw, Utensils, CupSoda, Store, Clock, CalendarDays, AlertTriangle } from 'lucide-react'
import * as api from '../api.js'

// yyyy-MM-dd (yerel)
const iso = d => { const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }
const nf = n => Math.round(n || 0).toLocaleString('tr-TR')
const asArr = x => (Array.isArray(x) ? x : [])

// {key: toplam} → [{name,value}] azalan
function topBy(rows, keyFn, n) {
  const m = new Map()
  for (const r of rows) { const k = keyFn(r); m.set(k, (m.get(k) || 0) + r.value) }
  const out = [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  return n ? out.slice(0, n) : out
}

// azalan sıralı listeden en çok N / en az N (en az: topN dışında kalanların en küçüğü, artan)
const LIST_N = 15
const top7 = a => a.slice(0, LIST_N)
const bottom7 = a => a.slice(LIST_N).slice(-LIST_N).reverse()

function Card({ children, style }) {
  return <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, ...style }}>{children}</div>
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
function SectionTitle({ icon, children, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
      {icon} {children}
      {note && <span style={{ fontSize: 12, color: 'var(--text-xdim)', fontWeight: 400 }}>· {note}</span>}
    </div>
  )
}

// Yatay bar listesi
function BarList({ rows, color, empty = 'Veri yok' }) {
  if (!rows.length) return <div style={{ color: 'var(--text-xdim)', fontSize: 13, padding: '8px 0' }}>{empty}</div>
  const m = Math.max(...rows.map(r => r.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 150, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name}</div>
          <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 4, height: 18, overflow: 'hidden' }}>
            <div style={{ width: `${(r.value / m) * 100}%`, background: color, height: '100%', borderRadius: 4, minWidth: 2 }} />
          </div>
          <div style={{ width: 64, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{nf(r.value)}</div>
        </div>
      ))}
    </div>
  )
}

// Dikey bar grafik (saatlik / günlük)
function VBars({ bars, color, labelEvery = 1 }) {
  const m = Math.max(...bars.map(b => b.value), 1)
  if (!bars.length) return <div style={{ color: 'var(--text-xdim)', fontSize: 13 }}>Veri yok</div>
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140 }}>
      {bars.map((b, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }} title={`${b.label}: ${nf(b.value)}`}>
          <div style={{ fontSize: 10, color: 'var(--text-xdim)', height: 12 }}>{b.value ? nf(b.value) : ''}</div>
          <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', height: 90 }}>
            <div style={{ width: '100%', height: `${(b.value / m) * 100}%`, background: color, borderRadius: '3px 3px 0 0', minHeight: b.value ? 2 : 0 }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{i % labelEvery === 0 ? b.label : ''}</div>
        </div>
      ))}
    </div>
  )
}

// Mini top liste (tooltip içi)
function MiniTop({ title, color, items }) {
  const m = Math.max(...items.map(i => i.value), 1)
  return (
    <div style={{ flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 6 }}>{title}</div>
      {items.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-xdim)' }}>—</div>}
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div style={{ width: 110, fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.name}>{it.name}</div>
          <div style={{ flex: 1, height: 9, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${(it.value / m) * 100}%`, height: '100%', background: color, borderRadius: 3, minWidth: 2 }} />
          </div>
          <div style={{ width: 34, textAlign: 'right', fontSize: 11, fontWeight: 600 }}>{nf(it.value)}</div>
        </div>
      ))}
    </div>
  )
}

// Saatlik grafik — bara hover edince o saatin top yemek/içecek'i yan yana
function HourlyChart({ rows }) {
  const [hover, setHover] = useState(null)
  const perHour = useMemo(() => {
    const arr = Array.from({ length: 24 }, () => ({ total: 0, fm: new Map(), dm: new Map() }))
    for (const r of rows) {
      const h = parseInt(String(r.hour)); if (h < 0 || h > 23) continue
      arr[h].total += r.value
      const m = r.kind === 'food' ? arr[h].fm : arr[h].dm
      m.set(r.name, (m.get(r.name) || 0) + r.value)
    }
    const sortAll = m => [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    return arr.map(h => ({ total: h.total, food: sortAll(h.fm), drink: sortAll(h.dm) }))
  }, [rows])
  const max = Math.max(...perHour.map(h => h.total), 1)
  const leftPct = hover != null ? Math.min(Math.max((hover + 0.5) / 24 * 100, 26), 74) : 0

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140 }}>
        {perHour.map((h, i) => (
          <div key={i}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0, cursor: h.total ? 'pointer' : 'default' }}
            title={h.total ? '' : undefined}>
            <div style={{ fontSize: 10, color: 'var(--text-xdim)', height: 12 }}>{h.total ? nf(h.total) : ''}</div>
            <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', height: 90 }}>
              <div style={{ width: '100%', height: `${(h.total / max) * 100}%`, background: 'var(--gold)', borderRadius: '3px 3px 0 0', minHeight: h.total ? 2 : 0, opacity: hover == null || hover === i ? 1 : 0.4, transition: 'opacity .12s' }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{i % 2 === 0 ? i : ''}</div>
          </div>
        ))}
      </div>
      {hover != null && perHour[hover].total > 0 && (
        <div style={{
          position: 'absolute', top: 150, left: `${leftPct}%`, transform: 'translateX(-50%)',
          zIndex: 20, width: 440, maxWidth: '94%',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,.18))', padding: 12,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
            {String(hover).padStart(2, '0')}:00 — {String((hover + 1) % 24).padStart(2, '0')}:00 · toplam {nf(perHour[hover].total)}
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <MiniTop title="🍽 En çok 15 yemek" color="var(--blue)" items={top7(perHour[hover].food)} />
              <div style={{ height: 10 }} />
              <MiniTop title="En az 15 yemek" color="var(--text-dim)" items={bottom7(perHour[hover].food)} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <MiniTop title="🥤 En çok 15 içecek" color="var(--gold)" items={top7(perHour[hover].drink)} />
              <div style={{ height: 10 }} />
              <MiniTop title="En az 15 içecek" color="var(--text-dim)" items={bottom7(perHour[hover].drink)} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function QrOrdersPage({ token }) {
  const [from, setFrom] = useState(daysAgo(0))
  const [to, setTo] = useState(daysAgo(0))
  const [unitId, setUnitId] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [configured, setConfigured] = useState(null)

  useEffect(() => {
    (async () => {
      try { const st = await api.qrStatus(token); setConfigured(!!st.configured) }
      catch { setConfigured(false) }
    })()
  }, [token])

  const runAnalysis = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const r = await api.qrBreakdown(token, { startDate: from, endDate: to })
      if (r && r.error) { setErr(r.error); setRows([]) }
      else setRows(asArr(r))
    } catch (e) { setErr(e.message || 'Veri alınamadı'); setRows([]) }
    setLoading(false)
  }, [token, from, to])

  useEffect(() => { if (configured) runAnalysis() }, [configured]) // eslint-disable-line

  // Şube listesi (veriden türetilir)
  const units = useMemo(() => {
    const m = new Map()
    for (const r of rows) m.set(r.restId, r.restName)
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  }, [rows])

  // Şube filtresi (şube karşılaştırması hariç her şeye uygulanır)
  const scoped = useMemo(() => unitId ? rows.filter(r => String(r.restId) === String(unitId)) : rows, [rows, unitId])
  const food = useMemo(() => scoped.filter(r => r.kind === 'food'), [scoped])
  const drink = useMemo(() => scoped.filter(r => r.kind === 'drink'), [scoped])

  const totalFood = useMemo(() => food.reduce((s, r) => s + r.value, 0), [food])
  const totalDrink = useMemo(() => drink.reduce((s, r) => s + r.value, 0), [drink])
  const total = totalFood + totalDrink
  const topFood = useMemo(() => topBy(food, r => r.name, 10), [food])
  const topDrink = useMemo(() => topBy(drink, r => r.name, 10), [drink])
  const foodVariety = useMemo(() => topBy(food, r => r.name).length, [food])
  const drinkVariety = useMemo(() => topBy(drink, r => r.name).length, [drink])
  const variety = foodVariety + drinkVariety
  const topAll = topBy(scoped, r => r.name, 1)[0]
  const foodPct = total ? Math.round((totalFood / total) * 100) : 0

  // Saatlik (0–23)
  const hourly = useMemo(() => {
    const buck = Array(24).fill(0)
    for (const r of scoped) { const h = parseInt(String(r.hour)); if (h >= 0 && h < 24) buck[h] += r.value }
    return buck.map((value, h) => ({ label: String(h), value }))
  }, [scoped])
  const peakHour = useMemo(() => hourly.reduce((a, b) => b.value > a.value ? b : a, { label: '-', value: 0 }), [hourly])

  // Günlük
  const daily = useMemo(() => {
    const m = new Map()
    for (const r of scoped) m.set(r.date, (m.get(r.date) || 0) + r.value)
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ label: date.slice(8, 10) + '.' + date.slice(5, 7), value }))
  }, [scoped])

  // Şube karşılaştırması (her zaman tüm şubeler)
  const branches = useMemo(() => topBy(rows, r => r.restName), [rows])

  const inputStyle = { padding: '8px 10px', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontFamily: 'inherit' }
  const scopeLabel = unitId ? (units.find(u => String(u.id) === String(unitId))?.name || 'Şube') : 'Şirket geneli'

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <QrCode size={22} /><h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>QR Siparişler</h1>
      </div>
      <div style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 20 }}>Otelde verilen QR siparişlerinin (DigyBI) tüketim analizi.</div>

      {configured === false && (
        <Card style={{ borderColor: 'var(--gold)', background: 'var(--gold-bg)', marginBottom: 16, display: 'flex', gap: 10 }}>
          <AlertTriangle size={18} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          <div style={{ fontSize: 13 }}><b>DigyBI kimlik bilgileri eksik.</b> Sunucuda <code>server/.env</code> içine <code>DIGYBI_CLIENT_ID/SECRET/COMPANY_ID</code> girilmeli.</div>
        </Card>
      )}

      {/* Filtre */}
      <Card style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div><div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Başlangıç</div>
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={inputStyle} /></div>
        <div><div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Bitiş</div>
          <input type="date" value={to} min={from} max={daysAgo(0)} onChange={e => setTo(e.target.value)} style={inputStyle} /></div>
        <div><div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Kapsam</div>
          <select value={unitId} onChange={e => setUnitId(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
            <option value="">Şirket geneli</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select></div>
        <button onClick={runAnalysis} disabled={loading || configured === false}
          style={{ padding: '9px 18px', fontSize: 14, fontWeight: 600, color: '#fff', background: 'var(--blue)', border: 'none', borderRadius: 6, cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, opacity: (loading || configured === false) ? 0.6 : 1 }}>
          <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
          {loading ? 'Yükleniyor…' : 'Analiz Et'}
        </button>
      </Card>

      {err && <Card style={{ borderColor: 'var(--red)', background: 'var(--red-bg)', marginBottom: 16, fontSize: 13, color: 'var(--red)' }}>{err}</Card>}

      {/* KPI */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Kpi label="Toplam Sipariş Adedi" value={nf(total)} sub={scopeLabel} />
        <Kpi label="Çeşit Sayısı" value={nf(variety)} sub={`${nf(foodVariety)} yemek · ${nf(drinkVariety)} içecek`} />
        <Kpi label="En Yoğun Saat" value={peakHour.value ? `${peakHour.label}:00` : '—'} sub={peakHour.value ? `${nf(peakHour.value)} adet` : 'Veri yok'} color="var(--gold)" />
        <Kpi label="En Çok Tüketilen" value={topAll ? nf(topAll.value) : '—'} sub={topAll ? topAll.name : 'Veri yok'} color="var(--green)" />
        <Kpi label="Yemek / İçecek" value={`%${foodPct} / %${100 - foodPct}`} sub={`${nf(totalFood)} / ${nf(totalDrink)}`} color="var(--blue)" />
      </div>

      {/* Saatlik */}
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle icon={<Clock size={16} style={{ color: 'var(--gold)' }} />} note={`${scopeLabel} · bara gelince o saatin top ürünleri`}>Saatlik Dağılım (00–23)</SectionTitle>
        <HourlyChart rows={scoped} />
      </Card>

      {/* Günlük */}
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle icon={<CalendarDays size={16} style={{ color: 'var(--blue)' }} />} note={scopeLabel}>Günlük Trend</SectionTitle>
        <VBars bars={daily} color="var(--blue)" labelEvery={daily.length > 16 ? 3 : 1} />
      </Card>

      {/* Yemek vs İçecek */}
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle>Yemek vs İçecek</SectionTitle>
        <div style={{ display: 'flex', height: 26, borderRadius: 6, overflow: 'hidden', background: 'var(--surface2)' }}>
          <div style={{ width: `${foodPct}%`, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 600 }}>{foodPct >= 10 && `Yemek %${foodPct}`}</div>
          <div style={{ width: `${100 - foodPct}%`, background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a1a1a', fontSize: 12, fontWeight: 600 }}>{(100 - foodPct) >= 10 && `İçecek %${100 - foodPct}`}</div>
        </div>
      </Card>

      {/* En çok tüketilenler */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <SectionTitle icon={<Utensils size={16} style={{ color: 'var(--blue)' }} />}>En Çok Tüketilen Yemekler</SectionTitle>
          <BarList rows={topFood} color="var(--blue)" empty="Bu aralıkta yemek yok" />
        </Card>
        <Card>
          <SectionTitle icon={<CupSoda size={16} style={{ color: 'var(--gold)' }} />}>En Çok Tüketilen İçecekler</SectionTitle>
          <BarList rows={topDrink} color="var(--gold)" empty="Bu aralıkta içecek yok" />
        </Card>
      </div>

      {/* Şube karşılaştırması */}
      <Card>
        <SectionTitle icon={<Store size={16} />} note="tüm şubeler">Şube Karşılaştırması (toplam adet)</SectionTitle>
        <BarList rows={branches} color="var(--green)" empty="Şube verisi yok" />
      </Card>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
