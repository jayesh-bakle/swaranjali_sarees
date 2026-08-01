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
      {/* Hero Section — Nalli-style */}
      <section className="relative bg-primary-900 text-white overflow-hidden">
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-[0.08]" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 2px, transparent 0)',
          backgroundSize: '36px 36px'
        }} />
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-primary-900 via-primary-800 to-primary-900" />
        <div className="container-app py-20 lg:py-28 relative z-10 text-center">
          <p className="text-gold-400 font-medium mb-4 uppercase tracking-[0.3em] text-xs lg:text-sm">
            Handpicked · Authentic · Handwoven
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            Authentic Paithani
            <span className="block text-gold-400 italic">Silk Sarees</span>
          </h1>
          <div className="nalli-divider justify-center my-6">
            <span className="text-gold-500">✦</span>
          </div>
          <p className="text-lg text-primary-100 mb-8 max-w-2xl mx-auto">
            Discover our exclusive collection of genuine handwoven Paithani silk sarees —
            crafted by master weavers of Yeola, Maharashtra, with traditional gold zari.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/shop" className="btn-gold text-lg px-10 py-3">
              Shop Collection
            </Link>
            <Link to="/shop?category=Traditional%20Paithani" className="btn text-lg px-10 py-3 border border-gold-400 text-gold-300 hover:bg-gold-400 hover:text-primary-900 transition-colors">
              Explore Paithani
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="container-app py-16">
        <div className="nalli-heading">
          <h2>Editor's Picks</h2>
          <div className="nalli-divider">
            <span className="text-gold-500">✦</span>
          </div>
          <p>Featured Paithani Silk Sarees</p>
        </div>
        {loading ? (
          <LoadingSpinner text="Loading featured sarees..." />
        ) : featured.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="text-center text-slate-500 py-12">No featured products yet. Check back soon!</p>
        )}
        <div className="text-center mt-10">
          <Link to="/shop" className="btn-outline px-8 py-3">
            View All Sarees
          </Link>
        </div>
      </section>

      {/* Category Highlights — Nalli-style band */}
      <section className="bg-primary-900 py-16 text-white">
        <div className="container-app">
          <div className="text-center mb-10">
            <p className="text-gold-400 text-sm uppercase tracking-[0.3em] mb-2">Collections</p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold">Explore Our Collections</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { name: 'Traditional Paithani', icon: '🏵️', desc: 'Classic handwoven pure silk with gold zari', to: '/shop?category=Traditional%20Paithani' },
              { name: 'Designer Paithani', icon: '✨', desc: 'Contemporary motifs in pure silk', to: '/shop?category=Designer%20Paithani' },
              { name: 'Paithani Dupattas', icon: '🌸', desc: 'Elegant silk stoles & dupattas', to: '/shop?category=Paithani%20Dupattas' },
            ].map((cat, i) => (
              <Link
                key={i}
                to={cat.to}
                className="bg-white/5 border border-gold-500/20 rounded-sm p-8 text-center hover:bg-white/10 hover:border-gold-400/50 transition-all duration-300 group"
              >
                <div className="text-4xl mb-3">{cat.icon}</div>
                <h3 className="font-display text-xl font-semibold mb-1 text-gold-300 group-hover:text-gold-200">{cat.name}</h3>
                <p className="text-sm text-primary-100/80">{cat.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Products */}
      <section className="container-app py-16">
        <div className="nalli-heading">
          <h2>New Arrivals</h2>
          <div className="nalli-divider">
            <span className="text-gold-500">✦</span>
          </div>
          <p>Just In From The Looms</p>
        </div>
        {loading ? (
          <LoadingSpinner text="Loading new arrivals..." />
        ) : latest.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {latest.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="text-center text-slate-500 py-12">No products yet. Check back soon!</p>
        )}
        <div className="text-center mt-10">
          <Link to="/shop" className="btn-outline px-8 py-3">
            View All New Arrivals
          </Link>
        </div>
      </section>

      {/* Craftsmanship Banner — Nalli-style */}
      <section className="container-app pb-16">
        <div className="bg-gradient-to-br from-primary-800 to-primary-900 rounded-sm p-12 md:p-16 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 2px, transparent 0)',
            backgroundSize: '32px 32px'
          }} />
          <div className="relative z-10">
            <p className="text-gold-400 text-sm uppercase tracking-[0.3em] mb-3">Our Heritage</p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold mb-3">
              The Art of Authentic Paithani
            </h2>
            <p className="text-primary-100 mb-8 max-w-lg mx-auto">
              Every saree is handwoven on traditional pit looms in Yeola, Maharashtra — using pure silk
              and genuine gold zari, just as it has been for over 2000 years.
            </p>
            <Link to="/shop" className="btn-gold text-lg px-10 py-3">
              Shop Authentic Paithani
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}