import React, { useState, useRef } from 'react'
import { FolderOpen, Clipboard, Eye, Download, RefreshCw, Loader2, Plus, Trash2 } from 'lucide-react'
import * as api from '../api.js'

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
const MEAL_LABEL = { lunch: 'Öğle', dinner: 'Akşam' }
const DAYS_TR = {
  'PAZARTESİ': 1, 'PAZARTESI': 1,
  'SALI': 2,
  'ÇARŞAMBA': 3, 'CARSAMBA': 3,
  'PERŞEMBE': 4, 'PERSEMBE': 4,
  'CUMA': 5,
  'CUMARTESİ': 6, 'CUMARTESI': 6,
  'PAZAR': 7,
}
const STATION_KEYWORDS = [
  // Çorbalar
  'ÇORBA','CORBA',
  // Sıcak bölüm
  'ARA SICAK','ARASICAK',
  'SEBZE YEMEKLERİ','SEBZE YEMEKLERI',
  'GÜVEÇ','GUVEC',
  'KESİM','KESIM',
  'WOK',
  'PANE',
  'MAKARNA',
  'ET TAVUK','IZGARA KÖŞESİ','IZGARA KOSESI','IZGARA',
  'RUS MUTFAĞI','RUS MUTFAGI',
  'TATLILAR',
  'SHOW İSTASYONU','SHOW ISTASYONU',
  // Soğuk bölüm
  'SOĞUK AYNA','SOGUK AYNA',
  'KIZARTMA','KIZARTMALAR',
  'PEYNİR','PEYNIR',
  'BALIK FÜME','BALIK FUME','BALIK',
  'İŞTAH AÇICI','IŞTAH AÇICI','ISTAH ACICI',
  'MEZE',
  'ZEYTİNYAĞLI DOLMA','ZEYTINYAGLI DOLMA',
  'ZEYTİNYAĞLILAR','ZEYTINYAGLILAR',
  'ZEYTİNYAĞLI','ZEYTINYAGLI',
  'STANDART SALATA','SALATA ÇEŞİTLERİ','SALATA CESITLERI',
  'SALATA SOSLARI','SALATA SOSU',
  'SALATA BARI',
  'TURŞU','TURSU',
  'ZEYTİN','ZEYTIN',
  'SUSHI',
  'BOWL SALATA',
  'SHOW',
]

function isMostlyUpper(text) {
  const letters = [...text].filter(c => /\p{L}/u.test(c))
  if (letters.length < 3) return false
  const uppers = letters.filter(c => c === c.toUpperCase() && c !== c.toLowerCase())
  return uppers.length / letters.length >= 0.6
}

function isStationHeader(text) {
  const t = text.toUpperCase()
  return isMostlyUpper(text) && STATION_KEYWORDS.some(kw => t.includes(kw))
}

function extractMeta(text) {
  const upper = text.toUpperCase()
  let day = null
  // Uzun isimleri önce kontrol et (CUMARTESI > CUMA, PAZARTESI > PAZAR)
  for (const [name, num] of Object.entries(DAYS_TR).sort((a, b) => b[0].length - a[0].length)) {
    if (upper.includes(name)) { day = num; break }
  }
  const meal = upper.includes('AKŞAM') || upper.includes('AKSAM') ? 'dinner'
             : upper.includes('ÖĞLEN') || upper.includes('OGLEN') || upper.includes('ÖĞLE') ? 'lunch'
             : null
  const section = upper.includes('SOĞUK') || upper.includes('SOGUK') ? 'cold'
                : upper.includes('TATLI') ? 'dessert'
                : upper.includes('SICAK') ? 'hot'
                : null
  return { day, meal, section }
}

function parseClipboardText(text) {
  const lines = text
    .split('\n')
    .map(line => line.split('\t').map(c => c.trim()).filter(Boolean).join(' ').trim())
    .filter(Boolean)
  if (lines.length === 0) return null

  // İlk istasyona kadar tüm satırları tara — gün/öğün/bölüm herhangi birinde olabilir
  let day = null, meal = null, section = null
  let theme = ''
  const stations = []
  let currentStation = null
  let firstStation = false

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]
    if (isStationHeader(t)) {
      firstStation = true
      currentStation = { name: t, dishes: [] }
      stations.push(currentStation)
    } else if (!firstStation) {
      const meta = extractMeta(t)
      if (!day     && meta.day)     day     = meta.day
      if (!meal    && meta.meal)    meal    = meta.meal
      if (!section && meta.section) section = meta.section
      // Gün/bölüm satırları tema sayılmaz; sadece açıklama niteliğindeyse tema yap
      if (meta.day || meta.meal || meta.section) continue
      theme = theme ? theme + ' ' + t : t
    } else if (currentStation) {
      currentStation.dishes.push(t)
    }
  }

  return { day, meal, section, theme, stations }
}

