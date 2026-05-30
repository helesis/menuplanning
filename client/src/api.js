const h = { 'Content-Type': 'application/json' }

export const getMenus            = ()         => fetch('/api/menus').then(r => r.json())
export const getMenu             = (id)       => fetch(`/api/menus/${id}`).then(r => r.json())
export const updateMenuTheme     = (id, theme)=> fetch(`/api/menus/${id}`, { method:'PUT', headers:h, body:JSON.stringify({ theme }) }).then(r => r.json())
export const getStationTemplates = ()         => fetch('/api/station-templates').then(r => r.json())
export const addStationTemplate  = (name)     => fetch('/api/station-templates', { method:'POST', headers:h, body:JSON.stringify({ name }) }).then(r => r.json())
export const addStation          = (menuId, name) => fetch(`/api/menus/${menuId}/stations`, { method:'POST', headers:h, body:JSON.stringify({ name }) }).then(r => r.json())
export const updateStation       = (id, name) => fetch(`/api/stations/${id}`, { method:'PUT', headers:h, body:JSON.stringify({ name }) }).then(r => r.json())
export const deleteStation       = (id)       => fetch(`/api/stations/${id}`, { method:'DELETE' }).then(r => r.json())
export const addDish             = (stationId, data) => fetch(`/api/stations/${stationId}/dishes`, { method:'POST', headers:h, body:JSON.stringify(data) }).then(r => r.json())
export const updateDish          = (id, data) => fetch(`/api/dishes/${id}`, { method:'PUT', headers:h, body:JSON.stringify(data) }).then(r => r.json())
export const deleteDish          = (id)       => fetch(`/api/dishes/${id}`, { method:'DELETE' }).then(r => r.json())
export const copyMenu            = (fromId, toId) => fetch(`/api/menus/${fromId}/copy-to/${toId}`, { method:'POST' }).then(r => r.json())
export const getStats            = ()         => fetch('/api/stats').then(r => r.json())

export const previewExcel = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return fetch('/api/import?preview=1', { method: 'POST', body: fd }).then(r => r.json())
}

export const importExcel = (file, { overwrite = false } = {}) => {
  const fd = new FormData()
  fd.append('file', file)
  return fetch(`/api/import?overwrite=${overwrite ? 1 : 0}`, { method: 'POST', body: fd }).then(r => r.json())
}

export const importParsed = (sheets, { overwrite = false } = {}) =>
  fetch('/api/import-parsed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheets, overwrite }),
  }).then(r => r.json())
