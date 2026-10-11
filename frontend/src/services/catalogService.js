const catalogApiUrl = (
  import.meta.env.VITE_CATALOG_API_URL || 'http://localhost:3001/api/catalog'
).replace(/\/+$/, '')

import { supabase } from './supabaseClient'

async function request(path, options = {}) {
  const response = await fetch(`${catalogApiUrl}${path}`, options)
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
  if (response.status === 204) return null
  const body = await response.text()
  return body ? JSON.parse(body) : null
}

async function authenticatedRequest(path, options = {}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Please sign in again before managing the catalog.')
  return request(path, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  })
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

export async function listNewArrivalBooks(limit = 12) {
  const payload = await request(`/new-arrivals?page=1&limit=${encodeURIComponent(limit)}`)
  return payload.items || []
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

export async function getCatalogProfileRole() {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!userData.user) return null
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userData.user.id).maybeSingle()
  if (error) throw error
  return data?.role || null
}

export async function createCatalogBook(record) {
  return authenticatedRequest('/books', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  })
}

export async function updateCatalogBook(id, record) {
  return authenticatedRequest(`/books/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  })
}

export async function deleteCatalogBook(id) {
  return authenticatedRequest(`/books/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
