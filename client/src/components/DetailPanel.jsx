import React, { useState, useEffect } from 'react'
import { X, Trash2, Plus, ChevronDown, Leaf, Sprout } from 'lucide-react'
import * as api from '../api.js'

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
const MEAL_LABEL = { lunch: 'Öğle', dinner: 'Akşam' }

export default function DetailPanel({ menuId, templates, onClose, toast }) {
  const [menu, setMenu] = useState(null)
  const [theme, setTheme] = useState('')
  const [newStation, setNewStation] = useState('')
  const [tplValue, setTplValue] = useState('')

  useEffect(() => {
    if (!menuId) return
    api.getMenu(menuId).then(m => {
      setMenu(m)
      setTheme(m.theme || '')
    })
  }, [menuId])

  const refresh = () => api.getMenu(menuId).then(setMenu)

  const saveTheme = async () => {
    await api.updateMenuTheme(menuId, theme)
    toast('Tema kaydedildi', 'success')
  }

  const addStation = async (name) => {
    if (!name.trim()) return
    await api.addStation(menuId, name.trim())
    setNewStation('')
    setTplValue('')
    refresh()
  }

  const deleteStation = async (id) => {
    if (!confirm('İstasyonu sil?')) return
    await api.deleteStation(id)
    refresh()
    toast('İstasyon silindi', 'success')
  }

  const addDish = async (stationId, name, setVal) => {
    if (!name.trim()) return
    await api.addDish(stationId, { name: name.trim() })
    setVal('')
    refresh()
  }

  const deleteDish = async (id) => {
    await api.deleteDish(id)
    refresh()
  }

  const isOpen = !!menuId

  return (
    <>
      <div className={`detail-overlay${isOpen ? ' open' : ''}`} onClick={onClose} />
      <div className={`detail-panel${isOpen ? ' open' : ''}`}>
        {menu && (
          <>
            <div className="detail-header">
              <div style={{ flex: 1 }}>
                <div className="page-title">
                  {DAYS[menu.day_of_week - 1]} — {MEAL_LABEL[menu.meal_type]}
                </div>
                <div className="page-sub">İstasyon ve yemekler</div>
                <div className="theme-edit">
                  <input
                    type="text"
                    value={theme}
                    onChange={e => setTheme(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveTheme()}
                    placeholder="Tema / başlık..."
                  />
                  <button className="btn btn-sm btn-primary" onClick={saveTheme}>Kaydet</button>
                </div>
              </div>
              <button className="modal-close" onClick={onClose}><X size={16} /></button>
            </div>

            <div className="detail-body">
              {menu.stations.length === 0 && (
                <div className="loading" style={{ padding: '20px 0' }}>Henüz istasyon yok</div>
              )}

              {menu.stations.map(s => (
                <StationBlock
                  key={s.id}
                  station={s}
                  onDelete={() => deleteStation(s.id)}
                  onAddDish={addDish}
                  onDeleteDish={deleteDish}
                />
              ))}

              <div className="add-station-row">
                <select
                  className="form-select"
                  style={{ flex: 1, fontSize: 13 }}
                  value={tplValue}
                  onChange={e => setTplValue(e.target.value)}
                >
                  <option value="">Şablondan seç...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
                <button className="btn btn-sm btn-secondary" onClick={() => addStation(tplValue)}>
                  <Plus size={13} /> Şablondan
                </button>
              </div>

              <div className="inline-input mt-12">
                <input
                  type="text"
                  placeholder="Yeni istasyon adı..."
                  value={newStation}
                  onChange={e => setNewStation(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addStation(newStation)}
                />
                <button className="btn btn-sm btn-primary" onClick={() => addStation(newStation)}>
                  <Plus size={13} /> Ekle
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function StationBlock({ station, onDelete, onAddDish, onDeleteDish }) {
  const [dishInput, setDishInput] = useState('')

  return (
    <div className="station-block">
      <div className="station-header">
        <span className="station-name">{station.name}</span>
        <div className="station-actions">
          <button className="btn btn-sm btn-ghost btn-icon" onClick={onDelete} title="Sil">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="dish-list">
        {station.dishes.map(d => (
          <div key={d.id} className="dish-item">
            <span className="dish-name">{d.name}</span>
            <div className="dish-badges">
              {d.is_vegan
                ? <span className="badge badge-green"><Sprout size={10} /> Vegan</span>
                : d.is_vegetarian
                ? <span className="badge badge-blue"><Leaf size={10} /> Vejetaryen</span>
                : null}
            </div>
            <div className="dish-actions">
              <button className="btn btn-sm btn-ghost btn-icon" onClick={() => onDeleteDish(d.id)}>
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
        <div className="add-dish-row">
          <div className="inline-input">
            <input
              type="text"
              placeholder="Yemek ekle..."
              value={dishInput}
              onChange={e => setDishInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onAddDish(station.id, dishInput, setDishInput)}
            />
            <button className="btn btn-sm btn-ghost" onClick={() => onAddDish(station.id, dishInput, setDishInput)}>
              <Plus size={13} /> Ekle
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
