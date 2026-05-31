// .env dosyasını manuel oku — dotenvx sarmalayıcısını bypass et
const fs = require('fs');
const envPath = require('path').join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const express = require('express');
const cors    = require('cors');
const low     = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path    = require('path');
const multer  = require('multer');
const XLSX    = require('xlsx');
const Anthropic = require('@anthropic-ai/sdk');

// Kurs kategorileri
const COURSES = [
  { id: 'soup',         label: 'Çorba',                                        short: 'Çorba' },
  { id: 'cold_starter', label: 'Soğuk Başlangıç',                              short: 'Soğuk Başlangıç' },
  { id: 'cold_dish',    label: 'Soğuk Yemek',                                  short: 'Soğuk Yemek' },
  { id: 'hot_starter',  label: 'Sıcak Başlangıç',                              short: 'Sıcak Başlangıç' },
  { id: 'pasta_rice',   label: 'Makarna / Pilav',                              short: 'Makarna / Pilav' },
  { id: 'red_meat',     label: 'Kırmızı Et (Dana & Kuzu)',                     short: 'Kırmızı Et' },
  { id: 'white_meat',   label: 'Beyaz Et (Tavuk & Hindi)',                     short: 'Beyaz Et' },
  { id: 'offal',        label: 'Sakatat',                                      short: 'Sakatat' },
  { id: 'fish',         label: 'Balık (Çipura, Levrek)',                       short: 'Balık' },
  { id: 'seafood',      label: 'Deniz Mahsulleri (Kalamar, Karides, Midye)',   short: 'Deniz Mahsulleri' },
  { id: 'vegetable',    label: 'Sebze / Vejetaryen',                           short: 'Sebze / Vej.' },
  { id: 'cheese',       label: 'Peynirler',                                    short: 'Peynirler' },
  { id: 'olive',        label: 'Zeytinler',                                    short: 'Zeytinler' },
  { id: 'sauce',        label: 'Soslar & Garnitür',                            short: 'Soslar' },
  { id: 'dessert',      label: 'Tatlı',                                        short: 'Tatlı' },
  { id: 'other',        label: 'Diğer',                                        short: 'Diğer' },
];

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const db = low(new FileSync(path.join(__dirname, 'db.json')));

// ─── Schema defaults ────────────────────────────────────────────────────────────

db.defaults({ menus: [], templates: [], _seq: 200 }).write();

// ─── Seed templates ─────────────────────────────────────────────────────────────

if (!db.get('templates').size().value()) {
  const names = [
    'ÇORBALAR', 'ARASICAK VE SEBZE YEMEKLERİ', 'GÜVEÇ KÖŞESİ',
    'KESİM SUNUM KÖŞESİ', 'WOK TAVA YEMEKLERİ', 'PANE VE PATATES KÖŞESİ',
    'BALIK IZGARA KÖŞESİ', 'MAKARNA SHOW İSTASYONU', 'ET TAVUK IZGARA KÖŞESİ',
    'RUS MUTFAĞI KÖŞESİ', 'SALATA BARI', 'TATLILAR KÖŞESİ',
  ];
  db.set('templates', names.map((name, i) => ({ id: i + 1, name, display_order: i + 1 }))).write();
}

// ─── Seed 14 menu slots ─────────────────────────────────────────────────────────

if (!db.get('menus').size().value()) {
  const menus = [];
  let id = 1;
  for (let day = 1; day <= 7; day++) {
    for (const meal_type of ['lunch', 'dinner']) {
      menus.push({ id: id++, day_of_week: day, meal_type, theme: '', stations: [] });
    }
  }
  db.set('menus', menus).write();
}

// ─── ID generator ───────────────────────────────────────────────────────────────

const seq = () => {
  const id = db.get('_seq').value();
  db.update('_seq', n => n + 1).write();
  return id;
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

const findMenu = (id) => db.get('menus').find({ id: Number(id) }).value();

const findStation = (id) => {
  const numId = Number(id);
  for (const menu of db.get('menus').value()) {
    const station = menu.stations.find(s => s.id === numId);
    if (station) return { menu, station };
  }
  return null;
};

const findDish = (id) => {
  const numId = Number(id);
  for (const menu of db.get('menus').value()) {
    for (const station of menu.stations) {
      const dish = station.dishes.find(d => d.id === numId);
      if (dish) return { menu, station, dish };
    }
  }
  return null;
};

// ─── Routes ─────────────────────────────────────────────────────────────────────

app.get('/api/health', (_, res) => res.json({ ok: true }));

// Station templates
app.get('/api/station-templates', (_, res) => {
  res.json(db.get('templates').sortBy('display_order').value());
});

app.post('/api/station-templates', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const existing = db.get('templates').find({ name: name.trim() }).value();
  if (existing) return res.json(existing);
  const maxOrder = db.get('templates').map('display_order').max().value() || 0;
  const tpl = { id: seq(), name: name.trim(), display_order: maxOrder + 1 };
  db.get('templates').push(tpl).write();
  res.json(tpl);
});

// Menus overview (counts only)
app.get('/api/menus', (_, res) => {
  const rows = db.get('menus').value().map(m => {
    const category_counts = {};
    const category_dishes = {}; // id -> [name, ...]
    for (const st of m.stations)
      for (const d of st.dishes)
        if (d.course) {
          category_counts[d.course] = (category_counts[d.course] || 0) + 1;
          if (!category_dishes[d.course]) category_dishes[d.course] = [];
          category_dishes[d.course].push(d.name);
        }
    return {
    id:            m.id,
    day_of_week:   m.day_of_week,
    meal_type:     m.meal_type,
    theme:         m.theme,
    station_count: m.stations.length,
    dish_count:    m.stations.reduce((s, st) => s + st.dishes.length, 0),
    category_counts,
    category_dishes,
  }});
  res.json(rows);
});

// Single menu with full detail
app.get('/api/menus/:id', (req, res) => {
  const menu = findMenu(req.params.id);
  if (!menu) return res.status(404).json({ error: 'Not found' });
  res.json(menu);
});

// Update theme
app.put('/api/menus/:id', (req, res) => {
  db.get('menus').find({ id: Number(req.params.id) }).assign({ theme: req.body.theme ?? '' }).write();
  res.json({ ok: true });
});

// Add station to menu
app.post('/api/menus/:menuId/stations', (req, res) => {
  const { name, section } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const menu = findMenu(req.params.menuId);
  if (!menu) return res.status(404).json({ error: 'Menu not found' });
  const maxOrder = menu.stations.reduce((m, s) => Math.max(m, s.display_order), 0);
  const station = { id: seq(), name: name.trim(), section: section || null, display_order: maxOrder + 1, dishes: [] };
  db.get('menus').find({ id: Number(req.params.menuId) }).get('stations').push(station).write();
  res.json(station);
});

// Update station name / section
app.put('/api/stations/:id', (req, res) => {
  const found = findStation(req.params.id);
  if (!found) return res.status(404).json({ error: 'Not found' });
  if (req.body.name    !== undefined) found.station.name    = req.body.name;
  if (req.body.section !== undefined) found.station.section = req.body.section;
  db.write();
  res.json({ ok: true });
});

// Delete station (and its dishes)
app.delete('/api/stations/:id', (req, res) => {
  const numId = Number(req.params.id);
  const menu = db.get('menus').value().find(m => m.stations.some(s => s.id === numId));
  if (!menu) return res.status(404).json({ error: 'Not found' });
  db.get('menus').find({ id: menu.id }).get('stations').remove({ id: numId }).write();
  res.json({ ok: true });
});

