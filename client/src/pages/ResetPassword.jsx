import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import API from '../api/client'
import toast from 'react-hot-toast'
import { usePageMeta } from '../utils/usePageMeta'

export default function ResetPassword() {
  usePageMeta({
    title: 'Set New Password',
    description: 'Choose a new password for your Jagmohini Paithani account.',
  })
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await API.post('/auth/reset-password', { token, password })
      setDone(true)
      toast.success('Password reset! Please sign in.')
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed. The link may be expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-10">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-card p-8">
          <div className="text-center mb-8">
            <span className="inline-block text-4xl mb-2">🔐</span>
            <h1 className="font-display text-3xl font-semibold text-slate-900">Set New Password</h1>
            <p className="text-sm text-slate-500 mt-2">Choose a strong password for your account</p>
          </div>

          {done ? (
            <div className="text-center text-sm text-green-600">Password updated! Redirecting to sign in…</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="label">New Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="confirm" className="label">Confirm Password</label>
                <input
                  id="confirm"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Re-enter password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full text-base py-3">
                {loading ? 'Updating...' : 'Update Password'}
              </button>
              <p className="text-center text-sm text-slate-500 mt-4">
                <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                  ← Back to Sign In
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
