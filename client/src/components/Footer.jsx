import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 mt-16">
      <div className="container-app py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🧵</span>
              <span className="font-display text-2xl font-semibold text-white">
                Saree<span className="text-gold-400">Elegance</span>
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-md">
              Premium handpicked sarees from across India. From timeless Banarasi silks to breathable cotton blouses,
              find the perfect drape for every occasion.
            </p>
            <div className="flex gap-4 mt-4">
              <a href="#" className="text-slate-400 hover:text-white transition-colors" aria-label="Instagram">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors" aria-label="Facebook">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-display text-lg text-white mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="hover:text-gold-400 transition-colors">Home</Link></li>
              <li><Link to="/shop" className="hover:text-gold-400 transition-colors">Shop Sarees</Link></li>
              <li><Link to="/cart" className="hover:text-gold-400 transition-colors">Cart</Link></li>
              <li><Link to="/orders" className="hover:text-gold-400 transition-colors">My Orders</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-display text-lg text-white mb-4">Contact</h3>
            <ul className="space-y-2 text-sm">
              <li>📞 +91 98765 43210</li>
              <li>📧 support@sareeelegance.com</li>
              <li>📍 Mumbai, Maharashtra, India</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-10 pt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} SareeElegance. All rights reserved. Crafted with ❤️ for saree lovers.
        </div>
      </div>
    </footer>
  )
}