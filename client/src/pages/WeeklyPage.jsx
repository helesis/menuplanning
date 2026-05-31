import React, { useState, useEffect } from 'react'
import { Utensils, Store, Search, X, AlertTriangle, Info, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import DetailPanel from '../components/DetailPanel.jsx'

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
const MEAL_LABEL = { lunch: 'Öğle', dinner: 'Akşam' }

// Kategori renkleri (CSS değişkenleri yerine hex — SVG fill için)
const CAT_META = {
  soup:         { color: '#3b82f6', label: 'Çorba' },
  cold_starter: { color: '#94a3b8', label: 'Soğuk Başlangıç' },
  cold_dish:    { color: '#64748b', label: 'Soğuk Yemek' },
  hot_starter:  { color: '#f59e0b', label: 'Sıcak Başlangıç' },
  pasta_rice:   { color: '#d97706', label: 'Makarna/Pilav' },
  red_meat:     { color: '#ef4444', label: 'Kırmızı Et' },
  white_meat:   { color: '#fb923c', label: 'Beyaz Et' },
  offal:        { color: '#b91c1c', label: 'Sakatat' },
  fish:         { color: '#06b6d4', label: 'Balık' },
  seafood:      { color: '#0ea5e9', label: 'Deniz Mahsulleri' },
  vegetable:    { color: '#22c55e', label: 'Sebze/Vej.' },
  cheese:       { color: '#fbbf24', label: 'Peynirler' },
  olive:        { color: '#4ade80', label: 'Zeytinler' },
  sauce:        { color: '#a78bfa', label: 'Soslar' },
  dessert:      { color: '#a855f7', label: 'Tatlı' },
  other:        { color: '#cbd5e1', label: 'Diğer' },
}

function Highlight({ text, query }) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--gold-bg)', color: 'var(--gold)', borderRadius: 2, padding: '0 2px' }}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </span>
  )
}

function SearchHits({ hits, query }) {
  return (
    <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
      {hits.map((name, i) => (
        <div key={i} style={{ fontSize: 11, color: 'var(--text)', padding: '2px 0' }}>
          <Highlight text={name} query={query} />
        </div>
      ))}
    </div>
  )
}

function MenuCardContent({ m }) {
  return (
    <>
      <div className="menu-card-label">{MEAL_LABEL[m.meal_type]}</div>
      <div className="menu-card-theme">
        {m.theme || <span style={{ color: 'var(--text-xdim)' }}>Tema yok</span>}
      </div>
      <div className="menu-card-counts">
        <span className="menu-count-badge">
          <Store size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
          {m.station_count}
        </span>
        <span className="menu-count-badge">
          <Utensils size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
          {m.dish_count}
        </span>
      </div>
      {m.category_counts && Object.keys(m.category_counts).length > 0 && (
        <DonutChart counts={m.category_counts} dishes={m.category_dishes || {}} />
      )}
    </>
  )
}

