import { useEffect, useState } from 'react'
import { FiSave, FiX } from 'react-icons/fi'
import { getStudentProfile, updateStudentProfile } from '../services/studentLibraryService'

const emptyProfile = {
  first_name: '',
  middle_initial: '',
  last_name: '',
  suffix: '',
  school: '',
}

const schools = [
  'School of Computing and Information Technology',
  'School of Engineering',
  'School of Management',
  'School of Architecture',
  'School of Multimedia and Arts',
]

export default function ProfileSettingsDialog({ user, onClose, onUpdated }) {
  const [form, setForm] = useState(emptyProfile)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getStudentProfile()
      .then((profile) => {
        if (!active) return
        setForm({
          first_name: profile.first_name || user.user_metadata?.first_name || '',
          middle_initial: profile.middle_initial || user.user_metadata?.middle_initial || '',
          last_name: profile.last_name || user.user_metadata?.last_name || '',
          suffix: profile.suffix || user.user_metadata?.suffix || '',
          school: profile.school || user.user_metadata?.school || '',
        })
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Could not load your profile.')
      })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [user])

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSaving(true)
    try {
      const profile = await updateStudentProfile(form)
      onUpdated(profile)
    } catch (saveError) {
      setError(saveError.message || 'Could not save your profile.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="reading-list-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="reading-list-picker profile-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-settings-title">
        <header className="reading-list-picker-header">
          <div>
            <p>Account</p>
            <h2 id="profile-settings-title">Profile settings</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close profile settings"><FiX aria-hidden="true" /></button>
        </header>

        {isLoading ? <p className="reading-list-picker-note">Loading your profile...</p> : <form className="profile-settings-form" onSubmit={handleSubmit}>
          <label>First name<input name="first_name" value={form.first_name} onChange={updateField} autoComplete="given-name" required /></label>
          <label>Middle initial <span>(optional)</span><input name="middle_initial" value={form.middle_initial} onChange={updateField} maxLength={2} autoComplete="additional-name" /></label>
          <label>Last name<input name="last_name" value={form.last_name} onChange={updateField} autoComplete="family-name" required /></label>
          <label>Suffix <span>(optional)</span><input name="suffix" value={form.suffix} onChange={updateField} maxLength={10} autoComplete="honorific-suffix" /></label>
          <label>School<select name="school" value={form.school} onChange={updateField} required>
            <option value="" disabled>Select your school</option>
            {schools.map((school) => <option key={school} value={school}>{school}</option>)}
          </select></label>
          {error && <p className="reading-list-picker-error" role="alert">{error}</p>}
          <footer className="reading-list-picker-actions">
            <button type="button" className="reading-list-picker-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="reading-list-picker-save" disabled={isSaving}><FiSave aria-hidden="true" /> {isSaving ? 'Saving...' : 'Save changes'}</button>
          </footer>
        </form>}
      </section>
    </div>
  )
}