// Add dish to station
app.post('/api/stations/:stationId/dishes', (req, res) => {
  const { name, notes = '', is_vegetarian = 0, is_vegan = 0, meat_type = '', cooking_method = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const found = findStation(req.params.stationId);
  if (!found) return res.status(404).json({ error: 'Station not found' });
  const maxOrder = found.station.dishes.reduce((m, d) => Math.max(m, d.display_order), 0);
  const dish = {
    id: seq(), name: name.trim(), notes, display_order: maxOrder + 1,
    is_vegetarian: is_vegetarian ? 1 : 0, is_vegan: is_vegan ? 1 : 0, meat_type, cooking_method,
  };
  found.station.dishes.push(dish);
  db.write();
  res.json(dish);
});

// Update dish
app.put('/api/dishes/:id', (req, res) => {
  const found = findDish(req.params.id);
  if (!found) return res.status(404).json({ error: 'Not found' });
  for (const f of ['name', 'notes', 'is_vegetarian', 'is_vegan', 'meat_type', 'cooking_method']) {
    if (req.body[f] !== undefined) {
      found.dish[f] = (f === 'is_vegetarian' || f === 'is_vegan') ? (req.body[f] ? 1 : 0) : req.body[f];
    }
  }
  db.write();
  res.json({ ok: true });
});

// Delete dish
app.delete('/api/dishes/:id', (req, res) => {
  const numId = Number(req.params.id);
  for (const menu of db.get('menus').value()) {
    for (const station of menu.stations) {
      const idx = station.dishes.findIndex(d => d.id === numId);
      if (idx !== -1) {
        station.dishes.splice(idx, 1);
        db.write();
        return res.json({ ok: true });
      }
    }
  }
  res.status(404).json({ error: 'Not found' });
});

// Copy a full menu to another slot
app.post('/api/menus/:fromId/copy-to/:toId', (req, res) => {
  const from = findMenu(req.params.fromId);
  if (!from) return res.status(404).json({ error: 'Source not found' });
  const newStations = from.stations.map(s => ({
    id: seq(), name: s.name, display_order: s.display_order,
    dishes: s.dishes.map(d => ({ ...d, id: seq() })),
  }));
  db.get('menus').find({ id: Number(req.params.toId) }).assign({ theme: from.theme, stations: newStations }).write();
  res.json({ ok: true });
});

// ─── Balance / Denge ────────────────────────────────────────────────────────────

const FIXED_KEYWORDS = ['PEYNİR','PEYNIR','SALATA','TURŞU','TURSU','ZEYTİN','ZEYTIN','DOLMA','FÜME','FUME','SOS'];

app.get('/api/balance', (_, res) => {
  const menus = db.get('menus').value();
  const DAYS = ['','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];

  // 1. Genel özet
  let totalDishes = 0;
  const allNames = [];
  const missingSection = [];
  for (const m of menus) {
    const hasSections = { hot: false, cold: false };
    for (const s of m.stations) {
      if (s.section === 'hot')  hasSections.hot  = true;
      if (s.section === 'cold') hasSections.cold = true;
      for (const d of s.dishes) { totalDishes++; allNames.push(d.name.trim().toLowerCase()); }
    }
    if (!hasSections.hot || !hasSections.cold) {
      missingSection.push({
        day: m.day_of_week, meal: m.meal_type,
        missing: [!hasSections.hot && 'hot', !hasSections.cold && 'cold'].filter(Boolean),
      });
    }
  }
  const uniqueDishes = new Set(allNames).size;

  // 2. İstasyon çeşitlilik skorları
  const stationMap = {};
  for (const m of menus) {
    for (const s of m.stations) {
      const key = s.name.trim();
      if (!stationMap[key]) stationMap[key] = { name: key, section: s.section, dishes: [], appearances: 0 };
      stationMap[key].appearances++;
      for (const d of s.dishes) stationMap[key].dishes.push(d.name.trim().toLowerCase());
    }
  }
  const stationVariety = Object.values(stationMap).map(st => {
    const total   = st.dishes.length;
    const unique  = new Set(st.dishes).size;
    const isFixed = FIXED_KEYWORDS.some(k => st.name.toUpperCase().includes(k));
    return {
      name: st.name, section: st.section, appearances: st.appearances,
      total, unique, repeatRate: total > 0 ? Math.round((total - unique) / total * 100) : 0,
      isFixed,
    };
  }).sort((a, b) => b.repeatRate - a.repeatRate);

  // 3. Öğün bazında tekrar eden yemekler (sabit istasyonlar hariç)
  const dishMeals = {}; // name -> [{day, meal}]
  for (const m of menus) {
    for (const s of m.stations) {
      const isFixed = FIXED_KEYWORDS.some(k => s.name.toUpperCase().includes(k));
      if (isFixed) continue;
      for (const d of s.dishes) {
        const n = d.name.trim().toLowerCase();
        if (!dishMeals[n]) dishMeals[n] = [];
        dishMeals[n].push({ day: m.day_of_week, meal: m.meal_type, station: s.name });
      }
    }
  }
  const topRepeats = Object.entries(dishMeals)
    .filter(([, v]) => v.length > 1)
    .map(([name, occurrences]) => ({ name, count: occurrences.length, occurrences }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);

  // 4. Çorba çeşitliliği (günlük bazda)
  const soupByMeal = {};
  for (const m of menus) {
    const key = `${m.day_of_week}_${m.meal_type}`;
    for (const s of m.stations) {
      if (s.name.toUpperCase().includes('ÇORBA') || s.name.toUpperCase().includes('CORBA')) {
        soupByMeal[key] = s.dishes.map(d => d.name);
      }
    }
  }

  // 5. Öğün başına yemek sayısı
  const mealCounts = menus.map(m => ({
    day: m.day_of_week, meal: m.meal_type,
    dishCount: m.stations.reduce((s, st) => s + st.dishes.length, 0),
    stationCount: m.stations.length,
  }));

  res.json({ totalDishes, uniqueDishes, missingSection, stationVariety, topRepeats, soupByMeal, mealCounts });
});

// Distribution stats
app.get('/api/stats', (_, res) => {
  const byDay = db.get('menus').value().map(m => ({
    day_of_week:      m.day_of_week,
    meal_type:        m.meal_type,
    station_count:    m.stations.length,
    dish_count:       m.stations.reduce((s, st) => s + st.dishes.length, 0),
    vegetarian_count: m.stations.reduce((s, st) => s + st.dishes.filter(d => d.is_vegetarian).length, 0),
  }));
  res.json({ byDay });
});

// ─── Excel Import ────────────────────────────────────────────────────────────────

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const DAYS_TR = {
  'PAZARTESİ': 1, 'PAZARTESI': 1,
  'SALI': 2, 'SALII': 2,
  'ÇARŞAMBA': 3, 'CARSAMBA': 3,
  'PERŞEMBE': 4, 'PERSEMBE': 4,
  'CUMA': 5,
  'CUMARTESİ': 6, 'CUMARTESI': 6,
  'PAZAR': 7,
};

// Keywords that identify a row as a station header
const STATION_KEYWORDS = [
  // Çorbalar
  'ÇORBA', 'CORBA',
  // Sıcak bölüm
  'ARA SICAK', 'ARASICAK',
  'SEBZE YEMEKLERİ', 'SEBZE YEMEKLERI',
  'GÜVEÇ', 'GUVEC',
  'KESİM', 'KESIM',
  'WOK',
  'PANE',
  'MAKARNA',
  'ET TAVUK', 'IZGARA KÖŞESİ', 'IZGARA KOSESI', 'IZGARA',
  'RUS MUTFAĞI', 'RUS MUTFAGI',
  'TATLILAR',
  'SHOW İSTASYONU', 'SHOW ISTASYONU',
  // Soğuk bölüm
  'SOĞUK AYNA', 'SOGUK AYNA',
  'KIZARTMA', 'KIZARTMALAR',
  'PEYNİR', 'PEYNIR',
  'BALIK FÜME', 'BALIK FUME', 'BALIK',
  'İŞTAH AÇICI', 'IŞTAH AÇICI', 'ISTAH ACICI',
  'MEZE',
  'ZEYTİNYAĞLI DOLMA', 'ZEYTINYAGLI DOLMA',
  'ZEYTİNYAĞLILAR', 'ZEYTINYAGLILAR',
  'ZEYTİNYAĞLI', 'ZEYTINYAGLI',
  'STANDART SALATA', 'SALATA ÇEŞİTLERİ', 'SALATA CESITLERI',
  'SALATA SOSLARI', 'SALATA SOSU',
  'SALATA BARI',
  'TURŞU', 'TURSU',
  'ZEYTİN', 'ZEYTIN',
  'SUSHI',
  'BOWL SALATA',
  'SHOW',
];

function isMostlyUpper(text) {
  const letters = text.match(/\p{L}/gu) || [];
  if (letters.length < 3) return false;
  const uppers = letters.filter(c => c === c.toUpperCase() && c !== c.toLowerCase());
  return uppers.length / letters.length >= 0.6;
}

function isStationHeader(text) {
  const t = text.toUpperCase();
  return isMostlyUpper(text) && STATION_KEYWORDS.some(kw => t.includes(kw));
}

function extractMeta(text) {
  const upper = text.toUpperCase();
  let day = null;
  // Uzun isimleri önce kontrol et (CUMARTESI > CUMA, PAZARTESI > PAZAR)
  for (const [name, num] of Object.entries(DAYS_TR).sort((a, b) => b[0].length - a[0].length)) {
    if (upper.includes(name)) { day = num; break; }
  }
  const meal = upper.includes('AKŞAM') || upper.includes('AKSAM') ? 'dinner'
             : upper.includes('ÖĞLEN') || upper.includes('OGLEN') || upper.includes('ÖĞLE') ? 'lunch'
             : null;
  const section = upper.includes('SOĞUK') || upper.includes('SOGUK') ? 'cold'
                : upper.includes('TATLI') ? 'dessert'
                : upper.includes('SICAK') ? 'hot'
                : null;
  return { day, meal, section };
}

function getCellText(sheet, r, colMax) {
  const parts = [];
  for (let c = 0; c <= colMax; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c })];
    if (cell?.v != null) parts.push(String(cell.v).trim());
  }
  return parts.filter(Boolean).join(' ').trim();
}

function parseExcelBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellStyles: true });
  const results = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet['!ref']) continue;
    const range = XLSX.utils.decode_range(sheet['!ref']);

    // Collect non-empty rows
    const rows = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      const text = getCellText(sheet, r, range.e.c);
      if (!text) continue;
      // Check if any cell in this row is bold
      let bold = false;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (cell?.s?.font?.bold) { bold = true; break; }
      }
      rows.push({ text, bold });
    }

    if (rows.length === 0) continue;

    // İlk istasyona kadar tüm satırları tara — gün/öğün/bölüm herhangi birinde olabilir
    let day = null, meal = null, section = null;
    let theme = '';
    const stations = [];
    let currentStation = null;
    let firstStationFound = false;

    for (let i = 0; i < rows.length; i++) {
      const { text, bold } = rows[i];

      if (isStationHeader(text) || bold) {
        firstStationFound = true;
        currentStation = { name: text, dishes: [] };
        stations.push(currentStation);
      } else if (!firstStationFound) {
        const meta = extractMeta(text);
        if (!day     && meta.day)     day     = meta.day;
        if (!meal    && meta.meal)    meal    = meta.meal;
        if (!section && meta.section) section = meta.section;
        // Gün/bölüm satırları tema sayılmaz
        if (meta.day || meta.meal || meta.section) continue;
        if (theme) theme += ' ' + text; else theme = text;
      } else if (currentStation) {
        currentStation.dishes.push(text);
      }
    }

    results.push({ sheetName, day, meal, section, theme, stations });
  }

  return results;
}

// POST /api/import?preview=1  →  returns parsed data without saving
// POST /api/import?overwrite=1 →  replaces existing stations (default: append)
app.post('/api/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Dosya gerekli' });

  let parsed;
  try {
    parsed = parseExcelBuffer(req.file.buffer);
  } catch (err) {
    console.error('Excel parse hatası:', err);
    return res.status(400).json({ error: 'Excel okunamadı: ' + err.message });
  }

  if (req.query.preview === '1') {
    return res.json({ ok: true, sheets: parsed });
  }

  // Actual import
  const overwrite = req.query.overwrite === '1';
  let importedSheets = 0;

  for (const item of parsed) {
    // Allow manual override of day/meal via body
    const day  = item.day  ?? Number(req.body?.day);
    const meal = item.meal ?? req.body?.meal;
    if (!day || !meal) continue;

    const menu = db.get('menus').find({ day_of_week: day, meal_type: meal }).value();
    if (!menu) continue;

    const targetSection = item.section || null;

    if (overwrite) {
      if (targetSection) {
        const kept = findMenu(menu.id).stations.filter(st => st.section !== targetSection);
        db.get('menus').find({ id: menu.id }).assign({ stations: kept }).write();
        if (item.theme) db.get('menus').find({ id: menu.id }).assign({ theme: item.theme }).write();
      } else {
        db.get('menus').find({ id: menu.id }).assign({ theme: item.theme, stations: [] }).write();
      }
    } else if (item.theme) {
      db.get('menus').find({ id: menu.id }).assign({ theme: item.theme }).write();
    }

    const freshMenu = findMenu(menu.id);
    for (const s of item.stations) {
      const maxOrder = freshMenu.stations.reduce((m, st) => Math.max(m, st.display_order), 0);
      const station = {
        id: seq(), name: s.name, section: s.section || targetSection || null,
        display_order: maxOrder + 1,
        dishes: s.dishes.map((name, i) => ({
          id: seq(), name, notes: '', display_order: i + 1,
          is_vegetarian: 0, is_vegan: 0, meat_type: '', cooking_method: '',
        })),
      };
      db.get('menus').find({ id: menu.id }).get('stations').push(station).write();
    }
    importedSheets++;
  }

  res.json({ ok: true, imported: importedSheets, sheets: parsed });
});

// Accept pre-parsed JSON from client (used for clipboard paste)
function doImport(sheets, overwrite) {
  let count = 0;
  for (const item of sheets) {
    const day  = item.day;
    const meal = item.meal;
    if (!day || !meal) continue;
    const menu = db.get('menus').find({ day_of_week: day, meal_type: meal }).value();
    if (!menu) continue;

    // Hangi section üzerine yazılacak?
    const targetSection = item.section || null;

    if (overwrite) {
      if (targetSection) {
        // Sadece aynı section'daki istasyonları sil, diğerlerini koru
        const kept = findMenu(menu.id).stations.filter(st => st.section !== targetSection);
        db.get('menus').find({ id: menu.id }).assign({ stations: kept }).write();
        if (item.theme) {
          db.get('menus').find({ id: menu.id }).assign({ theme: item.theme }).write();
        }
      } else {
        // Section belirtilmemişse tüm istasyonları temizle
        db.get('menus').find({ id: menu.id }).assign({ theme: item.theme || '', stations: [] }).write();
      }
    } else if (item.theme) {
      db.get('menus').find({ id: menu.id }).assign({ theme: item.theme }).write();
    }

    const freshMenu = findMenu(menu.id);
    for (const s of item.stations) {
      const maxOrder = freshMenu.stations.reduce((m, st) => Math.max(m, st.display_order), 0);
      const station = {
        id: seq(), name: s.name, section: s.section || targetSection || null,
        display_order: maxOrder + 1,
        dishes: (s.dishes || []).map((name, i) => ({
          id: seq(), name, notes: '', display_order: i + 1,
          is_vegetarian: 0, is_vegan: 0, meat_type: '', cooking_method: '',
        })),
      };
      db.get('menus').find({ id: menu.id }).get('stations').push(station).write();
    }
    count++;
  }
  return count;
}

