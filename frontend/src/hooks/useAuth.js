import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { ensureKohaPatronAccount } from '../services/catalogService'

function provisionSession(session) {
  if (!session?.user) return
  ensureKohaPatronAccount().catch((error) => {
    console.warn('Koha patron provisioning is pending:', error.message)
  })
}

export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return undefined

    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session)
        setLoading(false)
        provisionSession(data.session)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        // Defer network work until Supabase finishes its auth callback.
        setTimeout(() => provisionSession(nextSession), 0)
      }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return { session, loading, configured: Boolean(supabase) }
}
