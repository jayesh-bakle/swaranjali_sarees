import { Link } from 'react-router-dom'

export default function EmptyState({ icon = '🛍️', title, description, actionText = 'Shop Sarees', actionLink = '/shop', actionHandler = null }) {
  const buttonClass = 'btn-primary'
  return (
    <div className="text-center py-20">
      <div className="text-6xl mb-4">{icon}</div>
      <h2 className="font-display text-2xl text-slate-800 mb-2">{title}</h2>
      <p className="text-slate-500 mb-6">{description}</p>
      {actionHandler ? (
        <button onClick={actionHandler} className={buttonClass}>
          {actionText}
        </button>
      ) : (
        <Link to={actionLink} className={buttonClass}>
          {actionText}
        </Link>
      )}
    </div>
  )
}