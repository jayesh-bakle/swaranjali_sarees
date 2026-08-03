import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import WhatsAppPopup from './components/WhatsAppPopup'
import LoadingSpinner from './components/LoadingSpinner'

// Code-split every page — only the bundle for the current route is downloaded,
// which cuts the initial JS shipped to visitors significantly.
const Home = lazy(() => import('./pages/Home'))
const Shop = lazy(() => import('./pages/Shop'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const Cart = lazy(() => import('./pages/Cart'))
const Checkout = lazy(() => import('./pages/Checkout'))
const Wishlist = lazy(() => import('./pages/Wishlist'))
const Addresses = lazy(() => import('./pages/Addresses'))
const Orders = lazy(() => import('./pages/Orders'))
const TrackOrder = lazy(() => import('./pages/TrackOrder'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ChangePassword = lazy(() => import('./pages/ChangePassword'))
const Admin = lazy(() => import('./pages/Admin'))
const Success = lazy(() => import('./pages/Success'))
const NotFound = lazy(() => import('./pages/NotFound'))

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Suspense fallback={<LoadingSpinner text="Loading..." fullPage />}>
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
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/success" element={<Success />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <WhatsAppPopup />
    </div>
  )
}

export default App