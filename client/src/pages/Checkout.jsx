import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import API from '../api/client'
import EmptyState from '../components/EmptyState'
import toast from 'react-hot-toast'

const PAYMENT_METHODS = [
  { id: 'cod', label: 'Cash on Delivery', icon: '💵', desc: 'Pay when your order arrives' },
  { id: 'online', label: 'Card / UPI / NetBanking', icon: '💳', desc: 'Pay securely via Razorpay (GPay, PhonePe, Paytm, Cards & more)' },
]

export default function Checkout() {
  const { items, totalPrice, totalItems, savings, clearCart } = useCart()
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [addresses, setAddresses] = useState([])
  const [selectedAddress, setSelectedAddress] = useState(null)
  const [showAddAddress, setShowAddAddress] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [placing, setPlacing] = useState(false)

  // New address form
  const [newAddress, setNewAddress] = useState({
    full_name: '', phone: '', address_line1: '', address_line2: '',
    city: '', state: '', postal_code: '', country: 'India', is_default: false
  })
  const [savingAddress, setSavingAddress] = useState(false)

  useEffect(() => {
    if (!user || isAdmin) return
    fetchAddresses()
  }, [user, isAdmin])

  const fetchAddresses = async () => {
    try {
      const { data } = await API.get('/addresses')
      setAddresses(data.addresses || [])
      const defaultAddr = data.addresses?.find((a) => a.is_default) || data.addresses?.[0]
      setSelectedAddress(defaultAddr || null)
    } catch (err) {
      console.error('Failed to fetch addresses:', err)
    }
  }

  if (!user) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-3xl font-semibold text-slate-900 mb-8">Checkout</h1>
        <EmptyState icon="🔒" title="Please sign in to checkout" description="Login to place your order securely." actionText="Sign In" actionLink="/login" />
      </div>
    )
  }

  if (isAdmin) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-3xl font-semibold text-slate-900 mb-8">Checkout</h1>
        <EmptyState icon="👑" title="Admin — Store Manager" description="Only customers can place orders. Manage the store from the admin panel." actionText="Go to Admin Panel" actionLink="/admin" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-3xl font-semibold text-slate-900 mb-8">Checkout</h1>
        <EmptyState icon="🛒" title="Your cart is empty" description="Add some sarees to your cart before checking out." actionText="Start Shopping" actionLink="/shop" />
      </div>
    )
  }

  const handleSaveAddress = async (e) => {
    e.preventDefault()
    setSavingAddress(true)
    try {
      const { data } = await API.post('/addresses', newAddress)
      setAddresses([...addresses, data.address])
      setSelectedAddress(data.address)
      setShowAddAddress(false)
      setNewAddress({ full_name: '', phone: '', address_line1: '', address_line2: '', city: '', state: '', postal_code: '', country: 'India', is_default: false })
      toast.success('Address saved!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save address')
    } finally {
      setSavingAddress(false)
    }
  }

  const placeOrder = async (razorpayPayload = null) => {
    const shippingAddress = [
      selectedAddress.full_name,
      selectedAddress.address_line1,
      selectedAddress.address_line2,
      `${selectedAddress.city}, ${selectedAddress.state} ${selectedAddress.postal_code}`,
      selectedAddress.country,
    ].filter(Boolean).join(', ')

    const { data } = await API.post('/orders', {
      items,
      total: totalPrice,
      shipping_address: shippingAddress,
      phone: selectedAddress.phone,
      payment_method: paymentMethod === 'online' ? 'razorpay' : 'cod',
      payment_details: razorpayPayload,
    })
    return data
  }

  const loadRazorpayScript = () => {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve(true)
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => reject(new Error('Failed to load Razorpay SDK'))
      document.body.appendChild(script)
    })
  }

  const handleRazorpayPayment = async () => {
    setPlacing(true)
    try {
      await loadRazorpayScript()

      // 1. Create a Razorpay order
      const { data: rzpOrder } = await API.post('/payments/create-order', {
        amount: totalPrice,
        currency: 'INR',
        receipt: 'rcpt_' + Date.now(),
        notes: { userId: String(user.id) },
      })

      // 2. Open the Razorpay checkout dialog
      const options = {
        key: rzpOrder.key_id,
        amount: rzpOrder.amount, // paise
        currency: rzpOrder.currency || 'INR',
        name: 'Saree Elegance',
        description: `Order of ${totalItems} item${totalItems > 1 ? 's' : ''}`,
        image: 'https://placehold.co/100x100/f59e0b/white?text=S',
        order_id: rzpOrder.order_id,
        prefill: {
          name: user.name || '',
          email: user.email || '',
          contact: selectedAddress?.phone || '',
        },
        handler: async (response) => {
          try {
            // 3. Verify payment signature on server
            const { data: verified } = await API.post('/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })

            if (verified.verified) {
              // 4. Place the order with payment confirmation
              const data = await placeOrder({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              })
              clearCart()
              toast.success('🎉 Payment successful! Order placed.')
              navigate(`/track-order/${data.order.id}`)
            } else {
              toast.error('Payment verification failed')
            }
          } catch (err) {
            console.error('Verification error:', err)
            toast.error('Payment verification failed. Please try again.')
          } finally {
            setPlacing(false)
          }
        },
        modal: {
          ondismiss: () => setPlacing(false),
        },
        theme: { color: '#f59e0b' },
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (response) => {
        console.error('Payment failed:', response.error)
        toast.error(response.error?.description || 'Payment failed. Please try again.')
        setPlacing(false)
      })
      rzp.open()
    } catch (err) {
      console.error('Razorpay error:', err)
      toast.error(err.response?.data?.message || err.message || 'Failed to start payment. Check if Razorpay keys are configured.')
      setPlacing(false)
    }
  }

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      toast.error('Please select a shipping address')
      return
    }

    if (paymentMethod === 'online') {
      await handleRazorpayPayment()
      return
    }

    // COD flow
    setPlacing(true)
    try {
      const data = await placeOrder()
      clearCart()
      toast.success('🎉 Order placed successfully!')
      navigate(`/track-order/${data.order.id}`)
    } catch (err) {
      console.error('Error placing order:', err)
      toast.error(err.response?.data?.message || 'Failed to place order. Please try again.')
    } finally {
      setPlacing(false)
    }
  }

  const inputClass = 'input w-full'

  return (
    <div className="container-app py-10">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/cart" className="text-slate-400 hover:text-primary-600 transition-colors">
          ← Cart
        </Link>
        <h1 className="font-display text-3xl font-semibold text-slate-900">Checkout</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Address + Payment */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Shipping Address */}
          <div className="bg-white rounded-xl shadow-soft p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-semibold text-slate-900">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-sm font-bold mr-2">1</span>
                Shipping Address
              </h2>
              <button onClick={() => setShowAddAddress(!showAddAddress)} className="text-sm font-medium text-primary-600 hover:text-primary-700">
                {showAddAddress ? 'Cancel' : '+ Add New Address'}
              </button>
            </div>

            {showAddAddress ? (
              <form onSubmit={handleSaveAddress} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name *</label>
                  <input className={inputClass} required value={newAddress.full_name} onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })} placeholder="Recipient name" />
                </div>
                <div>
                  <label className="label">Phone *</label>
                  <input className={inputClass} required type="tel" value={newAddress.phone} onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })} placeholder="10-digit mobile" />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Address Line 1 *</label>
                  <input className={inputClass} required value={newAddress.address_line1} onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })} placeholder="House no, Building, Street" />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Address Line 2</label>
                  <input className={inputClass} value={newAddress.address_line2} onChange={(e) => setNewAddress({ ...newAddress, address_line2: e.target.value })} placeholder="Area, Landmark" />
                </div>
                <div>
                  <label className="label">City *</label>
                  <input className={inputClass} required value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} />
                </div>
                <div>
                  <label className="label">State *</label>
                  <input className={inputClass} required value={newAddress.state} onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })} />
                </div>
                <div>
                  <label className="label">PIN Code *</label>
                  <input className={inputClass} required value={newAddress.postal_code} onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })} />
                </div>
                <div>
                  <label className="label">Country</label>
                  <input className={inputClass} value={newAddress.country} onChange={(e) => setNewAddress({ ...newAddress, country: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={newAddress.is_default} onChange={(e) => setNewAddress({ ...newAddress, is_default: e.target.checked })} className="rounded" />
                    Set as default address
                  </label>
                </div>
                <div className="md:col-span-2">
                  <button type="submit" disabled={savingAddress} className="btn-primary">
                    {savingAddress ? 'Saving...' : 'Save Address'}
                  </button>
                </div>
              </form>
            ) : addresses.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-slate-500 mb-4">No saved addresses yet.</p>
                <button onClick={() => setShowAddAddress(true)} className="btn-secondary">
                  + Add Your First Address
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    onClick={() => setSelectedAddress(addr)}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${selectedAddress?.id === addr.id ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-800">
                          {addr.full_name} {addr.is_default && <span className="ml-2 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-semibold">Default</span>}
                        </p>
                        <p className="text-sm text-slate-600 mt-1">{addr.phone}</p>
                        <p className="text-sm text-slate-600 mt-1">
                          {addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ''}<br />
                          {addr.city}, {addr.state} — {addr.postal_code}<br />
                          {addr.country}
                        </p>
                      </div>
                      <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 ${selectedAddress?.id === addr.id ? 'border-primary-500 bg-primary-500' : 'border-slate-300'}`}>
                        {selectedAddress?.id === addr.id && (
                          <svg className="w-3 h-3 mx-auto mt-0.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Payment Method */}
          <div className="bg-white rounded-xl shadow-soft p-6">
            <h2 className="font-display text-xl font-semibold text-slate-900 mb-4">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-sm font-bold mr-2">2</span>
              Payment Method
            </h2>

            <div className="space-y-3">
              {PAYMENT_METHODS.map((method) => (
                <div
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${paymentMethod === method.id ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{method.icon}</span>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">{method.label}</p>
                      <p className="text-xs text-slate-500">{method.desc}</p>
                    </div>
                    <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${paymentMethod === method.id ? 'border-primary-500 bg-primary-500' : 'border-slate-300'}`}>
                      {paymentMethod === method.id && (
                        <svg className="w-3 h-3 mx-auto mt-0.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {paymentMethod === 'cod' && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 animate-fade-in">
                💵 Pay ₹{totalPrice.toFixed(2)} in cash when your order is delivered. No advance payment needed.
              </div>
            )}

            {paymentMethod === 'online' && (
              <div className="mt-4 bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm text-primary-700 animate-fade-in">
                🔒 You will be redirected to Razorpay's secure checkout to pay ₹{totalPrice.toFixed(2)} via
                UPI, Card, NetBanking, or Wallets.
              </div>
            )}
          </div>
        </div>

        {/* Right: Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-soft p-6 sticky top-24">
            <h2 className="font-display text-xl font-semibold text-slate-900 mb-4">Order Summary</h2>

            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <img
                    src={item.image?.startsWith('http') ? item.image : (import.meta.env.VITE_API_URL || 'http://localhost:5000') + item.image}
                    alt={item.name}
                    className="w-14 h-16 object-cover rounded-lg flex-shrink-0"
                    onError={(e) => { e.target.src = 'https://placehold.co/100x120/slate/white?text=Saree' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 line-clamp-1">{item.name}</p>
                    <p className="text-xs text-slate-500">Qty: {item.quantity}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-sm border-t border-slate-100 pt-4 mb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Items ({totalItems})</span>
                <span className="font-medium">${totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Shipping</span>
                <span className="font-medium text-green-600">FREE</span>
              </div>
              {savings > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>You Save</span>
                  <span className="font-bold">-${savings.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-800">Total</span>
                <span className="text-2xl font-bold text-primary-700">${totalPrice.toFixed(2)}</span>
              </div>
            </div>

            <button onClick={handlePlaceOrder} disabled={placing || !selectedAddress} className="btn-primary w-full text-base py-3">
              {placing ? 'Processing...' : `Place Order • $${totalPrice.toFixed(2)}`}
            </button>
            <Link to="/cart" className="block text-center text-sm text-primary-600 hover:text-primary-700 mt-4">
              ← Back to Cart
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}