import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import API from '../api/client'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  out_for_delivery: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const PAYMENT_COLORS = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-slate-100 text-slate-600',
}

const CANCELLABLE = ['pending', 'confirmed', 'processing']

// Load Razorpay checkout script
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => {
      console.error('Failed to load Razorpay SDK')
      resolve(false)
    }
    document.body.appendChild(script)
  })
}

export default function Orders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [payingOrderId, setPayingOrderId] = useState(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    fetchOrders()
  }, [user])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const { data } = await API.get('/orders')
      setOrders(data.orders)
    } catch (err) {
      console.error('Error fetching orders:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelOrder = async (orderId) => {
    if (!confirm('Are you sure you want to cancel this order?')) return
    try {
      const { data } = await API.put(`/orders/cancel/${orderId}`)
      toast.success('Order cancelled')
      fetchOrders()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel order')
    }
  }

  const handlePayNow = async (order) => {
    setPayingOrderId(order.id)
    try {
      // 1. Load Razorpay SDK
      const loaded = await loadRazorpayScript()
      if (!loaded) {
        toast.error('Could not load payment gateway. Please try again.')
        setPayingOrderId(null)
        return
      }

      // 2. Create a Razorpay order for this existing order
      const { data } = await API.post(`/payments/create-order-for-order/${order.id}`)

      // 3. Open Razorpay checkout
      const rzp = new window.Razorpay({
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: 'Swaranjali Sarees',
        description: `Payment for Order #${order.id}`,
        order_id: data.order_id,
        notes: { orderId: String(order.id) },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: order.phone || '',
        },
        theme: { color: '#D97706' },
        handler: async (response) => {
          try {
            // 4. Verify payment signature + mark this order as paid
            await API.post('/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderId: order.id,
            })
            toast.success('Payment successful! Your order is confirmed.')
            fetchOrders()
          } catch (err) {
            toast.error(err.response?.data?.message || 'Payment verification failed')
          } finally {
            setPayingOrderId(null)
          }
        },
        modal: {
          ondismiss: () => setPayingOrderId(null),
        },
      })

      rzp.on('payment.failed', (response) => {
        console.error('Payment failed:', response.error)
        toast.error(response.error?.description || 'Payment failed. Please try again.')
        setPayingOrderId(null)
      })

      rzp.open()
    } catch (err) {
      console.error('Pay now error:', err)
      toast.error(err.response?.data?.message || 'Failed to initiate payment')
      setPayingOrderId(null)
    }
  }

  if (!user) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-3xl font-semibold text-slate-900 mb-8">My Orders</h1>
        <EmptyState icon="🔒" title="Please sign in" description="Login to view your order history." actionText="Sign In" actionLink="/login" />
      </div>
    )
  }

  if (loading) {
    return <LoadingSpinner text="Loading your orders..." fullPage />
  }

  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  return (
    <div className="container-app py-10">
      <h1 className="font-display text-3xl font-semibold text-slate-900 mb-8">
        My Orders <span className="text-lg text-slate-400 font-normal">({orders.length})</span>
      </h1>

      {orders.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No orders yet"
          description="You haven't placed any orders yet. Explore our collection!"
          actionText="Shop Sarees"
          actionLink="/shop"
        />
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-xl shadow-soft overflow-hidden">
              {/* Order header */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-50 border-b border-slate-100">
                <div>
                  <p className="font-semibold text-slate-900">Order #{order.id}</p>
                  <p className="text-xs text-slate-500">
                    Placed on {new Date(order.created_at).toLocaleDateString()} at {new Date(order.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || STATUS_COLORS.pending}`}>
                    {order.status.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${PAYMENT_COLORS[order.payment_status] || PAYMENT_COLORS.pending}`}>
                    {order.payment_status === 'paid' ? 'Paid' : order.payment_status === 'refunded' ? 'Refunded' : 'Payment Pending'}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="px-6 py-4 space-y-3">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <img
                      src={item.image?.startsWith('http') ? item.image : baseURL + item.image}
                      alt={item.name}
                      className="w-14 h-16 object-cover rounded-lg flex-shrink-0"
                      onError={(e) => { e.target.src = 'https://placehold.co/100x120/slate/white?text=Saree' }}
                    />
                    <div className="flex-1 min-w-0">
                      <Link to={`/product/${item.id}`} className="text-sm font-medium text-slate-800 hover:text-primary-600 transition-colors line-clamp-1">
                        {item.name}
                      </Link>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.fabric && <span>{item.fabric}</span>}
                        {item.color && <span> · {item.color}</span>}
                        <span> · Qty: {item.quantity}</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        ${Number(item.price).toFixed(2)} each
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-800">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Pay Now banner for unpaid orders */}
              {order.payment_status !== 'paid' && order.payment_status !== 'refunded' && order.status !== 'cancelled' && (
                <div className="px-6 py-3 bg-amber-50 border-t border-amber-100 flex items-center justify-between">
                  <p className="text-xs text-amber-800 font-medium">
                    ⚠️ This order is pending payment. Complete your payment to confirm it.
                  </p>
                  <button
                    onClick={() => handlePayNow(order)}
                    disabled={payingOrderId === order.id}
                    className="ml-4 flex-shrink-0 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                  >
                    {payingOrderId === order.id ? 'Processing…' : '💳 Pay Now'}
                  </button>
                </div>
              )}

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm space-y-1">
                    <p className="text-slate-600">
                      <span className="font-medium text-slate-700">Delivery:</span> {order.shipping_address}
                    </p>
                    {order.phone && (
                      <p className="text-slate-600">
                        <span className="font-medium text-slate-700">Phone:</span> {order.phone}
                      </p>
                    )}
                    {order.payment_method && (
                      <p className="text-slate-600">
                        <span className="font-medium text-slate-700">Payment:</span>{' '}
                        {order.payment_method === 'cod' ? 'Cash on Delivery' : order.payment_method === 'card' ? 'Card' : order.payment_method === 'upi' ? 'UPI' : order.payment_method}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Order Total</p>
                      <p className="text-xl font-bold text-primary-700">${Number(order.total).toFixed(2)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Link to={`/track-order/${order.id}`} className="btn-secondary text-sm py-2">
                        Track Order
                      </Link>
                      {CANCELLABLE.includes(order.status) && (
                        <button onClick={() => handleCancelOrder(order.id)} className="text-sm text-red-600 hover:text-red-700 font-medium border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 transition-colors">
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="text-center pt-4">
            <Link to="/shop" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              ← Continue Shopping
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}