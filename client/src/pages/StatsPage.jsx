import React, { useEffect, useState } from 'react'
import { Utensils, Leaf, Store, TrendingUp, Loader2 } from 'lucide-react'
import * as api from '../api.js'

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
const MEAL_LABEL = { lunch: 'Öğle', dinner: 'Akşam' }

export default function StatsPage() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.getStats().then(setData)
  }, [])

  if (!data) return (
    <>
      <div className="page-header"><div className="page-title">İstatistikler</div></div>
      <div className="page-body">
        <div className="loading"><Loader2 size={18} className="spinner" /> Yükleniyor...</div>
      </div>
    </>
  )

  const { byDay } = data
  const totalDishes   = byDay.reduce((s, m) => s + m.dish_count, 0)
  const totalVeg      = byDay.reduce((s, m) => s + m.vegetarian_count, 0)
  const totalStations = byDay.reduce((s, m) => s + m.station_count, 0)
  const avgPerMeal    = Math.round(totalDishes / 14)

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">İstatistikler</div>
          <div className="page-sub">Dağılım özeti</div>
        </div>
      </div>
      <div className="page-body">
        <div className="stats-grid mb-24">
          <div className="stat-card gold">
            <div className="stat-value">{totalDishes}</div>
            <div className="stat-label">Toplam Yemek</div>
          </div>
          <div className="stat-card green">
            <div className="stat-value">{totalVeg}</div>
            <div className="stat-label">Vejetaryen</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-value">{totalStations}</div>
            <div className="stat-label">İstasyon</div>
          </div>
          <div className="stat-card yellow">
            <div className="stat-value">{avgPerMeal}</div>
            <div className="stat-label">Öğün Başı Ort.</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Günlük Dağılım</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Gün</th>
                  <th>Öğün</th>
                  <th><Store size={12} style={{ verticalAlign: 'middle' }} /> İstasyon</th>
                  <th><Utensils size={12} style={{ verticalAlign: 'middle' }} /> Yemek</th>
                  <th><Leaf size={12} style={{ verticalAlign: 'middle' }} /> Vejetaryen</th>
                </tr>
              </thead>
              <tbody>
                {byDay.map((m, i) => (
                  <tr key={i}>
                    <td>{DAYS[m.day_of_week - 1]}</td>
                    <td>{MEAL_LABEL[m.meal_type]}</td>
                    <td>{m.station_count}</td>
                    <td>{m.dish_count}</td>
                    <td>
                      {m.vegetarian_count
                        ? <span className="badge badge-green">{m.vegetarian_count}</span>
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