app.post('/api/import-parsed', (req, res) => {
  const { sheets, overwrite } = req.body;
  if (!sheets || !Array.isArray(sheets)) return res.status(400).json({ error: 'sheets required' });
  const imported = doImport(sheets, overwrite);
  res.json({ ok: true, imported });
});

// ─── Kurs kategorileri ───────────────────────────────────────────────────────

app.get('/api/courses', (_, res) => res.json(COURSES));

app.put('/api/dishes/:id/course', (req, res) => {
  const found = findDish(req.params.id);
  if (!found) return res.status(404).json({ error: 'Not found' });
  found.dish.course = req.body.course ?? null;
  db.write();
  res.json({ ok: true });
});

// ─── AI Kategorilendirme ─────────────────────────────────────────────────────

// Tüm yemekleri listele (kategorisiz olanlar dahil)
app.get('/api/dishes/all', (_, res) => {
  const dishes = [];
  for (const menu of db.get('menus').value()) {
    for (const station of menu.stations) {
      for (const dish of station.dishes) {
        dishes.push({
          id: dish.id,
          name: dish.name,
          course: dish.course || null,
          station: station.name,
          day: menu.day_of_week,
          meal_type: menu.meal_type,
        });
      }
    }
  }
  res.json(dishes);
});

// Tek yemeği AI ile kategorilendirme
app.post('/api/dishes/:id/categorize', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(400).json({ error: 'ANTHROPIC_API_KEY eksik' });
  }
  const found = findDish(req.params.id);
  if (!found) return res.status(404).json({ error: 'Not found' });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const courseList = COURSES.map(c => `${c.id}: ${c.label}`).join('\n');

  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Aşağıdaki yemek hangi kategoriye giriyor? Sadece kategori id'sini yaz, başka hiçbir şey yazma.

Yemek adı: ${found.dish.name}
İstasyon: ${found.station.name}

Kategoriler:
${courseList}

Cevap (sadece id):`,
      }],
    });

    const courseId = msg.content[0].text.trim().toLowerCase();
    const valid = COURSES.find(c => c.id === courseId);
    const finalId = valid ? courseId : 'other';

    found.dish.course = finalId;
    db.write();
    res.json({ ok: true, course: finalId, label: COURSES.find(c => c.id === finalId)?.label });
  } catch (err) {
    console.error('Claude API hatası:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// "Diğer" olarak işaretlenenleri yeniden kategorile (SSE)
app.get('/api/dishes/recategorize-other', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(400).json({ error: 'ANTHROPIC_API_KEY eksik' });
  }

  const allOther = [];
  for (const menu of db.get('menus').value())
    for (const station of menu.stations)
      for (const dish of station.dishes)
        if (dish.course === 'other')
          allOther.push({ dish, stationName: station.name });

  if (allOther.length === 0) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(`data: ${JSON.stringify({ done: 0, total: 0, finished: true })}\n\n`);
    return res.end();
  }

  // Benzersiz isimlere göre grupla
  const nameMap = {};
  for (const { dish, stationName } of allOther) {
    const key = dish.name.trim().toLowerCase();
    if (!nameMap[key]) nameMap[key] = { displayName: dish.name.trim(), stationName, dishes: [] };
    nameMap[key].dishes.push(dish);
  }
  const uniqueGroups = Object.values(nameMap);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const courseList = COURSES.map(c => `${c.id}: ${c.label}`).join('\n');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let done = 0;
  const total = uniqueGroups.length;
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  for (const group of uniqueGroups) {
    try {
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 20,
        messages: [{
          role: 'user',
          content: `Türk mutfağında bu ürünü aşağıdaki kategorilerden en uygununa ata. Sadece kategori id'sini yaz, başka hiçbir şey yazma.

Kurallar:
- Peynir çeşitleri, beyaz peynir, kaşar, lor → cheese
- Zeytin çeşitleri, yeşil/siyah zeytin → olive
- Sos, garnitür, turşu, ekmek → sauce
- Salata → cold_starter
- Zeytinyağlı soğuk yemekler → cold_dish
- Izgara/fırın dana, kuzu, köfte → red_meat
- Izgara/fırın tavuk, hindi → white_meat
- Ciğer, böbrek, işkembe → offal
- Balık ızgara/fırın → fish
- Karides, kalamar, midye → seafood
- Sebze yemeği, güveç (etsiz) → vegetable
- Börek, sigara böreği, kızarmış → hot_starter
- Makarna, pilav, risotto → pasta_rice
- Tatlı, pasta → dessert

Ürün: ${group.displayName}
İstasyon: ${group.stationName}

Kategoriler:
${courseList}

Kategori id:`,
        }],
      });

      const rawId = msg.content[0].text.trim().toLowerCase().replace(/[^a-z_]/g, '');
      const valid = COURSES.find(c => c.id === rawId);
      const finalId = valid ? rawId : 'other';

      for (const dish of group.dishes) dish.course = finalId;
      db.write();
      done++;
      send({ done, total, dish: group.displayName, count: group.dishes.length, course: finalId });
    } catch (err) {
      send({ done, total, dish: group.displayName, error: err.message });
    }
  }

  send({ done, total, finished: true });
  res.end();
});

// Soğuk Başlangıç olarak işaretlenenleri yeniden kategorile (peynir/zeytin/sos ayrımı için)
app.get('/api/dishes/recategorize-cold-starter', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(400).json({ error: 'ANTHROPIC_API_KEY eksik' });
  }

  const targets = [];
  for (const menu of db.get('menus').value())
    for (const station of menu.stations)
      for (const dish of station.dishes)
        if (dish.course === 'cold_starter')
          targets.push({ dish, stationName: station.name });

  if (targets.length === 0) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(`data: ${JSON.stringify({ done: 0, total: 0, finished: true })}\n\n`);
    return res.end();
  }

  const nameMap = {};
  for (const { dish, stationName } of targets) {
    const key = dish.name.trim().toLowerCase();
    if (!nameMap[key]) nameMap[key] = { displayName: dish.name.trim(), stationName, dishes: [] };
    nameMap[key].dishes.push(dish);
  }
  const uniqueGroups = Object.values(nameMap);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const courseList = COURSES.map(c => `${c.id}: ${c.label}`).join('\n');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let done = 0;
  const total = uniqueGroups.length;
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  for (const group of uniqueGroups) {
    try {
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 20,
        messages: [{
          role: 'user',
          content: `Türk mutfağında bu ürünü aşağıdaki kategorilerden en uygununa ata. Sadece kategori id'sini yaz, başka hiçbir şey yazma.

Kurallar:
- Peynir çeşitleri, beyaz peynir, kaşar, lor, tulum → cheese
- Zeytin çeşitleri, yeşil/siyah zeytin → olive
- Sos, ketçap, mayonez, hardal, garnitür, turşu, ekmek → sauce
- Meze, söğüş, işlenmemiş sebze tabakları, salata → cold_starter
- Zeytinyağlı soğuk pişmiş yemekler → cold_dish

Ürün: ${group.displayName}
İstasyon: ${group.stationName}

Kategoriler:
${courseList}

