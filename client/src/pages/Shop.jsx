import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import API from '../api/client'
import ProductCard from '../components/ProductCard'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [categories, setCategories] = useState([])
  const [fabrics, setFabrics] = useState([])
  const [colors, setColors] = useState([])
  const [mobileFilters, setMobileFilters] = useState(false)

  const PAGE_SIZE = 50

  const category = searchParams.get('category') || ''
  const fabric = searchParams.get('fabric') || ''
  const colorParam = searchParams.get('color') || ''
  const search = searchParams.get('search') || ''
  const sort = searchParams.get('sort') || 'newest'

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true)
      try {
        const params = { limit: PAGE_SIZE, page }
        if (category) params.category = category
        if (fabric) params.fabric = fabric
        if (colorParam) params.color = colorParam
        if (search) params.search = search
        if (sort) params.sort = sort

        const { data } = await API.get('/products', { params })
        setProducts((prev) => (page === 1 ? data.products : [...prev, ...data.products]))
        setTotal(data.total || 0)
        setError(false)

        // Derive filter options from the products on the first page
        if (page === 1) {
          const cats = [...new Set(data.products.map((p) => p.category).filter(Boolean))]
          const fab = [...new Set(data.products.map((p) => p.fabric).filter(Boolean))]
          const cols = [...new Set(data.products.map((p) => p.color).filter(Boolean))]
          setCategories(cats)
          setFabrics(fab)
          setColors(cols)
        }
      } catch (err) {
        console.error('Error fetching products:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [category, fabric, colorParam, search, sort, page])

  const updateFilter = (key, value) => {
    setPage(1) // reset pagination when filters change
    if (value) {
      searchParams.set(key, value)
    } else {
      searchParams.delete(key)
    }
    setSearchParams(searchParams, { replace: true })
  }

  const clearFilters = () => {
    setPage(1)
    setSearchParams({})
    setMobileFilters(false)
  }

  const filterCount = [category, fabric, colorParam, search].filter(Boolean).length

  const filterSection = (
    <div className="space-y-8">
      {/* Search */}
      <div>
        <h3 className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">Search</h3>
        <input
          type="search"
          placeholder="Search sarees..."
          value={search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="input"
        />
      </div>

      {/* Category */}
      {categories.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">Category</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 hover:text-primary-700 cursor-pointer">
              <input type="radio" name="category" checked={category === ''} onChange={() => updateFilter('category', '')} className="accent-primary-700" />
              All Categories
            </label>
            {categories.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm text-slate-700 hover:text-primary-700 cursor-pointer">
                <input type="radio" name="category" checked={category === c} onChange={() => updateFilter('category', c)} className="accent-primary-700" />
                {c}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Fabric */}
      {fabrics.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">Fabric</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 hover:text-primary-700 cursor-pointer">
              <input type="radio" name="fabric" checked={fabric === ''} onChange={() => updateFilter('fabric', '')} className="accent-primary-700" />
              All Fabrics
            </label>
            {fabrics.map((f) => (
              <label key={f} className="flex items-center gap-2 text-sm text-slate-700 hover:text-primary-700 cursor-pointer">
                <input type="radio" name="fabric" checked={fabric === f} onChange={() => updateFilter('fabric', f)} className="accent-primary-700" />
                {f}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Color */}
      {colors.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">Color</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 hover:text-primary-700 cursor-pointer">
              <input type="radio" name="color" checked={colorParam === ''} onChange={() => updateFilter('color', '')} className="accent-primary-700" />
              All Colors
            </label>
            {colors.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm text-slate-700 hover:text-primary-700 cursor-pointer">
                <input type="radio" name="color" checked={colorParam === c} onChange={() => updateFilter('color', c)} className="accent-primary-700" />
                {c}
              </label>
            ))}
          </div>
        </div>
      )}

      {filterCount > 0 && (
        <button onClick={clearFilters} className="text-xs text-primary-700 hover:text-primary-800 font-medium uppercase tracking-wider underline underline-offset-4">
          Clear All Filters
        </button>
      )}
    </div>
  )

  return (
    <div className="container-app py-10">
      {/* Page header — Nalli-style */}
      <div className="nalli-heading">
        <h2>Paithani Sarees</h2>
        <div className="nalli-divider">
          <span className="text-gold-500">✦</span>
        </div>
        <p>Handwoven Pure Silk · Crafted In Yeola, Maharashtra</p>
      </div>

      <div className="flex lg:gap-10">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          {filterSection}
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              {/* Mobile filters button */}
              <button
                onClick={() => setMobileFilters(true)}
                className="lg:hidden btn-outline px-3 py-2 text-xs"
              >
                Filters {filterCount > 0 && `(${filterCount})`}
              </button>
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-700">{total}</span> products
                {search && <span> for "<span className="text-primary-700">{search}</span>"</span>}
              </p>
            </div>
            <select
              value={sort}
              onChange={(e) => updateFilter('sort', e.target.value)}
              className="input w-auto text-sm max-w-full"
            >
              <option value="newest">Sort: Newest</option>
              <option value="price_asc">Sort: Price: Low to High</option>
              <option value="price_desc">Sort: Price: High to Low</option>
            </select>
          </div>

          {/* Active filter chips */}
          {filterCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-4">
              {category && <span className="badge-outline bg-primary-50 border-primary-200 text-primary-800">Category: {category}</span>}
              {fabric && <span className="badge-outline bg-primary-50 border-primary-200 text-primary-800">Fabric: {fabric}</span>}
              {colorParam && <span className="badge-outline bg-primary-50 border-primary-200 text-primary-800">Color: {colorParam}</span>}
              {search && <span className="badge-outline bg-primary-50 border-primary-200 text-primary-800">Search: "{search}"</span>}
              <button onClick={clearFilters} className="text-xs text-primary-700 hover:text-primary-800 font-medium uppercase tracking-wider">
                Clear All
              </button>
            </div>
          )}

          {/* Product grid */}
          {loading ? (
            <LoadingSpinner text="Loading sarees..." />
          ) : error ? (
            <EmptyState
              icon="⚠️"
              title="Couldn't load products"
              description="There was a problem reaching the store. Please refresh to try again."
              actionText="Retry"
              actionHandler={() => setPage(1)}
            />
          ) : products.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {products.length < total && (
                <div className="text-center mt-10">
                  <button onClick={() => setPage((p) => p + 1)} className="btn-outline px-8 py-3" disabled={loading}>
                    {loading ? 'Loading...' : 'Load More Sarees'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              title="No sarees found"
              description="Try adjusting your search or filters to find what you're looking for."
              actionText="Clear Filters"
              actionLink="/shop"
            />
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {mobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFilters(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl p-6 overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
              <h3 className="font-display text-xl font-semibold text-slate-900">Filters</h3>
              <button onClick={() => setMobileFilters(false)} className="p-2 hover:bg-slate-100 rounded-sm" aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {filterSection}
          </div>
        </div>
      )}
    </div>
  )
}