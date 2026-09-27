const catalogApiUrl = import.meta.env.VITE_CATALOG_API_URL || 'http://localhost:3001/api/catalog'

async function request(path) {
  const response = await fetch(`${catalogApiUrl}${path}`)
  if (!response.ok) throw new Error(`Catalog request failed (${response.status})`)
  return response.json()
}

export async function listCatalogBooks(limit = 100) {
  const payload = await request(`/books?page=1&limit=${limit}`)
  return payload.items || []
}
