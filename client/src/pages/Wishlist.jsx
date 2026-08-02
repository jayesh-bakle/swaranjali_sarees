import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import API from '../api/client'
import EmptyState from '../components/EmptyState'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'
import { resolveImageUrl } from '../utils/imageUrl'

export default function Wishlist() {
  const { user, isAdmin } = useAuth()
  const { addItem } = useCart()
  const location = useLocation()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [movingId, setMovingId] = useState(null)

  useEffect(() => {
    if (!user) return
    fetchWishlist()
  }, [user])

  const fetchWishlist = async () => {
    setLoading(true)
    try {
      const { data } = await API.get('/wishlist')
      setItems(data.items || [])
      setError(false)
    } catch (err) {
      console.error('Failed to fetch wishlist:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const removeFromWishlist = async (productId) => {
    try {
      await API.delete(`/wishlist/${productId}`)
      setItems((prev) => prev.filter((item) => item.id !== productId))
      window.dispatchEvent(new Event('wishlist-updated'))
      toast('Removed from wishlist', { icon: '🗑️' })
    } catch (err) {
      toast.error('Failed to remove item')
    }
  }

  const moveToCart = async (item) => {
    if (movingId) return // prevent double-submit
    // Out-of-stock items can't go to the cart (matches ProductDetail behaviour)
    if (!item.stock || item.stock <= 0) {
      toast.error(`${item.name} is out of stock`)
      return
    }
    setMovingId(item.id)
    try {
      addItem(item, 1)
      await removeFromWishlist(item.id)
    } finally {
      setMovingId(null)
    }
  }

  if (!user) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-3xl font-semibold text-slate-900 mb-8">My Wishlist</h1>
        <EmptyState icon="🔒" title="Please sign in" description="Login to view and manage your wishlist." actionText="Sign In" actionLink="/login" actionState={{ from: location.pathname }} />
      </div>
    )
  }

  if (isAdmin) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-3xl font-semibold text-slate-900 mb-8">My Wishlist</h1>
        <EmptyState icon="👑" title="Admins manage the store" description="Wishlist is for customers browsing and saving products." actionText="Go to Admin Panel" actionLink="/admin" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-3xl font-semibold text-slate-900 mb-8">My Wishlist</h1>
        <LoadingSpinner />
      </div>
    )
  }

  if (error && items.length === 0) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-3xl font-semibold text-slate-900 mb-8">My Wishlist</h1>
        <EmptyState
          icon="⚠️"
          title="Couldn't load your wishlist"
          description="There was a problem reaching the store. Please try again."
          actionText="Retry"
          actionHandler={fetchWishlist}
        />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-3xl font-semibold text-slate-900 mb-8">My Wishlist</h1>
        <EmptyState
          icon="💖"
          title="Your wishlist is empty"
          description="Save sarees you love and find them here later."
          actionText="Discover Sarees"
          actionLink="/shop"
        />
      </div>
    )
  }

  return (
    <div className="container-app py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-semibold text-slate-900">
          My Wishlist <span className="text-lg text-slate-400 font-normal">({items.length} items)</span>
        </h1>
        <Link to="/shop" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
          Continue Shopping →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((item) => (
          <div key={item.id} className="bg-white rounded-xl shadow-soft overflow-hidden group">
            <Link to={`/product/${item.id}`} className="block relative">
              <img
                src={resolveImageUrl(item.image_url)}
                alt={item.name}
                className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => { e.target.src = 'https://placehold.co/200x250/slate/white?text=Saree' }}
              />
              {item.sale_price && item.sale_price < item.price && (
                <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {Math.round(((item.price - item.sale_price) / item.price) * 100)}% OFF
                </span>
              )}
              <button
                onClick={(e) => { e.preventDefault(); removeFromWishlist(item.id) }}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-rose-500 hover:scale-110 transition-transform"
                aria-label="Remove from wishlist"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </Link>
            <div className="p-4">
              <Link to={`/product/${item.id}`} className="font-medium text-slate-800 hover:text-primary-600 transition-colors line-clamp-1">
                {item.name}
              </Link>
              <p className="text-xs text-slate-500 mt-1">{item.fabric} · {item.color}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="font-semibold text-primary-700">₹{Number(item.sale_price || item.price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                {item.sale_price && (
                  <span className="text-xs text-slate-400 line-through">₹{Number(item.price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                )}
              </div>
              <button
                onClick={() => moveToCart(item)}
                disabled={movingId !== null}
                className="btn-primary w-full mt-3 text-sm py-2"
              >
                {movingId === item.id ? 'Moving...' : 'Move to Cart'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}