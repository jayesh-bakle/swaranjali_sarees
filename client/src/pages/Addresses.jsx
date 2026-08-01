import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import API from '../api/client'
import EmptyState from '../components/EmptyState'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

const emptyForm = {
  full_name: '', phone: '', address_line1: '', address_line2: '',
  city: '', state: '', postal_code: '', country: 'India', is_default: false
}

export default function Addresses() {
  const { user } = useAuth()
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    fetchAddresses()
  }, [user])

  const fetchAddresses = async () => {
    setLoading(true)
    try {
      const { data } = await API.get('/addresses')
      setAddresses(data.addresses || [])
    } catch (err) {
      console.error('Failed to fetch addresses:', err)
      toast.error('Failed to load addresses')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingId) {
        const { data } = await API.put(`/addresses/${editingId}`, form)
        setAddresses(addresses.map((a) => (a.id === editingId ? { ...a, ...data.address } : a)))
        toast.success('Address updated!')
      } else {
        const { data } = await API.post('/addresses', form)
        setAddresses([...addresses, data.address])
        toast.success('Address added!')
      }
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save address')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this address?')) return
    try {
      await API.delete(`/addresses/${id}`)
      setAddresses(addresses.filter((a) => a.id !== id))
      toast.success('Address deleted')
    } catch (err) {
      toast.error('Failed to delete address')
    }
  }

  const handleSetDefault = async (id) => {
    try {
      await API.put(`/addresses/${id}/default`)
      setAddresses(addresses.map((a) => ({ ...a, is_default: a.id === id ? 1 : 0 })))
      toast.success('Default address updated')
    } catch (err) {
      toast.error('Failed to update default address')
    }
  }

  const startEdit = (addr) => {
    setEditingId(addr.id)
    setForm({
      full_name: addr.full_name, phone: addr.phone,
      address_line1: addr.address_line1, address_line2: addr.address_line2 || '',
      city: addr.city, state: addr.state, postal_code: addr.postal_code,
      country: addr.country || 'India', is_default: !!addr.is_default
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!user) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-3xl font-semibold text-slate-900 mb-8">My Addresses</h1>
        <EmptyState icon="🔒" title="Please sign in" description="Login to manage your saved addresses." actionText="Sign In" actionLink="/login" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-3xl font-semibold text-slate-900 mb-8">My Addresses</h1>
        <LoadingSpinner />
      </div>
    )
  }

  const inputClass = 'input w-full'

  return (
    <div className="container-app py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-semibold text-slate-900">My Addresses</h1>
        <button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm) }} className="btn-primary">
          {showForm && !editingId ? 'Cancel' : '+ Add New Address'}
        </button>
      </div>

      {/* Address form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-soft p-6 mb-8 animate-fade-in">
          <h2 className="font-display text-xl font-semibold text-slate-900 mb-4">
            {editingId ? 'Edit Address' : 'Add New Address'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name *</label>
              <input className={inputClass} required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Recipient name" />
            </div>
            <div>
              <label className="label">Phone *</label>
              <input className={inputClass} required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Address Line 1 *</label>
              <input className={inputClass} required value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} placeholder="House no, Building, Street" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Address Line 2</label>
              <input className={inputClass} value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} placeholder="Area, Landmark" />
            </div>
            <div>
              <label className="label">City *</label>
              <input className={inputClass} required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <label className="label">State *</label>
              <input className={inputClass} required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </div>
            <div>
              <label className="label">PIN Code *</label>
              <input className={inputClass} required value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
            </div>
            <div>
              <label className="label">Country</label>
              <input className={inputClass} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="rounded" />
                Set as default address
              </label>
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : editingId ? 'Update Address' : 'Save Address'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm) }} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Address cards */}
      {addresses.length === 0 && !showForm ? (
        <EmptyState
          icon="🏠"
          title="No saved addresses"
          description="Add an address to make checkout faster and easier."
          actionText="+ Add Your First Address"
          actionHandler={() => setShowForm(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {addresses.map((addr) => (
            <div key={addr.id} className={`bg-white rounded-xl shadow-soft p-6 border-2 ${addr.is_default ? 'border-primary-500' : 'border-transparent'}`}>
              <div className="flex items-start justify-between mb-3">
                <p className="font-semibold text-slate-800">
                  {addr.full_name}
                  {!!addr.is_default && (
                    <span className="ml-2 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-semibold">Default</span>
                  )}
                </p>
              </div>
              <p className="text-sm text-slate-600">{addr.phone}</p>
              <p className="text-sm text-slate-600 mt-2">
                {addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ''}<br />
                {addr.city}, {addr.state} — {addr.postal_code}<br />
                {addr.country}
              </p>

              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100 text-sm">
                <button onClick={() => startEdit(addr)} className="text-primary-600 hover:text-primary-700 font-medium">
                  Edit
                </button>
                {!addr.is_default && (
                  <button onClick={() => handleSetDefault(addr.id)} className="text-slate-500 hover:text-slate-700 font-medium">
                    Set Default
                  </button>
                )}
                <button onClick={() => handleDelete(addr.id)} className="text-red-600 hover:text-red-700 font-medium ml-auto">
                  Delete
                </button>
              </div>
            </div>
          ))}

          {/* Add new card */}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center py-10 text-slate-400 hover:border-primary-400 hover:text-primary-500 transition-colors min-h-[180px]"
            >
              <span className="text-3xl mb-2">+</span>
              <span className="text-sm font-medium">Add New Address</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}