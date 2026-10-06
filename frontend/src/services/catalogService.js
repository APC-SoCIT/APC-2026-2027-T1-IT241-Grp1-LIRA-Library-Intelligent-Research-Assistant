const catalogApiUrl = import.meta.env.VITE_CATALOG_API_URL || 'http://localhost:3001/api/catalog'

async function request(path) {
  const response = await fetch(`${catalogApiUrl}${path}`)
  if (!response.ok) {
    let message = `Catalog request failed (${response.status})`
    try {
      const payload = await response.json()
      if (typeof payload.message === 'string') message = payload.message
    } catch {
      // Keep the HTTP status message when a proxy returns a non-JSON error response.
    }
    throw new Error(message)
  }
  return response.json()
}

export async function listCatalogBooks() {
  const books = []
  for (let page = 1; ; page++) {
    const payload = await request(`/books?page=${page}&limit=100`)
    if (!payload.items || payload.items.length === 0) break
    books.push(...payload.items)
    if (payload.items.length < 100) break
  }
  return books
}

export async function searchCatalogBooks(query, mode = 'keyword') {
  const books = []
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({ q: query, mode, page: String(page), limit: '100' })
    const payload = await request(`/search?${params.toString()}`)
    if (!payload.items || payload.items.length === 0) break
    books.push(...payload.items)
    if (payload.items.length < 100) break
  }
  return books
}

export async function getCatalogBook(id) {
  return request(`/books/${encodeURIComponent(id)}`)
}

export async function getCatalogBookContent(id) {
  return request(`/books/${encodeURIComponent(id)}/content`)
}
