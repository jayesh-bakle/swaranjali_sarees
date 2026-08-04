import { useState } from 'react'
import { Link } from 'react-router-dom'
import API from '../api/client'
import toast from 'react-hot-toast'
import { usePageMeta } from '../utils/usePageMeta'

export default function ForgotPassword() {
  usePageMeta({
    title: 'Reset Password',
    description: 'Request a password reset link for your Jagmohini Paithani account.',
  })
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      // The server always returns the same message (no account enumeration)
      await API.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-10">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-card p-8">
          <div className="text-center mb-8">
            <span className="inline-block text-4xl mb-2">🔑</span>
            <h1 className="font-display text-3xl font-semibold text-slate-900">Reset Password</h1>
            <p className="text-sm text-slate-500 mt-2">Enter your email and we'll send you a reset link</p>
          </div>

          {sent ? (
            <div className="text-center">
              <div className="bg-green-50 text-green-700 rounded-xl p-4 text-sm mb-6">
                If an account exists for that email, a password reset link has been sent.
              </div>
              <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="label">Email Address</label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full text-base py-3">
                {loading ? 'Sending...' : 'Send Reset Link'}
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
