import React, { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Flame, Snowflake, RefreshCw, Loader2 } from 'lucide-react'

const DAYS = ['', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const DAYS_FULL = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
const MEAL_LABEL = { lunch: 'Öğle', dinner: 'Akşam' }

function RepeatBar({ rate, isFixed }) {
  const color = isFixed
    ? 'var(--blue)'
    : rate >= 80 ? 'var(--red)'
    : rate >= 50 ? 'var(--yellow)'
    : 'var(--green)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, minWidth: 80 }}>
        <div style={{ width: rate + '%', height: '100%', borderRadius: 3, background: color, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 12, color, fontWeight: 600, width: 34, textAlign: 'right' }}>%{rate}</span>
    </div>
  )
}

export default function BalancePage() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('variety') // variety | repeats | missing

  const load = () => {
    setLoading(true)
    fetch('/api/balance').then(r => r.json()).then(d => { setData(d); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const changing = data?.stationVariety.filter(s => !s.isFixed) || []
  const fixed    = data?.stationVariety.filter(s =>  s.isFixed) || []

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Denge Analizi</div>
          <div className="page-sub">
            {data
              ? `${data.totalDishes} yemek kaydı · ${data.uniqueDishes} benzersiz · tekrar oranı %${Math.round((data.totalDishes - data.uniqueDishes) / data.totalDishes * 100)}`
              : 'Yükleniyor...'}
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={13} /> Yenile
        </button>
      </div>

      {/* Özet kartlar */}
      {data && (
        <div style={{ padding: '16px 32px', display: 'flex', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <SummaryCard
            label="Değişen İstasyonlar"
            value={changing.filter(s => s.repeatRate < 50).length + ' / ' + changing.length}
            sub="çeşitlilik skoru iyi"
            color="var(--green)"
          />
          <SummaryCard
            label="Yüksek Tekrar"
            value={changing.filter(s => s.repeatRate >= 80).length}
            sub="istasyon %80+ aynı"
            color={changing.filter(s => s.repeatRate >= 80).length > 0 ? 'var(--red)' : 'var(--green)'}
          />
          <SummaryCard
            label="Tekrar Eden Yemek"
            value={data.topRepeats.length}
            sub="değişen istasyonlarda"
            color={data.topRepeats.length > 10 ? 'var(--yellow)' : 'var(--green)'}
          />
          <SummaryCard
            label="Eksik Bölüm"
            value={data.missingSection.length}
            sub="öğünde sıcak/soğuk eksik"
            color={data.missingSection.length > 0 ? 'var(--red)' : 'var(--green)'}
          />
        </div>
      )}

      {/* Sekmeler */}
      <div style={{ padding: '10px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6 }}>
        {[
          ['variety',  'İstasyon Çeşitliliği'],
          ['repeats',  'Tekrar Eden Yemekler'],
          ['missing',  'Eksik / Uyarılar'],
        ].map(([key, label]) => (
          <button key={key} className={`tab-btn${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      <div className="page-body">
        {loading && <div className="loading"><Loader2 size={16} className="spinner" /> Yükleniyor...</div>}

        {!loading && data && tab === 'variety' && (
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>

            {/* Değişmesi gereken istasyonlar */}
            <div className="card" style={{ flex: '1 1 480px' }}>
              <div className="card-title">
                Değişen İstasyonlar
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-dim)', marginLeft: 8 }}>peynir / salata / turşu hariç</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, fontSize: 11, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--red)', fontWeight: 600 }}>■ %80+ kritik</span>
                <span style={{ color: 'var(--yellow)', fontWeight: 600 }}>■ %50-79 orta</span>
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>■ %0-49 iyi</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {changing.map(st => (
                  <div key={st.name} style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                        {st.section === 'hot'  && <Flame size={10} style={{ color: 'var(--yellow)', marginRight: 4 }} />}
                        {st.section === 'cold' && <Snowflake size={10} style={{ color: 'var(--blue)', marginRight: 4 }} />}
                        {st.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        {st.appearances} öğün · {st.unique} farklı / {st.total} kayıt
                      </div>
                    </div>
                    <RepeatBar rate={st.repeatRate} isFixed={false} />
                  </div>
                ))}
              </div>
            </div>

            {/* Sabit büfe istasyonları */}
            <div className="card" style={{ flex: '1 1 360px' }}>
              <div className="card-title">
                Sabit Büfe İstasyonları
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-dim)', marginLeft: 8 }}>tekrar normal</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fixed.map(st => (
                  <div key={st.name} style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{st.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        {st.appearances} öğün · {st.unique} farklı / {st.total} kayıt
                      </div>
                    </div>
                    <RepeatBar rate={st.repeatRate} isFixed={true} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && data && tab === 'repeats' && (
          <div className="card" style={{ maxWidth: 700 }}>
            <div className="card-title">
              Tekrar Eden Yemekler
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-dim)', marginLeft: 8 }}>sabit büfe istasyonları hariç · en fazla tekrar eden 40</span>
            </div>
            {data.topRepeats.length === 0 ? (
              <div style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 8, padding: 16 }}>
                <CheckCircle size={16} /> Hiç tekrar eden yemek yok!
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Yemek</th>
                      <th style={{ width: 60, textAlign: 'center' }}>Tekrar</th>
                      <th>Hangi Öğünlerde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topRepeats.map((item, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500, textTransform: 'capitalize' }}>{item.name}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${item.count >= 7 ? 'badge-red' : item.count >= 4 ? 'badge-yellow' : 'badge-gray'}`}>
                            {item.count}x
                          </span>
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          {item.occurrences.map((o, j) => (
                            <span key={j} style={{ marginRight: 6, whiteSpace: 'nowrap' }}>
                              {DAYS[o.day]} {MEAL_LABEL[o.meal]}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!loading && data && tab === 'missing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
            {data.missingSection.length === 0 ? (
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--green)' }}>
                <CheckCircle size={18} /> Tüm öğünlerde sıcak ve soğuk bölüm mevcut!
              </div>
            ) : (
              <div className="card">
                <div className="card-title" style={{ color: 'var(--red)' }}>
                  <AlertTriangle size={15} /> Eksik Bölümler
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Gün</th><th>Öğün</th><th>Eksik</th></tr>
                    </thead>
                    <tbody>
                      {data.missingSection.map((m, i) => (
                        <tr key={i}>
                          <td>{DAYS_FULL[m.day]}</td>
                          <td>{MEAL_LABEL[m.meal]}</td>
                          <td>
                            {m.missing.map(s => (
                              <span key={s} className={`badge ${s === 'hot' ? 'badge-red' : 'badge-blue'}`} style={{ marginRight: 4 }}>
                                {s === 'hot' ? '🔥 Sıcak' : '❄️ Soğuk'}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-title">Öğün Başına Yemek Sayısı</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Gün</th>
                      <th>Öğün</th>
                      <th style={{ textAlign: 'center' }}>İstasyon</th>
                      <th style={{ textAlign: 'center' }}>Yemek</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.mealCounts.map((m, i) => {
                      const avg = Math.round(data.totalDishes / data.mealCounts.length)
                      const diff = m.dishCount - avg
                      return (
                        <tr key={i}>
                          <td>{DAYS_FULL[m.day]}</td>
                          <td>{MEAL_LABEL[m.meal]}</td>
                          <td style={{ textAlign: 'center' }}>{m.stationCount}</td>
                          <td style={{ textAlign: 'center' }}>
                            {m.dishCount}
                            {' '}
                            <span style={{ fontSize: 11, color: diff > 10 ? 'var(--red)' : diff < -10 ? 'var(--blue)' : 'var(--text-dim)' }}>
                              ({diff > 0 ? '+' : ''}{diff})
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function SummaryCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
      padding: '14px 20px', minWidth: 160, flex: '1 1 160px',
    }}>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>
    </div>
  )
}
