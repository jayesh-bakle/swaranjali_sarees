import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import toast from 'react-hot-toast'

const CartContext = createContext(null)

// Treat a real 0 as "out of stock", not as "no cap"
const capStock = (stock) => (typeof stock === 'number' ? Math.max(0, stock) : 99)

// Cart reducer
const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find((item) => item.id === action.payload.id)
      if (existing) {
        const max = capStock(action.payload.stock ?? existing.stock)
        // Clamp the merged quantity so repeated clicks can't exceed stock
        const newQty = Math.min(existing.quantity + action.payload.quantity, max)
        return {
          ...state,
          items: state.items.map((item) =>
            item.id === action.payload.id
              ? {
                  ...item,
                  quantity: Math.max(1, newQty),
                  price: action.payload.price,
                  originalPrice: action.payload.originalPrice,
                  stock: action.payload.stock ?? existing.stock,
                }
              : item
          ),
        }
      }
      return { ...state, items: [...state.items, { ...action.payload }] }
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((item) => item.id !== action.payload) }
    case 'UPDATE_QUANTITY':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.id
            ? { ...item, quantity: Math.max(1, Math.min(action.payload.quantity, capStock(item.stock))) }
            : item
        ),
      }
    case 'SET_CART':
      return { items: Array.isArray(action.payload) ? action.payload : [] }
    case 'CLEAR_CART':
      return { items: [] }
    default:
      return state
  }
}

// Load cart from localStorage
const loadCart = () => {
  try {
    const saved = localStorage.getItem('cart')
    return saved ? JSON.parse(saved) : { items: [] }
  } catch {
    return { items: [] }
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, null, loadCart)

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(state))
  }, [state])

  // Keep the cart in sync across tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'cart' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          dispatch({ type: 'SET_CART', payload: parsed?.items || [] })
        } catch (_) { /* ignore malformed storage */ }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const addItem = (product, quantity = 1) => {
    // Never allow adding an out-of-stock product to the cart
    if (capStock(product.stock) <= 0) {
      toast.error(`${product.name} is out of stock`)
      return
    }
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        id: product.id,
        name: product.name,
        price: product.sale_price || product.price,
        originalPrice: product.price,
        image: product.image_url,
        fabric: product.fabric,
        color: product.color,
        size: product.size,
        stock: product.stock,
        quantity,
      },
    })
    toast.success(`${product.name} added to cart!`)
  }

  const removeItem = (id) => {
    dispatch({ type: 'REMOVE_ITEM', payload: id })
    toast('Item removed from cart', { icon: '🗑️' })
  }

  const updateQuantity = (id, quantity) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } })
  }

  const clearCart = () => dispatch({ type: 'CLEAR_CART' })

  const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = state.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const savings = Math.max(0, state.items.reduce(
    (sum, item) => sum + (item.originalPrice - item.price) * item.quantity,
    0
  ))

  // Memoize the value object — addToCart on one card shouldn't re-render every consumer
  const value = useMemo(
    () => ({ items: state.items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, savings }),
    [state.items, totalItems, totalPrice, savings]
  )

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}