Kategori id:`,
        }],
      });

      const rawId = msg.content[0].text.trim().toLowerCase().replace(/[^a-z_]/g, '');
      const valid = COURSES.find(c => c.id === rawId);
      const finalId = valid ? rawId : 'cold_starter';

      for (const dish of group.dishes) dish.course = finalId;
      db.write();
      done++;
      send({ done, total, dish: group.displayName, count: group.dishes.length, course: finalId });
    } catch (err) {
      send({ done, total, dish: group.displayName, error: err.message });
    }
  }

  send({ done, total, finished: true });
  res.end();
});

// Tüm kategorileri sıfırla
app.post('/api/dishes/reset-courses', (req, res) => {
  let count = 0;
  for (const menu of db.get('menus').value())
    for (const station of menu.stations)
      for (const dish of station.dishes)
        if (dish.course) { dish.course = null; count++; }
  db.write();
  res.json({ ok: true, reset: count });
});

// Toplu AI kategorilendirme — teker teker, claude-sonnet
app.get('/api/dishes/categorize-all', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(400).json({ error: 'ANTHROPIC_API_KEY eksik' });
  }

  // Kategorisiz tüm dish referanslarını topla (reset=1 ise hepsini dahil et)
  const allUncategorized = [];
  for (const menu of db.get('menus').value()) {
    for (const station of menu.stations) {
      for (const dish of station.dishes) {
        if (!dish.course) {
          allUncategorized.push({ dish, stationName: station.name });
        }
      }
    }
  }

  if (allUncategorized.length === 0) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(`data: ${JSON.stringify({ done: 0, total: 0, finished: true })}\n\n`);
    return res.end();
  }

  // Benzersiz isimlere göre grupla
  const nameMap = {};
  for (const { dish, stationName } of allUncategorized) {
    const key = dish.name.trim().toLowerCase();
    if (!nameMap[key]) nameMap[key] = { displayName: dish.name.trim(), stationName, dishes: [] };
    nameMap[key].dishes.push(dish);
  }
  const uniqueGroups = Object.values(nameMap);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const courseList = COURSES.map(c => `${c.id}: ${c.label}`).join('\n');

  // SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let done = 0;
  const total = uniqueGroups.length;
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  for (const group of uniqueGroups) {
    try {
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 20,
        messages: [{
          role: 'user',
          content: `Türk mutfağında bu yemeği aşağıdaki kategorilerden birine ata. Sadece kategori id'sini yaz, başka hiçbir şey yazma.

Yemek: ${group.displayName}
İstasyon: ${group.stationName}

Kategoriler:
${courseList}

