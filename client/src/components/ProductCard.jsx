import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { resolveImageUrl } from '../utils/imageUrl'

function formatPrice(price) {
  return `₹${Number(price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default function ProductCard({ product }) {
  const { addItem } = useCart()
  const { isAdmin } = useAuth()

  const discount = product.sale_price
    ? Math.round(((product.price - product.sale_price) / product.price) * 100)
    : 0

  return (
    <div className="group bg-white overflow-hidden transition-all duration-300 hover:shadow-hover border border-slate-100 hover:border-primary-200">
      {/* Image */}
      <Link to={`/product/${product.id}`} className="relative block aspect-[3/4] overflow-hidden bg-slate-50">
        <img
          src={resolveImageUrl(product.image_url)}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
          onError={(e) => { e.target.src = 'https://placehold.co/400x500/slate/white?text=Saree' }}
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {discount > 0 && (
            <span className="badge-sale">{discount}% OFF</span>
          )}
          {Number(product.is_featured) === 1 && (
            <span className="bg-gold-500 text-white text-xs font-medium px-2.5 py-0.5 tracking-wide">FEATURED</span>
          )}
          {product.stock <= 0 && (
            <span className="bg-slate-800 text-white text-xs font-medium px-2.5 py-0.5 tracking-wide">SOLD OUT</span>
          )}
        </div>

        {/* Quick add — hover reveal on desktop, always visible on touch/mobile */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 max-md:translate-y-0">
          {isAdmin ? (
            <Link
              to="/admin"
              className="block w-full py-3 bg-primary-800 text-white text-sm font-medium uppercase tracking-wider hover:bg-primary-900 transition-colors text-center"
            >
              Manage in Admin
            </Link>
          ) : product.stock <= 0 ? (
            <button
              disabled
              className="w-full py-3 bg-slate-300 text-slate-500 text-sm font-medium uppercase tracking-wider cursor-not-allowed"
            >
              Out of Stock
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.preventDefault()
                addItem(product)
              }}
              className="w-full py-3 bg-primary-800 text-white text-sm font-medium uppercase tracking-wider hover:bg-primary-900 transition-colors"
            >
              Add to Cart
            </button>
          )}
        </div>
      </Link>

      {/* Info */}
      <Link to={`/product/${product.id}`} className="block p-4 text-center">
        <p className="text-[11px] text-slate-400 mb-1 uppercase tracking-[0.2em]">{product.fabric || 'Silk'}</p>
        <h3 className="font-display text-lg font-semibold text-slate-900 group-hover:text-primary-700 transition-colors line-clamp-1">
          {product.name}
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">{product.color}</p>
        <div className="mt-2 flex items-baseline justify-center gap-2">
          <span className="text-base font-semibold text-primary-800">
            {formatPrice(product.sale_price || product.price)}
          </span>
          {product.sale_price && (
            <span className="text-sm text-slate-400 line-through">
              {formatPrice(product.price)}
            </span>
          )}
        </div>
      </Link>
    </div>
  )
}