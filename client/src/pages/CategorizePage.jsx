import React, { useState, useEffect, useRef } from 'react'
import { Sparkles, Check, ChevronDown, Loader2, RefreshCw } from 'lucide-react'

const COURSE_COLORS = {
  soup:         'badge-blue',
  cold_starter: 'badge-gray',
  cold_dish:    'badge-gray',
  hot_starter:  'badge-yellow',
  pasta_rice:   'badge-gold',
  red_meat:     'badge-red',
  white_meat:   'badge-yellow',
  offal:        'badge-red',
  fish:         'badge-blue',
  seafood:      'badge-blue',
  vegetable:    'badge-green',
  cheese:       'badge-yellow',
  olive:        'badge-green',
  sauce:        'badge-gray',
  dessert:      'badge-gold',
  other:        'badge-gray',
}

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const MEAL = { lunch: 'Öğle', dinner: 'Akşam' }

export default function CategorizePage({ toast, isAdmin = false }) {
  const [courses, setCourses] = useState([])
  const [dishes, setDishes] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(null)
  const [filter, setFilter] = useState('all') // 'all' | 'uncategorized'
  const evtRef = useRef(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/courses').then(r => r.json()),
      fetch('/api/dishes/all').then(r => r.json()),
    ]).then(([c, d]) => { setCourses(c); setDishes(d); setLoading(false) })
  }, [])

  const reload = () => fetch('/api/dishes/all').then(r => r.json()).then(setDishes)

  const setCourse = async (dishId, courseId) => {
    await fetch(`/api/dishes/${dishId}/course`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course: courseId }),
    })
    setDishes(prev => prev.map(d => d.id === dishId ? { ...d, course: courseId } : d))
  }

  const categorizeOne = async (dishId) => {
    setDishes(prev => prev.map(d => d.id === dishId ? { ...d, _loading: true } : d))
    const res = await fetch(`/api/dishes/${dishId}/categorize`, { method: 'POST' })
    const data = await res.json()
    if (data.ok) {
      setDishes(prev => prev.map(d => d.id === dishId ? { ...d, course: data.course, _loading: false } : d))
      toast(`${data.label} olarak belirlendi`, 'success')
    } else {
      setDishes(prev => prev.map(d => d.id === dishId ? { ...d, _loading: false } : d))
      toast(data.error || 'Hata', 'error')
    }
  }

  const recategorizeOther = () => {
    setRunning(true)
    setProgress({ done: 0, total: 0 })
    const es = new EventSource('/api/dishes/recategorize-other')
    evtRef.current = es
    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      setProgress(data)
      if (data.finished) {
        es.close()
        setRunning(false)
        reload()
        toast('"Diğer" kategoriler yeniden değerlendirildi!', 'success')
      }
    }
    es.onerror = () => { es.close(); setRunning(false); toast('Bağlantı hatası', 'error') }
  }

  const recategorizeColdStarter = () => {
    setRunning(true)
    setProgress({ done: 0, total: 0 })
    const es = new EventSource('/api/dishes/recategorize-cold-starter')
    evtRef.current = es
    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      setProgress(data)
      if (data.finished) {
        es.close()
        setRunning(false)
        reload()
        toast('Soğuk başlangıçlar yeniden değerlendirildi!', 'success')
      }
    }
    es.onerror = () => { es.close(); setRunning(false); toast('Bağlantı hatası', 'error') }
  }

  const resetAndCategorize = async () => {
    if (!confirm('Tüm kategoriler sıfırlanıp yeniden AI ile belirlenecek. Emin misin?')) return
    await fetch('/api/dishes/reset-courses', { method: 'POST' })
    await reload()
    categorizeAll()
  }

  const categorizeAll = () => {
    setRunning(true)
    setProgress({ done: 0, total: 0 })
    const es = new EventSource('/api/dishes/categorize-all')
    evtRef.current = es
    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      setProgress(data)
      if (data.finished) {
        es.close()
        setRunning(false)
        reload()
        toast('Tüm yemekler kategorilendi!', 'success')
      }
    }
    es.onerror = () => {
      es.close()
      setRunning(false)
      toast('Bağlantı hatası', 'error')
    }
  }

  const stopAll = () => {
    evtRef.current?.close()
    setRunning(false)
    reload()
  }

  const filtered = filter === 'uncategorized'
    ? dishes.filter(d => !d.course)
    : dishes

  const uncategorizedCount = dishes.filter(d => !d.course).length

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Yemek Kategorileri</div>
          <div className="page-sub">{dishes.length} yemek · {uncategorizedCount} kategorisiz</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {running ? (
            <button className="btn btn-danger btn-sm" onClick={stopAll}>
              Durdur
            </button>
          ) : isAdmin ? (
            <>
              <button className="btn btn-primary" onClick={categorizeAll} disabled={uncategorizedCount === 0}>
                <Sparkles size={14} /> Kategorisizleri Kategorile ({uncategorizedCount})
              </button>
              <button className="btn btn-secondary" onClick={recategorizeOther}
                disabled={dishes.filter(d => d.course === 'other').length === 0}>
                <RefreshCw size={14} /> "Diğer"leri Yeniden Değerlendir ({dishes.filter(d => d.course === 'other').length})
              </button>
              <button className="btn btn-secondary" onClick={recategorizeColdStarter}
                disabled={dishes.filter(d => d.course === 'cold_starter').length === 0}>
                <RefreshCw size={14} /> Soğuk Başlangıçları Ayır ({dishes.filter(d => d.course === 'cold_starter').length})
              </button>
              <button className="btn btn-ghost btn-sm" onClick={resetAndCategorize}>
                <RefreshCw size={14} /> Sıfırla ve Yeniden Kategorile
              </button>
            </>) : null
          )}
        </div>
      </div>

      {/* İlerleme çubuğu */}
      {running && progress && (
        <div style={{ padding: '12px 32px', background: 'var(--gold-bg)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: 'var(--gold)', fontWeight: 600 }}>
              <Loader2 size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
              {progress.dish || 'Başlıyor...'}
              {progress.count > 1 && <span style={{ fontWeight: 400, marginLeft: 6 }}>({progress.count} kayıda uygulandı)</span>}
            </span>
            <span style={{ color: 'var(--text-dim)' }}>{progress.done} / {progress.total} benzersiz yemek</span>
          </div>
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
            <div style={{
              height: '100%', borderRadius: 2, background: 'var(--gold)',
              width: progress.total ? `${(progress.done / progress.total) * 100}%` : '0%',
              transition: 'width .3s',
            }} />
          </div>
        </div>
      )}

      <div style={{ padding: '12px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <button className={`tab-btn${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
          Tümü ({dishes.length})
        </button>
        <button className={`tab-btn${filter === 'uncategorized' ? ' active' : ''}`} onClick={() => setFilter('uncategorized')}>
          Kategorisiz ({uncategorizedCount})
        </button>
      </div>

      <div className="page-body">
        {loading && <div className="loading"><div className="spinner" /> Yükleniyor...</div>}

        {!loading && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Yemek</th>
                    <th>İstasyon</th>
                    <th>Gün / Öğün</th>
                    <th>Kategori</th>
                    <th style={{ width: 48 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(dish => (
                    <tr key={dish.id}>
                      <td style={{ fontWeight: 500 }}>{dish.name}</td>
                      <td style={{ color: 'var(--text-dim)', fontSize: 12 }}>{dish.station}</td>
                      <td style={{ color: 'var(--text-dim)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {DAYS[dish.day - 1]} {MEAL[dish.meal_type]}
                      </td>
                      <td>
                        <CourseSelect
                          value={dish.course}
                          courses={courses}
                          onChange={id => setCourse(dish.id, id)}
                        />
                      </td>
                      <td>
                        {isAdmin && (dish._loading
                          ? <Loader2 size={14} style={{ color: 'var(--text-xdim)', animation: 'spin .7s linear infinite' }} />
                          : (
                            <button
                              className="btn btn-ghost btn-sm btn-icon"
                              title="AI ile kategorile"
                              onClick={() => categorizeOne(dish.id)}
                            >
                              <Sparkles size={13} />
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 32 }}>
                      {filter === 'uncategorized' ? '🎉 Tüm yemekler kategorilendi!' : 'Yemek yok'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function CourseSelect({ value, courses, onChange }) {
  return (
    <select
      className="form-select"
      style={{ fontSize: 12, padding: '4px 8px', width: 'auto' }}
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
    >
      <option value="">— seçin —</option>
      {courses.map(c => (
        <option key={c.id} value={c.id}>{c.short || c.label}</option>
      ))}
    </select>
  )
}
