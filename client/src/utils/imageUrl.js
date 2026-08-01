// Central helper to build absolute image URLs.
// VITE_API_URL includes "/api" (e.g. http://localhost:5000/api),
// but uploaded images are served from "/uploads" on the same origin
// (e.g. http://localhost:5000/uploads/...). This strips "/api"
// so /uploads paths resolve correctly in dev and production.

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export function resolveImageUrl(url) {
  if (!url) return 'https://placehold.co/400x500/slate/white?text=Saree'
  // Already an absolute URL (https://...)
  if (url.startsWith('http')) return url
  // Server-relative upload path like /uploads/product-xxx.jpg
  if (url.startsWith('/uploads')) {
    const origin = API_BASE.replace(/\/api\/?$/, '')
    return origin + url
  }
  // Any other relative path — return as-is
  return url
}

export default resolveImageUrl