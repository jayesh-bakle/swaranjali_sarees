import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import API from '../api/client'
import ProductCard from '../components/ProductCard'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [fabrics, setFabrics] = useState([])
  const [colors, setColors] = useState([])

  const category = searchParams.get('category') || ''
  const fabric = searchParams.get('fabric') || ''
  const colorParam = searchParams.get('color') || ''
  const search = searchParams.get('search') || ''
  const sort = searchParams.get('sort') || 'newest'

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true)
      try {
        const params = { limit: 50 }
        if (category) params.category = category
        if (fabric) params.fabric = fabric
        if (colorParam) params.color = colorParam
        if (search) params.search = search
        if (sort) params.sort = sort

        const { data } = await API.get('/products', { params })
        setProducts(data.products)

        // Derive filter options from products
        const cats = [...new Set(data.products.map((p) => p.category).filter(Boolean))]
        const fab = [...new Set(data.products.map((p) => p.fabric).filter(Boolean))]
        const cols = [...new Set(data.products.map((p) => p.color).filter(Boolean))]
        setCategories(cats)
        setFabrics(fab)
        setColors(cols)
      } catch (err) {
        console.error('Error fetching products:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [category, fabric, colorParam, search, sort])

  const updateFilter = (key, value) => {
    if (value) {
      searchParams.set(key, value)
    } else {
      searchParams.delete(key)
    }
    setSearchParams(searchParams, { replace: true })
  }

  const clearFilters = () => setSearchParams({})

  return (
    <div className="container-app py-10">
      {/* Page header */}
      <div className="mb-8">
        <p className="text-primary-600 font-medium text-sm uppercase tracking-widest mb-1">Our Collection</p>
        <h1 className="font-display text-4xl font-semibold text-slate-900">Shop Sarees</h1>
      </div>

      {/* Filter & Search bar */}
      <div className="bg-white rounded-xl p-4 shadow-soft mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder="Search sarees..."
              value={search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="input pl-10"
            />
          </div>
          <select value={category} onChange={(e) => updateFilter('category', e.target.value)} className="input">
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={fabric} onChange={(e) => updateFilter('fabric', e.target.value)} className="input">
            <option value="">All Fabrics</option>
            {fabrics.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <select value={sort} onChange={(e) => updateFilter('sort', e.target.value)} className="input">
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="featured">Featured</option>
          </select>
        </div>
        {(category || fabric || search) && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {category && <span className="badge-outline">Category: {category}</span>}
            {fabric && <span className="badge-outline">Fabric: {fabric}</span>}
            {search && <span className="badge-outline">Search: "{search}"</span>}
            <button onClick={clearFilters} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Results count */}
      <p className="text-sm text-slate-500 mb-6">
        Showing <span className="font-semibold text-slate-700">{products.length}</span> products
      </p>

      {/* Product grid */}
      {loading ? (
        <LoadingSpinner text="Loading sarees..." />
      ) : products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No sarees found"
          description="Try adjusting your search or filters to find what you're looking for."
          actionText="Clear Filters"
          actionLink="/shop"
        />
      )}
    </div>
  )
}