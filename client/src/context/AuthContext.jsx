import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import API from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem('token') || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const handleAuthChange = () => {
      const stored = localStorage.getItem('user')
      setUser(stored ? JSON.parse(stored) : null)
      setToken(localStorage.getItem('token'))
    }
    window.addEventListener('auth-change', handleAuthChange)
    return () => window.removeEventListener('auth-change', handleAuthChange)
  }, [])

  const login = async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await API.post('/auth/login', { email, password })
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify({ ...data.user, default_password: data.default_password || false }))
      setUser({ ...data.user, default_password: data.default_password || false })
      setToken(data.token)
      return { success: true, message: data.message, user: data.user }
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed. Please try again.'
      setError(message)
      return { success: false, message }
    } finally {
      setLoading(false)
    }
  }

  const changePassword = async (currentPassword, newPassword) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await API.put('/auth/password', { currentPassword, newPassword })
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify({ ...data.user, default_password: false }))
      setUser({ ...data.user, default_password: false })
      setToken(data.token)
      return { success: true, message: data.message }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to change password.'
      setError(message)
      return { success: false, message }
    } finally {
      setLoading(false)
    }
  }

  const register = async (name, email, password) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await API.post('/auth/register', { name, email, password })
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
      setToken(data.token)
      return { success: true, message: data.message, user: data.user }
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed. Please try again.'
      setError(message)
      return { success: false, message }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    // Best-effort server-side revocation (the JWT would otherwise stay valid until it expires)
    try {
      API.post('/auth/logout').catch(() => {})
    } catch (_) { /* localStorage cleanup must always run */ }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setToken(null)
  }

  const isAdmin = user?.is_admin === 1 || user?.is_admin === true

  // Memoize so unrelated re-renders of the provider don't re-render every consumer
  const value = useMemo(
    () => ({ user, token, loading, error, login, register, logout, changePassword, isAdmin }),
    [user, token, loading, error, isAdmin]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}