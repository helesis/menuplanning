import React, { useState } from 'react'
import { User, Lock, LogIn } from 'lucide-react'

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Giriş başarısız'); return }
      localStorage.setItem('mp_token', data.token)
      localStorage.setItem('mp_user', JSON.stringify(data.user))
      onLogin(data.user, data.token)
    } catch {
      setError('Sunucuya bağlanılamadı')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark" style={{ width: 48, height: 48, fontSize: 22 }}>M</div>
          <div>
            <div className="brand-name" style={{ fontSize: 20 }}>Menü <span>Planlama</span></div>
            <div className="brand-sub">Haftalık Plan Sistemi</div>
          </div>
        </div>

        <h2 className="login-title">Giriş Yap</h2>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label>Kullanıcı Adı</label>
            <div className="login-input-wrap">
              <User size={16} className="login-input-icon" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="kullanıcı adı"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="login-field">
            <label>Şifre</label>
            <div className="login-input-wrap">
              <Lock size={16} className="login-input-icon" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            <LogIn size={16} />
            {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  )
}
