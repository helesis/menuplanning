import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Utensils, Leaf, Sprout, Flame, Snowflake, Cake, Trash2,
  X, TrendingUp, PlusCircle, Pencil, Check, Star,
  Search, Plus, Minus,
} from 'lucide-react'
import * as api from '../api.js'

const DAYS       = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
const DAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

const SECTIONS = [
  { id: 'hot',     label: 'Sıcak Yemekler', icon: <Flame size={14} />,     color: 'var(--yellow)',  bg: 'var(--yellow-bg)' },
  { id: 'cold',    label: 'Soğuk Yemekler', icon: <Snowflake size={14} />, color: 'var(--blue)',    bg: 'var(--blue-bg)' },
  { id: 'dessert', label: 'Tatlılar',        icon: <Cake size={14} />,      color: 'var(--gold)',    bg: 'var(--gold-bg)' },
  { id: null,      label: 'Diğer',           icon: <Utensils size={14} />,  color: 'var(--text-dim)',bg: 'var(--bg)' },
]

const MATCH_TYPES = [
  { key: 'custom',           color: '#8a6c2e', label: 'Özel Reçete' },
  { key: 'name_exact',       color: '#22c55e', label: 'Tam Eşleşme' },
  { key: 'name_partial',     color: '#3b82f6', label: 'Ad Benzerliği' },
  { key: 'ingredient_exact', color: '#f59e0b', label: 'Malzeme Olarak' },
  { key: 'ingredient_partial',color:'#a78bfa', label: 'Malzeme Benzerliği' },
]

