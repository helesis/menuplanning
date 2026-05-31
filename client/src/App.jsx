import React, { useState, useEffect, useCallback } from 'react'
import { CalendarDays, BarChart2, Upload, UtensilsCrossed, User, LayoutGrid, Tag, Scale, BookOpen } from 'lucide-react'
import * as api from './api.js'
import WeeklyPage from './pages/WeeklyPage.jsx'
import StatsPage from './pages/StatsPage.jsx'
import ImportPage from './pages/ImportPage.jsx'
import TemplatesPage from './pages/TemplatesPage.jsx'
import StationViewPage from './pages/StationViewPage.jsx'
import CategorizePage from './pages/CategorizePage.jsx'
import BalancePage from './pages/BalancePage.jsx'
import RecipesPage from './pages/RecipesPage.jsx'
import Toast from './components/Toast.jsx'

export default function App() {
  const [page, setPage] = useState('weekly')
  const [menus, setMenus] = useState([])
  const [templates, setTemplates] = useState([])
  const [toasts, setToasts] = useState([])

  const loadMenus = useCallback(async () => {
    setMenus(await api.getMenus())
  }, [])

  const loadTemplates = useCallback(async () => {
    setTemplates(await api.getStationTemplates())
  }, [])

  useEffect(() => {
    loadMenus()
    loadTemplates()
  }, [])

  const toast = useCallback((msg, type = 'info') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }, [])

  const navItems = [
    { key: 'weekly',    icon: <CalendarDays size={16} />,     label: 'Haftalık Plan' },
    { key: 'stations',  icon: <LayoutGrid size={16} />,       label: 'İstasyon Görünümü' },
    { key: 'balance',   icon: <Scale size={16} />,            label: 'Denge Analizi' },
    { key: 'stats',     icon: <BarChart2 size={16} />,        label: 'İstatistikler' },
    { key: 'import',    icon: <Upload size={16} />,           label: 'İçe Aktar' },
    { key: 'categorize',icon: <Tag size={16} />,              label: 'Kategoriler' },
    { key: 'templates', icon: <UtensilsCrossed size={16} />,  label: 'İstasyon Şablonları' },
    { key: 'recipes',   icon: <BookOpen size={16} />,         label: 'Reçeteler' },
  ]

  return (
    <>
      <aside id="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">M</div>
          <div>
            <div className="brand-name">Menü <span>Planlama</span></div>
            <div className="brand-sub">Haftalık Plan</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <a
              key={item.key}
              href="#"
              className={`nav-item${page === item.key ? ' active' : ''}`}
              onClick={e => { e.preventDefault(); setPage(item.key) }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar"><User size={14} /></div>
            <div><div className="user-role">Yönetici</div></div>
          </div>
        </div>
      </aside>

      <div id="main">
        {page === 'weekly' && (
          <WeeklyPage menus={menus} templates={templates} onRefresh={loadMenus} toast={toast} />
        )}
        {page === 'stations' && <StationViewPage />}
        {page === 'categorize' && <CategorizePage toast={toast} />}
        {page === 'balance'    && <BalancePage />}
        {page === 'stats' && <StatsPage />}
        {page === 'import' && <ImportPage onRefresh={loadMenus} toast={toast} />}
        {page === 'templates' && (
          <TemplatesPage templates={templates} onRefresh={loadTemplates} toast={toast} />
        )}
        {page === 'recipes' && <RecipesPage toast={toast} />}
      </div>

      <Toast toasts={toasts} />
    </>
  )
}