function PreviewBlock({ sheet, dayOverride, mealOverride }) {
  const day = dayOverride || sheet.day
  const meal = mealOverride || sheet.meal
  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
        {day ? DAYS[day - 1] : '?'} — {meal ? MEAL_LABEL[meal] : '?'}
        {sheet.theme && <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}> · {sheet.theme}</span>}
      </div>
      {sheet.stations.map((st, j) => (
        <div key={j}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', margin: '4px 0 2px' }}>{st.name}</div>
          {st.dishes.map((d, k) => (
            <div key={k} style={{ fontSize: 12, padding: '1px 12px' }}>• {d}</div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function ImportPage({ onRefresh, toast }) {
  const fileRef = useRef()
  const [filePreview, setFilePreview] = useState(null)
  const [loading, setLoading] = useState(false)

  const [pasteText, setPasteText] = useState('')
  const [parsed, setParsed] = useState(null)
  const [pasteDay, setPasteDay] = useState('')
  const [pasteMeal, setPasteMeal] = useState('')
  const [pasteSection, setPasteSection] = useState('')

  const handlePreview = async () => {
    const file = fileRef.current?.files[0]
    if (!file) { toast('Dosya seçin', 'error'); return }
    setLoading(true)
    const result = await api.previewExcel(file)
    setLoading(false)
    if (!result.ok) { toast(result.error || 'Hata', 'error'); return }
    setFilePreview(result.sheets)
  }

  const handleImport = async (overwrite) => {
    const file = fileRef.current?.files[0]
    if (!file) { toast('Dosya seçin', 'error'); return }
    setLoading(true)
    const result = await api.importExcel(file, { overwrite })
    setLoading(false)
    if (result.ok) {
      toast(`${result.imported} sayfa içe aktarıldı`, 'success')
      onRefresh(); setFilePreview(null)
    } else {
      toast(result.error || 'Hata', 'error')
    }
  }

  const handleChange = (text) => {
    setPasteText(text)
    const result = parseClipboardText(text)
    setParsed(result)
    if (result?.day)     setPasteDay(String(result.day))
    if (result?.meal)    setPasteMeal(result.meal)
    if (result?.section) setPasteSection(result.section)
  }

  const handlePasteImport = async (overwrite) => {
    if (!parsed) { toast('Önce içerik yapıştırın', 'error'); return }
    const day = Number(pasteDay)
    const meal = pasteMeal
    if (!day || !meal) { toast('Gün ve öğün seçin', 'error'); return }
    setLoading(true)
    const result = await api.importParsed([{ ...parsed, day, meal, section: pasteSection || null }], { overwrite })
    setLoading(false)
    if (result.ok) {
      toast('İçe aktarıldı', 'success')
      onRefresh()
      setPasteText(''); setParsed(null); setPasteDay(''); setPasteMeal('')
    } else {
      toast(result.error || 'Hata', 'error')
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">İçe Aktar</div>
          <div className="page-sub">Dosyadan veya panodan yapıştırarak menü yükle</div>
        </div>
      </div>
      <div className="page-body" style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Dosya */}
        <div className="card" style={{ flex: '1 1 400px', maxWidth: 520 }}>
          <div className="card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderOpen size={16} /> Dosyadan Yükle
            </span>
          </div>
          <div className="form-group mb-16">
            <label className="form-label">Excel Dosyası (.xlsx)</label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="form-input" />
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={handlePreview} disabled={loading}>
              <Eye size={14} /> Önizle
            </button>
            <button className="btn btn-primary" onClick={() => handleImport(false)} disabled={loading}>
              <Download size={14} /> Ekle
            </button>
            <button className="btn btn-danger" onClick={() => handleImport(true)} disabled={loading}>
              <RefreshCw size={14} /> Üzerine Yaz
            </button>
          </div>
          {loading && <div className="loading"><Loader2 size={16} className="spinner" /> İşleniyor...</div>}
          {filePreview && (
            <div className="mt-16">
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Önizleme — {filePreview.length} sayfa</div>
              {filePreview.map((s, i) => <div key={i} className="mb-16"><PreviewBlock sheet={s} /></div>)}
            </div>
          )}
        </div>

        {/* Yapıştırma */}
        <div className="card" style={{ flex: '1 1 400px', maxWidth: 520 }}>
          <div className="card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clipboard size={16} /> Panodan Yapıştır
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
            Excel'den kopyaladığınız hücreleri aşağıya yapıştırın.
          </p>
          <div className="form-group mb-12">
            <label className="form-label">İçerik</label>
            <textarea
              className="form-input"
              rows={8}
              placeholder="Ctrl+V ile Excel içeriğini buraya yapıştırın..."
              value={pasteText}
              onChange={e => handleChange(e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>

          {parsed && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }} className="mb-12">
                <div className="form-group">
                  <label className="form-label">Gün</label>
                  <select className="form-select" value={pasteDay} onChange={e => setPasteDay(e.target.value)}>
                    <option value="">Seçin...</option>
                    {DAYS.map((d, i) => <option key={i} value={i + 1}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Öğün</label>
                  <select className="form-select" value={pasteMeal} onChange={e => setPasteMeal(e.target.value)}>
                    <option value="">Seçin...</option>
                    <option value="lunch">Öğle</option>
                    <option value="dinner">Akşam</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Bölüm</label>
                  <select className="form-select" value={pasteSection} onChange={e => setPasteSection(e.target.value)}>
                    <option value="">Seçin...</option>
                    <option value="hot">🔥 Sıcak</option>
                    <option value="cold">❄️ Soğuk</option>
                    <option value="dessert">🍮 Tatlı</option>
                  </select>
                </div>
              </div>

              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-dim)', marginBottom: 8 }}>
                  Önizleme
                </div>
                <PreviewBlock sheet={parsed} dayOverride={pasteDay ? Number(pasteDay) : null} mealOverride={pasteMeal || null} />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" onClick={() => handlePasteImport(false)} disabled={loading}>
                  <Download size={14} /> Ekle
                </button>
                <button className="btn btn-danger" onClick={() => handlePasteImport(true)} disabled={loading}>
                  <RefreshCw size={14} /> Üzerine Yaz
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setPasteText(''); setParsed(null) }}>
                  <Trash2 size={13} /> Temizle
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </>
  )
}
