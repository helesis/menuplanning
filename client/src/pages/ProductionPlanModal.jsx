import React, { useState, useEffect, useRef } from 'react'
import { X, Printer, ChevronDown } from 'lucide-react'

const DAYS      = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
const SECTIONS  = [
  { id: 'hot',     label: 'Sıcak Yemekler' },
  { id: 'cold',    label: 'Soğuk Yemekler' },
  { id: 'dessert', label: 'Tatlılar' },
]
const MEALS = [
  { id: 'both',   label: 'Öğle + Akşam' },
  { id: 'lunch',  label: 'Sadece Öğle' },
  { id: 'dinner', label: 'Sadece Akşam' },
]

export default function ProductionPlanModal({ onClose }) {
  const [allMenus, setAllMenus]   = useState([])
  const [sections, setSections]   = useState(['hot'])
  const [meal, setMeal]           = useState('both')
  const [loading, setLoading]     = useState(true)
  const printRef = useRef(null)

  useEffect(() => {
    // Tüm menüleri tam detaylarıyla çek
    fetch('/api/menus')
      .then(r => r.json())
      .then(summaries => {
        Promise.all(summaries.map(s => fetch(`/api/menus/${s.id}`).then(r => r.json())))
          .then(full => { setAllMenus(full); setLoading(false) })
      })
  }, [])

  function toggleSection(id) {
    setSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  // Seçili bölümlerdeki istasyonları gün+öğün bazında topla
  function buildPlan() {
    // selectedSection → stationName → [{ day, meal, dishes }]
    const plan = {} // stationName → rows

    const mealsToShow = meal === 'both' ? ['lunch', 'dinner'] : [meal]

    for (const menu of allMenus) {
      if (!mealsToShow.includes(menu.meal_type)) continue

      for (const station of menu.stations) {
        const sec = station.section
        const secNorm = sec && SECTIONS.find(s => s.id === sec) ? sec
          : !sec || !['hot','cold','dessert'].includes(sec) ? 'other' : sec

        if (!sections.includes(secNorm)) continue
        if (station.dishes.length === 0) continue

        if (!plan[station.name]) plan[station.name] = []
        plan[station.name].push({
          day:    DAYS[menu.day_of_week - 1],
          dayNum: menu.day_of_week,
          meal:   menu.meal_type === 'lunch' ? 'Öğle' : 'Akşam',
          dishes: station.dishes.map(d => d.name),
        })
      }
    }

    // Her istasyon için gün sırasına göre sırala
    for (const name of Object.keys(plan)) {
      plan[name].sort((a, b) => a.dayNum - b.dayNum || (a.meal === 'Öğle' ? -1 : 1))
    }

    return plan
  }

  function handlePrint() {
    const content = printRef.current?.innerHTML
    const win = window.open('', '_blank')
    win.document.write(`
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8" />
        <title>Haftalık Üretim Planı</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; }
          h1 { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
          .subtitle { font-size: 11px; color: #666; margin-bottom: 20px; }
          .station-block { margin-bottom: 24px; page-break-inside: avoid; }
          .station-title {
            font-size: 12px; font-weight: 700; text-transform: uppercase;
            letter-spacing: .06em; padding: 6px 10px;
            background: #f0f0f0; border-left: 4px solid #8a6c2e;
            margin-bottom: 0;
          }
          table { width: 100%; border-collapse: collapse; }
          th {
            background: #faf9f6; padding: 5px 8px;
            border: 1px solid #ddd; font-size: 10px;
            text-align: left; font-weight: 700; color: #555;
          }
          td { padding: 5px 8px; border: 1px solid #ddd; vertical-align: top; font-size: 11px; }
          td.day-cell { font-weight: 600; white-space: nowrap; background: #fafaf8; width: 80px; }
          td.meal-cell { color: #888; white-space: nowrap; width: 50px; font-size: 10px; }
          td.dishes-cell { line-height: 1.6; }
          tr:nth-child(even) td { background: #fefefe; }
          @media print {
            body { font-size: 10px; }
            .station-block { page-break-inside: avoid; }
            @page { margin: 12mm 10mm; size: A4 portrait; }
          }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  const plan = !loading ? buildPlan() : {}
  const stationNames = Object.keys(plan)

  const today = new Date()
  const dateStr = today.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
  const sectionLabel = sections.map(s => SECTIONS.find(x => x.id === s)?.label).join(', ')

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg)',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '12px 24px', background: 'var(--surface)',
        borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginRight: 8 }}>Üretim Planı</div>

        {/* Bölüm seçici */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Bölüm:</span>
          {SECTIONS.map(s => (
            <label key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 12, cursor: 'pointer',
              padding: '4px 10px', borderRadius: 6,
              border: `1px solid ${sections.includes(s.id) ? 'var(--gold)' : 'var(--border)'}`,
              background: sections.includes(s.id) ? 'var(--gold-bg)' : 'var(--surface)',
              color: sections.includes(s.id) ? 'var(--gold)' : 'var(--text-dim)',
              fontWeight: sections.includes(s.id) ? 600 : 400,
            }}>
              <input type="checkbox" checked={sections.includes(s.id)} onChange={() => toggleSection(s.id)}
                style={{ display: 'none' }} />
              {s.label}
            </label>
          ))}
        </div>

        {/* Öğün seçici */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Öğün:</span>
          {MEALS.map(m => (
            <button
              key={m.id}
              onClick={() => setMeal(m.id)}
              style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${meal === m.id ? 'var(--gold)' : 'var(--border)'}`,
                background: meal === m.id ? 'var(--gold-bg)' : 'var(--surface)',
                color: meal === m.id ? 'var(--gold)' : 'var(--text-dim)',
                fontWeight: meal === m.id ? 600 : 400,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={handlePrint}
            disabled={stationNames.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
              background: stationNames.length ? 'var(--gold)' : 'var(--border)',
              color: stationNames.length ? '#fff' : 'var(--text-xdim)',
              border: 'none', fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
            }}
          >
            <Printer size={15} /> Yazdır / PDF
          </button>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--text-dim)', fontSize: 13, fontFamily: 'inherit',
            }}
          >
            <X size={15} /> Kapat
          </button>
        </div>
      </div>

      {/* Önizleme */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
        {loading && <div className="loading"><div className="spinner" /> Yükleniyor...</div>}

        {!loading && stationNames.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-xdim)', marginTop: 40 }}>
            Seçili bölümlerde veri bulunamadı.
          </div>
        )}

        {!loading && stationNames.length > 0 && (
          <div
            ref={printRef}
            style={{
              background: '#fff', maxWidth: 800, margin: '0 auto',
              padding: '24px 32px', borderRadius: 12,
              boxShadow: '0 4px 24px rgba(0,0,0,.08)',
            }}
          >
            {/* Başlık */}
            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              Haftalık Üretim Planı
            </h1>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 24 }}>
              {sectionLabel} · {MEALS.find(m => m.id === meal)?.label} · {dateStr}
            </div>

            {/* İstasyon blokları */}
            {stationNames.map(name => (
              <div key={name} style={{ marginBottom: 28 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '.06em', padding: '6px 10px',
                  background: '#f5f3ef', borderLeft: '4px solid #8a6c2e',
                  marginBottom: 0,
                }}>
                  {name}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '5px 8px', border: '1px solid #e0ddd8', fontSize: 10, textAlign: 'left', background: '#faf9f6', color: '#777', width: 90 }}>Gün</th>
                      {meal === 'both' && <th style={{ padding: '5px 8px', border: '1px solid #e0ddd8', fontSize: 10, textAlign: 'left', background: '#faf9f6', color: '#777', width: 55 }}>Öğün</th>}
                      <th style={{ padding: '5px 8px', border: '1px solid #e0ddd8', fontSize: 10, textAlign: 'left', background: '#faf9f6', color: '#777' }}>Yemekler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan[name].map((row, i) => (
                      <tr key={i}>
                        <td style={{ padding: '6px 8px', border: '1px solid #e0ddd8', fontWeight: 600, fontSize: 11, verticalAlign: 'top', background: '#fafaf8', whiteSpace: 'nowrap' }}>
                          {row.day}
                        </td>
                        {meal === 'both' && (
                          <td style={{ padding: '6px 8px', border: '1px solid #e0ddd8', fontSize: 10, color: '#888', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                            {row.meal}
                          </td>
                        )}
                        <td style={{ padding: '6px 8px', border: '1px solid #e0ddd8', fontSize: 11, lineHeight: 1.7, verticalAlign: 'top' }}>
                          {row.dishes.join(' · ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
