import React, { useState, useEffect } from 'react'
import { UserPlus, Trash2, Pencil, X, Check, ShieldCheck, User } from 'lucide-react'

function apiFetch(path, opts, token) {
  return fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts?.headers || {}) },
  }).then(r => r.json())
}

export default function UsersPage({ token, toast, currentUser }) {
  const [users, setUsers]       = useState([])
  const [showAdd, setShowAdd]   = useState(false)
  const [editId, setEditId]     = useState(null)
  const [form, setForm]         = useState({ username: '', password: '', role: 'Kullanıcı' })
  const [editForm, setEditForm] = useState({ username: '', password: '', role: 'Kullanıcı' })

  async function load() {
    const data = await apiFetch('/api/users', {}, token)
    if (Array.isArray(data)) setUsers(data)
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e) {
    e.preventDefault()
    const res = await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(form) }, token)
    if (res.error) { toast(res.error, 'error'); return }
    toast('Kullanıcı eklendi', 'success')
    setForm({ username: '', password: '', role: 'Kullanıcı' })
    setShowAdd(false)
    load()
  }

  async function handleEdit(e) {
    e.preventDefault()
    const payload = { role: editForm.role }
    if (editForm.username) payload.username = editForm.username
    if (editForm.password) payload.password = editForm.password
    const res = await apiFetch(`/api/users/${editId}`, { method: 'PUT', body: JSON.stringify(payload) }, token)
    if (res.error) { toast(res.error, 'error'); return }
    toast('Kullanıcı güncellendi', 'success')
    setEditId(null)
    load()
  }

  async function handleDelete(id, username) {
    if (!confirm(`"${username}" kullanıcısı silinsin mi?`)) return
    const res = await apiFetch(`/api/users/${id}`, { method: 'DELETE' }, token)
    if (res.error) { toast(res.error, 'error'); return }
    toast('Kullanıcı silindi', 'success')
    load()
  }

  function startEdit(u) {
    setEditId(u.id)
    setEditForm({ username: u.username, password: '', role: u.role })
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">Kullanıcı Yönetimi</h1>
          <p className="page-sub">Sisteme erişim yetkilerini yönetin</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(s => !s)}>
          <UserPlus size={15} /> Yeni Kullanıcı
        </button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
          <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>Yeni Kullanıcı Ekle</div>
          <form onSubmit={handleAdd} className="user-form">
            <div className="user-form-row">
              <div className="login-field" style={{ flex: 1 }}>
                <label>Kullanıcı Adı</label>
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required placeholder="kullanıcı adı" />
              </div>
              <div className="login-field" style={{ flex: 1 }}>
                <label>Şifre</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required placeholder="şifre" />
              </div>
              <div className="login-field" style={{ width: 140 }}>
                <label>Yetki</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option>Admin</option>
                  <option>Kullanıcı</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" style={{ fontSize: 13 }}><Check size={14} /> Kaydet</button>
              <button type="button" className="btn" onClick={() => setShowAdd(false)} style={{ fontSize: 13 }}><X size={14} /> İptal</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="users-table">
          <thead>
            <tr>
              <th>Kullanıcı</th>
              <th>Yetki</th>
              <th style={{ width: 140 }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  {editId === u.id ? (
                    <input
                      value={editForm.username}
                      onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))}
                      placeholder={u.username}
                      style={{ fontSize: 13, padding: '4px 8px', border: '1px solid var(--border2)', borderRadius: 6, width: '100%' }}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="user-avatar" style={{ width: 28, height: 28, fontSize: 12 }}>
                        <User size={12} />
                      </div>
                      <span style={{ fontWeight: 500 }}>{u.username}</span>
                      {u.id === currentUser.id && <span style={{ fontSize: 11, color: 'var(--text-xdim)' }}>(siz)</span>}
                    </div>
                  )}
                </td>
                <td>
                  {editId === u.id ? (
                    <select
                      value={editForm.role}
                      onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                      style={{ fontSize: 13, padding: '4px 8px', border: '1px solid var(--border2)', borderRadius: 6 }}
                    >
                      <option>Admin</option>
                      <option>Kullanıcı</option>
                    </select>
                  ) : (
                    <span className={`role-badge ${u.role === 'Admin' ? 'role-admin' : 'role-user'}`}>
                      {u.role === 'Admin' ? <ShieldCheck size={12} /> : <User size={12} />}
                      {u.role}
                    </span>
                  )}
                </td>
                <td>
                  {editId === u.id ? (
                    <form onSubmit={handleEdit} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="password"
                        value={editForm.password}
                        onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="yeni şifre (opsiyonel)"
                        style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--border2)', borderRadius: 6, width: 150 }}
                      />
                      <button type="submit" className="icon-btn icon-btn-green" title="Kaydet"><Check size={14} /></button>
                      <button type="button" className="icon-btn" onClick={() => setEditId(null)} title="İptal"><X size={14} /></button>
                    </form>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="icon-btn" onClick={() => startEdit(u)} title="Düzenle"><Pencil size={14} /></button>
                      {u.id !== currentUser.id && (
                        <button className="icon-btn icon-btn-red" onClick={() => handleDelete(u.id, u.username)} title="Sil"><Trash2 size={14} /></button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
