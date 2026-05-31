import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Search, ChevronRight, X, TrendingUp, AlertTriangle } from 'lucide-react'

const ALLERGEN_LABELS = {
  gluten: 'Gluten', kabuklu: 'Kabuklu', yumurta: 'Yumurta', balik: 'Balık',
  fistik: 'Fıstık', soya: 'Soya', sut: 'Süt', sertkabuk: 'Sert Kabuk',
  kereviz: 'Kereviz', hardal: 'Hardal', susam: 'Susam', so2: 'SO₂',
  bal: 'Bal', et: 'Et',
}

const BOLUM_COLORS = {
  'ANA RESTORAN': { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  'ALA CARTE':    { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
}

function getBolumStyle(bolum) {
  return BOLUM_COLORS[bolum] || { bg: '#f5f5f7', color: '#555', border: '#e5e5e7' }
}

export default function RecipesPage({ toast }) {
  const [q, setQ]             = useState('')
  const [bolum, setBolum]     = useState('')
  const [bolumler, setBolumler] = useState([])
  const [recipes, setRecipes] = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail]   = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const debounceRef = useRef(null)
  const LIMIT = 50

  useEffect(() => {
    fetch('/api/recipe-bolumler').then(r => r.json()).then(setBolumler)
  }, [])

  const load = useCallback((qVal, bolumVal, pageVal) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: LIMIT, page: pageVal })
    if (qVal) params.set('q', qVal)
    if (bolumVal) params.set('bolum', bolumVal)
    fetch(`/api/recipes?${params}`)
      .then(r => r.json())
      .then(d => { setRecipes(d.items); setTotal(d.total); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      load(q, bolum, 1)
    }, 300)
  }, [q, bolum])

  useEffect(() => { load(q, bolum, page) }, [page])

  const openDetail = (y_no) => {
    setSelected(y_no)
    setDetail(null)
    setDetailLoading(true)
    fetch(`/api/recipes/${y_no}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setDetailLoading(false) })
      .catch(() => setDetailLoading(false))
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* SOL: Liste */}
      <div style={{ flex: selected ? '0 0 480px' : '1', display: 'flex', flexDirection: 'column', borderRight: selected ? '1px solid var(--border)' : 'none', overflow: 'hidden' }}>

        {/* Header */}
        <div className="page-header" style={{ flexShrink: 0 }}>
          <div>
            <div className="page-title">Reçeteler</div>
            <div className="page-sub">{total.toLocaleString('tr')} reçete</div>
          </div>
        </div>

        {/* Filtreler */}
        <div style={{ padding: '10px 24px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              className="form-input"
              placeholder="Reçete ara..."
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{ paddingLeft: 32, width: '100%' }}
            />
          </div>
          <select className="form-select" value={bolum} onChange={e => setBolum(e.target.value)} style={{ width: 180 }}>
            <option value="">Tüm bölümler</option>
            {bolumler.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* Liste */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <div className="loading"><div className="spinner" /> Yükleniyor...</div>}
          {!loading && recipes.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>Reçete bulunamadı</div>
          )}
          {!loading && recipes.map(r => {
            const st = getBolumStyle(r.bolum)
            const isActive = selected === r.y_no
            return (
              <div
                key={r.y_no}
                onClick={() => openDetail(r.y_no)}
                style={{
                  padding: '12px 24px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: isActive ? 'var(--gold-bg)' : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'background .15s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.adi}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                      {r.bolum}
                    </span>
                    {r.tur && r.tur !== 'PASİF' && (
                      <span style={{ fontSize: 11, color: 'var(--text-xdim)' }}>{r.tur}</span>
                    )}
                    {r.tur === 'PASİF' && (
                      <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>PASİF</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>
                  {r.ingredientCount} malzeme
                </div>
                <ChevronRight size={14} style={{ color: 'var(--text-xdim)', flexShrink: 0 }} />
              </div>
            )
          })}
        </div>

        {/* Sayfalama */}
        {totalPages > 1 && (
          <div style={{ padding: '10px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'center', flexShrink: 0 }}>
            <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Önceki</button>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', alignSelf: 'center' }}>{page} / {totalPages}</span>
            <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Sonraki →</button>
          </div>
        )}
      </div>

      {/* SAĞ: Detay */}
      {selected && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Detay header */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
            {detail ? (
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{detail.adi}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {detail.bolum && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, ...getBolumStyle(detail.bolum), border: `1px solid ${getBolumStyle(detail.bolum).border}` }}>
                      {detail.bolum}
                    </span>
                  )}
                  {detail.tur && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{detail.tur}</span>}
                </div>
              </div>
            ) : <div />}
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setSelected(null); setDetail(null) }}>
              <X size={14} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
            {detailLoading && <div className="loading"><div className="spinner" /> Yükleniyor...</div>}
            {detail && <RecipeDetail detail={detail} />}
          </div>
        </div>
      )}

      {/* Detay açık değilse orta boş mesaj */}
      {!selected && !loading && recipes.length > 0 && (
        <div style={{ display: 'none' }} />
      )}
    </div>
  )
}

function RecipeDetail({ detail }) {
  const allergenList = detail.detail
    ? [...new Set(detail.detail.flatMap(r => {
        // allergen bilgisi için inglist'e bakmak lazım; şimdilik sadece maliyet göster
        return []
      }))]
    : []

  const hasPrice = detail.detail && detail.detail.some(r => r.fiyat > 0)
  const liveCount = detail.detail ? detail.detail.filter(r => r.source === 'live').length : 0

  return (
    <div>
      {/* Maliyet özeti */}
      {detail.total != null && (
        <div style={{
          margin: '16px 0', padding: 16, borderRadius: 10,
          background: 'var(--gold-bg)', border: '1px solid var(--gold-border)',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <TrendingUp size={20} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>
                  {detail.total.toFixed(2)} <span style={{ fontSize: 14 }}>TL</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>toplam reçete</div>
              </div>
              {detail.per100g != null && (
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>
                    {detail.per100g.toFixed(2)} <span style={{ fontSize: 14 }}>TL</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    100g başına · {detail.totalGrams}g toplam
                  </div>
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
              {detail.detail?.length} malzeme
              {liveCount > 0 && <span style={{ color: '#16a34a', marginLeft: 8 }}>● {liveCount} canlı fiyat</span>}
              {!hasPrice && <span style={{ color: '#f59e0b', marginLeft: 8 }}>⚠ Bazı fiyatlar eksik</span>}
            </div>
          </div>
        </div>
      )}

      {/* Malzeme tablosu */}
      {detail.detail && detail.detail.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>
            MALZEMEler
          </div>
          <table style={{ width: '100%', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface)' }}>
                <th style={{ padding: '8px 16px', textAlign: 'left', color: 'var(--text-dim)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Malzeme</th>
                <th style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-dim)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Miktar</th>
                <th style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-dim)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Birim Fiyat</th>
                <th style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-dim)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Maliyet</th>
              </tr>
            </thead>
            <tbody>
              {detail.detail.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 16px', color: 'var(--text)' }}>{row.ingredient}</td>
                  <td style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-dim)' }}>
                    {row.miktar} {row.birim}
                  </td>
                  <td style={{ padding: '8px 16px', textAlign: 'right', color: row.source === 'live' ? '#16a34a' : row.fiyat > 0 ? 'var(--text-dim)' : '#fbbf24' }}>
                    {row.fiyat > 0 ? `${row.fiyat.toFixed(4)} TL/${row.birim}` : '—'}
                    {row.source === 'live' && <span title="Canlı alış fiyatı" style={{ marginLeft: 4, fontSize: 10 }}>●</span>}
                  </td>
                  <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: row.maliyet > 0 ? 600 : 400, color: row.maliyet > 0 ? 'var(--text)' : 'var(--text-xdim)' }}>
                    {row.maliyet > 0 ? `${row.maliyet.toFixed(2)} TL` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--surface)' }}>
                <td colSpan={3} style={{ padding: '10px 16px', fontWeight: 700, fontSize: 13 }}>TOPLAM</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: 'var(--gold)' }}>
                  {detail.total.toFixed(2)} TL
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {detail.detail?.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)' }}>
          Bu reçete için malzeme kaydı bulunamadı.
        </div>
      )}
    </div>
  )
}