function DonutChart({ counts, dishes }) {
  const [tooltip, setTooltip] = useState(null) // { id, x, y }
  const entries = Object.entries(counts).filter(([, v]) => v > 0)
  if (entries.length === 0) return null

  const total = entries.reduce((s, [, v]) => s + v, 0)
  const size = 72
  const cx = size / 2, cy = size / 2
  const R = 30, r = 16   // dış ve iç yarıçap
  const gap = 1.5        // dilimler arası boşluk (derece)

  // SVG yay hesaplama
  const toRad = d => (d - 90) * Math.PI / 180
  const arc = (start, end, outerR, innerR) => {
    const s1 = toRad(start), e1 = toRad(end)
    const s2 = toRad(end),   e2 = toRad(start)
    const lg = (end - start) > 180 ? 1 : 0
    return [
      `M ${cx + outerR * Math.cos(s1)} ${cy + outerR * Math.sin(s1)}`,
      `A ${outerR} ${outerR} 0 ${lg} 1 ${cx + outerR * Math.cos(e1)} ${cy + outerR * Math.sin(e1)}`,
      `L ${cx + innerR * Math.cos(s2)} ${cy + innerR * Math.sin(s2)}`,
      `A ${innerR} ${innerR} 0 ${lg} 0 ${cx + innerR * Math.cos(e2)} ${cy + innerR * Math.sin(e2)}`,
      'Z'
    ].join(' ')
  }

  const slices = []
  let angle = 0
  for (const [id, val] of entries) {
    const deg = (val / total) * 360
    const start = angle + gap / 2
    const end   = angle + deg - gap / 2
    if (end > start) {
      slices.push({ id, val, path: arc(start, end, R, r), color: CAT_META[id]?.color || '#ccc' })
    }
    angle += deg
  }

  // Tüm kategoriler, büyükten küçüğe
  const topCats = [...entries].sort((a, b) => b[1] - a[1])

  return (
    <div style={{ marginTop: 8, position: 'relative' }}>
      {/* Donut + legend yan yana üstte */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <svg width={size} height={size} style={{ flexShrink: 0 }}>
          {slices.map(s => (
            <path key={s.id} d={s.path} fill={s.color}
              style={{ cursor: 'pointer', opacity: tooltip?.id === s.id ? 0.7 : 1, transition: 'opacity .15s' }}
              onMouseEnter={() => setTooltip({ id: s.id })}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}
          <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize: 12, fontWeight: 700, fill: '#666' }}>
            {entries.length}
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize: 8, fill: '#aaa' }}>
            kat.
          </text>
        </svg>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {entries.length} kategori · {Object.values(counts).reduce((a,b)=>a+b,0)} yemek
        </div>
      </div>

      {/* Tüm kategoriler liste olarak */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {topCats.map(([id, val]) => (
          <div
            key={id}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '2px 4px', borderRadius: 4, cursor: 'default',
              background: tooltip?.id === id ? (CAT_META[id]?.color + '18') : 'transparent',
              transition: 'background .15s',
            }}
            onMouseEnter={() => setTooltip({ id })}
            onMouseLeave={() => setTooltip(null)}
          >
            <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_META[id]?.color || '#ccc', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-dim)', flex: 1 }}>
              {CAT_META[id]?.label || id}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && dishes[tooltip.id]?.length > 0 && (
        <div
          style={{
            position: 'fixed', zIndex: 9999,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '10px 14px', minWidth: 200, maxWidth: 280,
            boxShadow: '0 8px 24px rgba(0,0,0,.18)',
            pointerEvents: 'none',
            left: '50%', transform: 'translateX(-50%)',
            bottom: 'auto', top: 80,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
            color: CAT_META[tooltip.id]?.color || 'var(--text-dim)', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_META[tooltip.id]?.color }} />
            {CAT_META[tooltip.id]?.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {dishes[tooltip.id].map((name, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text)', borderBottom: i < dishes[tooltip.id].length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: 3 }}>
                {name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const SEVERITY_META = {
  error:   { color: '#ef4444', bg: '#fef2f2', border: '#fecaca', Icon: AlertCircle },
  warning: { color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', Icon: AlertTriangle },
  info:    { color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', Icon: Info },
}

function MiniBar({ counts }) {
  const max = Math.max(...counts.map(c => c.count), 1)
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 24, marginTop: 4 }}>
      {counts.map(({ day, count }) => (
        <div key={day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <div style={{ width: 18, height: Math.max(2, (count / max) * 20), background: count === 0 ? '#e2e8f0' : 'var(--gold)', borderRadius: 2 }} />
          <span style={{ fontSize: 8, color: 'var(--text-xdim)' }}>{day}</span>
        </div>
      ))}
    </div>
  )
}

function SuggestionList({ items, onApply }) {
  const [applying, setApplying] = useState(null)

  const apply = async (s, i) => {
    if (!s.action) return
    setApplying(i)
    await fetch('/api/suggestions/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s.action),
    })
    setApplying(null)
    onApply?.()
  }

  if (items.length === 0) return <div style={{ fontSize: 13, color: 'var(--text-dim)', padding: '8px 0' }}>Sorun bulunamadı ✓</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((s, i) => {
        const { color, bg, border, Icon } = SEVERITY_META[s.severity] || SEVERITY_META.info
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: bg, border: `1px solid ${border}`, borderRadius: 10 }}>
            <Icon size={15} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.title}</div>
              {s.detail && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{s.detail}</div>}
              {s.items && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {s.items.map((item, j) => (
                    <span key={j} style={{ fontSize: 11, background: color + '18', color, padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>{item}</span>
                  ))}
                </div>
              )}
              {s.hint && (
                <button
                  onClick={() => apply(s, i)}
                  disabled={applying === i}
                  style={{
                    marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: applying === i ? 'var(--border)' : 'var(--surface)',
                    border: '1px solid var(--border)', borderRadius: 20,
                    padding: '4px 12px', fontSize: 12, color: 'var(--text-dim)',
                    cursor: applying === i ? 'default' : 'pointer',
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => { if (applying !== i) e.currentTarget.style.background = 'var(--gold-bg)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = applying === i ? 'var(--border)' : 'var(--surface)' }}
                >
                  <span style={{ fontSize: 14 }}>{applying === i ? '⏳' : '💡'}</span>
                  {s.hint}
                </button>
              )}
              {s.counts && <MiniBar counts={s.counts} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SectionHeader({ title, badge, color, collapsed, onToggle }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 32px', cursor: 'pointer', background: 'var(--surface)', borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}
      onClick={onToggle}
    >
      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', flex: 1 }}>
        {title}
        {badge > 0 && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color }}> ● {badge} uyarı</span>}
        {badge === 0 && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-xdim)' }}>✓ sorun yok</span>}
      </span>
      {collapsed ? <ChevronDown size={14} color="var(--text-dim)" /> : <ChevronUp size={14} color="var(--text-dim)" />}
    </div>
  )
}

function SuggestionsPanel({ onRefresh }) {
  const [data, setData] = useState({ general: [], grill: [] })
  const [col1, setCol1] = useState(false)
  const [col2, setCol2] = useState(false)

  const reload = () => {
    fetch('/api/suggestions').then(r => r.json()).then(setData).catch(() => {})
    onRefresh?.()
  }

  useEffect(() => {
    fetch('/api/suggestions').then(r => r.json()).then(setData).catch(() => {})
  }, [])

  const { general = [], grill = [] } = data
  if (general.length === 0 && grill.length === 0) return null

  const generalBadge = general.filter(s => s.severity !== 'info').length
  const grillBadge   = grill.filter(s => s.severity !== 'info').length

  return (
    <div style={{ borderTop: '2px solid var(--border)', background: 'var(--bg)' }}>
      <SectionHeader
        title="Denge Önerileri"
        badge={generalBadge}
        color="#ef4444"
        collapsed={col1}
        onToggle={() => setCol1(v => !v)}
      />
      {!col1 && <div style={{ padding: '16px 32px' }}><SuggestionList items={general} onApply={reload} /></div>}

      <SectionHeader
        title="Izgara Önerileri"
        badge={grillBadge}
        color="#f59e0b"
        collapsed={col2}
        onToggle={() => setCol2(v => !v)}
      />
      {!col2 && <div style={{ padding: '16px 32px' }}><SuggestionList items={grill} onApply={reload} /></div>}
    </div>
  )
}

export default function WeeklyPage({ menus, templates, onRefresh, toast }) {
  const [filter, setFilter] = useState('all')
  const [openMenuId, setOpenMenuId] = useState(null)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState(null) // null = no search

  const meals = filter === 'all' ? ['lunch', 'dinner'] : [filter]

  // Arama: tüm menülerde yemek adlarını tara
  useEffect(() => {
    const q = search.trim().toLowerCase()
    if (!q) { setSearchResults(null); return }

    fetch('/api/menus')
      .then(r => r.json())
      .then(async summaries => {
        const results = {} // menuId -> [matchedDishName, ...]
        await Promise.all(summaries.map(async s => {
          const full = await fetch(`/api/menus/${s.id}`).then(r => r.json())
          const matched = []
          for (const st of full.stations)
            for (const d of st.dishes)
              if (d.name.toLowerCase().includes(q)) matched.push(d.name)
          if (matched.length) results[s.id] = matched
        }))
        setSearchResults(results)
      })
  }, [search])

  const handleClose = () => {
    setOpenMenuId(null)
    onRefresh()
  }

  const matchCount = searchResults ? Object.values(searchResults).reduce((s, a) => s + a.length, 0) : 0

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Haftalık Menü</div>
          <div className="page-sub">7 günlük öğle &amp; akşam planı</div>
        </div>
          <div className="tabs">
            {[['all', 'Tümü'], ['lunch', 'Öğle'], ['dinner', 'Akşam']].map(([val, label]) => (
              <button key={val} className={`tab-btn${filter === val ? ' active' : ''}`} onClick={() => setFilter(val)}>
                {label}
              </button>
            ))}
          </div>
      </div>

      {/* Arama barı */}
      <div style={{ padding: '10px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 32, paddingRight: search ? 28 : 12, width: 240, height: 34, fontSize: 13 }}
            placeholder="Yemek ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0, display: 'flex' }}>
              <X size={13} />
            </button>
          )}
        </div>
        {searchResults && (
          <span style={{ fontSize: 13, color: matchCount > 0 ? 'var(--gold)' : 'var(--text-dim)', fontWeight: 600 }}>
            {matchCount > 0 ? `${matchCount} yemek bulundu` : 'Sonuç bulunamadı'}
          </span>
        )}
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
        <div style={{ padding: '0 32px 32px' }}>
        <div className="day-grid-v2">
          {/* Gün başlıkları */}
          {DAYS.map((day, i) => (
            <div key={i} className="day-label" style={{ gridRow: 1, gridColumn: i + 1 }}>{day}</div>
          ))}

          {/* Öğle kartları */}
          {meals.includes('lunch') && DAYS.map((_, i) => {
            const m = menus.find(x => x.day_of_week === i + 1 && x.meal_type === 'lunch')
            if (!m) return <div key={`l${i}`} style={{ gridRow: 2, gridColumn: i + 1 }} />
            const hits = searchResults?.[m.id]
            const dimmed = searchResults && !hits
            return (
              <div key={`l${i}`} className="menu-card" style={{ gridRow: 2, gridColumn: i + 1, opacity: dimmed ? 0.25 : 1, transition: 'opacity .2s', outline: hits ? '2px solid var(--gold)' : 'none' }} onClick={() => setOpenMenuId(m.id)}>
                <MenuCardContent m={m} />
                {hits && <SearchHits hits={hits} query={search} />}
              </div>
            )
          })}

          {/* Akşam kartları */}
          {meals.includes('dinner') && DAYS.map((_, i) => {
            const row = meals.includes('lunch') ? 3 : 2
            const m = menus.find(x => x.day_of_week === i + 1 && x.meal_type === 'dinner')
            if (!m) return <div key={`d${i}`} style={{ gridRow: row, gridColumn: i + 1 }} />
            const hits = searchResults?.[m.id]
            const dimmed = searchResults && !hits
            return (
              <div key={`d${i}`} className="menu-card" style={{ gridRow: row, gridColumn: i + 1, opacity: dimmed ? 0.25 : 1, transition: 'opacity .2s', outline: hits ? '2px solid var(--gold)' : 'none' }} onClick={() => setOpenMenuId(m.id)}>
                <MenuCardContent m={m} />
                {hits && <SearchHits hits={hits} query={search} />}
              </div>
            )
          })}
        </div>
        </div>

        <SuggestionsPanel onRefresh={onRefresh} />
      </div>

      <DetailPanel
        menuId={openMenuId}
        templates={templates}
        onClose={handleClose}
        toast={toast}
      />
    </>
  )
}
