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

export async function updateStudentProfile(profile) {
  const { client, user } = await requireUser()
  const firstName = profile.first_name.trim()
  const middleInitial = profile.middle_initial.trim()
  const lastName = profile.last_name.trim()
  const suffix = profile.suffix.trim()
  const school = profile.school.trim()
  if (!firstName || !lastName || !school) throw new Error('First name, last name, and school are required.')

  const fullName = [firstName, middleInitial, lastName, suffix].filter(Boolean).join(' ')
  const profileUpdate = await client.from('profiles').update({
    full_name: fullName,
    first_name: firstName,
    middle_initial: middleInitial || null,
    last_name: lastName,
    suffix: suffix || null,
    school,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id).select().single()
  if (profileUpdate.error) throw profileUpdate.error

  const authUpdate = await client.auth.updateUser({
    data: {
      full_name: fullName,
      first_name: firstName,
      middle_initial: middleInitial || null,
      last_name: lastName,
      suffix: suffix || null,
      school,
    },
  })
  if (authUpdate.error) throw authUpdate.error
  return profileUpdate.data
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

export async function listReadingLists() {
  const { client, user } = await requireUser()
  const { data, error } = await client.from('reading_lists').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createReadingList(name) {
  const { client, user } = await requireUser()
  const normalizedName = name.trim()
  if (!normalizedName || normalizedName.length > 60) throw new Error('List names must be between 1 and 60 characters.')
  const { data, error } = await client.from('reading_lists').insert({
    user_id: user.id,
    name: normalizedName,
  }).select().single()
  if (error) throw error
  return data
}

export async function renameReadingList(listId, name) {
  const { client, user } = await requireUser()
  const normalizedName = name.trim()
  if (!normalizedName || normalizedName.length > 60) throw new Error('List names must be between 1 and 60 characters.')
  const { data, error } = await client.from('reading_lists').update({
    name: normalizedName,
    updated_at: new Date().toISOString(),
  }).eq('user_id', user.id).eq('id', listId).select().single()
  if (error) throw error
  return data
}

export async function deleteReadingList(listId) {
  const { client, user } = await requireUser()
  const { error } = await client.from('reading_lists').delete().eq('user_id', user.id).eq('id', listId)
  if (error) throw error
}

export async function saveBookmark(book, listId) {
  const { client, user } = await requireUser()
  if (listId === undefined || listId === null) throw new Error('Choose a list before saving this book.')
  const { data, error } = await client.from('bookmarks').upsert({
    user_id: user.id,
    list_id: listId,
    book_id: book.id,
    title: book.title,
    author: book.author || null,
  }, { onConflict: 'user_id,book_id' }).select().single()
  if (error) throw error
  return data
}

export async function moveBookmark(bookId, listId) {
  const { client, user } = await requireUser()
  const { data, error } = await client.from('bookmarks').update({ list_id: listId })
    .eq('user_id', user.id)
    .eq('book_id', bookId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeBookmark(bookId) {
  const { client, user } = await requireUser()
  const { error } = await client.from('bookmarks').delete().eq('user_id', user.id).eq('book_id', bookId)
  if (error) throw error
}

export async function listBookmarks(listId) {
  const { client, user } = await requireUser()
  let request = client.from('bookmarks').select('*').eq('user_id', user.id)
  if (listId !== undefined && listId !== null) request = request.eq('list_id', listId)
  const { data, error } = await request.order('created_at', { ascending: false })
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
