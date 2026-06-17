import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X, TrendingDown, ArrowDownRight, Coins, CircleDollarSign, Star, Link2, Unlink, Sparkles, ChevronDown, CalendarDays, ChevronRight } from 'lucide-react'

const fmt = (n, d = 2) => (n == null ? '—' : Number(n).toLocaleString('tr', { minimumFractionDigits: d, maximumFractionDigits: d }))
const mealLabel = (m) => m === 'lunch' ? 'Öğle' : m === 'dinner' ? 'Akşam' : (m || '')
function coverageColor(c) { if (c >= 70) return '#16a34a'; if (c >= 35) return '#f59e0b'; return '#ef4444' }

export default function CostSuggestPage() {
  const [menus, setMenus]       = useState([])
  const [menusLoading, setML]   = useState(false)
  const [selMenu, setSelMenu]   = useState(null)   // menu.id
  // seçili menü item'ı
  const [selItem, setSelItem]   = useState(null)   // { dish, y_no, recipe, total, ... }
  const [detail, setDetail]     = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  // elle eşleştirme modalı
  const [mapIng, setMapIng]     = useState(null)
  const [mapQ, setMapQ]         = useState('')
  const [mapResults, setMapResults] = useState([])
  const [mapBusy, setMapBusy]   = useState(false)
  const mapDebounce = useRef(null)
  // Menü çapında alternatifler (her kaleme 1)
  const [menuAlts, setMenuAlts] = useState(null)        // { menuId, suggestions }
  const [menuAltLoading, setMenuAltLoading] = useState(false)
  const [menuAltErr, setMenuAltErr] = useState(null)
  const [altOpen, setAltOpen]   = useState(null)        // açık alternatif (malzeme detayı) dish adı
  const [showUncosted, setShowUncosted] = useState(false)

  // Menüleri (item'larıyla) yükle
  const loadMenus = useCallback(() => {
    setML(true)
    fetch('/api/cost-oneri/menu-itemlar')
      .then(r => r.json())
      .then(d => {
        const list = d.menus || []
        setMenus(list); setML(false)
        setSelMenu(prev => prev ?? (list[0]?.id ?? null))
      })
      .catch(() => setML(false))
  }, [])
  useEffect(() => { loadMenus() }, [loadMenus])

  const menu = menus.find(m => m.id === selMenu) || null

  const openItem = (item) => {
    setSelItem(item)
    setDetail(null)
    setDetailLoading(true)
    fetch(`/api/cost-oneri/dish-cost?dish=${encodeURIComponent(item.dish)}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setDetailLoading(false) })
      .catch(() => setDetailLoading(false))
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
      fetch(`/api/cost-oneri/stok-ara?q=${encodeURIComponent(q)}`).then(r => r.json())
        .then(d => setMapResults(Array.isArray(d) ? d : [])).catch(() => setMapResults([]))
    }, 250)
    return () => clearTimeout(mapDebounce.current)
  }, [mapQ, mapIng])
  const saveMap = (ingredient, stok) => {
    setMapBusy(true)
    fetch('/api/cost-oneri/eslestir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredient, stok }),
    }).then(r => r.json()).then(() => {
      setMapBusy(false); closeMap()
      if (selItem) openItem(selItem)   // detayı tazele
      loadMenus()                       // menü maliyetlerini tazele
    }).catch(() => setMapBusy(false))
  }

  // ── Menü çapında alternatif üret (her değerli kaleme 1) ──
  const genMenuAlts = (force = false) => {
    if (!selMenu) return
    setMenuAltLoading(true); setMenuAltErr(null); setAltOpen(null)
    fetch('/api/cost-oneri/menu-alternatif', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menuId: selMenu, force }),
    })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Hata'); return d })
      .then(d => { setMenuAlts(d); setMenuAltLoading(false) })
      .catch(e => { setMenuAltErr(e.message); setMenuAltLoading(false) })
  }
  const altFor = (dish) => (menuAlts && menuAlts.menuId === selMenu)
    ? (menuAlts.suggestions || []).find(s => s.original.dish === dish) : null

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* SOL: menü + en değerli 10 item */}
      <div style={{ flex: selItem ? '0 0 460px' : '1', display: 'flex', flexDirection: 'column', borderRight: selItem ? '1px solid var(--border)' : 'none', overflow: 'hidden' }}>
        <div className="page-header" style={{ flexShrink: 0 }}>
          <div>
            <div className="page-title">Maliyet Önerileri</div>
            <div className="page-sub">Haftalık plandaki menüler · her öğünde en değerli 10 kalem</div>
          </div>
        </div>

        {/* Menü seçici */}
        <div style={{ padding: '10px 24px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <CalendarDays size={15} style={{ color: 'var(--text-dim)' }} />
          <select className="form-select" value={selMenu ?? ''} onChange={e => { setSelMenu(Number(e.target.value)); setSelItem(null); setMenuAlts(null) }} style={{ flex: 1 }}>
            {menus.map(m => (
              <option key={m.id} value={m.id}>{m.theme} · {mealLabel(m.meal_type)}</option>
            ))}
          </select>
          <button className="btn btn-sm" style={{ background: 'var(--gold)', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }} disabled={menuAltLoading || !menu} onClick={() => genMenuAlts(menuAlts && menuAlts.menuId === selMenu)}>
            <Sparkles size={14} /> {menuAltLoading ? 'Üretiliyor…' : (menuAlts && menuAlts.menuId === selMenu ? '↻ Yenile' : 'Alternatif üret')}
          </button>
        </div>
        {menuAltLoading && <div style={{ padding: '6px 24px', fontSize: 11, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>AI tüm menüyü gözden geçiriyor, her değerli kaleme 1 alternatif… (~10-20 sn)</div>}
        {menuAltErr && <div style={{ padding: '6px 24px', fontSize: 11, color: '#ef4444', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>{menuAltErr}</div>}

        {menu && (
          <div style={{ padding: '6px 24px', fontSize: 11, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {menu.dishCount} yemek · {menu.costedCount} maliyetlendi (birebir reçete) · en değerli {menu.items.length} gösteriliyor
          </div>
        )}

        {/* En değerli 10 item */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {menusLoading && <div className="loading"><div className="spinner" /> Yükleniyor...</div>}
          {!menusLoading && menu && menu.items.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>Bu menüde maliyetlendirilebilen yemek bulunamadı.</div>
          )}
          {!menusLoading && menu && menu.items.map((it, i) => {
            const isActive = selItem && selItem.y_no === it.y_no && selItem.dish === it.dish
            const sug = altFor(it.dish)
            return (
              <React.Fragment key={i}>
              <div onClick={() => openItem(it)}
                style={{ padding: '11px 18px 11px 24px', borderBottom: sug && sug.alt ? 'none' : '1px solid var(--border)', cursor: 'pointer',
                  background: isActive ? 'var(--gold-bg)' : 'transparent', display: 'flex', alignItems: 'center', gap: 10, transition: 'background .15s' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                <div style={{ width: 22, textAlign: 'center', fontWeight: 700, fontSize: 13, color: i < 3 ? 'var(--gold)' : 'var(--text-xdim)', flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.dish}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-xdim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {it.station}{it.how !== 'exact' ? ` · ~${it.recipe}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gold)' }}>{fmt(it.total)} ₺</div>
                  <div style={{ fontSize: 10, color: coverageColor(it.coverage) }}>kapsama %{it.coverage}</div>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--text-xdim)', flexShrink: 0 }} />
              </div>
              {sug && sug.alt && (
                <div onClick={() => setAltOpen(altOpen === it.dish ? null : it.dish)}
                  style={{ padding: '8px 18px 8px 56px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: 'rgba(22,163,74,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ArrowDownRight size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ color: 'var(--text-dim)' }}>yerine: </span><strong>{sug.alt.name}</strong>
                      <span style={{ marginLeft: 6, fontSize: 10, color: coverageColor(sug.alt.coverage) }}>kapsama %{sug.alt.coverage}</span>
                    </div>
                    {altOpen === it.dish && (
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: '3px 12px' }}>
                        {sug.alt.ingredients.map((ing, j) => (
                          <span key={j} style={{ color: ing.matchedStok ? 'var(--text-dim)' : '#b45309' }}>{ing.name} {ing.miktar}{ing.birim}{ing.maliyet > 0 ? ` · ${fmt(ing.maliyet)}₺` : ' · ○'}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: '#16a34a' }}>{sug.alt.per100g != null ? `${fmt(sug.alt.per100g)} ₺/100g` : '—'}</div>
                    {sug.alt.savingPct != null && <div style={{ fontSize: 10, fontWeight: 700, color: sug.alt.savingPct > 0 ? '#16a34a' : '#ef4444' }}>{sug.alt.savingPct > 0 ? `%${sug.alt.savingPct} ucuz` : `+%${Math.abs(sug.alt.savingPct)}`}</div>}
                  </div>
                </div>
              )}
              </React.Fragment>
            )
          })}

          {/* Reçetesi eşleşmeyen / maliyetlendirilemeyen yemekler */}
          {!menusLoading && menu && menu.uncosted && menu.uncosted.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <div onClick={() => setShowUncosted(v => !v)} style={{ padding: '10px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', fontSize: 12, fontWeight: 600 }}>
                <ChevronDown size={14} style={{ transform: showUncosted ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
                Reçetesi eşleşmeyen ({menu.uncosted.length})
                <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-xdim)' }}>· maliyetlendirilemedi</span>
              </div>
              {showUncosted && menu.uncosted.map((dn, i) => (
                <div key={i} style={{ padding: '6px 24px 6px 46px', fontSize: 12, color: 'var(--text-xdim)', borderTop: '1px solid var(--border)' }}>{dn}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SAĞ: item detayı + AI alternatif */}
      {selItem && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{selItem.dish}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {selItem.how !== 'exact' ? <>eşleşen reçete: <strong>{selItem.recipe}</strong> · </> : null}{selItem.station}
              </div>
            </div>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelItem(null)}><X size={14} /></button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
            {detailLoading && <div className="loading"><div className="spinner" /> Yükleniyor...</div>}

            {/* Maliyet özeti */}
            {detail && detail.total != null && (
              <div style={{ margin: '16px 0', padding: 16, borderRadius: 10, background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', display: 'flex', gap: 24, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <CircleDollarSign size={20} style={{ color: 'var(--gold)' }} />
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>{fmt(detail.total)} <span style={{ fontSize: 13 }}>₺</span></div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>reçete maliyeti</div>
                </div>
                {detail.per100g != null && (
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>{fmt(detail.per100g)} <span style={{ fontSize: 13 }}>₺</span></div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>100g başına · {detail.totalGrams}g</div>
                  </div>
                )}
              </div>
            )}

            {/* Bu kalem için menü-çapı AI önerisi (varsa) */}
            {detail && altFor(selItem.dish) && altFor(selItem.dish).alt && (
              <div className="card" style={{ padding: '12px 16px', marginBottom: 16, border: '1px solid var(--gold-border)', background: 'rgba(22,163,74,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <ArrowDownRight size={16} style={{ color: '#16a34a' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Önerilen alternatif</div>
                  <div style={{ fontWeight: 700 }}>{altFor(selItem.dish).alt.name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: '#16a34a' }}>{altFor(selItem.dish).alt.per100g != null ? `${fmt(altFor(selItem.dish).alt.per100g)} ₺/100g` : '—'}</div>
                  {altFor(selItem.dish).alt.savingPct != null && <div style={{ fontSize: 11, fontWeight: 700, color: altFor(selItem.dish).alt.savingPct > 0 ? '#16a34a' : '#ef4444' }}>{altFor(selItem.dish).alt.savingPct > 0 ? `%${altFor(selItem.dish).alt.savingPct} ucuz` : `+%${Math.abs(altFor(selItem.dish).alt.savingPct)}`}</div>}
                </div>
              </div>
            )}

            {/* Malzeme kırılımı + fiyatsızlara elle eşleştirme */}
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
                            <button onClick={() => openMap(row.ingredient)} title="Canlı ürüne eşlendi — değiştirmek için tıkla" style={{ marginLeft: 5, fontSize: 9, color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                              ● canlı
                            </button>
                          )}
                          {row.source !== 'live' && row.source !== 'manual' && (
                            <button onClick={() => openMap(row.ingredient)} title="Cost canlı listesinden ürün seçerek canlı fiyata eşle" style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 5, cursor: 'pointer', padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Star size={11} fill="#f59e0b" stroke="#f59e0b" /> {row.fiyat > 0 ? 'statik · canlıya eşle' : 'fiyat yok · eşle'}
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

      {/* Elle eşleştirme modalı */}
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
                <input className="form-input" autoFocus placeholder="Cost listesinde ara..." value={mapQ} onChange={e => setMapQ(e.target.value)} style={{ paddingLeft: 32, width: '100%' }} />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {mapQ.trim().length < 2 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>Aramak için en az 2 harf yazın.</div>}
              {mapQ.trim().length >= 2 && mapResults.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>Eşleşen cost ürünü bulunamadı.</div>}
              {mapResults.map(m => (
                <div key={m.stok} onClick={() => !mapBusy && saveMap(mapIng, m.stok)} style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', cursor: mapBusy ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
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
