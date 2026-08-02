import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useState, useEffect } from 'react'
import API from '../api/client'

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth()
  const { totalItems } = useCart()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [wishlistCount, setWishlistCount] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchWishlistCount = async () => {
      if (!user) {
        setWishlistCount(0)
        return
      }
      try {
        const { data } = await API.get('/wishlist')
        setWishlistCount(data.items?.length || 0)
      } catch (err) {
        console.error('Failed to fetch wishlist count:', err)
      }
    }
    fetchWishlistCount()
    window.addEventListener('wishlist-updated', fetchWishlistCount)
    return () => window.removeEventListener('wishlist-updated', fetchWishlistCount)
  }, [user])

  const handleLogout = () => {
    logout()
    setDropdownOpen(false)
    navigate('/')
  }

  const linkClass = ({ isActive }) =>
    `px-4 py-2 text-sm uppercase tracking-wider font-medium transition-colors border-b-2 ${
      isActive ? 'text-primary-700 border-primary-700' : 'text-slate-700 border-transparent hover:text-primary-700 hover:border-gold-400'
    }`

  return (
    <header className="bg-white sticky top-0 z-50 shadow-soft">
      {/* Top announcement ribbon */}
      <div className="bg-primary-800 text-white text-center text-[11px] sm:text-xs tracking-widest uppercase py-2">
        <div className="container-app flex items-center justify-center gap-2">
          <span className="hidden xs:inline">✦</span>
          <span className="truncate px-2">Authentic Handwoven Paithani · Free Shipping Across India</span>
          <span className="hidden xs:inline">✦</span>
        </div>
      </div>

      {/* Main nav */}
      <nav className="container-app flex items-center justify-between h-16 lg:h-20">
        {/* Logo */}
        <Link to="/" className="flex flex-col items-center group">
          <span className="font-display text-2xl lg:text-3xl font-bold text-primary-700 tracking-wide group-hover:text-primary-600 transition-colors">
            Swaranjali
          </span>
          <span className="text-[10px] lg:text-xs uppercase tracking-[0.35em] text-gold-600 -mt-1">
            Sarees · Est. 1985
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-2">
          <NavLink to="/" className={linkClass} end>
            Home
          </NavLink>
          <NavLink to="/shop" className={linkClass}>
            Shop Paithani
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin" className={linkClass}>
              Admin
            </NavLink>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1">
          {/* Wishlist icon */}
          {user && !isAdmin && (
            <Link to="/wishlist" className="relative p-2 rounded-sm hover:bg-slate-100 transition-colors" aria-label="Wishlist">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary-700 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </Link>
          )}

          {/* Cart icon */}
          <Link to="/cart" className="relative p-2 rounded-sm hover:bg-slate-100 transition-colors" aria-label="Cart">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-fade-in">
                {totalItems}
              </span>
            )}
          </Link>

          {/* User section */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-sm hover:bg-slate-100 transition-colors"
              >
                <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold">
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </span>
                <span className="text-sm font-medium text-slate-700 hidden sm:block">
                  {user.name?.split(' ')[0]}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-sm shadow-lg border border-slate-100 py-2 animate-fade-in">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  {!isAdmin && (
                    <>
                      <button onClick={() => { setDropdownOpen(false); navigate('/orders') }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        My Orders
                      </button>
                      <button onClick={() => { setDropdownOpen(false); navigate('/wishlist') }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        Wishlist ({wishlistCount})
                      </button>
                      <button onClick={() => { setDropdownOpen(false); navigate('/addresses') }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        My Addresses
                      </button>
                    </>
                  )}
                  {isAdmin && (
                    <button onClick={() => { setDropdownOpen(false); navigate('/admin') }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      Admin Dashboard
                    </button>
                  )}
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn-primary">
              Sign In
            </Link>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-sm hover:bg-slate-100"
            aria-label="Menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 px-4 py-3 space-y-1 animate-fade-in">
          <NavLink to="/" className={linkClass} onClick={() => setMobileOpen(false)} end>
            Home
          </NavLink>
          <NavLink to="/shop" className={linkClass} onClick={() => setMobileOpen(false)}>
            Shop Paithani
          </NavLink>
          {user && !isAdmin && (
            <NavLink to="/wishlist" className={linkClass} onClick={() => setMobileOpen(false)}>
              Wishlist
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={linkClass} onClick={() => setMobileOpen(false)}>
              Admin Panel
            </NavLink>
          )}
        </div>
      )}
    </header>
  )
}