Kategori id:`,
        }],
      });

      const rawId = msg.content[0].text.trim().toLowerCase().replace(/[^a-z_]/g, '');
      const valid = COURSES.find(c => c.id === rawId);
      const finalId = valid ? rawId : 'other';

      for (const dish of group.dishes) dish.course = finalId;
      db.write();
      done++;
      send({ done, total, dish: group.displayName, count: group.dishes.length, course: finalId });
    } catch (err) {
      send({ done, total, dish: group.displayName, error: err.message });
    }
  }

  send({ done, total, finished: true });
  res.end();
});

// Haftalık denge önerileri
app.get('/api/suggestions', (_, res) => {
  const menus = db.get('menus').value();
  const DAYS_TR = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  const MEAL_TR = { lunch: 'Öğle', dinner: 'Akşam' };

  const HOT_COURSES = new Set(['soup','hot_starter','pasta_rice','red_meat','white_meat','offal','fish','seafood','vegetable']);

  // 14 menüden 5+ tanesinde geçen "sabit" yemekleri bul (balık köşesi, makarna show vs.)
  const dishMenuCount = {};
  for (const m of menus)
    for (const st of m.stations)
      for (const d of st.dishes)
        if (HOT_COURSES.has(d.course)) {
          const key = d.name.trim().toLowerCase();
          dishMenuCount[key] = (dishMenuCount[key] || 0) + 1;
        }
  const isFixture = name => (dishMenuCount[name] || 0) >= 8;

  // Sıralı öğün listesi: Pzt Öğle, Pzt Akşam, Sal Öğle, ...
  const seq = [];
  for (let day = 1; day <= 7; day++) {
    for (const meal of ['lunch', 'dinner']) {
      const m = menus.find(x => x.day_of_week === day && x.meal_type === meal);
      if (!m) continue;
      const dishes = m.stations
        .flatMap(st => st.dishes.filter(d => HOT_COURSES.has(d.course)).map(d => d.name.trim().toLowerCase()))
        .filter(d => !isFixture(d));
      const cats = {};
      for (const st of m.stations)
        for (const d of st.dishes)
          if (d.course) cats[d.course] = (cats[d.course] || 0) + 1;
      seq.push({ day, meal, menuId: m.id, dishes, cats });
    }
  }

  const suggestions = [];

  // 1. Tekrar eden yemekler: aynı gün öğle↔akşam, önceki akşam↔sonraki öğle, Pazar Akşam↔Pazartesi Öğle
  const pazarAksam   = seq.find(x => x.day === 7 && x.meal === 'dinner');
  const pztOgle      = seq.find(x => x.day === 1 && x.meal === 'lunch');
  const checkPairs   = [...Array(seq.length - 1).keys()].map(i => [seq[i], seq[i + 1]]);
  if (pazarAksam && pztOgle) checkPairs.push([pazarAksam, pztOgle]);

  for (const [a, b] of checkPairs) {
    const isPair = (a.day === b.day) || (a.meal === 'dinner' && b.meal === 'lunch');
    if (!isPair) continue;
    const repeats = a.dishes.filter(d => d.length > 3 && b.dishes.includes(d));
    if (repeats.length > 0) {
      const labelA = `${DAYS_TR[a.day - 1]} ${MEAL_TR[a.meal]}`;
      const labelB = a.day === b.day ? MEAL_TR[b.meal] : `${DAYS_TR[b.day - 1]} ${MEAL_TR[b.meal]}`;
      // Öneri: tekrar yemeğin olmadığı başka bir öğün bul (aynı meal type)
      const altSlots = seq.filter(x =>
        x.meal === b.meal && x.day !== a.day && x.day !== b.day &&
        !repeats.some(r => x.dishes.includes(r))
      );
      let hint = null, action = null;
      if (altSlots.length > 0) {
        const t = altSlots[0];
        hint = `${DAYS_TR[b.day - 1]} ${MEAL_TR[b.meal]}'deki tekrar yemeği ${DAYS_TR[t.day - 1]} ${MEAL_TR[t.meal]}'e taşı → bu uyarı kapanır`;
        action = { dishNames: repeats, fromMenuId: b.menuId, toMenuId: t.menuId };
      }
      suggestions.push({
        type: 'repeat',
        severity: 'error',
        title: `${labelA} → ${labelB} tekrar`,
        items: repeats.map(d => d.charAt(0).toUpperCase() + d.slice(1)),
        hint, action,
      });
    }
  }

  // 2. Aynı gün öğle+akşam benzer et hazırlığı
  const MEAT_COURSES  = new Set(['red_meat', 'white_meat', 'offal']);
  const PREP_KEYWORDS = ['köfte', 'şiş', 'kebap', 'güveç', 'kavurma', 'steak', 'dolma', 'sote', 'haşlama', 'rosto', 'fajita', 'taco', 'schnitzel'];

  const getMeatDishes = (menuId) => {
    const m = menus.find(x => x.id === menuId);
    if (!m) return [];
    return m.stations.flatMap(st => st.dishes.filter(d => MEAT_COURSES.has(d.course)).map(d => d.name.trim()));
  };

  const extractPrep = (name) => PREP_KEYWORDS.find(k => name.toLowerCase().includes(k));

  for (let day = 1; day <= 7; day++) {
    const lunch  = seq.find(x => x.day === day && x.meal === 'lunch');
    const dinner = seq.find(x => x.day === day && x.meal === 'dinner');
    if (!lunch || !dinner) continue;

    const lunchMeat  = getMeatDishes(lunch.menuId);
    const dinnerMeat = getMeatDishes(dinner.menuId);

    const prepMap = {}; // prep → { lunch: [], dinner: [] }
    for (const d of lunchMeat) {
      const p = extractPrep(d);
      if (!p) continue;
      if (!prepMap[p]) prepMap[p] = { lunch: [], dinner: [] };
      prepMap[p].lunch.push(d);
    }
    for (const d of dinnerMeat) {
      const p = extractPrep(d);
      if (!p) continue;
      if (!prepMap[p]) prepMap[p] = { lunch: [], dinner: [] };
      prepMap[p].dinner.push(d);
    }

    for (const [prep, { lunch: ld, dinner: dd }] of Object.entries(prepMap)) {
      if (ld.length === 0 || dd.length === 0) continue;
      const dayLabel = DAYS_TR[day - 1];
      const prepLabel = prep.charAt(0).toUpperCase() + prep.slice(1);

      // Akşam yemeğini taşıyabileceğimiz, aynı prep'in olmadığı başka bir akşam bul
      const altDinner = seq.find(x =>
        x.meal === 'dinner' && x.day !== day &&
        !getMeatDishes(x.menuId).some(d => d.toLowerCase().includes(prep))
      );
      // Öğle yemeğini taşıyabileceğimiz, aynı prep'in olmadığı başka bir öğle bul
      const altLunch = seq.find(x =>
        x.meal === 'lunch' && x.day !== day &&
        !getMeatDishes(x.menuId).some(d => d.toLowerCase().includes(prep))
      );

      let hint = null, action = null;
      if (altDinner) {
        hint = `${dayLabel} Akşam'daki "${dd[0]}" yemeğini ${DAYS_TR[altDinner.day - 1]} Akşam'e taşı → bu uyarı kapanır`;
        action = { dishNames: [dd[0]], fromMenuId: dinner.menuId, toMenuId: altDinner.menuId };
      } else if (altLunch) {
        hint = `${dayLabel} Öğle'deki "${ld[0]}" yemeğini ${DAYS_TR[altLunch.day - 1]} Öğle'e taşı → bu uyarı kapanır`;
        action = { dishNames: [ld[0]], fromMenuId: lunch.menuId, toMenuId: altLunch.menuId };
      }

      suggestions.push({
        type: 'same_day_prep',
        severity: 'warning',
        title: `${dayLabel}: öğle ve akşamda benzer et — ${prepLabel}`,
        items: [...new Set([...ld, ...dd])],
        detail: `Öğle: ${ld.join(', ')} · Akşam: ${dd.join(', ')}`,
        hint, action,
      });
    }
  }

  // 3. Kategori dağılımı: her gün öğle+akşam birleşik sayı
  const KEY_CATS = [
    { id: 'red_meat',   label: 'Kırmızı Et' },
    { id: 'white_meat', label: 'Beyaz Et' },
    { id: 'fish',       label: 'Balık' },
    { id: 'seafood',    label: 'Deniz Mahsulleri' },
    { id: 'vegetable',  label: 'Sebze/Vej.' },
    { id: 'dessert',    label: 'Tatlı' },
  ];
  for (const { id, label } of KEY_CATS) {
    const counts = [];
    for (let day = 1; day <= 7; day++) {
      const daySeq = seq.filter(x => x.day === day);
      counts.push(daySeq.reduce((s, x) => s + (x.cats[id] || 0), 0));
    }
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    const avg = total / 7;
    if (max >= avg * 2.2 && min === 0) {
      const heavyDays = counts.map((c, i) => c >= avg * 2 ? DAYS_TR[i] : null).filter(Boolean);
      const emptyDays = counts.map((c, i) => c === 0 ? DAYS_TR[i] : null).filter(Boolean);
      suggestions.push({
        type: 'imbalance',
        severity: 'warning',
        title: `${label} dağılımı dengesiz`,
        detail: `Yoğun: ${heavyDays.join(', ')} · Hiç yok: ${emptyDays.join(', ')}`,
        counts: counts.map((c, i) => ({ day: DAYS_TR[i].slice(0, 3), count: c })),
      });
    }
  }

  // 3. Anahtar kelime dağılımı: ızgara, köfte, hindi, tavuk
  const KEYWORDS = [
    { key: 'ızgara', label: 'Izgara' },
    { key: 'köfte',  label: 'Köfte' },
    { key: 'hindi',  label: 'Hindi' },
    { key: 'tavuk',  label: 'Tavuk' },
  ];
  for (const { key, label } of KEYWORDS) {
    const counts = [];
    for (let day = 1; day <= 7; day++) {
      const dayDishes = seq.filter(x => x.day === day).flatMap(x => x.dishes);
      counts.push(dayDishes.filter(d => d.includes(key)).length);
    }
    const total = counts.reduce((a, b) => a + b, 0);
    if (total < 2) continue;
    const max = Math.max(...counts);
    const daysWithZero = counts.filter(c => c === 0).length;
    if (max >= 3 && daysWithZero >= 4) {
      const activeDays = counts.map((c, i) => c > 0 ? `${DAYS_TR[i].slice(0, 3)} (${c})` : null).filter(Boolean);
      const emptyDays = counts.map((c, i) => c === 0 ? DAYS_TR[i].slice(0, 3) : null).filter(Boolean);
      suggestions.push({
        type: 'keyword',
        severity: 'info',
        title: `${label} yalnızca ${activeDays.length} günde var`,
        detail: `Var: ${activeDays.join(', ')} · Yok: ${emptyDays.join(', ')}`,
        counts: counts.map((c, i) => ({ day: DAYS_TR[i].slice(0, 3), count: c })),
      });
    }
  }

  // ── IZGARA ÖNERİLERİ ──────────────────────────────────────────────────────
  const grillSuggestions = [];
  const KOFTE_KW  = ['köfte'];
  const LOP_ET_KW = ['steak', 'şiş', 'pirzola', 'kaburga', 'bonfile', 'antrikot', 'kebap', 'kebab', 'kuzu baget', 'ribye', 'rosto'];

  const MEAT_GROUPS = [
    { label: 'Kırmızı Et', courses: new Set(['red_meat', 'offal']) },
    { label: 'Beyaz Et',   courses: new Set(['white_meat']) },
  ];

  for (const mealType of ['lunch', 'dinner']) {
    const mealLabel = MEAL_TR[mealType];

    for (const { label: meatLabel, courses } of MEAT_GROUPS) {
      // Her gün için ilgili et grubundaki yemekleri topla
      const mealSeq = [];
      for (let day = 1; day <= 7; day++) {
        const m = menus.find(x => x.day_of_week === day && x.meal_type === mealType);
        const dishes = m
          ? m.stations.flatMap(st => st.dishes.filter(d => courses.has(d.course)).map(d => d.name.trim().toLowerCase()))
          : [];
        mealSeq.push({ day, menuId: m?.id, dishes });
      }

      // Yardımcı: bu öğün tipinde köftesiz günler
      const daysWithoutKofte = mealSeq.filter(x => !x.dishes.some(d => KOFTE_KW.some(k => d.includes(k))));

      // Art arda köfte kontrolü
      for (let i = 0; i < mealSeq.length - 1; i++) {
        const a = mealSeq[i], b = mealSeq[i + 1];
        const aK = a.dishes.filter(d => KOFTE_KW.some(k => d.includes(k)));
        const bK = b.dishes.filter(d => KOFTE_KW.some(k => d.includes(k)));
        if (aK.length > 0 && bK.length > 0) {
          // Öneri: tekrar eden iki günden birini köftesiz güne taşı
          const targets = daysWithoutKofte.filter(x => x.day !== a.day && x.day !== b.day);
          let hint = null, action = null;
          if (targets.length > 0) {
            const t = targets[0];
            hint = `${DAYS_TR[b.day - 1]} köftesini ${DAYS_TR[t.day - 1]} ${mealLabel}'e kaydır → bu uyarı kapanır`;
            action = { dishNames: bK, fromMenuId: b.menuId, toMenuId: t.menuId };
          }
          grillSuggestions.push({
            severity: 'warning',
            title: `${mealLabel} ${meatLabel} — art arda köfte: ${DAYS_TR[a.day - 1]} ve ${DAYS_TR[b.day - 1]}`,
            items: [...new Set([...aK, ...bK])].map(d => d.charAt(0).toUpperCase() + d.slice(1)),
            hint, action,
          });
        }
      }

      // Aynı yemek art arda kontrolü
      for (let i = 0; i < mealSeq.length - 1; i++) {
        const a = mealSeq[i], b = mealSeq[i + 1];
        const repeats = a.dishes.filter(d => d.length > 3 && !isFixture(d) && b.dishes.includes(d));
        if (repeats.length > 0) {
          // Öneri: tekrar eden yemeklerin olmadığı günleri bul
          const altDays = mealSeq.filter(x =>
            x.day !== a.day && x.day !== b.day &&
            !repeats.some(r => x.dishes.includes(r))
          );
          let hint = null, action = null;
          if (altDays.length > 0) {
            const t = altDays[0];
            hint = `${DAYS_TR[b.day - 1]}'deki tekrar yemeği ${DAYS_TR[t.day - 1]} ${mealLabel}'e taşı → bu uyarı kapanır`;
            action = { dishNames: repeats, fromMenuId: b.menuId, toMenuId: t.menuId };
          }
          grillSuggestions.push({
            severity: 'warning',
            title: `${mealLabel} ${meatLabel} — aynı yemek ard arda: ${DAYS_TR[a.day - 1]} ve ${DAYS_TR[b.day - 1]}`,
            items: repeats.map(d => d.charAt(0).toUpperCase() + d.slice(1)),
            hint, action,
          });
        }
      }

      // Kırmızı et için löp et (steak/şiş) en az 2 günde 1 kontrolü
      if (meatLabel === 'Kırmızı Et') {
        let gapStart = null;
        for (let i = 0; i < mealSeq.length; i++) {
          const { day, dishes } = mealSeq[i];
          const hasLopEt = dishes.some(d => LOP_ET_KW.some(k => d.includes(k)));
          if (hasLopEt) {
            gapStart = null;
          } else {
            if (gapStart === null) gapStart = day;
            else if (day - gapStart === 2) {
              grillSuggestions.push({
                severity: 'info',
                title: `${mealLabel} Kırmızı Et — ${DAYS_TR[gapStart - 1]}'den itibaren 3 gün löp et yok`,
                hint: `${DAYS_TR[day - 1]} ${mealLabel}'e steak, şiş, pirzola veya kebap ekle`,
              });
            }
          }
        }
      }
    }
  }

  res.json({ general: suggestions, grill: grillSuggestions });
});

