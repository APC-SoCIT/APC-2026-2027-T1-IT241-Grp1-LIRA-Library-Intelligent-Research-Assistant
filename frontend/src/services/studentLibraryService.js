import { supabase } from './supabaseClient'

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

async function requireUser() {
  const client = requireClient()
  const { data, error } = await client.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('You must be signed in to manage library data.')
  return { client, user: data.user }
}

export async function getStudentProfile() {
  const { client, user } = await requireUser()
  const { data, error } = await client.from('profiles').select('*').eq('id', user.id).single()
  if (error) throw error
  return data
}

export async function recordReading(book) {
  const { client, user } = await requireUser()
  const { data, error } = await client.from('reading_history').upsert({
    user_id: user.id,
    book_id: book.id,
    title: book.title,
    author: book.author || null,
    last_read_at: new Date().toISOString(),
  }, { onConflict: 'user_id,book_id' }).select().single()
  if (error) throw error
  return data
}

export async function listReadingHistory() {
  const { client, user } = await requireUser()
  const { data, error } = await client.from('reading_history').select('*').eq('user_id', user.id).order('last_read_at', { ascending: false })
  if (error) throw error
  return data
}

export async function recordCatalogSearch(query) {
  const normalizedQuery = query.trim().slice(0, 200)
  if (!normalizedQuery) return
  const { client, user } = await requireUser()
  const { error } = await client.from('catalog_search_history').insert({
    user_id: user.id,
    query: normalizedQuery,
  })
  if (error) throw error
}

export async function recordCatalogBookView(book) {
  const { client, user } = await requireUser()
  const { error } = await client.from('catalog_book_views').upsert({
    user_id: user.id,
    book_id: book.id,
    title: book.title,
    author: book.author || null,
    item_type: book.itemType || null,
    genres: book.genres || [],
    subjects: book.subjects || [],
    series: book.series || null,
    publisher: book.publisher || null,
    publication_place: book.publicationPlace || null,
    publication_year: book.publicationYear || null,
    url: book.url || null,
    viewed_at: new Date().toISOString(),
  }, { onConflict: 'user_id,book_id' })
  if (error) throw error
}

export async function getCatalogRecommendationHistory() {
  const { client, user } = await requireUser()
  const [views, readings, searches] = await Promise.all([
    client.from('catalog_book_views')
      .select('book_id,title,author,item_type,genres,subjects,series,publisher,publication_place,publication_year,url,viewed_at')
      .eq('user_id', user.id)
      .order('viewed_at', { ascending: false })
      .limit(30),
    client.from('reading_history')
      .select('book_id,title,author,last_read_at')
      .eq('user_id', user.id)
      .order('last_read_at', { ascending: false })
      .limit(30),
    client.from('catalog_search_history')
      .select('query,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30),
  ])
  for (const result of [views, readings, searches]) {
    if (result.error) throw result.error
  }
  return {
    views: views.data,
    readings: readings.data,
    searches: searches.data,
  }
}

export async function saveBookmark(book) {
  const { client, user } = await requireUser()
  const { data, error } = await client.from('bookmarks').upsert({
    user_id: user.id,
    book_id: book.id,
    title: book.title,
    author: book.author || null,
  }, { onConflict: 'user_id,book_id' }).select().single()
  if (error) throw error
  return data
}

export async function removeBookmark(bookId) {
  const { client, user } = await requireUser()
  const { error } = await client.from('bookmarks').delete().eq('user_id', user.id).eq('book_id', bookId)
  if (error) throw error
}

export async function listBookmarks() {
  const { client, user } = await requireUser()
  const { data, error } = await client.from('bookmarks').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addReservationCartItem(book) {
  const { client, user } = await requireUser()
  const { data, error } = await client.from('reservations').upsert({
    user_id: user.id,
    book_id: book.id,
    title: book.title,
    author: book.author || null,
  }, { onConflict: 'user_id,book_id' }).select().single()
  if (error) throw error
  return data
}

export async function removeReservationCartItem(bookId) {
  const { client, user } = await requireUser()
  const { error } = await client.from('reservations').delete().eq('user_id', user.id).eq('book_id', bookId)
  if (error) throw error
}

export async function listReservations() {
  const { client, user } = await requireUser()
  const { data, error } = await client.from('reservations').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
  if (error) throw error
  return data
}
