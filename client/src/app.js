import * as api from './api.js';

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const MEAL_LABEL = { lunch: 'Öğle', dinner: 'Akşam' };

let allMenus = [];
let currentMenu = null;
let currentFilter = 'all';
let templates = [];

// ── INIT ──────────────────────────────────────────────────────────────────────

async function init() {
  await Promise.all([loadMenus(), loadTemplates()]);
}

async function loadMenus() {
  allMenus = await api.getMenus();
  renderWeekly();
}

async function loadTemplates() {
  templates = await api.getStationTemplates();
  renderTemplates();
  renderTplSelect();
}

// ── PAGES ─────────────────────────────────────────────────────────────────────

window.showPage = function(page) {
  ['weekly', 'stats', 'import', 'templates'].forEach(p => {
    document.getElementById(`page-${p}`).style.display = p === page ? '' : 'none';
  });
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  event.currentTarget.classList.add('active');
  if (page === 'stats') loadStats();
  if (page === 'templates') renderTemplates();
};

// ── WEEKLY ────────────────────────────────────────────────────────────────────

window.filterMeal = function(meal, btn) {
  currentFilter = meal;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderWeekly();
};

function renderWeekly() {
  const grid = document.getElementById('weekly-grid');
  const meals = currentFilter === 'all' ? ['lunch', 'dinner'] : [currentFilter];

  grid.innerHTML = DAYS.map((day, i) => {
    const dayNum = i + 1;
    const cards = meals.map(meal => {
      const m = allMenus.find(x => x.day_of_week === dayNum && x.meal_type === meal);
      if (!m) return '';
      return `
        <div class="menu-card" onclick="openDetail(${m.id})">
          <div class="menu-card-label">${MEAL_LABEL[meal]}</div>
          <div class="menu-card-theme">${m.theme || '<span style="color:var(--text-xdim)">Tema yok</span>'}</div>
          <div class="menu-card-counts">
            <span class="menu-count-badge">🍽 ${m.station_count} istasyon</span>
            <span class="menu-count-badge">🥘 ${m.dish_count} yemek</span>
          </div>
        </div>`;
    }).join('');
    return `<div class="day-col"><div class="day-label">${day}</div>${cards}</div>`;
  }).join('');
}

// ── DETAIL PANEL ──────────────────────────────────────────────────────────────

window.openDetail = async function(id) {
  currentMenu = await api.getMenu(id);
  const day = DAYS[currentMenu.day_of_week - 1];
  const meal = MEAL_LABEL[currentMenu.meal_type];
  document.getElementById('detail-title').textContent = `${day} — ${meal}`;
  document.getElementById('detail-sub').textContent = 'İstasyon ve yemekler';
  document.getElementById('theme-input').value = currentMenu.theme || '';
  renderStations();
  renderTplSelect();
  document.getElementById('detail-overlay').classList.add('open');
  document.getElementById('detail-panel').classList.add('open');
};

window.closeDetail = function() {
  document.getElementById('detail-overlay').classList.remove('open');
  document.getElementById('detail-panel').classList.remove('open');
  currentMenu = null;
  loadMenus();
};

window.saveTheme = async function() {
  if (!currentMenu) return;
  const theme = document.getElementById('theme-input').value.trim();
  await api.updateMenuTheme(currentMenu.id, theme);
  currentMenu.theme = theme;
  toast('Tema kaydedildi', 'success');
};

function renderStations() {
  const list = document.getElementById('stations-list');
  if (!currentMenu.stations.length) {
    list.innerHTML = '<div class="loading" style="padding:20px 0">Henüz istasyon yok</div>';
    return;
  }
  list.innerHTML = currentMenu.stations.map(s => `
    <div class="station-block" id="station-${s.id}">
      <div class="station-header">
        <span class="station-name">${s.name}</span>
        <div class="station-actions">
          <button class="btn btn-sm btn-ghost btn-icon" title="Sil" onclick="deleteStation(${s.id})">🗑</button>
        </div>
      </div>
      <div class="dish-list">
        ${s.dishes.map(d => `
          <div class="dish-item" id="dish-${d.id}">
            <span class="dish-name">${d.name}</span>
            <div class="dish-badges">
              ${d.is_vegan ? '<span class="badge badge-green">Vegan</span>' : d.is_vegetarian ? '<span class="badge badge-blue">Vejetaryen</span>' : ''}
            </div>
            <div class="dish-actions">
              <button class="btn btn-sm btn-ghost btn-icon" onclick="deleteDish(${d.id})">✕</button>
            </div>
          </div>`).join('')}
        <div class="add-dish-row">
          <div class="inline-input">
            <input type="text" placeholder="Yemek ekle..." id="dish-input-${s.id}"
              onkeydown="if(event.key==='Enter') addDish(${s.id})">
            <button class="btn btn-sm btn-ghost" onclick="addDish(${s.id})">+ Ekle</button>
          </div>
        </div>
      </div>
    </div>`).join('');
}

// ── STATION OPS ───────────────────────────────────────────────────────────────

window.addStation = async function() {
  if (!currentMenu) return;
  const inp = document.getElementById('new-station-name');
  const name = inp.value.trim();
  if (!name) return;
  const s = await api.addStation(currentMenu.id, name);
  currentMenu.stations.push({ ...s, dishes: [] });
  inp.value = '';
  renderStations();
};

