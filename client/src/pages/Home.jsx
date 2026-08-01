import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import API from '../api/client'
import ProductCard from '../components/ProductCard'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Home() {
  const [featured, setFeatured] = useState([])
  const [latest, setLatest] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const [featuredRes, latestRes] = await Promise.all([
          API.get('/products?sort=featured&limit=4'),
          API.get('/products?sort=newest&limit=8'),
        ])
        setFeatured(featuredRes.data.products)
        setLatest(latestRes.data.products)
      } catch (err) {
        console.error('Error fetching products:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [])

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-primary-700 via-primary-600 to-primary-500 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-40 h-40 rounded-full border-4 border-white"></div>
          <div className="absolute bottom-10 right-1/3 w-64 h-64 rounded-full border-4 border-white"></div>
          <div className="absolute top-1/4 right-10 w-24 h-24 rounded-full border-4 border-white"></div>
        </div>
        <div className="container-app py-20 lg:py-28 relative z-10">
          <div className="max-w-2xl">
            <p className="text-gold-400 font-medium mb-3 uppercase tracking-widest text-sm">
              Handpicked · Authentic · Premium
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Drape Yourself in
              <span className="block text-gold-400">Timeless Elegance</span>
            </h1>
            <p className="text-lg text-primary-100 mb-8 max-w-xl">
              Discover a curated collection of handwoven sarees — from luxurious Banarasi silks to
              breezy cotton weaves, crafted by artisans across India.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/shop" className="btn-gold text-lg px-8 py-3">
                Shop Collection
              </Link>
              <Link to="/login" className="btn bg-white/10 hover:bg-white/20 text-lg px-8 py-3 backdrop-blur">
                Become a Member
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="container-app py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-primary-600 font-medium text-sm uppercase tracking-widest mb-1">Featured</p>
            <h2 className="font-display text-3xl font-semibold text-slate-900">Editor's Picks</h2>
          </div>
          <Link to="/shop" className="text-primary-600 hover:text-primary-700 font-medium text-sm inline-flex items-center gap-1">
            View All <span aria-hidden>→</span>
          </Link>
        </div>
        {loading ? (
          <LoadingSpinner text="Loading featured sarees..." />
        ) : featured.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="text-center text-slate-500 py-12">No featured products yet. Check back soon!</p>
        )}
      </section>

      {/* Category Highlights */}
      <section className="bg-white py-16">
        <div className="container-app">
          <div className="text-center mb-10">
            <p className="text-primary-600 font-medium text-sm uppercase tracking-widest mb-1">Categories</p>
            <h2 className="font-display text-3xl font-semibold text-slate-900">Explore Our Collections</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { name: 'Wedding Collection', icon: '💍', desc: 'Banarasi & Kanjivaram silks', color: 'from-amber-500 to-yellow-600' },
              { name: 'Silk Collection', icon: '✨', desc: 'Tussar & pure silks', color: 'from-primary-500 to-primary-700' },
              { name: 'Cotton Collection', icon: '🌿', desc: 'Chanderi & everyday wear', color: 'from-emerald-500 to-teal-600' },
            ].map((cat, i) => (
              <Link
                key={i}
                to={`/shop?category=${encodeURIComponent(cat.name)}`}
                className={`bg-gradient-to-br ${cat.color} text-white rounded-xl p-8 text-center shadow-card hover:shadow-hover hover:-translate-y-1 transition-all duration-300`}
              >
                <div className="text-4xl mb-3">{cat.icon}</div>
                <h3 className="font-display text-xl font-semibold mb-1">{cat.name}</h3>
                <p className="text-sm text-white/80">{cat.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Products */}
      <section className="container-app py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-primary-600 font-medium text-sm uppercase tracking-widest mb-1">Just In</p>
            <h2 className="font-display text-3xl font-semibold text-slate-900">New Arrivals</h2>
          </div>
          <Link to="/shop" className="text-primary-600 hover:text-primary-700 font-medium text-sm inline-flex items-center gap-1">
            View All <span aria-hidden>→</span>
          </Link>
        </div>
        {loading ? (
          <LoadingSpinner text="Loading new arrivals..." />
        ) : latest.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {latest.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="text-center text-slate-500 py-12">No products yet. Check back soon!</p>
        )}
      </section>

      {/* CTA Banner */}
      <section className="container-app pb-16">
        <div className="bg-slate-900 rounded-2xl p-12 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-1/4 w-32 h-32 rounded-full bg-gold-400"></div>
            <div className="absolute bottom-0 right-1/4 w-48 h-48 rounded-full bg-primary-500"></div>
          </div>
          <h2 className="font-display text-3xl font-semibold mb-3 relative z-10">
            Are you a Saree Seller?
          </h2>
          <p className="text-slate-300 mb-6 max-w-lg mx-auto relative z-10">
            Upload your saree photos and start selling online within minutes. Join our community of artisans and boutique owners.
          </p>
          <Link to="/login" className="btn-gold relative z-10 text-lg px-8 py-3">
            Start Selling Today
          </Link>
        </div>
      </section>
    </div>
  )
}