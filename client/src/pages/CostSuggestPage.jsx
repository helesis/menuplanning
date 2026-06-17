import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Search, ChevronRight, X, TrendingDown, ArrowDownRight, Coins, CircleDollarSign } from 'lucide-react'

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
    setDetailLoading(true)
    fetch(`/api/recipes/${y_no}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setDetailLoading(false) })
      .catch(() => setDetailLoading(false))
    loadAlts(y_no, altScope)
  }

  const changeScope = (s) => { setAltScope(s); if (selected) loadAlts(selected, s) }

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
                          {!(row.fiyat > 0) && <span title="Fiyat eşleşmedi" style={{ marginLeft: 5, fontSize: 9, color: '#ef4444' }}>○ fiyat yok</span>}
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
    </div>
  )
}