export default function StationViewPage() {
  const [menus, setMenus]               = useState([])
  const [selectedDay, setSelectedDay]   = useState(1)
  const [selectedMeal, setSelectedMeal] = useState('lunch')
  const [menu, setMenu]                 = useState(null)
  const [loading, setLoading]           = useState(false)
  const [recipeMatches, setRecipeMatches] = useState({})
  const [activePanel, setActivePanel]   = useState(null)

  // Dışarı tıklayınca paneli kapat
  useEffect(() => {
    if (!activePanel) return
    const close = (e) => {
      if (!e.target.closest('.rm-chip') && !e.target.closest('.recipe-panel')) {
        setActivePanel(null)
      }
    }
    const timer = setTimeout(() => document.addEventListener('click', close), 0)
    return () => { clearTimeout(timer); document.removeEventListener('click', close) }
  }, [activePanel])

  useEffect(() => { api.getMenus().then(setMenus) }, [])

  const loadMatches = useCallback((m) => {
    const names = [...new Set(m.stations.flatMap(s => s.dishes.map(d => d.name)))]
    fetch('/api/recipe-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names }),
    }).then(r => r.json()).then(setRecipeMatches).catch(() => {})
  }, [])

  useEffect(() => {
    const summary = menus.find(m => m.day_of_week === selectedDay && m.meal_type === selectedMeal)
    if (!summary) return
    setLoading(true)
    setActivePanel(null)
    api.getMenu(summary.id).then(m => {
      setMenu(m)
      setLoading(false)
      loadMatches(m)
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

  const onRecipeSaved = useCallback((dishName) => {
    // Reçete kaydedilince eşleşmeleri yenile
    if (!menu) return
    loadMatches(menu)
    setActivePanel(prev => {
      if (!prev) return prev
      // Paneli aç bırak ama key'i güncelle (custom göstersin)
      return { ...prev, refreshKey: Date.now() }
    })
  }, [menu, loadMatches])

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

      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '12px 32px', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {DAYS.map((day, i) => (
            <button key={i} className={`tab-btn${selectedDay === i + 1 ? ' active' : ''}`}
              style={{ padding: '6px 14px' }} onClick={() => setSelectedDay(i + 1)}>
              <span style={{ display: 'none' }} className="day-short">{DAYS_SHORT[i]}</span>
              <span className="day-full">{day}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
          {[['lunch', 'Öğle'], ['dinner', 'Akşam']].map(([val, label]) => (
            <button key={val} className={`tab-btn${selectedMeal === val ? ' active' : ''}`}
              onClick={() => setSelectedMeal(val)}>{label}</button>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 16px', borderRadius: 10,
                background: sec.bg, color: sec.color,
                fontWeight: 700, fontSize: 13, letterSpacing: '.04em',
              }}>
                {sec.icon} {sec.label.toUpperCase()}
                <span style={{ fontWeight: 400, fontSize: 12, opacity: .7 }}>
                  — {sec.stations.length} istasyon
                </span>
              </div>
              <button className="btn btn-ghost btn-sm btn-icon"
                title="Bu bölümü sil" style={{ color: 'var(--red)', opacity: .7 }}
                onClick={() => {
                  if (confirm(`"${sec.label}" bölümündeki tüm istasyonlar silinecek. Emin misin?`))
                    deleteSection(sec.id)
                }}>
                <Trash2 size={14} />
              </button>
            </div>

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
                    {station.dishes.map(dish => {
                      const matches   = recipeMatches[dish.name] || []
                      const hasCustom = matches.some(m => m.matchType === 'custom')
                      const customMatch = matches.find(m => m.matchType === 'custom')
                      return (
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

                            {hasCustom ? (
                              <span
                                className="rm-chip"
                                title="Özel Reçete"
                                onClick={e => {
                                  e.nativeEvent.stopImmediatePropagation()
                                  const panelKey = `custom_${dish.id}`
                                  setActivePanel(prev =>
                                    prev?.key === panelKey ? null : {
                                      key: panelKey,
                                      dishName: dish.name,
                                      type: 'custom',
                                      recipes: [customMatch],
                                      mode: 'view',
                                    }
                                  )
                                }}
                                style={{
                                  cursor: 'pointer', padding: '1px 2px', borderRadius: 3,
                                  background: activePanel?.key === `custom_${dish.id}` ? '#8a6c2e22' : 'transparent',
                                }}
                              >
                                <Star size={12} style={{ color: '#8a6c2e' }} />
                              </span>
                            ) : (
                              <span
                                className="rm-chip"
                                title="Reçete ekle"
                                onClick={e => {
                                  e.nativeEvent.stopImmediatePropagation()
                                  const panelKey = `new_${dish.id}`
                                  setActivePanel(prev =>
                                    prev?.key === panelKey ? null : {
                                      key: panelKey,
                                      dishName: dish.name,
                                      type: 'new',
                                      recipes: [],
                                      mode: 'create',
                                    }
                                  )
                                }}
                                style={{ cursor: 'pointer', padding: '1px 2px', borderRadius: 3 }}
                              >
                                <PlusCircle size={13} style={{ color: 'var(--text-xdim)' }} />
                              </span>
                            )}
                          </span>
                        </div>
                      )
                    })}
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
        .ing-search-wrap { position: relative; }
        .ing-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); box-shadow: var(--shadow-lg);
          z-index: 2000; max-height: 200px; overflow-y: auto;
        }
        .ing-dropdown-item {
          padding: 7px 12px; font-size: 12px; cursor: pointer;
          border-bottom: 1px solid var(--border);
        }
        .ing-dropdown-item:last-child { border-bottom: none; }
        .ing-dropdown-item:hover { background: var(--bg); }
      `}</style>

      {activePanel && (
        <RecipePanel
          panel={activePanel}
          onClose={() => setActivePanel(null)}
          onSaved={onRecipeSaved}
        />
      )}
    </>
  )
}


// ─── Reçete Paneli ────────────────────────────────────────────────────────────

function RecipePanel({ panel, onClose, onSaved }) {
  const { dishName, type, recipes } = panel
  const typeInfo = MATCH_TYPES.find(t => t.key === type) || MATCH_TYPES[0]

  const [mode, setMode]         = useState(panel.mode || 'view') // 'view' | 'edit' | 'create'
  const [selected, setSelected] = useState(recipes[0]?.y_no ?? null)
  const [detail, setDetail]     = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Edit state
  const [editIngredients, setEditIngredients] = useState([])
  const [saving, setSaving]     = useState(false)
  const [customId, setCustomId] = useState(recipes[0]?.customId ?? null)

  // Reset on panel change
  useEffect(() => {
    setMode(panel.mode || 'view')
    setSelected(recipes[0]?.y_no ?? null)
    setDetail(null)
    setCustomId(recipes[0]?.customId ?? null)
  }, [panel.key, panel.refreshKey])

  // Load recipe detail for view mode
  useEffect(() => {
    if (mode !== 'view' || !selected) return
    setDetailLoading(true)
    setDetail(null)
    fetch(`/api/recipes/${selected}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setDetailLoading(false) })
      .catch(() => setDetailLoading(false))
  }, [selected, mode])

  // Load custom recipe for edit/create mode
  useEffect(() => {
    if (mode !== 'edit' && mode !== 'create') return
    // If editing a custom recipe, load its ingredients
    if (type === 'custom' && customId) {
      fetch(`/api/custom-recipes?dish_name=${encodeURIComponent(dishName)}`)
        .then(r => r.json())
        .then(d => {
          if (d) setEditIngredients(d.ingredients || [])
        })
    } else if (mode === 'create') {
      setEditIngredients([])
    } else if (mode === 'edit' && detail?.detail) {
      // Pre-populate from db recipe
      setEditIngredients(detail.detail.map(row => ({
        ing_no: null,
        ing_name: row.ingredient,
        miktar: row.miktar,
        birim: row.birim || 'g',
      })))
    } else if (mode === 'edit' && !detail) {
      // Need to load first, then set
      setEditIngredients([])
    }
  }, [mode])

  // Pre-populate when switching to edit and detail is already loaded
  useEffect(() => {
    if (mode === 'edit' && type !== 'custom' && detail?.detail && editIngredients.length === 0) {
      setEditIngredients(detail.detail.map(row => ({
        ing_no: null,
        ing_name: row.ingredient,
        miktar: row.miktar,
        birim: row.birim || 'g',
      })))
    }
  }, [detail, mode])

  async function handleSave() {
    setSaving(true)
    try {
      const body = { dish_name: dishName, ingredients: editIngredients }
      const res = await fetch('/api/custom-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json())
      setCustomId(res.id)
      setMode('view')
      // Switch to custom recipe view
      onSaved(dishName)
    } finally {
      setSaving(false)
    }
  }

  function removeIngredient(idx) {
    setEditIngredients(prev => prev.filter((_, i) => i !== idx))
  }

  function updateIngredient(idx, field, value) {
    setEditIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing))
  }

  function addIngredient(ing) {
    setEditIngredients(prev => [...prev, ing])
  }

  const canEdit = type === 'custom' || type === 'name_exact'
  const isEditMode = mode === 'edit' || mode === 'create'

  const headerColor = isEditMode ? '#8a6c2e' : typeInfo.color
  const headerLabel = mode === 'create' ? 'Yeni Reçete' : mode === 'edit' ? 'Reçete Düzenle' : typeInfo.label

  return (
    <div
      className="recipe-panel"
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed', bottom: 24, right: 24,
        width: 460, maxHeight: '80vh',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 8px 40px rgba(0,0,0,.18)',
        zIndex: 1000,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: headerColor + '14',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isEditMode ? <Pencil size={14} style={{ color: headerColor }} /> : <BookOpen size={14} style={{ color: headerColor }} />}
          <span style={{ fontSize: 12, fontWeight: 700, color: headerColor, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {headerLabel}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>— {dishName}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {!isEditMode && canEdit && (
            <button
              className="icon-btn"
              title="Düzenle"
              onClick={() => setMode(type === 'custom' ? 'edit' : 'edit')}
              style={{ width: 26, height: 26 }}
            >
              <Pencil size={12} />
            </button>
          )}
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={13} /></button>
        </div>
      </div>

      {/* Recipe selector */}
      {!isEditMode && recipes.length > 1 && (
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

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        {/* VIEW MODE */}
        {!isEditMode && (
          <>
            {detailLoading && <div style={{ padding: 24, textAlign: 'center' }}><div className="spinner" /></div>}
            {detail && (
              <>
                <div style={{ padding: '12px 0 8px', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{detail.adi}</div>
                  {detail.tur && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{detail.tur}</div>}
                </div>

                {detail.total != null && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 10, marginBottom: 14,
                    background: 'var(--gold-bg)', border: '1px solid rgba(138,108,46,.15)',
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
                      </div>
                    </div>
                  </div>
                )}

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
            {/* Custom recipe in view mode — no db detail, just show saved ingredients */}
            {!detailLoading && type === 'custom' && !detail && (
              <CustomRecipeView dishName={dishName} />
            )}
          </>
        )}

        {/* EDIT / CREATE MODE */}
        {isEditMode && (
          <div style={{ paddingTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
              Malzemeleri ekleyip miktarlarını belirtin. Kaydedince özel reçete olarak saklanır.
            </div>

            {/* Ingredient rows */}
            {editIngredients.length > 0 && (
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '4px 0', textAlign: 'left', color: 'var(--text-dim)', fontWeight: 600 }}>Malzeme</th>
                    <th style={{ padding: '4px 0', textAlign: 'right', color: 'var(--text-dim)', fontWeight: 600, width: 70 }}>Miktar</th>
                    <th style={{ padding: '4px 0', textAlign: 'right', color: 'var(--text-dim)', fontWeight: 600, width: 50 }}>Birim</th>
                    <th style={{ width: 28 }} />
                  </tr>
                </thead>
                <tbody>
                  {editIngredients.map((ing, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '5px 0', fontSize: 12 }}>{ing.ing_name}</td>
                      <td style={{ padding: '5px 4px', textAlign: 'right' }}>
                        <input
                          type="number"
                          value={ing.miktar}
                          onChange={e => updateIngredient(idx, 'miktar', e.target.value)}
                          style={{
                            width: 64, textAlign: 'right', fontSize: 12,
                            padding: '3px 6px', border: '1px solid var(--border)',
                            borderRadius: 4, background: 'var(--surface)', color: 'var(--text)',
                          }}
                        />
                      </td>
                      <td style={{ padding: '5px 4px', textAlign: 'right' }}>
                        <select
                          value={ing.birim}
                          onChange={e => updateIngredient(idx, 'birim', e.target.value)}
                          style={{
                            fontSize: 11, padding: '3px 4px',
                            border: '1px solid var(--border)', borderRadius: 4,
                            background: 'var(--surface)', color: 'var(--text)',
                          }}
                        >
                          <option value="g">g</option>
                          <option value="cl">cl</option>
                          <option value="adet">adet</option>
                          <option value="ml">ml</option>
                          <option value="kg">kg</option>
                        </select>
                      </td>
                      <td style={{ padding: '5px 0', textAlign: 'center' }}>
                        <button
                          onClick={() => removeIngredient(idx)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--red)', padding: 2, display: 'flex',
                          }}
                        >
                          <Minus size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {editIngredients.length === 0 && (
              <div style={{ color: 'var(--text-xdim)', fontSize: 12, marginBottom: 12, textAlign: 'center', padding: '8px 0' }}>
                Henüz malzeme eklenmedi
              </div>
            )}

            {/* Add ingredient row */}
            <IngredientAddRow onAdd={addIngredient} />

            {/* Save / Cancel */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, fontSize: 13 }}
                onClick={handleSave}
                disabled={saving}
              >
                <Check size={13} /> {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
              <button
                className="btn"
                style={{ fontSize: 13 }}
                onClick={() => {
                  if (mode === 'create') onClose()
                  else setMode('view')
                }}
              >
                İptal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CustomRecipeView({ dishName }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    fetch(`/api/custom-recipes?dish_name=${encodeURIComponent(dishName)}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [dishName])

  if (!data) return <div style={{ padding: 24, textAlign: 'center' }}><div className="spinner" /></div>

  return (
    <div style={{ paddingTop: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{data.dish_name}</div>
      {data.ingredients?.length > 0 ? (
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '4px 0', textAlign: 'left', color: 'var(--text-dim)', fontWeight: 600 }}>Malzeme</th>
              <th style={{ padding: '4px 0', textAlign: 'right', color: 'var(--text-dim)', fontWeight: 600 }}>Miktar</th>
            </tr>
          </thead>
          <tbody>
            {data.ingredients.map((ing, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '5px 0' }}>{ing.ing_name}</td>
                <td style={{ padding: '5px 0', textAlign: 'right', color: 'var(--text-dim)' }}>{ing.miktar} {ing.birim}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ color: 'var(--text-xdim)', fontSize: 12 }}>Malzeme eklenmemiş</div>
      )}
    </div>
  )
}

function IngredientAddRow({ onAdd }) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [selected, setSelected] = useState(null) // { ing_no, ing_name, ing_birim }
  const [miktar, setMiktar]     = useState('')
  const [birim, setBirim]       = useState('g')
  const [open, setOpen]         = useState(false)
  const timerRef = useRef(null)

  const search = useCallback((q) => {
    if (!q || q.length < 2) { setResults([]); setOpen(false); return }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      fetch(`/api/ingredients?q=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then(data => { setResults(data.slice(0, 20)); setOpen(true) })
        .catch(() => {})
    }, 200)
  }, [])

  function selectIng(ing) {
    setSelected(ing)
    setQuery(ing.ing_name)
    setBirim((ing.ing_birim || 'g').toLowerCase().includes('cl') ? 'cl' : 'g')
    setResults([])
    setOpen(false)
  }

  function handleAdd() {
    if (!selected || !miktar) return
    onAdd({ ing_no: selected.ing_no, ing_name: selected.ing_name, miktar: Number(miktar), birim })
    setQuery('')
    setSelected(null)
    setMiktar('')
    setBirim('g')
    setResults([])
  }

  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
        Malzeme Ekle
      </div>
      <div className="ing-search-wrap" style={{ marginBottom: 8 }}>
        <div style={{ position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-xdim)', pointerEvents: 'none' }} />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null); search(e.target.value) }}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Malzeme ara… (min 2 harf)"
            style={{
              width: '100%', padding: '7px 10px 7px 28px', fontSize: 12,
              border: '1px solid var(--border)', borderRadius: 6,
              background: 'var(--surface)', color: 'var(--text)',
              boxSizing: 'border-box',
            }}
          />
        </div>
        {open && results.length > 0 && (
          <div className="ing-dropdown">
            {results.map(r => (
              <div key={r.ing_no} className="ing-dropdown-item" onMouseDown={() => selectIng(r)}>
                <span style={{ fontWeight: 500 }}>{r.ing_name}</span>
                {r.ing_fiyat > 0 && <span style={{ color: 'var(--text-xdim)', marginLeft: 8, fontSize: 11 }}>{r.ing_fiyat} TL/{r.ing_birim}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="number"
          value={miktar}
          onChange={e => setMiktar(e.target.value)}
          placeholder="Miktar"
          disabled={!selected}
          style={{
            flex: 1, padding: '7px 10px', fontSize: 12,
            border: '1px solid var(--border)', borderRadius: 6,
            background: selected ? 'var(--surface)' : 'var(--bg)', color: 'var(--text)',
          }}
        />
        <select
          value={birim}
          onChange={e => setBirim(e.target.value)}
          disabled={!selected}
          style={{
            padding: '7px 8px', fontSize: 12,
            border: '1px solid var(--border)', borderRadius: 6,
            background: selected ? 'var(--surface)' : 'var(--bg)', color: 'var(--text)',
          }}
        >
          <option value="g">g</option>
          <option value="cl">cl</option>
          <option value="ml">ml</option>
          <option value="adet">adet</option>
          <option value="kg">kg</option>
        </select>
        <button
          onClick={handleAdd}
          disabled={!selected || !miktar}
          style={{
            padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6,
            border: 'none', cursor: selected && miktar ? 'pointer' : 'not-allowed',
            background: selected && miktar ? 'var(--gold)' : 'var(--border)',
            color: selected && miktar ? '#fff' : 'var(--text-xdim)',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <Plus size={13} /> Ekle
        </button>
      </div>
    </div>
  )
}