// Öneri taşıma: bir yemeği kaynak menüden hedef menüye taşı
app.post('/api/suggestions/move', (req, res) => {
  const { dishNames, fromMenuId, toMenuId } = req.body;
  if (!dishNames?.length || !fromMenuId || !toMenuId) {
    return res.status(400).json({ error: 'Eksik parametre' });
  }

  const fromMenu = db.get('menus').find({ id: fromMenuId }).value();
  const toMenu   = db.get('menus').find({ id: toMenuId }).value();
  if (!fromMenu || !toMenu) return res.status(404).json({ error: 'Menü bulunamadı' });

  const namesLower = dishNames.map(n => n.trim().toLowerCase());
  const moved = [];

  for (const nameKey of namesLower) {
    // Kaynak menüde yemeği bul
    let foundDish = null, fromStation = null;
    for (const st of fromMenu.stations) {
      const idx = st.dishes.findIndex(d => d.name.trim().toLowerCase() === nameKey);
      if (idx !== -1) { foundDish = st.dishes.splice(idx, 1)[0]; fromStation = st; break; }
    }
    if (!foundDish) continue;

    // Hedef menüde aynı istasyonu bul, yoksa aynı section'daki ilk istasyona ekle
    let targetStation = toMenu.stations.find(st => st.name === fromStation.name)
      || toMenu.stations.find(st => st.section === fromStation.section)
      || toMenu.stations[0];

    if (!targetStation) {
      // İstasyon yoksa oluştur
      const newSt = { id: seq(), name: fromStation.name, section: fromStation.section, dishes: [] };
      toMenu.stations.push(newSt);
      targetStation = newSt;
    }

    targetStation.dishes.push(foundDish);
    moved.push(foundDish.name);
  }

  db.write();
  res.json({ ok: true, moved });
});

// ── COST-ANALYSIS DB (PostgreSQL canlı fiyatlar) ──────────────────────────────
let livePriceMap = {}; // UPPER(ing_name) → fiyat (TL/kg)

async function loadLivePrices() {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      host:     process.env.COST_DB_HOST     || '127.0.0.1',
      port:     parseInt(process.env.COST_DB_PORT || '5434'),
      database: process.env.COST_DB_NAME     || 'cost_analysis',
      user:     process.env.COST_DB_USER     || 'cost',
      password: process.env.COST_DB_PASSWORD || 'cost_guclu_sifre_2024',
    });
    // Son ayın ağırlıklı ortalama birim fiyatı (miktar ile ağırlıklı)
    const { rows } = await pool.query(`
      SELECT
        UPPER(TRIM(stok_mali)) AS stok_adi,
        birim,
        SUM(tuk_miktar * birim_fiyat) / NULLIF(SUM(tuk_miktar), 0) AS agirlikli_fiyat
      FROM fb_cost.tuketim
      WHERE tip = 'yiyecek'
        AND birim_fiyat > 0
        AND tarih_str = (
          SELECT MAX(tarih_str) FROM fb_cost.tuketim
          WHERE tip = 'yiyecek' AND birim_fiyat > 0
        )
      GROUP BY UPPER(TRIM(stok_mali)), birim
    `);
    const map = {};
    for (const r of rows) {
      map[r.stok_adi] = parseFloat(r.agirlikli_fiyat) || 0;
    }
    livePriceMap = map;
    await pool.end();
    console.log(`[cost-db] ${Object.keys(map).length} malzeme fiyatı yüklendi.`);
  } catch (err) {
    console.warn('[cost-db] Canlı fiyat yüklenemedi, statik fiyatlar kullanılacak:', err.message);
  }
}

loadLivePrices();
// Her 6 saatte bir güncelle
setInterval(loadLivePrices, 6 * 60 * 60 * 1000);

// ── REÇETE VERİTABANI ─────────────────────────────────────────────────────────
const recipesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'recipes.json'), 'utf8'));
const recipeProducts    = recipesData.products;    // 1467 ürün
const recipeIngredients = recipesData.ingredients; // 10321 satır
const recipeInglist     = recipesData.inglist;     // 11961 malzeme+fiyat

// Türkçe normalize
function normTR(s) {
  if (!s) return '';
  return s.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
}

// Eşleştirme index'leri (startup'ta bir kez oluşturulur)
// 1. Recipe adı index: normAdi → { y_no, adi }
const recipeNameIndex = {};
for (const p of recipeProducts) {
  if (p.adi) recipeNameIndex[normTR(p.adi)] = { y_no: p.y_no, adi: p.adi };
}
const recipeNameEntries = Object.entries(recipeNameIndex);

