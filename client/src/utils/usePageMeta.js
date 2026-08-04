import { useEffect } from 'react'

// Lightweight per-page SEO: updates <title> + meta description + og tags.
// No external dependency — works in a SPA even if crawlers only read the shell.
const SITE = 'Jagmohini Paithani'

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function usePageMeta({ title, description, image, type = 'website' } = {}) {
  useEffect(() => {
    document.title = title ? `${title} — ${SITE}` : SITE
    if (description) setMeta('name', 'description', description)
    if (description) setMeta('property', 'og:description', description)
    if (title) setMeta('property', 'og:title', title)
    setMeta('property', 'og:type', type)
    if (image) setMeta('property', 'og:image', image)
  }, [title, description, image, type])
}
