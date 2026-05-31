import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Utensils, Leaf, Sprout, Flame, Snowflake, Cake, Trash2, BookOpen, X, TrendingUp } from 'lucide-react'
import * as api from '../api.js'

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
const DAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

const SECTIONS = [
  { id: 'hot',     label: 'Sıcak Yemekler', icon: <Flame size={14} />,     color: 'var(--yellow)',  bg: 'var(--yellow-bg)' },
  { id: 'cold',    label: 'Soğuk Yemekler', icon: <Snowflake size={14} />, color: 'var(--blue)',    bg: 'var(--blue-bg)' },
  { id: 'dessert', label: 'Tatlılar',        icon: <Cake size={14} />,      color: 'var(--gold)',    bg: 'var(--gold-bg)' },
  { id: null,      label: 'Diğer',           icon: <Utensils size={14} />,  color: 'var(--text-dim)',bg: 'var(--bg)' },
]

export default function StationViewPage() {
  const [menus, setMenus] = useState([])
  const [selectedDay, setSelectedDay] = useState(1)
  const [selectedMeal, setSelectedMeal] = useState('lunch')
  const [menu, setMenu] = useState(null)
  const [loading, setLoading] = useState(false)
  const [recipeMatches, setRecipeMatches] = useState({}) // dishName → [{ y_no, adi, matchType }]
  const [activePanel, setActivePanel]     = useState(null) // { key, type, recipes }

  // Dışarı tıklayınca paneli kapat
  useEffect(() => {
    if (!activePanel) return
    const close = (e) => {
      if (!e.target.closest('.rm-chip') && !e.target.closest('.recipe-panel')) {
        setActivePanel(null)
      }
    }
    // setTimeout ile bu tıklamayı atla, sonraki tıklamaları dinle
    const timer = setTimeout(() => {
      document.addEventListener('click', close)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', close)
    }
  }, [activePanel])

  useEffect(() => {
    api.getMenus().then(setMenus)
  }, [])

  useEffect(() => {
    const summary = menus.find(m => m.day_of_week === selectedDay && m.meal_type === selectedMeal)
    if (!summary) return
    setLoading(true)
    setActivePanel(null)
    api.getMenu(summary.id).then(m => {
      setMenu(m)
      setLoading(false)
      // Tüm yemek adlarını topla, reçete eşleştirme yap
      const names = [...new Set(m.stations.flatMap(s => s.dishes.map(d => d.name)))]
      fetch('/api/recipe-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names }),
      }).then(r => r.json()).then(setRecipeMatches).catch(() => {})
    })
  }, [selectedDay, selectedMeal, menus])

  const deleteSection = async (sectionId) => {
    if (!menu) return
    const stations = menu.stations.filter(s =>
      sectionId === null
        ? !s.section || !SECTIONS.slice(0, 3).find(x => x.id === s.section)
        : s.section === sectionId
    )
    await Promise.all(stations.map(s => api.deleteStation(s.id)))
    const updated = await api.getMenu(menu.id)
    setMenu(updated)
  }

  // Bölümlere göre grupla
  const grouped = SECTIONS.map(sec => ({
    ...sec,
    stations: (menu?.stations || []).filter(s =>
      sec.id === null
        ? !s.section || !SECTIONS.slice(0, 3).find(x => x.id === s.section)
        : s.section === sec.id
    ),
  })).filter(sec => sec.stations.length > 0)

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">İstasyon Görünümü</div>
          <div className="page-sub">
            {menu?.theme || `${DAYS[selectedDay - 1]} — ${selectedMeal === 'lunch' ? 'Öğle' : 'Akşam'}`}
          </div>
        </div>
      </div>

      {/* Seçiciler */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '12px 32px', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {DAYS.map((day, i) => (
            <button
              key={i}
              className={`tab-btn${selectedDay === i + 1 ? ' active' : ''}`}
              style={{ padding: '6px 14px' }}
              onClick={() => setSelectedDay(i + 1)}
            >
              <span style={{ display: 'none' }} className="day-short">{DAYS_SHORT[i]}</span>
              <span className="day-full">{day}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
          {[['lunch', 'Öğle'], ['dinner', 'Akşam']].map(([val, label]) => (
            <button
              key={val}
              className={`tab-btn${selectedMeal === val ? ' active' : ''}`}
              onClick={() => setSelectedMeal(val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {loading && <div className="loading"><div className="spinner" /> Yükleniyor...</div>}

        {!loading && menu && menu.stations.length === 0 && (
          <div className="loading" style={{ color: 'var(--text-xdim)' }}>
            Bu öğün için henüz istasyon eklenmemiş.
          </div>
        )}

        {!loading && grouped.map(sec => (
          <div key={sec.id ?? 'other'} style={{ marginBottom: 32 }}>
            {/* Bölüm başlığı */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 16px', borderRadius: 10,
                background: sec.bg, color: sec.color,
                fontWeight: 700, fontSize: 13, letterSpacing: '.04em',
              }}>
                {sec.icon} {sec.label.toUpperCase()}
                <span style={{ fontWeight: 400, fontSize: 12, color: sec.color, opacity: .7 }}>
                  — {sec.stations.length} istasyon
                </span>
              </div>
              <button
                className="btn btn-ghost btn-sm btn-icon"
                title="Bu bölümü sil"
                style={{ color: 'var(--red)', opacity: .7 }}
                onClick={() => {
                  if (confirm(`"${sec.label}" bölümündeki tüm istasyonlar silinecek. Emin misin?`)) {
                    deleteSection(sec.id)
                  }
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* İstasyon kartları */}
            <div className="station-view-grid">
              {sec.stations.map(station => (
                <div key={station.id} className="station-view-card">
                  <div className="station-view-header" style={{ borderLeft: `3px solid ${sec.color}` }}>
                    {station.name}
                  </div>
                  <div className="station-view-body">
                    {station.dishes.length === 0 && (
                      <div style={{ color: 'var(--text-xdim)', fontSize: 12, padding: '8px 0' }}>Yemek yok</div>
                    )}
                    {station.dishes.map(dish => (
                      <div key={dish.id} className="station-view-dish">
                        <span className="station-view-dish-name">
                          <Utensils size={11} style={{ flexShrink: 0, color: 'var(--text-xdim)' }} />
                          {dish.name}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          {dish.is_vegan
                            ? <span className="badge badge-green" style={{ fontSize: 10 }}><Sprout size={9} /> Vegan</span>
                            : dish.is_vegetarian
                            ? <span className="badge badge-blue" style={{ fontSize: 10 }}><Leaf size={9} /> Vej.</span>
                            : null}
                          {recipeMatches[dish.name]?.length > 0 && (
                            <RecipeMatchIcon
                              dishKey={dish.id}
                              matches={recipeMatches[dish.name]}
                              activePanel={activePanel}
                              setActivePanel={setActivePanel}
                            />
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .station-view-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 14px;
        }
        .station-view-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow);
          overflow: hidden;
        }
        .station-view-header {
          background: var(--bg);
          border-bottom: 1px solid var(--border);
          padding: 9px 14px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text);
        }
        .station-view-body { padding: 8px 14px 12px; }
        .station-view-dish {
          display: flex; align-items: center; justify-content: space-between;
          gap: 8px; padding: 5px 0;
          border-bottom: 1px solid var(--border); font-size: 13px;
        }
        .station-view-dish:last-child { border-bottom: none; }
        .station-view-dish-name {
          display: flex; align-items: center; gap: 7px;
          flex: 1; color: var(--text); min-width: 0;
        }
        .rm-chip {
          position: relative; display: inline-flex; align-items: center;
          cursor: default;
        }
        .rm-chip .rm-tooltip {
          display: none;
          position: absolute; bottom: calc(100% + 7px); right: 0;
          background: #1d1d1f; color: #fff;
          font-size: 11px; line-height: 1.6;
          padding: 8px 12px; border-radius: 8px;
          z-index: 200;
          box-shadow: 0 4px 16px rgba(0,0,0,.3);
          min-width: 180px; max-width: 300px;
          white-space: normal; word-break: break-word;
        }
        .rm-chip:hover .rm-tooltip { display: block; }
        .rm-chip .rm-tooltip::after {
          content: ''; position: absolute; top: 100%; right: 7px;
          border: 5px solid transparent; border-top-color: #1d1d1f;
        }
        @media (max-width: 900px) {
          .day-full { display: none !important; }
          .day-short { display: inline !important; }
        }
      `}</style>

      {/* Global reçete paneli — tek, tüm sayfanın dışında */}
      {activePanel && (
        <RecipePanel
          type={activePanel.type}
          recipes={activePanel.recipes}
          onClose={() => setActivePanel(null)}
        />
      )}
    </>
  )
}

// Eşleşme tiplerine göre ikon rengi ve etiketi
const MATCH_TYPES = [
  { key: 'name_exact',         color: '#22c55e', label: 'Tam Eşleşme' },
  { key: 'name_partial',       color: '#3b82f6', label: 'Ad Benzerliği' },
  { key: 'ingredient_exact',   color: '#f59e0b', label: 'Malzeme Olarak' },
  { key: 'ingredient_partial', color: '#a78bfa', label: 'Malzeme Benzerliği' },
]

function RecipeMatchIcon({ dishKey, matches, activePanel, setActivePanel }) {
  if (!matches || matches.length === 0) return null

  // Tipe göre grupla
  const byType = {}
  for (const m of matches) {
    if (!byType[m.matchType]) byType[m.matchType] = []
    byType[m.matchType].push(m)
  }

  const handleClick = (e, type, recipes) => {
    e.nativeEvent.stopImmediatePropagation()
    const panelKey = `${dishKey}_${type}`
    setActivePanel(prev =>
      prev?.key === panelKey ? null : { key: panelKey, type, recipes }
    )
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {MATCH_TYPES.filter(t => byType[t.key]).map(t => {
        const panelKey = `${dishKey}_${t.key}`
        const isOpen = activePanel?.key === panelKey
        return (
          <span
            key={t.key}
            className="rm-chip"
            title={t.label}
            onClick={e => handleClick(e, t.key, byType[t.key])}
            style={{ cursor: 'pointer', background: isOpen ? t.color + '22' : 'transparent', borderRadius: 3, padding: '1px 2px' }}
          >
            <BookOpen size={12} style={{ color: t.color }} />
          </span>
        )
      })}
    </span>
  )
}

function RecipePanel({ type, recipes, onClose }) {
  const typeInfo  = MATCH_TYPES.find(t => t.key === type)
  const [selected, setSelected] = useState(recipes[0]?.y_no)
  const [detail, setDetail]     = useState(null)
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    setDetail(null)
    fetch(`/api/recipes/${selected}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [selected])

  return (
    <div
      className="recipe-panel"
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        bottom: 24, right: 24,
        width: 420, maxHeight: '75vh',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 8px 40px rgba(0,0,0,.18)',
        zIndex: 1000,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Panel başlık */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: typeInfo.color + '14',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={14} style={{ color: typeInfo.color }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: typeInfo.color, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {typeInfo.label}
          </span>
        </div>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={13} /></button>
      </div>

      {/* Reçete seçici (birden fazlaysa) */}
      {recipes.length > 1 && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {recipes.map(r => (
            <button
              key={r.y_no}
              onClick={() => setSelected(r.y_no)}
              style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', border: 'none',
                background: selected === r.y_no ? typeInfo.color : 'var(--bg)',
                color: selected === r.y_no ? '#fff' : 'var(--text)',
                fontWeight: selected === r.y_no ? 700 : 400,
              }}
            >
              {r.adi}
            </button>
          ))}
        </div>
      )}

      {/* İçerik */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)' }}><div className="spinner" /></div>}
        {detail && (
          <>
            {/* Başlık */}
            <div style={{ padding: '12px 0 8px', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{detail.adi}</div>
              {detail.tur && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{detail.tur}</div>}
            </div>

            {/* Maliyet özeti */}
            {detail.total != null && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 10, marginBottom: 14,
                background: 'var(--gold-bg)', border: '1px solid var(--gold-border)',
              }}>
                <TrendingUp size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)' }}>{detail.total.toFixed(2)}</span>
                      <span style={{ fontSize: 11, color: 'var(--gold)', marginLeft: 3 }}>TL toplam</span>
                    </div>
                    {detail.per100g != null && (
                      <div>
                        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)' }}>{detail.per100g.toFixed(2)}</span>
                        <span style={{ fontSize: 11, color: 'var(--gold)', marginLeft: 3 }}>TL / 100g</span>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                    {detail.detail?.length} malzeme
                    {detail.totalGrams > 0 && ` · ${detail.totalGrams}g`}
                    {(() => { const lc = (detail.detail||[]).filter(r=>r.source==='live').length; return lc > 0 ? <span style={{color:'#16a34a', marginLeft:6}}>● {lc} canlı</span> : null })()}
                  </div>
                </div>
              </div>
            )}

            {/* Malzeme tablosu */}
            {detail.detail?.length > 0 && (
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '5px 0', textAlign: 'left', color: 'var(--text-dim)', fontWeight: 600 }}>Malzeme</th>
                    <th style={{ padding: '5px 0', textAlign: 'right', color: 'var(--text-dim)', fontWeight: 600 }}>Miktar</th>
                    <th style={{ padding: '5px 0', textAlign: 'right', color: 'var(--text-dim)', fontWeight: 600 }}>Maliyet</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.detail.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '5px 0', color: row.source === 'live' ? '#16a34a' : 'var(--text)', fontWeight: row.source === 'live' ? 500 : 400 }}>
                        {row.ingredient}
                        {row.source === 'live' && <span style={{ marginLeft: 4, fontSize: 9, opacity: .7 }}>●</span>}
                      </td>
                      <td style={{ padding: '5px 0', textAlign: 'right', color: 'var(--text-dim)' }}>{row.miktar} {row.birim}</td>
                      <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: row.maliyet > 0 ? 600 : 400, color: row.maliyet > 0 ? 'var(--text)' : 'var(--text-xdim)' }}>
                        {row.maliyet > 0 ? `${row.maliyet.toFixed(2)} TL` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ padding: '8px 0', fontWeight: 700 }}>TOPLAM</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: 'var(--gold)' }}>{detail.total.toFixed(2)} TL</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  )
}
