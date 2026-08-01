import { createContext, useContext, useEffect, useReducer } from 'react'
import toast from 'react-hot-toast'

const CartContext = createContext(null)

// Cart reducer
const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find((item) => item.id === action.payload.id)
      if (existing) {
        return {
          ...state,
          items: state.items.map((item) =>
            item.id === action.payload.id
              ? { ...item, quantity: item.quantity + action.payload.quantity }
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
            ? { ...item, quantity: Math.max(1, Math.min(action.payload.quantity, item.stock || 99)) }
            : item
        ),
      }
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

  const addItem = (product, quantity = 1) => {
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
  const savings = state.items.reduce(
    (sum, item) => sum + (item.originalPrice - item.price) * item.quantity,
    0
  )

  return (
    <CartContext.Provider
      value={{ items: state.items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, savings }}
    >
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