window.addStationFromTpl = async function() {
  if (!currentMenu) return;
  const sel = document.getElementById('station-tpl-select');
  const name = sel.value;
  if (!name) return;
  const s = await api.addStation(currentMenu.id, name);
  currentMenu.stations.push({ ...s, dishes: [] });
  sel.value = '';
  renderStations();
};

window.deleteStation = async function(id) {
  if (!confirm('İstasyonu sil?')) return;
  await api.deleteStation(id);
  currentMenu.stations = currentMenu.stations.filter(s => s.id !== id);
  renderStations();
  toast('İstasyon silindi', 'success');
};

// ── DISH OPS ──────────────────────────────────────────────────────────────────

window.addDish = async function(stationId) {
  const inp = document.getElementById(`dish-input-${stationId}`);
  const name = inp.value.trim();
  if (!name) return;
  const dish = await api.addDish(stationId, { name });
  const station = currentMenu.stations.find(s => s.id === stationId);
  station.dishes.push(dish);
  inp.value = '';
  renderStations();
  document.getElementById(`dish-input-${stationId}`)?.focus();
};

window.deleteDish = async function(id) {
  await api.deleteDish(id);
  for (const s of currentMenu.stations) {
    s.dishes = s.dishes.filter(d => d.id !== id);
  }
  renderStations();
};

// ── TEMPLATES ─────────────────────────────────────────────────────────────────

function renderTemplates() {
  const list = document.getElementById('templates-list');
  if (!list) return;
  list.innerHTML = templates.map(t => `
    <div class="dish-item">
      <span class="dish-name">${t.name}</span>
    </div>`).join('');
}

function renderTplSelect() {
  const sel = document.getElementById('station-tpl-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">Şablondan seç...</option>' +
    templates.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
}

window.addTemplate = async function() {
  const inp = document.getElementById('tpl-name');
  const name = inp.value.trim();
  if (!name) return;
  const tpl = await api.addStationTemplate(name);
  if (!templates.find(t => t.id === tpl.id)) templates.push(tpl);
  inp.value = '';
  renderTemplates();
  toast('Şablon eklendi', 'success');
};

// ── STATS ─────────────────────────────────────────────────────────────────────

async function loadStats() {
  const { byDay } = await api.getStats();
  const totalDishes = byDay.reduce((s, m) => s + m.dish_count, 0);
  const totalVeg = byDay.reduce((s, m) => s + m.vegetarian_count, 0);
  const totalStations = byDay.reduce((s, m) => s + m.station_count, 0);

  document.getElementById('stats-content').innerHTML = `
    <div class="stats-grid mb-24">
      <div class="stat-card gold">
        <div class="stat-value">${totalDishes}</div>
        <div class="stat-label">Toplam Yemek</div>
      </div>
      <div class="stat-card green">
        <div class="stat-value">${totalVeg}</div>
        <div class="stat-label">Vejetaryen</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-value">${totalStations}</div>
        <div class="stat-label">İstasyon</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-value">${Math.round(totalDishes/14)}</div>
        <div class="stat-label">Öğün Başı Ort.</div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Günlük Dağılım</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Gün</th><th>Öğün</th><th>İstasyon</th><th>Yemek</th><th>Vejetaryen</th>
            </tr>
          </thead>
          <tbody>
            ${byDay.map(m => `
              <tr>
                <td>${DAYS[m.day_of_week-1]}</td>
                <td>${MEAL_LABEL[m.meal_type]}</td>
                <td>${m.station_count}</td>
                <td>${m.dish_count}</td>
                <td>${m.vegetarian_count ? `<span class="badge badge-green">${m.vegetarian_count}</span>` : '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── IMPORT ────────────────────────────────────────────────────────────────────

window.previewImport = async function() {
  const file = document.getElementById('import-file').files[0];
  if (!file) { toast('Dosya seçin', 'error'); return; }
  const result = await api.previewExcel(file);
  const box = document.getElementById('import-preview');
  if (!result.ok) { box.innerHTML = `<div class="toast toast-error">${result.error}</div>`; return; }
  box.innerHTML = `<div class="card mt-16"><div class="card-title">Önizleme — ${result.sheets.length} sayfa</div>` +
    result.sheets.map(s => `
      <div class="mb-16">
        <div style="font-weight:600;margin-bottom:4px">${s.sheetName}
          — ${DAYS[(s.day||1)-1]} ${MEAL_LABEL[s.meal]||'?'}</div>
        ${s.stations.map(st => `
          <div style="margin:4px 0 2px;font-size:12px;font-weight:600;color:var(--text-dim)">${st.name}</div>
          ${st.dishes.map(d=>`<div style="font-size:12px;padding:1px 12px">• ${d}</div>`).join('')}
        `).join('')}
      </div>`).join('') + '</div>';
};

window.doImport = async function(overwrite) {
  const file = document.getElementById('import-file').files[0];
  if (!file) { toast('Dosya seçin', 'error'); return; }
  const result = await api.importExcel(file, { overwrite });
  if (result.ok) {
    toast(`${result.imported} sayfa içe aktarıldı`, 'success');
    loadMenus();
  } else {
    toast(result.error || 'Hata', 'error');
  }
};

// ── TOAST ─────────────────────────────────────────────────────────────────────

function toast(msg, type = 'info') {
  const c = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

init();
