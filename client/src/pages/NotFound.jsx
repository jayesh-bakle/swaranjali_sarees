import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="container-app py-24 text-center">
      <div className="text-6xl mb-4">🧵</div>
      <h1 className="font-display text-4xl font-bold text-slate-900 mb-2">Page Not Found</h1>
      <p className="text-slate-500 mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-primary px-8 py-3">Go Home</Link>
        <Link to="/shop" className="btn-outline px-8 py-3">Shop Sarees</Link>
      </div>
    </div>
  )
}
