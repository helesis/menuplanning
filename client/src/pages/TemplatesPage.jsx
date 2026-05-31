import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import * as api from '../api.js'

export default function TemplatesPage({ templates, onRefresh, toast }) {
  const [name, setName] = useState('')

  const handleAdd = async () => {
    if (!name.trim()) return
    await api.addStationTemplate(name.trim())
    setName('')
    onRefresh()
    toast('Şablon eklendi', 'success')
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">İstasyon Şablonları</div>
          <div className="page-sub">Tekrar kullanılabilir istasyon isimleri</div>
        </div>
      </div>
      <div className="page-body">
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-title">Şablonlar</div>
          {templates.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 12 }}>Henüz şablon yok</div>
          )}
          {templates.map(t => (
            <div key={t.id} className="dish-item">
              <span className="dish-name">{t.name}</span>
            </div>
          ))}
          <div className="inline-input mt-16">
            <input
              type="text"
              placeholder="Yeni şablon adı..."
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button className="btn btn-primary btn-sm" onClick={handleAdd}>
              <Plus size={13} /> Ekle
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
