import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import WhatsAppPopup from './components/WhatsAppPopup'
import Home from './pages/Home'
import Shop from './pages/Shop'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Login from './pages/Login'
import Register from './pages/Register'
import Admin from './pages/Admin'
import Orders from './pages/Orders'
import Success from './pages/Success'
import Wishlist from './pages/Wishlist'
import Checkout from './pages/Checkout'
import TrackOrder from './pages/TrackOrder'
import Addresses from './pages/Addresses'

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/addresses" element={<Addresses />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/track-order/:id" element={<TrackOrder />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/success" element={<Success />} />
        </Routes>
      </main>
      <Footer />
      <WhatsAppPopup />
    </div>
  )
}

export default App