import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API from '../api/client'
import EmptyState from '../components/EmptyState'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

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

const STATUS_ORDER = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered']
const STATUS_LABELS = {
  pending: 'Order Placed',
  confirmed: 'Order Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const STATUS_ICONS = {
  pending: '📝',
  confirmed: '✅',
  processing: '⚙️',
  shipped: '🚚',
  out_for_delivery: '🛵',
  delivered: '📦',
  cancelled: '❌',
}

export default function TrackOrder() {
  const { id } = useParams()
  const { user, isAdmin } = useAuth()
  const [order, setOrder] = useState(null)
  const [tracking, setTracking] = useState([])
  const [payments, setPayments] = useState([])
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    fetchOrder()
  }, [id, user])

  const fetchOrder = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data } = await API.get(`/orders/${id}`)
      setOrder(data.order)
      setTracking(data.tracking || [])
      setPayments(data.payments || [])
      if (data.customer) setCustomer(data.customer)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch order:', err)
      setError(err.response?.data?.message || 'Failed to load order')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!confirm('Are you sure you want to cancel this order?')) return
    try {
      const { data } = await API.put(`/orders/cancel/${id}`)
      setOrder(data.order)
      toast.success('Order cancelled')
      fetchOrder()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel order')
    }
  }

  const handlePayNow = async () => {
    setPaying(true)
    try {
      // 1. Load Razorpay SDK
      const loaded = await loadRazorpayScript()
      if (!loaded) {
        toast.error('Could not load payment gateway. Please try again.')
        setPaying(false)
        return
      }

      // 2. Create a Razorpay order for this existing order
      const { data } = await API.post(`/payments/create-order-for-order/${id}`)

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
              orderId: id,
            })
            toast.success('Payment successful! Your order is confirmed.')
            fetchOrder()
          } catch (err) {
            toast.error(err.response?.data?.message || 'Payment verification failed')
          } finally {
            setPaying(false)
          }
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      })

      rzp.on('payment.failed', (response) => {
        console.error('Payment failed:', response.error)
        toast.error(response.error?.description || 'Payment failed. Please try again.')
        setPaying(false)
      })

      rzp.open()
    } catch (err) {
      console.error('Pay now error:', err)
      toast.error(err.response?.data?.message || 'Failed to initiate payment')
      setPaying(false)
    }
  }

  if (!user) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-3xl font-semibold text-slate-900 mb-8">Track Order</h1>
        <EmptyState icon="🔒" title="Please sign in" description="Login to track your order." actionText="Sign In" actionLink="/login" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-3xl font-semibold text-slate-900 mb-8">Track Order</h1>
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-3xl font-semibold text-slate-900 mb-8">Track Order</h1>
        <EmptyState icon="⚠️" title="Order not found" description={error} actionText="View My Orders" actionLink="/orders" />
      </div>
    )
  }

  const currentStatusIndex = STATUS_ORDER.indexOf(order.status)
  const isCancelled = order.status === 'cancelled'
  const cancellable = ['pending', 'confirmed', 'processing'].includes(order.status)
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  return (
    <div className="container-app py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-900">Track Order</h1>
          <p className="text-slate-500 mt-1">Order #{order.id} • Placed {new Date(order.created_at).toLocaleDateString()}</p>
        </div>
        <Link to="/orders" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
          ← My Orders
        </Link>
      </div>

      {/* Status banner */}
      <div className={`rounded-xl p-6 mb-6 shadow-soft ${isCancelled ? 'bg-red-50 border border-red-200' : 'bg-white'}`}>
        <div className="flex items-center gap-4">
          <span className="text-4xl">{isCancelled ? STATUS_ICONS.cancelled : STATUS_ICONS[order.status]}</span>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-slate-900">
              {isCancelled ? 'Order Cancelled' : STATUS_LABELS[order.status]}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {isCancelled
                ? 'This order has been cancelled.'
                : `Estimated delivery: ${new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()}`}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {order.payment_status === 'paid' ? 'Paid' : 'Payment Pending'}
          </span>
        </div>

        {/* Pay Now button for unpaid orders */}
        {!isAdmin && order.payment_status !== 'paid' && !isCancelled && (
          <div className="mt-4 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div>
              <p className="text-sm font-medium text-amber-800">Complete your payment</p>
              <p className="text-xs text-amber-700 mt-0.5">Pay ₹{Number(order.total).toLocaleString('en-IN', { maximumFractionDigits: 0 })} now to confirm your order</p>
            </div>
            <button
              onClick={handlePayNow}
              disabled={paying}
              className="ml-4 flex-shrink-0 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              {paying ? 'Processing…' : '💳 Pay Now'}
            </button>
          </div>
        )}
      </div>

      {cancellable && (
        <div className="mb-6 flex justify-end">
          <button onClick={handleCancelOrder} className="text-sm text-red-600 hover:text-red-700 font-medium border border-red-200 rounded-lg px-4 py-2 hover:bg-red-50 transition-colors">
            Cancel Order
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Tracking timeline */}
        <div className="lg:col-span-2">
          {/* Progress bar */}
          {!isCancelled && (
            <div className="bg-white rounded-xl shadow-soft p-6 mb-6">
              <h3 className="font-semibold text-slate-800 mb-6">Delivery Progress</h3>
              <div className="relative">
                <div className="absolute top-4 left-0 right-0 h-1 bg-slate-200 rounded-full" />
                <div
                  className="absolute top-4 left-0 h-1 bg-primary-600 rounded-full transition-all duration-500"
                  style={{ width: `${(currentStatusIndex / (STATUS_ORDER.length - 1)) * 100}%` }}
                />
                <div className="relative flex justify-between">
                  {STATUS_ORDER.map((status, index) => (
                    <div key={status} className="flex flex-col items-center flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${index <= currentStatusIndex ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-slate-300 text-slate-400'}`}>
                        {index < currentStatusIndex ? '✓' : index + 1}
                      </div>
                      <span className={`text-xs mt-2 text-center ${index <= currentStatusIndex ? 'text-primary-700 font-medium' : 'text-slate-400'}`}>
                        {STATUS_LABELS[status]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-xl shadow-soft p-6">
            <h3 className="font-semibold text-slate-800 mb-6">Order Timeline</h3>
            {tracking.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No tracking updates yet.</p>
            ) : (
              <div className="space-y-0">
                {tracking.map((entry, index) => (
                  <div key={entry.id} className="flex gap-4">
                    {/* Timeline indicator */}
                    <div className="flex flex-col items-center">
                      <div className={`w-4 h-4 rounded-full border-2 ${index === 0 ? 'bg-primary-600 border-primary-600' : 'bg-white border-slate-300'} flex-shrink-0 mt-1`} />
                      {index < tracking.length - 1 && <div className="w-0.5 flex-grow bg-slate-200 my-1" />}
                    </div>
                    {/* Content */}
                    <div className={`pb-6 ${index === tracking.length - 1 ? '' : 'border-b border-slate-100'}`}>
                      <p className={`font-medium ${index === 0 ? 'text-primary-700' : 'text-slate-800'}`}>
                        {STATUS_ICONS[entry.status] || '📦'} {STATUS_LABELS[entry.status] || entry.status}
                      </p>
                      {entry.note && <p className="text-sm text-slate-500 mt-1">{entry.note}</p>}
                      {entry.location && <p className="text-xs text-slate-400 mt-1">📍 {entry.location}</p>}
                      <p className="text-xs text-slate-400 mt-1">{new Date(entry.updated_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment info */}
          {payments.length > 0 && (
            <div className="bg-white rounded-xl shadow-soft p-6 mt-6">
              <h3 className="font-semibold text-slate-800 mb-4">Payment Details</h3>
              {payments.map((payment) => (
                <div key={payment.id} className="text-sm space-y-1">
                  {payment.method === 'cod' || payment.method === 'cash' ? (
                    <p className="text-slate-600">💵 Cash on Delivery</p>
                  ) : (
                    <>
                      <p className="text-slate-600">{payment.method === 'card' ? '💳 Card' : '📱 UPI'} • {payment.method === 'card' && JSON.parse(payment.payment_details || '{}')?.cardLast4 ? `•••• ${JSON.parse(payment.payment_details || '{}').cardLast4}` : ''}</p>
                      <p className="text-slate-500">Transaction ID: {payment.transaction_id}</p>
                    </>
                  )}
                  <p className={`font-medium ${payment.status === 'completed' ? 'text-green-600' : 'text-amber-600'}`}>
                    ₹{Number(payment.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })} • {payment.status}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Order details */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-soft p-6 sticky top-24">
            <h3 className="font-semibold text-slate-800 mb-4">Order Summary</h3>

            {customer && (
              <div className="mb-4 pb-4 border-b border-slate-100">
                <p className="text-sm text-slate-500">Customer</p>
                <p className="font-medium text-slate-800">{customer.name}</p>
                <p className="text-xs text-slate-500">{customer.email}</p>
              </div>
            )}

            <div className="space-y-4 mb-4">
              {order.items.map((item, index) => (
                <div key={index} className="flex gap-3">
                  <img
                    src={item.image?.startsWith('http') ? item.image : baseURL + item.image}
                    alt={item.name}
                    className="w-14 h-16 object-cover rounded-lg flex-shrink-0"
                    onError={(e) => { e.target.src = 'https://placehold.co/100x120/slate/white?text=Saree' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 line-clamp-1">{item.name}</p>
                    <p className="text-xs text-slate-500">Qty: {item.quantity}</p>
                    <p className="text-xs text-slate-500">{item.fabric} · {item.color}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">₹{Number(item.price * item.quantity).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-sm border-t border-slate-100 pt-4 mb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium">₹{Number(order.total).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Shipping</span>
                <span className="font-medium text-green-600">FREE</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-800">Total</span>
                <span className="text-xl font-bold text-primary-700">₹{Number(order.total).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>

            {/* Shipping address */}
            {order.shipping_address && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm text-slate-500 mb-1">Shipping Address</p>
                <p className="text-sm text-slate-700">{order.shipping_address}</p>
                {order.phone && <p className="text-xs text-slate-500 mt-1">📞 {order.phone}</p>}
              </div>
            )}

            {!isAdmin && (
              <Link to="/shop" className="block text-center text-sm text-primary-600 hover:text-primary-700 mt-4">
                Continue Shopping →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}