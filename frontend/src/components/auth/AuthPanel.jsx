import { useState } from 'react'
import { FiAlertCircle, FiCheckCircle, FiLogIn, FiLogOut, FiUserPlus } from 'react-icons/fi'
import { signIn, signOut, signUp } from '../../services/authService'

export default function AuthPanel({ session, configured, onAccessCatalog }) {
  const [mode, setMode] = useState('sign-in')
  const [form, setForm] = useState({ firstName: '', middleInitial: '', lastName: '', suffix: '', school: '', email: '', password: '' })
  const [status, setStatus] = useState({ type: '', message: '' })
  const [busy, setBusy] = useState(false)

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setStatus({ type: '', message: '' })
    setBusy(true)

    try {
      if (mode === 'sign-up') {
        await signUp(form)
        setStatus({ type: 'success', message: 'Account created. You can sign in now.' })
        setMode('sign-in')
      } else {
        await signIn(form)
        setStatus({ type: 'success', message: 'Signed in successfully.' })
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Authentication failed. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  if (session) {
    return (
      <div className="catalog-authenticated">
        <FiCheckCircle aria-hidden="true" />
        <div>
          <strong>Signed in as {session.user.user_metadata?.full_name || session.user.email}</strong>
          <span>Your reading history and bookmarks are ready.</span>
        </div>
        <div className="catalog-auth-actions">
          <button type="button" className="catalog-primary-button" onClick={onAccessCatalog}>Open catalog</button>
          <button type="button" className="catalog-secondary-button" onClick={signOut}><FiLogOut aria-hidden="true" /> Sign out</button>
        </div>
      </div>
    )
  }

  return (
    <div className="catalog-auth-panel">
      <div className="catalog-auth-tabs" role="tablist" aria-label="Account access">
        <button type="button" role="tab" aria-selected={mode === 'sign-in'} className={mode === 'sign-in' ? 'active' : ''} onClick={() => setMode('sign-in')}><FiLogIn aria-hidden="true" /> Sign in</button>
        <button type="button" role="tab" aria-selected={mode === 'sign-up'} className={mode === 'sign-up' ? 'active' : ''} onClick={() => setMode('sign-up')}><FiUserPlus aria-hidden="true" /> Create account</button>
      </div>

      {!configured && <p className="catalog-auth-message error"><FiAlertCircle aria-hidden="true" /> Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to enable account access.</p>}
      {status.message && <p className={`catalog-auth-message ${status.type}`}>{status.type === 'error' ? <FiAlertCircle aria-hidden="true" /> : <FiCheckCircle aria-hidden="true" />}{status.message}</p>}

      <form onSubmit={submit} className="catalog-auth-form">
        {mode === 'sign-up' && <>
          <label>First name<input name="firstName" value={form.firstName} onChange={updateField} required autoComplete="given-name" /></label>
          <label>Middle initial <span className="catalog-optional-label">(optional)</span><input name="middleInitial" value={form.middleInitial} onChange={updateField} maxLength={2} placeholder="e.g. A." autoComplete="additional-name" /></label>
          <label>Last name<input name="lastName" value={form.lastName} onChange={updateField} required autoComplete="family-name" /></label>
          <label>Suffix <span className="catalog-optional-label">(optional)</span><input name="suffix" value={form.suffix} onChange={updateField} maxLength={10} placeholder="e.g. Jr." autoComplete="honorific-suffix" /></label>
          <label>School<select name="school" value={form.school} onChange={updateField} required>
            <option value="" disabled>Select your school</option>
            <option>School of Computing and Information Technology</option>
            <option>School of Engineering</option>
            <option>School of Management</option>
            <option>School of Architecture</option>
            <option>School of Multimedia and Arts</option>
          </select></label>
        </>}
        <label>Email address<input type="email" name="email" value={form.email} onChange={updateField} required autoComplete="email" /></label>
        <label>Password<input type="password" name="password" value={form.password} onChange={updateField} required minLength={8} autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} /></label>
        <button type="submit" className="catalog-primary-button" disabled={busy || !configured}>{busy ? 'Working...' : mode === 'sign-up' ? 'Create account' : 'Sign in'}</button>
      </form>
    </div>
  )
}
