import { useEffect, useState } from 'react'
import { FiBookmark, FiPlus, FiX } from 'react-icons/fi'
import { createReadingList, listReadingLists, saveBookmark } from '../services/studentLibraryService'

export default function ReadingListPicker({ book, onClose, onSaved }) {
  const [lists, setLists] = useState([])
  const [selectedListId, setSelectedListId] = useState('')
  const [newListName, setNewListName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    listReadingLists()
      .then((items) => {
        if (!active) return
        setLists(items)
        setSelectedListId(items[0] ? String(items[0].id) : '')
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Could not load your lists.')
      })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [])

  const handleCreateList = async (event) => {
    event.preventDefault()
    setIsCreating(true)
    setError('')
    try {
      const created = await createReadingList(newListName)
      setLists((current) => [...current, created])
      setSelectedListId(String(created.id))
      setNewListName('')
    } catch (createError) {
      setError(createError.message || 'Could not create this list.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleSave = async () => {
    if (!selectedListId) return
    setIsSaving(true)
    setError('')
    try {
      const bookmark = await saveBookmark(book, selectedListId)
      const list = lists.find((item) => String(item.id) === selectedListId)
      onSaved(bookmark, list?.name)
    } catch (saveError) {
      setError(saveError.message || 'Could not save this book.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="reading-list-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="reading-list-picker" role="dialog" aria-modal="true" aria-labelledby="reading-list-picker-title">
        <header className="reading-list-picker-header">
          <div>
            <p>Save book</p>
            <h2 id="reading-list-picker-title">Choose a list</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close list picker"><FiX aria-hidden="true" /></button>
        </header>

        <p className="reading-list-picker-book">{book.title}</p>

        {isLoading ? <p className="reading-list-picker-note">Loading your lists...</p> : lists.length > 0 ? (
          <label className="reading-list-picker-field" htmlFor="reading-list-destination">
            <span>Save to</span>
            <select id="reading-list-destination" value={selectedListId} onChange={(event) => setSelectedListId(event.target.value)}>
              {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
            </select>
          </label>
        ) : <p className="reading-list-picker-note">You don’t have any lists yet. Create one below, then choose it to save this book.</p>}

        <form className="reading-list-picker-create" onSubmit={handleCreateList}>
          <label htmlFor="reading-list-new-name">Create a list</label>
          <div>
            <input id="reading-list-new-name" value={newListName} onChange={(event) => setNewListName(event.target.value)} maxLength={60} placeholder="e.g. Weekend reading" required />
            <button type="submit" disabled={!newListName.trim() || isCreating}><FiPlus aria-hidden="true" /> {isCreating ? 'Creating...' : 'Create'}</button>
          </div>
        </form>

        {error && <p className="reading-list-picker-error" role="alert">{error}</p>}

        <footer className="reading-list-picker-actions">
          <button type="button" className="reading-list-picker-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="reading-list-picker-save" onClick={handleSave} disabled={!selectedListId || isLoading || isSaving}>
            <FiBookmark aria-hidden="true" /> {isSaving ? 'Saving...' : 'Add to list'}
          </button>
        </footer>
      </section>
    </div>
  )
}