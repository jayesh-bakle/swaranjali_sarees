import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'

function formatPrice(price) {
  return `$${Number(price).toFixed(2)}`
}

export default function ProductCard({ product }) {
  const { addItem } = useCart()
  const { isAdmin } = useAuth()

  const discount = product.sale_price
    ? Math.round(((product.price - product.sale_price) / product.price) * 100)
    : 0

  return (
    <div className="card group">
      {/* Image */}
      <Link to={`/product/${product.id}`} className="relative block aspect-[3/4] overflow-hidden bg-slate-100">
        <img
          src={product.image_url?.startsWith('http') ? product.image_url : (import.meta.env.VITE_API_URL || 'http://localhost:5000') + product.image_url}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(e) => { e.target.src = 'https://placehold.co/400x500/slate/white?text=Saree' }}
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {discount > 0 && (
            <span className="badge-sale">-{discount}%</span>
          )}
          {product.is_featured === 1 && (
            <span className="badge-featured">✨ Featured</span>
          )}
        </div>

        {/* Quick add on hover — customers only; admins get manage link */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          {isAdmin ? (
            <Link
              to="/admin"
              className="block w-full py-3 bg-slate-900/80 backdrop-blur text-white text-sm font-medium hover:bg-primary-600 transition-colors text-center"
            >
              Manage in Admin
            </Link>
          ) : (
            <button
              onClick={(e) => {
                e.preventDefault()
                addItem(product)
              }}
              className="w-full py-3 bg-slate-900/80 backdrop-blur text-white text-sm font-medium hover:bg-primary-600 transition-colors"
            >
              Add to Cart
            </button>
          )}
        </div>
      </Link>

      {/* Info */}
      <Link to={`/product/${product.id}`} className="block p-4">
        <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">{product.fabric}</p>
        <h3 className="font-medium text-slate-900 group-hover:text-primary-600 transition-colors line-clamp-1">
          {product.name}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {product.color}
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-semibold text-primary-700">
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