// 2. Malzeme adı index: normIngName → Set of y_no
const ingRecipeIndex = {}; // normIngName → [{ y_no, adi }]
for (const row of recipeIngredients) {
  if (!row.ingredient || !row.product_no) continue;
  const key = normTR(row.ingredient);
  if (!ingRecipeIndex[key]) ingRecipeIndex[key] = [];
  const prod = recipeProducts.find(p => p.y_no === row.product_no);
  if (prod && !ingRecipeIndex[key].some(x => x.y_no === prod.y_no)) {
    ingRecipeIndex[key].push({ y_no: prod.y_no, adi: prod.adi });
  }
}
const ingIndexEntries = Object.entries(ingRecipeIndex);

// Eşleştirme fonksiyonu
function matchDishToRecipes(dishName) {
  const n = normTR(dishName);
  if (n.length < 3) return [];
  const matches = []; // { y_no, adi, matchType }
  const seen = new Set();
  const add = (info, type) => {
    if (!seen.has(info.y_no)) { seen.add(info.y_no); matches.push({ ...info, matchType: type }); }
  };

  // 1. Tam reçete adı eşleşmesi
  if (recipeNameIndex[n]) add(recipeNameIndex[n], 'name_exact');

  // 2. Kısmi reçete adı eşleşmesi (min 5 karakter)
  if (n.length >= 5) {
    for (const [rn, info] of recipeNameEntries) {
      if (rn === n) continue;
      if (rn.includes(n) || (n.length >= 6 && n.includes(rn) && rn.length >= 5)) {
        add(info, 'name_partial');
      }
      if (matches.length >= 10) break;
    }
  }

  // 3. Tam malzeme adı eşleşmesi
  if (ingRecipeIndex[n]) {
    for (const info of ingRecipeIndex[n]) add(info, 'ingredient_exact');
  }

  // 4. Kısmi malzeme adı eşleşmesi (min 4 karakter)
  if (n.length >= 4 && matches.length < 10) {
    for (const [ingName, infos] of ingIndexEntries) {
      if (ingName === n) continue;
      if (ingName.includes(n) || (n.length >= 5 && n.includes(ingName) && ingName.length >= 4)) {
        for (const info of infos) add(info, 'ingredient_partial');
      }
      if (matches.length >= 10) break;
    }
  }

  return matches.slice(0, 5);
}

// POST /api/recipe-match — toplu yemek adı → reçete eşleştirme
app.post('/api/recipe-match', (req, res) => {
  const { names } = req.body; // string[]
  if (!Array.isArray(names)) return res.status(400).json({ error: 'names array required' });
  const result = {};
  for (const name of names) {
    const m = matchDishToRecipes(name);
    if (m.length > 0) result[name] = m;
  }
  res.json(result);
});

// Malzeme fiyat haritası (isim → ing kaydı)
const ingMap = {};
for (const ing of recipeInglist) {
  if (ing.ing_name) ingMap[ing.ing_name.trim().toUpperCase()] = ing;
}

// Ürün no → malzeme listesi haritası
const ingredientsByProduct = {};
for (const row of recipeIngredients) {
  if (!ingredientsByProduct[row.product_no]) ingredientsByProduct[row.product_no] = [];
  ingredientsByProduct[row.product_no].push(row);
}

// Birim dönüşüm katsayısı: reçete birimi → DB birim fiyatı (TL/kg veya TL/L)
// DB'deki fiyatlar Kilogram veya Litre bazında
function unitToKgFactor(birim) {
  if (!birim) return null;
  const b = birim.trim().toLowerCase();
  // Ağırlık → kg
  if (b === 'kg' || b === 'kilogram')  return 1;
  if (b === 'g'  || b === 'gr' || b === 'gram') return 0.001;
  if (b === 'mg') return 0.000001;
  // Hacim → litre
  if (b === 'l'  || b === 'lt' || b === 'litre' || b === 'liter') return 1;
  if (b === 'cl') return 0.01;
  if (b === 'ml') return 0.001;
  // Adet — dönüşüm yapılamaz
  return null;
}

// Reçete maliyeti hesapla (canlı DB fiyatı öncelikli, yoksa statik)
function calcRecipeCost(y_no) {
  const rows = ingredientsByProduct[y_no] || [];
  let total = 0;
  const detail = rows.map(row => {
    const ingKey = row.ingredient ? row.ingredient.trim().toUpperCase() : '';
    const factor = unitToKgFactor(row.birim); // null = adet/belirsiz

    // Önce canlı fiyat, sonra statik inglist fiyatı
    const livePrice = livePriceMap[ingKey];
    const ing = ingMap[ingKey];
    // Statik fiyat inglist'te de g/cl bazında saklanmış olabilir — onu olduğu gibi kullan
    const staticPrice = ing ? ing.ing_fiyat : 0;

    let fiyat, source, maliyet;

    if (livePrice != null && livePrice > 0 && factor != null) {
      // Canlı fiyat TL/kg → miktar(g)*0.001 * fiyat(TL/kg)
      fiyat  = livePrice * factor;   // birim başına TL (g, cl, ml…)
      source = 'live';
      maliyet = fiyat * (row.miktar || 0);
    } else if (livePrice != null && livePrice > 0 && factor == null) {
      // Birim adet/bilinmiyor, canlı fiyat direkt kullan
      fiyat  = livePrice;
      source = 'live';
      maliyet = fiyat * (row.miktar || 0);
    } else {
      // Statik fiyat (inglist'te zaten reçete birimiyle eşleşiyor)
      fiyat  = staticPrice;
      source = 'static';
      maliyet = fiyat * (row.miktar || 0);
    }

    total += maliyet;
    return { ingredient: row.ingredient, miktar: row.miktar, birim: row.birim, fiyat, maliyet, source };
  });
  return { total: Math.round(total * 100) / 100, detail };
}

// GET /api/recipes — liste (arama + sayfalama)
app.get('/api/recipes', (req, res) => {
  const q     = (req.query.q || '').toUpperCase();
  const bolum = req.query.bolum || '';
  const page  = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  let list = recipeProducts;
  if (q)     list = list.filter(p => p.adi && p.adi.toUpperCase().includes(q));
  if (bolum) list = list.filter(p => p.bolum === bolum);

  const total = list.length;
  const items = list.slice((page - 1) * limit, page * limit).map(p => ({
    y_no: p.y_no, adi: p.adi, bolum: p.bolum, tur: p.tur,
    ingredientCount: (ingredientsByProduct[p.y_no] || []).length,
  }));
  res.json({ total, page, limit, items });
});

// GET /api/recipes/:y_no — tek reçete detayı + maliyet
app.get('/api/recipes/:y_no', (req, res) => {
  const y_no = parseInt(req.params.y_no);
  const product = recipeProducts.find(p => p.y_no === y_no);
  if (!product) return res.status(404).json({ error: 'Reçete bulunamadı' });
  const cost = calcRecipeCost(y_no);
  res.json({ ...product, ...cost });
});

// GET /api/recipes/bolumler — bölüm listesi
app.get('/api/recipe-bolumler', (req, res) => {
  const bolumler = [...new Set(recipeProducts.map(p => p.bolum).filter(Boolean))].sort();
  res.json(bolumler);
});

// GET /api/ingredients — malzeme listesi (arama)
app.get('/api/ingredients', (req, res) => {
  const q = (req.query.q || '').toUpperCase();
  let list = recipeInglist;
  if (q) list = list.filter(i => i.ing_name && i.ing_name.toUpperCase().includes(q));
  res.json(list.slice(0, 200).map(i => ({
    ing_no: i.ing_no, ing_name: i.ing_name, ing_birim: i.ing_birim,
    ing_fiyat: i.ing_fiyat, wastepercent: i.wastepercent,
    allergens: ['gluten','kabuklu','yumurta','balik','fistik','soya','sut','sertkabuk','kereviz','hardal','susam','so2','bal','et'].filter(f => i[f]),
  })));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Sunucu http://0.0.0.0:${PORT} adresinde calisiyor`));
