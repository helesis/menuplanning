import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Search, ChevronRight, X, TrendingDown, ArrowDownRight, Coins, CircleDollarSign, Star, Link2, Unlink, Sparkles, ChevronDown } from 'lucide-react'

const BOLUM_COLORS = {
  'ANA RESTORAN': { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  'ALA CARTE':    { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
}
const getBolumStyle = (b) => BOLUM_COLORS[b] || { bg: '#f5f5f7', color: '#555', border: '#e5e5e7' }

const fmt = (n, d = 2) => (n == null ? '—' : Number(n).toLocaleString('tr', { minimumFractionDigits: d, maximumFractionDigits: d }))

function coverageColor(c) {
  if (c >= 70) return '#16a34a'
  if (c >= 35) return '#f59e0b'
  return '#ef4444'
}

// Maliyet rozeti — ₺/100g öncelikli, yoksa toplam
function CostBadge({ r }) {
  const has100 = r.per100g != null && r.per100g > 0
  return (
    <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 96 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: r.total > 0 ? 'var(--gold)' : 'var(--text-xdim)' }}>
        {has100 ? `${fmt(r.per100g)} ₺` : r.total > 0 ? `${fmt(r.total)} ₺` : '—'}
        <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-xdim)' }}>{has100 ? ' /100g' : ''}</span>
      </div>
      <div style={{ fontSize: 10, color: coverageColor(r.coverage) }}>
        kapsama %{r.coverage}{r.liveCount > 0 ? ` · ${r.liveCount} canlı` : ''}
      </div>
    </div>
  )
}

