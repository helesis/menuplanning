const express = require('express');
const cors    = require('cors');
const low     = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path    = require('path');
const multer  = require('multer');
const XLSX    = require('xlsx');

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
  const rows = db.get('menus').value().map(m => ({
    id:            m.id,
    day_of_week:   m.day_of_week,
    meal_type:     m.meal_type,
    theme:         m.theme,
    station_count: m.stations.length,
    dish_count:    m.stations.reduce((s, st) => s + st.dishes.length, 0),
  }));
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
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const menu = findMenu(req.params.menuId);
  if (!menu) return res.status(404).json({ error: 'Menu not found' });
  const maxOrder = menu.stations.reduce((m, s) => Math.max(m, s.display_order), 0);
  const station = { id: seq(), name: name.trim(), display_order: maxOrder + 1, dishes: [] };
  db.get('menus').find({ id: Number(req.params.menuId) }).get('stations').push(station).write();
  res.json(station);
});

// Update station name
app.put('/api/stations/:id', (req, res) => {
  const found = findStation(req.params.id);
  if (!found) return res.status(404).json({ error: 'Not found' });
  if (req.body.name !== undefined) found.station.name = req.body.name;
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
  'ÇORBA', 'CORBA',
  'ARASICAK',
  'GÜVEÇ', 'GUVEC',
  'KESİM', 'KESIM',
  'WOK',
  'PANE',
  'BALIK',
  'MAKARNA',
  'ET TAVUK', 'IZGARA KÖŞESİ', 'IZGARA KOSESI',
  'RUS MUTFAĞI', 'RUS MUTFAGI',
  'SALATA BARI',
  'TATLILAR',
  'SHOW İSTASYONU', 'SHOW ISTASYONU',
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

function parseTitleRow(text) {
  const upper = text.toUpperCase();
  let day = null;
  for (const [name, num] of Object.entries(DAYS_TR)) {
    if (upper.includes(name)) { day = num; break; }
  }
  const meal = upper.includes('AKŞAM') || upper.includes('AKSAM') ? 'dinner'
             : upper.includes('ÖĞLEN') || upper.includes('OGLEN') ? 'lunch'
             : null;
  return { day, meal };
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

    // Title = first row
    const { day, meal } = parseTitleRow(rows[0].text);

    let theme = '';
    const stations = [];
    let currentStation = null;
    let firstStationFound = false;

    for (let i = 1; i < rows.length; i++) {
      const { text, bold } = rows[i];

      if (isStationHeader(text) || bold) {
        firstStationFound = true;
        currentStation = { name: text, dishes: [] };
        stations.push(currentStation);
      } else if (!firstStationFound) {
        // Before first station → theme
        if (theme) theme += ' ' + text;
        else theme = text;
      } else if (currentStation) {
        currentStation.dishes.push(text);
      }
    }

    results.push({ sheetName, day, meal, theme, stations });
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

    if (overwrite) {
      db.get('menus').find({ id: menu.id }).assign({ theme: item.theme, stations: [] }).write();
    } else if (item.theme) {
      db.get('menus').find({ id: menu.id }).assign({ theme: item.theme }).write();
    }

    const freshMenu = findMenu(menu.id);
    for (const s of item.stations) {
      const maxOrder = freshMenu.stations.reduce((m, st) => Math.max(m, st.display_order), 0);
      const station = {
        id: seq(), name: s.name, display_order: maxOrder + 1,
        dishes: s.dishes.map((name, i) => ({
          id: seq(), name, notes: '', display_order: i + 1,
          is_vegetarian: 0, is_vegan: 0, meat_type: '', cooking_method: '',
        })),
      };
      db.get('menus').find({ id: menu.id }).get('stations').push(station).write();
      freshMenu.stations.push(station);
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

    if (overwrite) {
      db.get('menus').find({ id: menu.id }).assign({ theme: item.theme || '', stations: [] }).write();
    } else if (item.theme) {
      db.get('menus').find({ id: menu.id }).assign({ theme: item.theme }).write();
    }

    const freshMenu = findMenu(menu.id);
    for (const s of item.stations) {
      const maxOrder = freshMenu.stations.reduce((m, st) => Math.max(m, st.display_order), 0);
      const station = {
        id: seq(), name: s.name, display_order: maxOrder + 1,
        dishes: (s.dishes || []).map((name, i) => ({
          id: seq(), name, notes: '', display_order: i + 1,
          is_vegetarian: 0, is_vegan: 0, meat_type: '', cooking_method: '',
        })),
      };
      db.get('menus').find({ id: menu.id }).get('stations').push(station).write();
      freshMenu.stations.push(station);
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Sunucu http://localhost:${PORT} adresinde calisiyor`));
