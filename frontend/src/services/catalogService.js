const catalogApiUrl = (
  import.meta.env.VITE_CATALOG_API_URL || 'http://localhost:3001/api/catalog'
).replace(/\/+$/, '')
const patronsApiUrl = catalogApiUrl.replace(/\/api\/catalog$/, '/api/patrons')
const liraApiUrl = catalogApiUrl.replace(/\/api\/catalog$/, '/api')
const patronProvisioningByUser = new Map()
const patronProvisionedUsers = new Set()

export function resolveCatalogAssetUrl(value) {
  if (!value) return ''
  try {
    return new URL(value, `${catalogApiUrl}/`).href
  } catch {
    return value
  }
}

import { supabase } from './supabaseClient'

async function request(path, options = {}, baseUrl = catalogApiUrl) {
  const response = await fetch(`${baseUrl}${path}`, options)
  if (!response.ok) {
    let message = `Catalog request failed (${response.status})`
    try {
      const payload = await response.json()
      if (typeof payload.message === 'string') message = payload.message
      else if (Array.isArray(payload.message)) message = payload.message.filter((item) => typeof item === 'string').join(' ') || message
    } catch {
      // Keep the HTTP status message when a proxy returns a non-JSON error response.
    }
    const error = new Error(message)
    error.status = response.status
    throw error
  }
  if (response.status === 204) return null
  const body = await response.text()
  return body ? JSON.parse(body) : null
}

async function authenticatedRequest(path, options = {}, baseUrl = catalogApiUrl) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Please sign in again before managing library content.')
  return request(path, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  }, baseUrl)
}

export function authenticatedLiraRequest(path, options = {}) {
  return authenticatedRequest(path, options, liraApiUrl)
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

export async function askLibraryFaq(question, history, language) {
  return request('/chatbot/faq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history, language }),
  }, liraApiUrl)
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

export function ensureKohaPatronAccount() {
  if (!supabase) return Promise.reject(new Error('Supabase is not configured.'))
  return supabase.auth.getSession().then(({ data, error }) => {
    if (error) throw error
    const userId = data.session?.user?.id
    if (!userId) throw new Error('Please sign in before setting up your Koha account.')
    if (patronProvisionedUsers.has(userId)) return { created: false }
    if (patronProvisioningByUser.has(userId)) return patronProvisioningByUser.get(userId)
    const request = authenticatedRequest('/ensure-koha-account', { method: 'POST' }, patronsApiUrl)
      .then((result) => {
        patronProvisionedUsers.add(userId)
        return result
      })
      .finally(() => patronProvisioningByUser.delete(userId))
    patronProvisioningByUser.set(userId, request)
    return request
  })
}

export function listKohaReadingLists() {
  return authenticatedRequest('/lists', {}, liraApiUrl)
}

export function createKohaReadingList(name) {
  return authenticatedRequest('/lists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }, liraApiUrl)
}

export function renameKohaReadingList(listId, name) {
  return authenticatedRequest(`/lists/${encodeURIComponent(listId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }, liraApiUrl)
}

export function deleteKohaReadingList(listId) {
  return authenticatedRequest(`/lists/${encodeURIComponent(listId)}`, { method: 'DELETE' }, liraApiUrl)
}

export function listKohaBookmarks() {
  return authenticatedRequest('/lists/bookmarks', {}, liraApiUrl)
}

export function saveKohaBookmark(book, listId) {
  return authenticatedRequest(`/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(book.id)}`, { method: 'POST' }, liraApiUrl)
}

export function moveKohaBookmark(bookId, listId) {
  return authenticatedRequest(`/lists/bookmarks/${encodeURIComponent(bookId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ list_id: Number(listId) }) }, liraApiUrl)
}

export function removeKohaBookmark(bookId) {
  return authenticatedRequest(`/lists/bookmarks/${encodeURIComponent(bookId)}`, { method: 'DELETE' }, liraApiUrl)
}

export async function uploadCatalogResource(id, file) {
  const form = new FormData()
  form.append('file', file)
  return authenticatedRequest(`/books/${encodeURIComponent(id)}/resources/upload`, { method: 'POST', body: form })
}

export async function uploadCatalogCover(id, file) {
  const form = new FormData()
  form.append('file', file)
  return authenticatedRequest(`/books/${encodeURIComponent(id)}/cover/upload`, { method: 'POST', body: form })
}

export async function deleteCatalogBook(id) {
  return authenticatedRequest(`/books/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
