import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import API from '../api/client'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import ProductCard from '../components/ProductCard'
import Reviews from '../components/Reviews'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'
import { resolveImageUrl } from '../utils/imageUrl'
import { usePageMeta } from '../utils/usePageMeta'

export default function ProductDetail() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(0)
  const [paused, setPaused] = useState(false)
  const { addItem } = useCart()
  const { isAdmin } = useAuth()

  // Per-product SEO (title/description/og) once loaded
  usePageMeta({
    title: product ? product.name : undefined,
    description: product ? `${product.name} — ${product.fabric || 'Silk'} saree. ${product.stock > 0 ? 'In stock' : 'Currently out of stock'}.` : undefined,
    image: product?.image_url,
    type: 'product',
  })

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true)
      try {
        const { data } = await API.get(`/products/${id}`)
        setProduct(data.product)
        setActiveImage(0)
        setError(false)
        window.scrollTo({ top: 0, behavior: 'smooth' })

        // Fetch related products in same category
        const params = { limit: 4 }
        if (data.product.category) params.category = data.product.category
        const { data: relatedData } = await API.get('/products', { params })
        setRelated(relatedData.products.filter((p) => p.id !== data.product.id).slice(0, 4))
      } catch (err) {
        console.error('Error fetching product:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchProduct()
  }, [id])

  // All images for this product — computed here (above the early returns) so the
  // auto-advance effect below can reference it safely even while product is null.
  const imageUrl = product?.image_url ? resolveImageUrl(product.image_url) : ''
  const images = product && Array.isArray(product.images) && product.images.length
    ? product.images.map(resolveImageUrl)
    : (imageUrl ? [imageUrl] : [])

  // Auto-slide the gallery every 3.5s while there is more than one image.
  // Paused while the user hovers/touches the gallery so they can look at a slide.
  useEffect(() => {
    if (images.length < 2 || paused) return
    const timer = setInterval(() => {
      setActiveImage((i) => (i + 1) % images.length)
    }, 3500)
    return () => clearInterval(timer)
  }, [images.length, paused])

  if (loading) {
    return <LoadingSpinner text="Loading product..." fullPage />
  }

  if (error && !product) {
    return (
      <div className="container-app py-20 text-center">
        <h2 className="font-display text-2xl text-slate-800 mb-4">Couldn't load this product</h2>
        <p className="text-slate-500 mb-6">There was a problem reaching the store. Please try again.</p>
        <Link to="/shop" className="btn-primary">Back to Shop</Link>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container-app py-20 text-center">
        <h2 className="font-display text-2xl text-slate-800 mb-4">Product not found</h2>
        <Link to="/shop" className="btn-primary">Back to Shop</Link>
      </div>
    )
  }

  const discount = product.sale_price && Number(product.price) > 0
    ? Math.round(((Number(product.price) - Number(product.sale_price)) / Number(product.price)) * 100)
    : 0

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
        {/* Product image gallery */}
        <div>
          <div className="sticky top-24 flex flex-col-reverse sm:flex-row gap-3">
            {/* Thumbnail strip — vertical beside the image on desktop, horizontal below on mobile */}
            {images.length > 1 && (
              <div className="flex sm:flex-col gap-2 sm:w-20 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 -mx-1 px-1">
                {images.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`w-16 h-20 sm:w-20 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                      i === activeImage ? 'border-primary-500 ring-2 ring-primary-200' : 'border-transparent hover:border-slate-300'
                    }`}
                    aria-label={`View image ${i + 1}`}
                  >
                    <img src={src} alt={`${product.name} — view ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {/* Main image — auto-slides every 3.5s; pauses on hover/touch */}
            <div
              className="relative flex-1 min-w-0"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              onTouchStart={() => setPaused(true)}
              onTouchEnd={() => setPaused(false)}
            >
              <div className="rounded-2xl overflow-hidden shadow-card aspect-[3/4] bg-slate-100">
                <img key={activeImage} src={images[activeImage] || imageUrl} alt={product.name} className="w-full h-full object-cover animate-fade-in" />
              </div>
              {discount > 0 && (
                <div className="absolute top-4 left-4">
                  <span className="badge-sale text-sm">SALE -{discount}%</span>
                </div>
              )}
              {Number(product.is_featured) === 1 && (
                <div className="absolute bottom-4 left-4">
                  <span className="badge-featured">✨ Featured</span>
                </div>
              )}
              {images.length > 1 && (
                <>
                  {/* Prev / next arrows */}
                  <button
                    type="button"
                    onClick={() => setActiveImage((activeImage - 1 + images.length) % images.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 shadow-md hover:bg-white flex items-center justify-center text-slate-700 text-2xl leading-none transition-colors"
                    aria-label="Previous image"
                  >‹</button>
                  <button
                    type="button"
                    onClick={() => setActiveImage((activeImage + 1) % images.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 shadow-md hover:bg-white flex items-center justify-center text-slate-700 text-2xl leading-none transition-colors"
                    aria-label="Next image"
                  >›</button>
                  {/* Slide counter */}
                  <div className="absolute bottom-3 right-3 text-xs font-medium text-slate-700 bg-white/85 rounded-full px-2.5 py-0.5 shadow-sm">
                    {activeImage + 1} / {images.length}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Product info */}
        <div>
          <p className="text-sm text-slate-500 uppercase tracking-wider mb-2">{product.fabric}</p>
          <h1 className="font-display text-3xl font-bold text-slate-900 mb-3">{product.name}</h1>
          
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl font-bold text-primary-700">
              ₹{Number(product.sale_price || product.price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
            {product.sale_price && (
              <span className="text-lg text-slate-400 line-through">₹{Number(product.price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
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
              <div className="flex justify-between">
                <span className="text-slate-500">SKU</span>
                <span className="font-medium text-slate-800">JP-{String(product.id).padStart(4, '0')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Delivery</span>
                <span className="font-medium text-slate-800">🚚 5–7 days, FREE</span>
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

      {/* Reviews */}
      <div className="mt-16">
        <Reviews productId={product.id} />
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