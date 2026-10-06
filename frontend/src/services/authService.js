import { supabase } from './supabaseClient'

export async function signIn({ email, password }) {
  if (!supabase) throw new Error('Supabase is not configured. Add the Vite environment variables first.')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp({ email, password, firstName, middleInitial, lastName, suffix, school }) {
  if (!supabase) throw new Error('Supabase is not configured. Add the Vite environment variables first.')
  const fullName = [firstName, middleInitial, lastName, suffix].filter(Boolean).join(' ')
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, first_name: firstName, middle_initial: middleInitial || null, last_name: lastName, suffix: suffix || null, school } },
  })
  if (error) throw error
  return data
}

export async function signOut() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
