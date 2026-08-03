import axios from 'axios'
import toast from 'react-hot-toast'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
})

// Attach token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Surface a 401 as a session-expiry toast, but never for login/register (bad credentials).
// Tracks whether a toast was already shown to avoid spamming during parallel requests.
let sessionToastShown = false

// Handle 401 responses (expired/invalid token)
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || ''
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/logout')
      if (!isAuthEndpoint && !sessionToastShown) {
        sessionToastShown = true
        toast.error('Your session has expired. Please sign in again.')
      }
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.dispatchEvent(new Event('auth-change'))
    }
    return Promise.reject(error)
  }
)

export default API
