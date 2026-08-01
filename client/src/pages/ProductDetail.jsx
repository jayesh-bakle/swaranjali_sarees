import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import API from '../api/client'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import ProductCard from '../components/ProductCard'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

export default function ProductDetail() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const { addItem } = useCart()
  const { isAdmin } = useAuth()

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true)
      try {
        const { data } = await API.get(`/products/${id}`)
        setProduct(data.product)
        window.scrollTo({ top: 0, behavior: 'smooth' })

        // Fetch related products in same category
        const params = { limit: 4 }
        if (data.product.category) params.category = data.product.category
        const { data: relatedData } = await API.get('/products', { params })
        setRelated(relatedData.products.filter((p) => p.id !== data.product.id).slice(0, 4))
      } catch (err) {
        console.error('Error fetching product:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProduct()
  }, [id])

  if (loading) {
    return <LoadingSpinner text="Loading product..." fullPage />
  }

  if (!product) {
    return (
      <div className="container-app py-20 text-center">
        <h2 className="font-display text-2xl text-slate-800 mb-4">Product not found</h2>
        <Link to="/shop" className="btn-primary">Back to Shop</Link>
      </div>
    )
  }

  const discount = product.sale_price
    ? Math.round(((product.price - product.sale_price) / product.price) * 100)
    : 0

  const imageUrl = product.image_url?.startsWith('http')
    ? product.image_url
    : (import.meta.env.VITE_API_URL || 'http://localhost:5000') + product.image_url

  const handleAddToCart = () => {
    addItem(product, quantity)
  }

  return (
    <div className="container-app py-10">
      {/* Breadcrumb */}
      <nav className="text-sm text-slate-500 mb-6">
        <Link to="/" className="hover:text-primary-600">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/shop" className="hover:text-primary-600">Shop</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Product image */}
        <div className="relative">
          <div className="sticky top-24">
            <div className="rounded-2xl overflow-hidden shadow-card aspect-[3/4] bg-slate-100">
              <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />
            </div>
            {discount > 0 && (
              <div className="absolute top-4 left-4">
                <span className="badge-sale text-sm">SALE -{discount}%</span>
              </div>
            )}
            {product.is_featured === 1 && (
              <div className="absolute bottom-4 left-4">
                <span className="badge-featured">✨ Featured</span>
              </div>
            )}
          </div>
        </div>

        {/* Product info */}
        <div>
          <p className="text-sm text-slate-500 uppercase tracking-wider mb-2">{product.fabric}</p>
          <h1 className="font-display text-3xl font-bold text-slate-900 mb-3">{product.name}</h1>
          
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl font-bold text-primary-700">
              ${(product.sale_price || product.price).toFixed(2)}
            </span>
            {product.sale_price && (
              <span className="text-lg text-slate-400 line-through">${product.price.toFixed(2)}</span>
            )}
            {discount > 0 && <span className="badge-sale">Save {discount}%</span>}
          </div>

          <p className="text-slate-600 leading-relaxed mb-6">
            {product.description || 'This exquisite saree is handcrafted by skilled artisans. Each piece is unique, reflecting the rich cultural heritage of India.'}
          </p>

          {/* Details table */}
          <div className="bg-white rounded-xl border border-slate-100 p-5 mb-6">
            <h3 className="font-semibold text-slate-800 mb-3">Product Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between border-b border-slate-50 pb-2">
                <span className="text-slate-500">Fabric</span>
                <span className="font-medium text-slate-800">{product.fabric || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-2">
                <span className="text-slate-500">Color</span>
                <span className="font-medium text-slate-800">{product.color || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-2">
                <span className="text-slate-500">Size</span>
                <span className="font-medium text-slate-800">{product.size || 'U (6.3 m)'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-2">
                <span className="text-slate-500">Category</span>
                <span className="font-medium text-slate-800">{product.category || 'General'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">In Stock</span>
                <span className={`font-medium ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {product.stock > 0 ? `${product.stock} available` : 'Out of stock'}
                </span>
              </div>
            </div>
          </div>

          {/* Add to cart — customers only; admins see manage panel */}
          {isAdmin ? (
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-5 mb-6">
              <p className="font-semibold text-primary-800 mb-2">👑 Admin View</p>
              <p className="text-sm text-primary-700 mb-3">You manage the store. Use the Admin Panel to edit this product or update its stock.</p>
              <Link to="/admin" className="btn-primary text-sm">Go to Admin Panel</Link>
            </div>
          ) : (
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center border-2 border-slate-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 hover:bg-slate-100 transition-colors text-lg font-medium"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="px-4 py-2 text-center font-semibold min-w-[3rem]">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(product.stock || 99, quantity + 1))}
                  className="px-3 py-2 hover:bg-slate-100 transition-colors text-lg font-medium"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                disabled={product.stock <= 0}
                className="btn-primary flex-1 text-base py-3"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
              </button>
            </div>
          )}

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-100">
            {[
              { icon: '🚚', text: 'Free Shipping' },
              { icon: '↩️', text: '7-Day Returns' },
              { icon: '💯', text: 'Authentic' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl mb-1">{item.icon}</div>
                <p className="text-xs text-slate-500">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl font-semibold text-slate-900 mb-6">You May Also Like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}