export default function CostSuggestPage() {
  const [q, setQ]           = useState('')
  const [bolum, setBolum]   = useState('')
  const [tur, setTur]       = useState('')
  const [sort, setSort]     = useState('per100g')
  const [dir, setDir]       = useState('asc')
  const [onlyPriced, setOnlyPriced] = useState(true)
  const [meta, setMeta]     = useState({ bolumler: [], turler: [], count: 0 })
  const [items, setItems]   = useState([])
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [alts, setAlts]     = useState(null)
  const [altScope, setAltScope] = useState('bolum')
  const [detailLoading, setDetailLoading] = useState(false)
  const debounceRef = useRef(null)
  // Elle eşleştirme modalı
  const [mapIng, setMapIng]       = useState(null)   // eşleştirilen malzeme adı
  const [mapQ, setMapQ]           = useState('')
  const [mapResults, setMapResults] = useState([])
  const [mapBusy, setMapBusy]     = useState(false)
  const mapDebounce = useRef(null)
  // AI alternatifleri
  const [aiAlts, setAiAlts]       = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiErr, setAiErr]         = useState(null)
  const [aiOpen, setAiOpen]       = useState(null)   // açık alternatifin index'i (malzeme detayı)

  useEffect(() => {
    fetch('/api/cost-oneri/meta').then(r => r.json()).then(setMeta).catch(() => {})
  }, [])

  const load = useCallback((qVal, bolumVal, turVal, sortVal, dirVal, onlyP) => {
    setLoading(true)
    const params = new URLSearchParams({ sort: sortVal, dir: dirVal })
    if (qVal) params.set('q', qVal)
    if (bolumVal) params.set('bolum', bolumVal)
    if (turVal) params.set('tur', turVal)
    if (onlyP) params.set('onlyPriced', '1')
    fetch(`/api/cost-oneri/recipes?${params}`)
      .then(r => r.json())
      .then(d => { setItems(d.items || []); setTotal(d.total || 0); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load(q, bolum, tur, sort, dir, onlyPriced), 250)
    return () => clearTimeout(debounceRef.current)
  }, [q, bolum, tur, sort, dir, onlyPriced, load])

  const loadAlts = useCallback((y_no, scope) => {
    fetch(`/api/cost-oneri/alternatives/${y_no}?scope=${scope}`)
      .then(r => r.json()).then(setAlts).catch(() => setAlts(null))
  }, [])

  const openDetail = (y_no) => {
    setSelected(y_no)
    setDetail(null); setAlts(null)
    setAiAlts(null); setAiErr(null); setAiOpen(null)
    setDetailLoading(true)
    fetch(`/api/recipes/${y_no}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setDetailLoading(false) })
      .catch(() => setDetailLoading(false))
    loadAlts(y_no, altScope)
  }

  const changeScope = (s) => { setAltScope(s); if (selected) loadAlts(selected, s) }

  // AI alternatif üret (talep üzerine; cache'li)
  const genAiAlts = (force = false) => {
    if (!selected) return
    setAiLoading(true); setAiErr(null)
    fetch('/api/cost-oneri/ai-alternatif', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ y_no: selected, force }),
    })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Hata'); return d })
      .then(d => { setAiAlts(d); setAiLoading(false) })
      .catch(e => { setAiErr(e.message); setAiLoading(false) })
  }

  // ── Elle eşleştirme ──
  const openMap = (ingredient) => { setMapIng(ingredient); setMapQ(ingredient); setMapResults([]) }
  const closeMap = () => { setMapIng(null); setMapQ(''); setMapResults([]) }

  useEffect(() => {
    if (mapIng == null) return
    clearTimeout(mapDebounce.current)
    const q = mapQ.trim()
    if (q.length < 2) { setMapResults([]); return }
    mapDebounce.current = setTimeout(() => {
      fetch(`/api/cost-oneri/stok-ara?q=${encodeURIComponent(q)}`)
        .then(r => r.json()).then(d => setMapResults(Array.isArray(d) ? d : [])).catch(() => setMapResults([]))
    }, 250)
    return () => clearTimeout(mapDebounce.current)
  }, [mapQ, mapIng])

  const saveMap = (ingredient, stok) => {
    setMapBusy(true)
    fetch('/api/cost-oneri/eslestir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredient, stok }),
    })
      .then(r => r.json())
      .then(() => {
        setMapBusy(false); closeMap()
        if (selected) openDetail(selected)                 // detayı tazele (yeni fiyat görünür)
        load(q, bolum, tur, sort, dir, onlyPriced)          // listeyi tazele
      })
      .catch(() => setMapBusy(false))
  }

  const SortBtn = ({ val, label }) => (
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => { if (sort === val) setDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSort(val); setDir(val === 'coverage' ? 'desc' : 'asc') } }}
      style={{ fontWeight: sort === val ? 700 : 500, color: sort === val ? 'var(--gold)' : 'var(--text-dim)' }}
    >
      {label}{sort === val ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  )

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* SOL: Maliyete göre sıralı havuz */}
      <div style={{ flex: selected ? '0 0 520px' : '1', display: 'flex', flexDirection: 'column', borderRight: selected ? '1px solid var(--border)' : 'none', overflow: 'hidden' }}>
        <div className="page-header" style={{ flexShrink: 0 }}>
          <div>
            <div className="page-title">Maliyet Önerileri</div>
            <div className="page-sub">{total.toLocaleString('tr')} reçete · en son maliyet raporu fiyatlarıyla</div>
          </div>
        </div>

        {/* Filtreler */}
        <div style={{ padding: '10px 24px', display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input className="form-input" placeholder="Reçete ara..." value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: 32, width: '100%' }} />
          </div>
          <select className="form-select" value={bolum} onChange={e => setBolum(e.target.value)} style={{ width: 160 }}>
            <option value="">Tüm bölümler</option>
            {meta.bolumler.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select className="form-select" value={tur} onChange={e => setTur(e.target.value)} style={{ width: 180 }}>
            <option value="">Tüm türler</option>
            {meta.turler.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Sıralama + filtre satırı */}
        <div style={{ padding: '6px 18px', display: 'flex', gap: 4, alignItems: 'center', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text-xdim)', marginRight: 4 }}>Sırala:</span>
          <SortBtn val="per100g" label="₺/100g" />
          <SortBtn val="total" label="₺/porsiyon" />
          <SortBtn val="coverage" label="Kapsama" />
          <label style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)', display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyPriced} onChange={e => setOnlyPriced(e.target.checked)} />
            sadece fiyatlı
          </label>
        </div>

        {/* Liste */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <div className="loading"><div className="spinner" /> Yükleniyor...</div>}
          {!loading && items.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>Reçete bulunamadı</div>
          )}
          {!loading && items.map(r => {
            const st = getBolumStyle(r.bolum)
            const isActive = selected === r.y_no
            return (
              <div key={r.y_no} onClick={() => openDetail(r.y_no)}
                style={{ padding: '11px 18px 11px 24px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  background: isActive ? 'var(--gold-bg)' : 'transparent', display: 'flex', alignItems: 'center', gap: 10, transition: 'background .15s' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.adi}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{r.bolum}</span>
                    {r.tur && r.tur !== 'PASİF' && <span style={{ fontSize: 11, color: 'var(--text-xdim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{r.tur}</span>}
                  </div>
                </div>
                <CostBadge r={r} />
                <ChevronRight size={14} style={{ color: 'var(--text-xdim)', flexShrink: 0 }} />
              </div>
            )
          })}
        </div>
      </div>

      {/* SAĞ: Detay + ucuz alternatifler */}
      {selected && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
            {detail ? (
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{detail.adi}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {detail.bolum && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, ...getBolumStyle(detail.bolum), border: `1px solid ${getBolumStyle(detail.bolum).border}` }}>{detail.bolum}</span>}
                  {detail.tur && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{detail.tur}</span>}
                </div>
              </div>
            ) : <div />}
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setSelected(null); setDetail(null); setAlts(null) }}><X size={14} /></button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
            {detailLoading && <div className="loading"><div className="spinner" /> Yükleniyor...</div>}

            {/* Maliyet özeti */}
            {detail && detail.total != null && (
              <div style={{ margin: '16px 0', padding: 16, borderRadius: 10, background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', display: 'flex', gap: 24, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <CircleDollarSign size={20} style={{ color: 'var(--gold)' }} />
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>{fmt(detail.total)} <span style={{ fontSize: 13 }}>₺</span></div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>toplam reçete</div>
                </div>
                {detail.per100g != null && (
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>{fmt(detail.per100g)} <span style={{ fontSize: 13 }}>₺</span></div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>100g başına · {detail.totalGrams}g</div>
                  </div>
                )}
              </div>
            )}

            {/* Daha ucuz alternatifler */}
            {alts && (
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingDown size={15} style={{ color: '#16a34a' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Daha ucuz benzer reçeteler</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => changeScope('bolum')} style={{ fontWeight: altScope === 'bolum' ? 700 : 500, color: altScope === 'bolum' ? 'var(--gold)' : 'var(--text-dim)' }}>Aynı bölüm</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => changeScope('tur')} style={{ fontWeight: altScope === 'tur' ? 700 : 500, color: altScope === 'tur' ? 'var(--gold)' : 'var(--text-dim)' }}>Aynı tür</button>
                  </div>
                </div>
                {alts.alternatives && alts.alternatives.length > 0 ? (
                  <table style={{ width: '100%', fontSize: 12 }}>
                    <tbody>
                      {alts.alternatives.map(a => (
                        <tr key={a.y_no} onClick={() => openDetail(a.y_no)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '9px 16px', color: 'var(--text)' }}>{a.adi}</td>
                          <td style={{ padding: '9px 8px', textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--gold)', fontWeight: 600 }}>
                            {fmt(alts.metric === 'per100g' ? a.per100g : a.total)} ₺{alts.metric === 'per100g' ? '/100g' : ''}
                          </td>
                          <td style={{ padding: '9px 16px 9px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: '#16a34a', fontWeight: 700 }}>
                              <ArrowDownRight size={12} />%{a.savingPct}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                    Bu reçeteden daha ucuz benzer reçete bulunamadı — {altScope === 'tur' ? 'aynı türde' : 'aynı bölümde'} en uygunlardan biri olabilir. 👍
                  </div>
                )}
              </div>
            )}

            {/* AI ucuz alternatifler (tarif AI'dan, fiyat cost'tan) */}
            {detail && (
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16, border: '1px solid var(--gold-border)' }}>
                <div style={{ padding: '10px 16px', background: 'var(--gold-bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={15} style={{ color: 'var(--gold)' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>AI ile uygun maliyetli alternatifler</span>
                  {aiAlts && (
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'var(--text-dim)' }} disabled={aiLoading} onClick={() => genAiAlts(true)}>
                      ↻ Yeniden üret
                    </button>
                  )}
                </div>

                {!aiAlts && !aiLoading && !aiErr && (
                  <div style={{ padding: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
                      Bu yemek yerine sunulabilecek <strong>10 daha ucuz alternatif</strong> yemeği AI üretsin; fiyatlar cost'tan hesaplanır.
                    </div>
                    <button className="btn btn-sm" style={{ background: 'var(--gold)', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => genAiAlts(false)}>
                      <Sparkles size={14} /> Alternatif üret
                    </button>
                  </div>
                )}
                {aiLoading && <div className="loading"><div className="spinner" /> AI alternatifleri üretiyor… (~5-15 sn)</div>}
                {aiErr && (
                  <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: '#ef4444' }}>
                    {aiErr} · <button className="btn btn-ghost btn-sm" onClick={() => genAiAlts(true)}>tekrar dene</button>
                  </div>
                )}

                {aiAlts && aiAlts.alternatives && (
                  <table style={{ width: '100%', fontSize: 12 }}>
                    <tbody>
                      {aiAlts.alternatives.map((a, i) => {
                        const refP = aiAlts.ref.per100g
                        return (
                          <React.Fragment key={i}>
                            <tr onClick={() => setAiOpen(aiOpen === i ? null : i)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <td style={{ padding: '9px 8px 9px 16px', width: 18 }}>
                                <ChevronDown size={13} style={{ color: 'var(--text-xdim)', transform: aiOpen === i ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
                              </td>
                              <td style={{ padding: '9px 8px', color: 'var(--text)', fontWeight: 500 }}>
                                {a.name}
                                <span style={{ marginLeft: 6, fontSize: 10, color: coverageColor(a.coverage) }}>kapsama %{a.coverage}</span>
                              </td>
                              <td style={{ padding: '9px 8px', textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--gold)', fontWeight: 600 }}>
                                {a.per100g != null ? `${fmt(a.per100g)} ₺/100g` : '—'}
                              </td>
                              <td style={{ padding: '9px 16px 9px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                {a.savingPct != null && a.savingPct > 0
                                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: '#16a34a', fontWeight: 700 }}><ArrowDownRight size={12} />%{a.savingPct}</span>
                                  : a.savingPct != null
                                    ? <span style={{ color: '#ef4444', fontWeight: 600 }}>+%{Math.abs(a.savingPct)}</span>
                                    : <span style={{ color: 'var(--text-xdim)' }}>—</span>}
                              </td>
                            </tr>
                            {aiOpen === i && (
                              <tr><td colSpan={4} style={{ padding: '4px 16px 12px 38px', background: 'var(--surface)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-dim)', display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                                  {a.ingredients.map((ing, j) => (
                                    <span key={j} style={{ color: ing.matchedStok ? 'var(--text)' : '#b45309' }}>
                                      {ing.name} <span style={{ color: 'var(--text-xdim)' }}>{ing.miktar}{ing.birim}</span>
                                      {ing.maliyet > 0 ? ` · ${fmt(ing.maliyet)}₺` : ' · ○'}
                                    </span>
                                  ))}
                                </div>
                              </td></tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                )}
                {aiAlts && (
                  <div style={{ padding: '8px 16px', fontSize: 10, color: 'var(--text-xdim)', borderTop: '1px solid var(--border)' }}>
                    Tarifler AI üretimi (tahmini), fiyatlar cost canlı listesinden. ○ = fiyatı eşleşmeyen malzeme. Karşılaştırma ₺/100g üzerinden.
                  </div>
                )}
              </div>
            )}

            {/* Malzeme kırılımı */}
            {detail && detail.detail && detail.detail.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Coins size={14} /> MALZEME MALİYETİ
                </div>
                <table style={{ width: '100%', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface)' }}>
                      <th style={{ padding: '8px 16px', textAlign: 'left', color: 'var(--text-dim)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Malzeme</th>
                      <th style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-dim)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Miktar</th>
                      <th style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-dim)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Maliyet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...detail.detail].sort((a, b) => b.maliyet - a.maliyet).map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 16px', color: 'var(--text)' }}>
                          {row.ingredient}
                          {row.source === 'live' && <span title="Canlı alış fiyatı" style={{ marginLeft: 5, fontSize: 9, color: '#16a34a' }}>● canlı</span>}
                          {row.source === 'manual' && (
                            <button onClick={() => openMap(row.ingredient)} title="Elle eşleştirildi — değiştir"
                              style={{ marginLeft: 5, fontSize: 9, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                              <Link2 size={10} /> eşlendi
                            </button>
                          )}
                          {!(row.fiyat > 0) && (
                            <button onClick={() => openMap(row.ingredient)} title="Cost listesinden ürün seçerek fiyat eşleştir"
                              style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 5, cursor: 'pointer', padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Star size={11} fill="#f59e0b" stroke="#f59e0b" /> fiyat yok · eşle
                            </button>
                          )}
                        </td>
                        <td style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-dim)' }}>{row.miktar} {row.birim}</td>
                        <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: row.maliyet > 0 ? 600 : 400, color: row.maliyet > 0 ? 'var(--text)' : 'var(--text-xdim)' }}>
                          {row.maliyet > 0 ? `${fmt(row.maliyet)} ₺` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--surface)' }}>
                      <td colSpan={2} style={{ padding: '10px 16px', fontWeight: 700, fontSize: 13 }}>TOPLAM</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: 'var(--gold)' }}>{fmt(detail.total)} ₺</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Elle eşleştirme modalı — cost güncel ürün listesinden seç */}
      {mapIng != null && (
        <div onClick={closeMap} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 560, maxWidth: '92vw', maxHeight: '70vh', display: 'flex', flexDirection: 'column', background: 'var(--bg, #fff)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 12px 40px rgba(0,0,0,.25)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Star size={16} fill="#f59e0b" stroke="#f59e0b" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Cost ürünüyle eşleştir</div>
                <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mapIng}</div>
              </div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={closeMap}><X size={14} /></button>
            </div>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input className="form-input" autoFocus placeholder="Cost listesinde ara (en son dönem fiyatlı ürünler)..." value={mapQ} onChange={e => setMapQ(e.target.value)} style={{ paddingLeft: 32, width: '100%' }} />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {mapQ.trim().length < 2 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>Aramak için en az 2 harf yazın.</div>}
              {mapQ.trim().length >= 2 && mapResults.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>Eşleşen cost ürünü bulunamadı.</div>}
              {mapResults.map(m => (
                <div key={m.stok} onClick={() => !mapBusy && saveMap(mapIng, m.stok)}
                  style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', cursor: mapBusy ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Link2 size={13} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{m.stok}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)', whiteSpace: 'nowrap' }}>{fmt(m.fiyatKg)} ₺/kg</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => !mapBusy && saveMap(mapIng, '')} style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Unlink size={13} /> Eşleştirmeyi kaldır
              </button>
              <span style={{ fontSize: 11, color: 'var(--text-xdim)' }}>{mapBusy ? 'Kaydediliyor…' : 'Bir ürüne tıkla → eşleştir'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
