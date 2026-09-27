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

export async function reserveBook(book) {
  const { client, user } = await requireUser()
  const { data, error } = await client.from('reservations').upsert({
    user_id: user.id,
    book_id: book.id,
    title: book.title,
    author: book.author || null,
    status: 'pending',
  }, { onConflict: 'user_id,book_id' }).select().single()
  if (error) throw error
  return data
}
