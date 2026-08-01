import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import API from '../api/client'
import { resolveImageUrl } from '../utils/imageUrl'
import EmptyState from '../components/EmptyState'
import toast from 'react-hot-toast'

export default function Cart() {
  const { items, removeItem, updateQuantity, clearCart, totalPrice, totalItems, savings } = useCart()

  const { user, isAdmin } = useAuth()
  const [checkout, setCheckout] = useState(false)
  const [formData, setFormData] = useState({ address: '', phone: '' })
  const [placing, setPlacing] = useState(false)
  const navigate = useNavigate()

  const handlePlaceOrder = async (e) => {
    e.preventDefault()
    if (!user) {
      toast.error('Please login to place your order')
      navigate('/login')
      return
    }

    if (isAdmin) {
      toast.error('Admins manage the store. Only customers can place orders.')
      return
    }

    setPlacing(true)
    try {
      const { data } = await API.post('/orders', {
        items,
        total: totalPrice,
        shipping_address: formData.address,
        phone: formData.phone,
      })
      clearCart()
      toast.success('🎉 Order placed successfully!')
      navigate('/success')
    } catch (err) {
      console.error('Error placing order:', err)
      toast.error(err.response?.data?.message || 'Failed to place order. Please try again.')
    } finally {
      setPlacing(false)
    }
  }

  if (!user) {
    return (
      <div className="container-app">
        <h1 className="font-display text-3xl font-semibold text-slate-900 py-10">Shopping Cart</h1>
        <EmptyState icon="🔒" title="Please sign in to shop" description="Login to add sarees to your cart and place orders." actionText="Sign In" actionLink="/login" />
      </div>
    )
  }

  if (isAdmin) {
    return (
      <div className="container-app">
        <h1 className="font-display text-3xl font-semibold text-slate-900 py-10">Shopping Cart</h1>
        <EmptyState icon="👑" title="Admin — You manage the store" description="Ordering is for customers only. Manage products and orders from the Admin Panel." actionText="Go to Admin Panel" actionLink="/admin" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="container-app">
        <h1 className="font-display text-3xl font-semibold text-slate-900 py-10">Shopping Cart</h1>
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          description="Looks like you haven't added any sarees to your cart yet."
          actionText="Start Shopping"
          actionLink="/shop"
        />
      </div>
    )
  }

  return (
    <div className="container-app py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-semibold text-slate-900">Shopping Cart</h1>
        <button onClick={clearCart} className="text-sm text-red-600 hover:text-red-700 font-medium">
          Clear Cart
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-soft p-4 flex gap-4">
              {/* Image */}
              <img
                src={resolveImageUrl(item.image)}
                alt={item.name}
                className="w-24 h-28 object-cover rounded-lg flex-shrink-0"
                onError={(e) => { e.target.src = 'https://placehold.co/200x250/slate/white?text=Saree' }}
              />
              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link to={`/product/${item.id}`} className="font-medium text-slate-900 hover:text-primary-600 transition-colors line-clamp-1">
                      {item.name}
                    </Link>
                    <p className="text-xs text-slate-500 mt-1">
                      {item.fabric} · {item.color} · {item.size}
                    </p>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-slate-400 hover:text-red-600 transition-colors flex-shrink-0"
                    aria-label={`Remove ${item.name} from cart`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center border-2 border-slate-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="px-2.5 py-1 hover:bg-slate-100 transition-colors"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="px-3 py-1 text-center font-semibold min-w-[2.5rem]">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="px-2.5 py-1 hover:bg-slate-100 transition-colors"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="font-semibold text-primary-700">
                      ₹{Number(item.price * item.quantity).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                    {item.originalPrice > item.price && (
                      <p className="text-xs text-slate-400 line-through">
                        ₹{Number(item.originalPrice * item.quantity).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-soft p-6 sticky top-24">
            <h2 className="font-display text-xl font-semibold text-slate-900 mb-4">Order Summary</h2>

            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Items ({totalItems})</span>
                <span className="font-medium">₹{Number(totalPrice).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Shipping</span>
                <span className="font-medium text-green-600">FREE</span>
              </div>
              {savings > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>You Save</span>
                  <span className="font-bold">-₹{Number(savings).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-800">Total</span>
                <span className="text-2xl font-bold text-primary-700">₹{Number(totalPrice).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>

            {!checkout ? (
              <button onClick={() => setCheckout(true)} className="btn-primary w-full text-base py-3">
                Proceed to Checkout →
              </button>
            ) : (
              <form onSubmit={handlePlaceOrder} className="space-y-4">
                <div>
                  <label className="label">Shipping Address *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Enter your full shipping address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Phone Number *</label>
                  <input
                    required
                    type="tel"
                    placeholder="Enter your phone number"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input"
                  />
                </div>
                <button type="submit" disabled={placing} className="btn-primary w-full text-base py-3">
                  {placing ? 'Placing Order...' : 'Place Order ✅'}
                </button>
                <button
                  type="button"
                  onClick={() => setCheckout(false)}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 text-center"
                >
                  ← Back
                </button>
              </form>
            )}

            <Link to="/shop" className="block text-center text-sm text-primary-600 hover:text-primary-700 mt-4">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}