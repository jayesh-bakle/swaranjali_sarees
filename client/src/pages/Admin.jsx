import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import API from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'
import { resolveImageUrl } from '../utils/imageUrl'
import { exportCSV } from '../utils/csv'

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled']
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded']

const STATUS_BADGE = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  out_for_delivery: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const emptyForm = {
  name: '', description: '', price: '', sale_price: '', fabric: '', color: '',
  size: 'U (6.3 m)', category: '', stock: '10', is_featured: false
}

export default function Admin() {
  const { user, isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [stats, setStats] = useState(null)
  const [inventory, setInventory] = useState([])
  const [users, setUsers] = useState([])
  const [trend, setTrend] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Product form state
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [preview, setPreview] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [orderStatus, setOrderStatus] = useState({})
  const [paymentStatus, setPaymentStatus] = useState({})

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return
    }
    fetchAll()
  }, [isAdmin])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [prodRes, orderRes, statRes] = await Promise.all([
        API.get('/products?limit=100'),
        API.get('/orders/all'),
        API.get('/admin/stats'),
      ])
      setProducts(prodRes.data.products)
      setOrders(orderRes.data.orders)
      setStats(statRes.data.stats)
    } catch (err) {
      console.error('Error fetching admin data:', err)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const fetchTabData = async (tab) => {
    try {
      if (tab === 'inventory') {
        const { data } = await API.get('/admin/inventory-report')
        setInventory(data.products)
      }
      if (tab === 'customers') {
        const { data } = await API.get('/admin/users')
        setUsers(data.users)
      }
      if (tab === 'overview') {
        const { data } = await API.get('/admin/revenue-trend')
        setTrend(data.trend)
      }
    } catch (err) {
      toast.error('Failed to load data')
    }
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    fetchTabData(tab)
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImageFile(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  const resetForm = () => {
    setForm(emptyForm)
    setPreview(null)
    setImageFile(null)
    setEditingProduct(null)
    setShowForm(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return // prevent double-submit
    if (!form.name || !form.price || Number(form.stock) < 0) {
      toast.error('Please fill name, price, and valid stock')
      return
    }
    const priceNum = Number(form.price)
    if (form.sale_price && Number(form.sale_price) >= priceNum) {
      toast.error('Sale price must be lower than the price')
      return
    }
    const formData = new FormData()
    Object.keys(form).forEach((key) => formData.append(key, form[key]))

    setSubmitting(true)
    try {
      if (editingProduct) {
        if (imageFile) formData.append('image', imageFile)
        await API.put(`/products/${editingProduct.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        toast.success('Product updated successfully!')
      } else {
        if (!imageFile) {
          toast.error('Please select an image')
          return
        }
        formData.append('image', imageFile)
        await API.post('/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        toast.success('Product added successfully!')
      }
      resetForm()
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (product) => {
    setEditingProduct(product)
    setForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      sale_price: product.sale_price || '',
      fabric: product.fabric || '',
      color: product.color || '',
      size: product.size || 'U (6.3 m)',
      category: product.category || '',
      stock: product.stock,
      is_featured: Number(product.is_featured) === 1
    })
    setPreview(null)
    setImageFile(null)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return
    try {
      await API.delete(`/products/${id}`)
      toast.success('Product deleted')
      fetchAll()
    } catch (err) {
      toast.error('Failed to delete product')
    }
  }

  const handleQuickStock = async (id, newStock) => {
    if (newStock < 0) return
    try {
      await API.put(`/products/${id}`, { stock: newStock })
      toast.success('Stock updated')
      setProducts(products.map((p) => (p.id === id ? { ...p, stock: newStock } : p)))
    } catch (err) {
      toast.error('Failed to update stock')
    }
  }

  const handleOrderStatus = async (orderId, status) => {
    try {
      await API.put(`/orders/${orderId}/status`, { status })
      toast.success(`Order #${orderId} → ${status}`)
      fetchAll()
    } catch (err) {
      toast.error('Failed to update order status')
    }
  }

  const handlePaymentStatus = async (orderId, paymentStatusVal) => {
    try {
      await API.put(`/orders/${orderId}/payment`, { payment_status: paymentStatusVal })
      toast.success(`Order #${orderId} payment → ${paymentStatusVal}`)
      fetchAll()
    } catch (err) {
      toast.error('Failed to update payment status')
    }
  }

  if (!user) {
    return (
      <div className="container-app py-20 text-center">
        <p className="text-lg font-semibold mb-4">Please login to access the Admin Panel.</p>
        <Link to="/login" className="btn-primary">Sign In</Link>
      </div>
    )
  }
  if (!isAdmin) {
    return (
      <div className="container-app py-20 text-center">
        <p className="text-lg font-semibold">You don't have permission to access this page.</p>
      </div>
    )
  }

  if (loading && !stats && !products.length) {
    return <LoadingSpinner text="Loading seller dashboard..." fullPage />
  }

  const grossRevenue = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total), 0)
  const lowStockCount = products.filter((p) => p.stock <= 5).length
  const outOfStockCount = products.filter((p) => p.stock === 0).length

  const handleExportProducts = () => {
    exportCSV('products.csv',
      ['ID', 'Name', 'Category', 'Fabric', 'Price', 'Sale Price', 'Stock', 'Featured'],
      products.map((p) => ({
        ID: p.id, Name: p.name, Category: p.category, Fabric: p.fabric,
        Price: p.price, 'Sale Price': p.sale_price || '', Stock: p.stock, Featured: p.is_featured ? 'Yes' : 'No',
      }))
    )
  }

  const handleExportOrders = () => {
    exportCSV('orders.csv',
      ['Order ID', 'Customer', 'Status', 'Payment', 'Total', 'Date', 'Items'],
      orders.map((o) => ({
        'Order ID': o.id, Customer: o.customer_name || '', Status: o.status,
        Payment: o.payment_status, Total: o.total,
        Date: o.created_at || '',
        Items: Array.isArray(o.items) ? o.items.map((i) => `${i.name} ×${i.quantity}`).join(' | ') : '',
      }))
    )
  }

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'products', label: '📦 Products' },
    { id: 'orders', label: '📋 Orders' },
    { id: 'inventory', label: '📉 Inventory' },
    { id: 'customers', label: '👥 Customers' },
  ]

  return (
    <div className="container-app py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900">Seller Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Manage products, inventory, orders & customers</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'products' && (
            <button onClick={handleExportProducts} className="btn-outline">⬇ Export CSV</button>
          )}
          {activeTab === 'orders' && (
            <button onClick={handleExportOrders} className="btn-outline">⬇ Export CSV</button>
          )}
          {activeTab === 'products' && (
            <button onClick={showForm ? resetForm : () => setShowForm(true)} className="btn-primary">
              {showForm ? 'Cancel' : '+ Add Product'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            className={activeTab === t.id ? 'btn-primary' : 'btn-outline'}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <OverviewPanel stats={stats} orders={orders} products={products} trend={trend} setActiveTab={handleTabChange} />
      )}

      {activeTab === 'products' && (
        <>
          {showForm && (
            <div className="bg-white rounded-xl shadow-soft p-6 mb-8">
              <h2 className="font-display text-xl font-semibold mb-4">
                {editingProduct ? `Edit: ${editingProduct.name}` : 'Add New Saree'}
              </h2>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.keys(form).filter((k) => k !== 'is_featured').map((key) => (
                  <div key={key} className={key === 'description' ? 'md:col-span-2' : ''}>
                    <label className="label capitalize">
                      {key === 'sale_price' ? 'Sale Price (optional)' : key.replace(/_/g, ' ')}
                    </label>
                    <input
                      type={key === 'price' || key === 'sale_price' || key === 'stock' ? 'number' : 'text'}
                      name={key}
                      value={form[key]}
                      onChange={handleInputChange}
                      step={key === 'price' || key === 'sale_price' ? '0.01' : '1'}
                      className="input"
                      required={['name', 'price', 'stock'].includes(key)}
                    />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <label className="label">{editingProduct ? 'Product Image (leave empty to keep current)' : 'Product Image *'}</label>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="input cursor-pointer" />
                  {preview ? (
                    <img src={preview} alt="Preview" className="mt-2 h-40 object-cover rounded-lg" />
                  ) : editingProduct ? (
                    <img src={resolveImageUrl(editingProduct.image_url)} alt={editingProduct.name} className="mt-2 h-40 object-cover rounded-lg" />
                  ) : null}
                </div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <input type="checkbox" name="is_featured" checked={form.is_featured} onChange={handleInputChange} id="is_featured" className="w-4 h-4" />
                  <label htmlFor="is_featured" className="text-sm font-medium text-slate-700">Featured Product</label>
                </div>
                <div className="md:col-span-2 flex gap-3">
                  <button type="submit" disabled={submitting} className="btn-primary flex-1 text-base py-3 mt-2">
                    {submitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Add Product'}
                  </button>
                  {editingProduct && (
                    <button type="button" onClick={resetForm} className="btn-outline text-base py-3 mt-2">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {products.length === 0 ? (
            <LoadingSpinner text="Loading products..." />
          ) : (
            <div className="bg-white rounded-xl shadow-soft overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Featured</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img src={resolveImageUrl(p.image_url)} alt={p.name} className="w-12 h-14 object-cover rounded" />
                          <div>
                            <p className="font-medium text-slate-800">{p.name}</p>
                            <p className="text-xs text-slate-500">{p.category} · {p.fabric}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {p.sale_price ? (
                          <div>
                            <span>₹{Number(p.sale_price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                            <span className="block text-xs text-slate-400 line-through">₹{Number(p.price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                          </div>
                        ) : (
                          `₹${Number(p.price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleQuickStock(p.id, p.stock - 1)}
                            className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded hover:bg-slate-100"
                            title="Decrease stock"
                          >−</button>
                          <span className={`font-semibold min-w-[2rem] text-center ${p.stock <= 3 ? 'text-red-600' : 'text-slate-800'}`}>{p.stock}</span>
                          <button
                            onClick={() => handleQuickStock(p.id, p.stock + 1)}
                            className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded hover:bg-slate-100"
                            title="Increase stock"
                          >+</button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.stock === 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Out of Stock</span>
                        ) : p.stock <= 5 ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Low Stock</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">In Stock</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{p.is_featured ? '✅' : '—'}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => handleEdit(p)} className="text-blue-600 hover:text-blue-700 text-xs font-medium mr-3">Edit</button>
                        <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-700 text-xs font-medium">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'orders' && (
        <div className="bg-white rounded-xl shadow-soft overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">#{o.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{o.customer_name || `User #${o.user_id}`}</p>
                    {o.customer_email && <p className="text-xs text-slate-500">{o.customer_email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex -space-x-2">
                      {o.items.slice(0, 3).map((item, idx) => (
                        <img
                          key={idx}
                          src={resolveImageUrl(item.image)}
                          alt={item.name}
                          className="w-8 h-10 object-cover rounded border-2 border-white"
                          onError={(e) => { e.target.style.display = 'none' }}
                        />
                      ))}
                      {o.items.length > 3 && (
                        <span className="w-8 h-10 flex items-center justify-center bg-slate-100 text-xs font-medium text-slate-500 rounded border-2 border-white">
                          +{o.items.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">₹{Number(o.total).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      o.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                      o.payment_status === 'refunded' ? 'bg-slate-100 text-slate-600' :
                      o.payment_status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {o.payment_status === 'paid' ? 'Paid' : o.payment_status === 'refunded' ? 'Refunded' : o.payment_status === 'failed' ? 'Failed' : 'Pending'}
                    </span>
                    <div className="mt-1">
                      <select
                        value={paymentStatus[o.id] || o.payment_status}
                        onChange={(e) => {
                          setPaymentStatus({ ...paymentStatus, [o.id]: e.target.value })
                          handlePaymentStatus(o.id, e.target.value)
                        }}
                        className="input !py-0.5 text-xs w-auto"
                      >
                        {PAYMENT_STATUSES.map((s) => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[o.status] || STATUS_BADGE.pending}`}>
                      {o.status.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <select
                      value={orderStatus[o.id] || o.status}
                      onChange={(e) => {
                        setOrderStatus({ ...orderStatus, [o.id]: e.target.value })
                        handleOrderStatus(o.id, e.target.value)
                      }}
                      className="input !py-1 text-xs"
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>{s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'inventory' && (
        <InventoryPanel inventory={inventory} />
      )}

      {activeTab === 'customers' && (
        <CustomersPanel users={users} />
      )}
    </div>
  )
}

/* ------------------- Sub-components ------------------- */

function OverviewPanel({ stats, orders, products, trend, setActiveTab }) {
  const grossRevenue = (orders || []).filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total), 0)
  const lowStock = (products || []).filter((p) => p.stock <= 5).length
  const outOfStock = (products || []).filter((p) => p.stock === 0).length

  const cards = [
    { label: 'Total Revenue', value: `₹${Number(grossRevenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: '💰', color: 'bg-green-50 text-green-700' },
    { label: 'Total Orders', value: (orders || []).length, icon: '📋', color: 'bg-blue-50 text-blue-700' },
    { label: 'Products', value: (products || []).length, icon: '📦', color: 'bg-purple-50 text-purple-700' },
    { label: 'Low Stock', value: lowStock, icon: '⚠️', color: 'bg-amber-50 text-amber-700' },
    { label: 'Out of Stock', value: outOfStock, icon: '🚫', color: 'bg-red-50 text-red-700' },
    { label: 'Pending Orders', value: (orders || []).filter((o) => ['pending', 'confirmed', 'processing'].includes(o.status)).length, icon: '⏳', color: 'bg-orange-50 text-orange-700' },
  ]

  const recentOrders = (orders || []).slice(0, 5)

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={() => c.label === 'Low Stock' || c.label === 'Out of Stock' ? setActiveTab('inventory') : c.label === 'Pending Orders' ? setActiveTab('orders') : setActiveTab('overview')}
            className={`bg-white rounded-xl shadow-soft p-4 text-left hover:shadow-lg transition-shadow`}
          >
            <div className={`inline-flex w-9 h-9 items-center justify-center rounded-lg text-lg ${c.color}`}>{c.icon}</div>
            <p className="mt-2 text-xl font-bold text-slate-900">{c.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{c.label}</p>
          </button>
        ))}
      </div>

      {/* Revenue trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-soft p-6">
          <h3 className="font-display text-lg font-semibold text-slate-900 mb-4">Revenue Trend (Last 6 Months)</h3>
          {trend && trend.length > 0 ? (
            <div className="flex items-end gap-3 h-40">
              {trend.map((t) => (
                <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-slate-500 font-medium">₹{Number(t.revenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  <div
                    className={`w-full rounded-t-lg ${Number(t.revenue) > 0 ? 'bg-primary-500' : 'bg-slate-100'}`}
                    style={{ height: `${Math.max(4, Number(t.revenue) > 0 ? (Number(t.revenue) / Math.max(...trend.map((x) => Number(x.revenue)), 1)) * 112 : 4)}px` }}
                    title={`${t.month}: ₹${Number(t.revenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${t.orders} orders)`}
                  />
                  <span className="text-[10px] text-slate-400">{t.month.slice(5)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">No revenue data yet. Orders will appear here.</p>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl shadow-soft p-6">
          <h3 className="font-display text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button onClick={() => setActiveTab('products')} className="w-full text-left flex items-center justify-between px-4 py-3 rounded-lg border border-slate-200 hover:border-primary-400 hover:bg-primary-50 transition-colors">
              <span className="text-sm font-medium text-slate-700">➕ Add New Product</span>
              <span className="text-slate-400">→</span>
            </button>
            <button onClick={() => setActiveTab('orders')} className="w-full text-left flex items-center justify-between px-4 py-3 rounded-lg border border-slate-200 hover:border-primary-400 hover:bg-primary-50 transition-colors">
              <span className="text-sm font-medium text-slate-700">📋 Manage Orders</span>
              <span className="text-slate-400">→</span>
            </button>
            <button onClick={() => setActiveTab('inventory')} className="w-full text-left flex items-center justify-between px-4 py-3 rounded-lg border border-slate-200 hover:border-primary-400 hover:bg-primary-50 transition-colors">
              <span className="text-sm font-medium text-slate-700">📉 Inventory Report</span>
              <span className="text-slate-400">→</span>
            </button>
            <button onClick={() => setActiveTab('customers')} className="w-full text-left flex items-center justify-between px-4 py-3 rounded-lg border border-slate-200 hover:border-primary-400 hover:bg-primary-50 transition-colors">
              <span className="text-sm font-medium text-slate-700">👥 View Customers</span>
              <span className="text-slate-400">→</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-xl shadow-soft overflow-x-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-display text-lg font-semibold text-slate-900">Recent Orders</h3>
          <button onClick={() => setActiveTab('orders')} className="text-sm text-primary-600 hover:text-primary-700 font-medium">View All →</button>
        </div>
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recentOrders.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No orders yet.</td></tr>
            ) : recentOrders.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">#{o.id}</td>
                <td className="px-4 py-3">{o.customer_name || `User #${o.user_id}`}</td>
                <td className="px-4 py-3 font-medium">₹{Number(o.total).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[o.status] || STATUS_BADGE.pending}`}>
                    {o.status.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InventoryPanel({ inventory }) {
  if (!inventory.length) {
    return (
      <div className="bg-white rounded-xl shadow-soft p-10 text-center text-slate-400">
        <p className="text-4xl mb-3">📉</p>
        <p>Loading inventory report...</p>
      </div>
    )
  }

  const totalValue = inventory.reduce((s, p) => s + Number(p.stock) * Number(p.price), 0)
  const avgRating = inventory.filter((p) => p.avg_rating).reduce((s, p) => s + Number(p.avg_rating), 0) / (inventory.filter((p) => p.avg_rating).length || 1)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-soft p-4">
          <p className="text-xs text-slate-500">Total Products</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{inventory.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-soft p-4">
          <p className="text-xs text-slate-500">Total Stock Value</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">₹{Number(totalValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-white rounded-xl shadow-soft p-4">
          <p className="text-xs text-slate-500">Low Stock Items</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{inventory.filter((p) => p.stock <= 5 && p.stock > 0).length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-soft p-4">
          <p className="text-xs text-slate-500">Out of Stock</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{inventory.filter((p) => p.stock === 0).length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-soft overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Stock Value</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Reviews</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inventory.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img src={resolveImageUrl(p.image_url)} alt={p.name} className="w-10 h-12 object-cover rounded" />
                    <p className="font-medium text-slate-800">{p.name}</p>
                  </div>
                </td>
                <td className="px-4 py-3">{p.category || 'Uncategorized'}</td>
                <td className="px-4 py-3">₹{Number(p.price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3">
                  <span className={`font-semibold ${p.stock === 0 ? 'text-red-600' : p.stock <= 5 ? 'text-amber-600' : 'text-slate-800'}`}>{p.stock}</span>
                  {p.stock === 0 && <span className="ml-2 text-xs font-medium text-red-600">OUT</span>}
                  {p.stock <= 5 && p.stock > 0 && <span className="ml-2 text-xs font-medium text-amber-600">LOW</span>}
                </td>
                <td className="px-4 py-3 font-medium">₹{Number(Number(p.stock) * Number(p.price)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3">
                  {p.avg_rating ? (
                    <span className="text-amber-500 font-medium">★ {Number(p.avg_rating).toFixed(1)}</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{p.review_count || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CustomersPanel({ users }) {
  if (!users.length) {
    return (
      <div className="bg-white rounded-xl shadow-soft p-10 text-center text-slate-400">
        <p className="text-4xl mb-3">👥</p>
        <p>Loading customers...</p>
      </div>
    )
  }

  const totalCustomers = users.filter((u) => !u.is_admin).length
  const totalRevenue = users.reduce((s, u) => s + Number(u.total_spent || 0), 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-soft p-4">
          <p className="text-xs text-slate-500">Total Customers</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalCustomers}</p>
        </div>
        <div className="bg-white rounded-xl shadow-soft p-4">
          <p className="text-xs text-slate-500">Customer Revenue</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">₹{Number(totalRevenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-white rounded-xl shadow-soft p-4">
          <p className="text-xs text-slate-500">Avg Spend / Customer</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            ₹{totalCustomers ? Number(totalRevenue / totalCustomers).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-soft overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Total Spent</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.filter((u) => !u.is_admin).map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <p className="font-medium text-slate-800">{u.name}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3">{u.order_count || 0}</td>
                <td className="px-4 py-3 font-medium">₹{Number(u.total_spent || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}