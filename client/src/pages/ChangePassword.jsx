import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function ChangePassword() {
  const { user, loading, changePassword } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [busy, setBusy] = useState(false)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (busy) return
    if (form.next.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    if (form.next !== form.confirm) {
      toast.error('New passwords do not match')
      return
    }
    setBusy(true)
    const result = await changePassword(form.current, form.next)
    setBusy(false)
    if (result.success) {
      toast.success('Password updated successfully!')
      navigate(user.is_admin ? '/admin' : '/', { replace: true })
    } else {
      toast.error(result.message)
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-10">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-card p-8">
          <div className="text-center mb-8">
            <span className="inline-block text-4xl mb-2">🔒</span>
            <h1 className="font-display text-3xl font-semibold text-slate-900">Change Password</h1>
            <p className="text-sm text-slate-500 mt-2">Set a new password for your account</p>
          </div>

          {user.default_password && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="font-semibold text-red-800">⚠️ You must change your password</p>
              <p className="text-sm text-red-700 mt-0.5">
                You signed in with the default admin password. The admin panel and your orders are locked until you set a new one.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="current" className="label">Current Password</label>
              <input
                id="current"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={form.current}
                onChange={(e) => setForm({ ...form, current: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="next" className="label">New Password (min 8 characters)</label>
              <input
                id="next"
                type="password"
                required
                autoComplete="new-password"
                placeholder="••••••••"
                value={form.next}
                onChange={(e) => setForm({ ...form, next: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="confirm" className="label">Confirm New Password</label>
              <input
                id="confirm"
                type="password"
                required
                autoComplete="new-password"
                placeholder="••••••••"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                className="input"
              />
            </div>

            <button type="submit" disabled={busy || loading} className="btn-primary w-full text-base py-3">
              {busy ? 'Updating...' : 'Update Password'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Changed your mind?{' '}
            <Link to="/" className="text-primary-600 hover:text-primary-700 font-medium">
              Continue shopping
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
