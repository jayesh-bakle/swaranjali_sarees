import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import API from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

// Renders star icons for a given rating (0-5, whole numbers)
const Stars = ({ rating = 0 }) => {
  const value = Math.round(rating)
  return (
    <span className="text-gold-500 text-sm tracking-tight" aria-label={`${value} out of 5 stars`}>
      {'★'.repeat(value)}
      <span className="text-slate-300">{'★'.repeat(5 - value)}</span>
    </span>
  )
}

export default function Reviews({ productId }) {
  const { user, isAdmin } = useAuth()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [form, setForm] = useState({ rating: 5, title: '', comment: '' })
  const [photoFiles, setPhotoFiles] = useState([])
  const [photoPreviews, setPhotoPreviews] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 3)
    setPhotoFiles(files)
    setPhotoPreviews(files.map((f) => URL.createObjectURL(f)))
  }

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await API.get(`/reviews/product/${productId}`)
      setReviews(data.reviews || [])
      setError(false)
    } catch (err) {
      console.error('Failed to fetch reviews:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const body = new FormData()
      body.append('product_id', productId)
      body.append('rating', form.rating)
      body.append('title', form.title)
      body.append('comment', form.comment)
      photoFiles.forEach((f) => body.append('photos', f))
      await API.post('/reviews', body, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Thank you for your review!')
      setForm({ rating: 5, title: '', comment: '' })
      setPhotoFiles([])
      setPhotoPreviews([])
      fetchReviews()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  const myReview = user && !isAdmin ? reviews.find((r) => r.user_id === user.id) : null

  const summary = (() => {
    const total = reviews.length
    if (!total) return { count: 0, avg: null, bars: {} }
    const avg = reviews.reduce((s, r) => s + Number(r.rating), 0) / total
    const bars = {}
    for (let i = 5; i >= 1; i--) {
      bars[i] = reviews.filter((r) => Number(r.rating) === i).length
    }
    return { count: total, avg: avg.toFixed(1), bars }
  })()

  return (
    <div className="bg-white rounded-xl shadow-soft p-6 lg:p-8">
      <h2 className="font-display text-2xl font-semibold text-slate-900 mb-6">Customer Reviews</h2>

      {/* Summary */}
      {!loading && summary.count > 0 && (
        <div className="flex flex-col sm:flex-row gap-6 mb-8 pb-8 border-b border-slate-100">
          <div className="text-center sm:text-left flex-shrink-0">
            <div className="text-5xl font-bold text-slate-900">{summary.avg}</div>
            <div className="mt-1"><Stars rating={summary.avg} /></div>
            <p className="text-sm text-slate-500 mt-1">{summary.count} review{summary.count > 1 ? 's' : ''}</p>
          </div>
          <div className="flex-1 space-y-1.5">
            {Object.entries(summary.bars).map(([star, count]) => (
              <div key={star} className="flex items-center gap-3 text-sm">
                <span className="w-8 text-slate-600 flex-shrink-0">{star} ★</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold-500 rounded-full"
                    style={{ width: `${summary.count ? (count / summary.count) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-6 text-right text-slate-400 flex-shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review form */}
      {user && !isAdmin && (
        <form onSubmit={handleSubmit} className="mb-8 p-5 bg-slate-50 rounded-lg">
          <h3 className="font-semibold text-slate-800 mb-3">
            {myReview ? 'Edit your review' : 'Write a review'}
          </h3>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-slate-600">Rating:</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setForm({ ...form, rating: star })}
                className={`text-2xl leading-none transition-colors ${form.rating >= star ? 'text-gold-500' : 'text-slate-300 hover:text-gold-300'}`}
                aria-label={`${star} star${star > 1 ? 's' : ''}`}
              >
                ★
              </button>
            ))}
          </div>
          <input
            className="input mb-3"
            placeholder="Review title (optional)"
            value={form.title}
            maxLength={120}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            className="input mb-3"
            placeholder="Share your experience with this saree…"
            rows={3}
            maxLength={1000}
            required
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
          />
          {/* Optional review photos (max 3) */}
          <div className="mb-3 flex items-center gap-3 flex-wrap">
            {photoPreviews.map((src, i) => (
              <img key={i} src={src} alt={`Review photo ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
            ))}
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-primary-100 transition-colors">
              📷 Add Photos
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={handlePhotoChange} />
            </label>
            {photoFiles.length > 0 && (
              <button type="button" onClick={() => { setPhotoFiles([]); setPhotoPreviews([]); }} className="text-xs text-slate-500 hover:text-red-600 font-medium">
                Clear
              </button>
            )}
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Submitting...' : myReview ? 'Update Review' : 'Submit Review'}
          </button>
        </form>
      )}

      {!user && (
        <p className="text-sm text-slate-500 mb-6">
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">Sign in</Link> to write a review.
        </p>
      )}

      {/* Review list */}
      {loading ? (
        <p className="text-slate-500 text-center py-8">Loading reviews…</p>
      ) : error ? (
        <p className="text-slate-500 text-center py-8">Couldn't load reviews. Please try again.</p>
      ) : reviews.length === 0 ? (
        <p className="text-slate-500 text-center py-8">No reviews yet. Be the first to review this saree!</p>
      ) : (
        <ul className="space-y-5">
          {reviews.map((review) => (
            <li key={review.id} className="pb-5 border-b border-slate-100 last:border-0 last:pb-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-semibold text-sm">
                    {(review.user_name || 'U').charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{review.user_name || 'Customer'}</p>
                    <p className="text-xs text-slate-400">
                      {review.created_at ? new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </p>
                  </div>
                </div>
                <Stars rating={review.rating} />
              </div>
              {review.title && <p className="font-medium text-slate-800 mt-2">{review.title}</p>}
              {review.comment && <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{review.comment}</p>}
              {(() => {
                try {
                  const photos = JSON.parse(review.photos || '[]')
                  if (!photos.length) return null
                  return (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {photos.map((src, i) => (
                        <a key={i} href={src} target="_blank" rel="noopener noreferrer">
                          <img src={src} alt={`${review.user_name || 'Customer'}'s photo ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-slate-200 hover:opacity-90 transition-opacity" loading="lazy" />
                        </a>
                      ))}
                    </div>
                  )
                } catch (_) { return null }
              })()}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
