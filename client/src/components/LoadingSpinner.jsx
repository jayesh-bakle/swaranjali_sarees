export default function LoadingSpinner({ text = 'Loading...', fullPage = false }) {
  return (
    <div className={`${fullPage ? 'min-h-[60vh] flex items-center justify-center' : 'flex items-center justify-center py-12'}`}>
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
        <p className="mt-4 text-sm text-slate-500">{text}</p>
      </div>
    </div>
  )
}