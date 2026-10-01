import { useEffect, useState } from 'react'
import { FiArrowLeft, FiBookmark, FiCheck, FiEdit2, FiPlus, FiTrash2, FiX } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { createReadingList, deleteReadingList, listBookmarks, listReadingLists, moveBookmark, removeBookmark, renameReadingList } from '../services/studentLibraryService'
import { useAuth } from '../hooks/useAuth'

export default function BookmarksPage() {
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const [lists, setLists] = useState([])
  const [bookmarks, setBookmarks] = useState([])
  const [activeListId, setActiveListId] = useState(null)
  const [newListName, setNewListName] = useState('')
  const [renameListId, setRenameListId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [isLoadingLists, setIsLoadingLists] = useState(true)
  const [status, setStatus] = useState({ type: '', message: '' })

  useEffect(() => {
    if (!session) {
      setIsLoadingLists(false)
      return undefined
    }
    let active = true
    Promise.all([listReadingLists(), listBookmarks()])
      .then(([readingLists, savedBooks]) => {
        if (!active) return
        setLists(readingLists)
        setBookmarks(savedBooks)
        setActiveListId((current) => current ?? readingLists[0]?.id ?? null)
      })
      .catch((error) => {
        if (active) setStatus({ type: 'error', message: error.message || 'Could not load your lists.' })
      })
      .finally(() => { if (active) setIsLoadingLists(false) })
    return () => { active = false }
  }, [session])

  const activeList = lists.find((list) => String(list.id) === String(activeListId))
  const activeBookmarks = bookmarks.filter((bookmark) => String(bookmark.list_id) === String(activeListId))

  const handleCreateList = async (event) => {
    event.preventDefault()
    try {
      const list = await createReadingList(newListName)
      setLists((current) => [...current, list])
      setActiveListId(list.id)
      setNewListName('')
      setStatus({ type: 'success', message: `Created “${list.name}”.` })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Could not create this list.' })
    }
  }

  const handleRenameList = async (event) => {
    event.preventDefault()
    try {
      const updated = await renameReadingList(renameListId, renameValue)
      setLists((current) => current.map((list) => list.id === updated.id ? updated : list))
      setRenameListId(null)
      setStatus({ type: 'success', message: 'List name updated.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Could not rename this list.' })
    }
  }

  const handleMoveBookmark = async (bookmark, targetListId) => {
    try {
      const moved = await moveBookmark(bookmark.book_id, targetListId)
      setBookmarks((current) => current.map((item) => item.book_id === moved.book_id ? moved : item))
      setStatus({ type: 'success', message: `Moved “${bookmark.title}”.` })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Could not move this book.' })
    }
  }

  const handleRemove = async (bookId) => {
    try {
      await removeBookmark(bookId)
      setBookmarks((current) => current.filter((bookmark) => bookmark.book_id !== bookId))
      setStatus({ type: 'success', message: 'Book removed from your lists.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Could not remove this book.' })
    }
  }

  const handleDeleteList = async () => {
    if (!activeList || activeBookmarks.length > 0 || lists.length <= 1) return
    try {
      await deleteReadingList(activeList.id)
      const remaining = lists.filter((list) => list.id !== activeList.id)
      setLists(remaining)
      setActiveListId(remaining[0]?.id ?? null)
      setStatus({ type: 'success', message: `Deleted “${activeList.name}”.` })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Could not delete this list.' })
    }
  }

  if (loading) return <div className="catalog-list-page"><p>Loading your list...</p></div>
  if (!session) return <div className="catalog-list-page"><p>Please sign in to view your list.</p><button type="button" onClick={() => navigate('/catalog')}>Go to sign in</button></div>

  const firstName = session.user.user_metadata?.first_name || session.user.user_metadata?.full_name?.split(' ')[0] || 'Student'

  return (
    <main className="catalog-list-page">
      <div className="catalog-list-header">
        <button type="button" className="catalog-list-back" onClick={() => navigate('/catalog')}><FiArrowLeft aria-hidden="true" /> Back to catalog</button>
        <div>
          <p className="catalog-list-eyebrow">{firstName}'s library</p>
          <h1><FiBookmark aria-hidden="true" /> Your lists</h1>
          <p>Organize the books you want to keep.</p>
        </div>
      </div>

      {status.message && <p className={`catalog-list-error ${status.type}`} role="status">{status.message}</p>}

      <section className="catalog-list-management" aria-label="Manage reading lists">
        <form className="catalog-list-create" onSubmit={handleCreateList}>
          <label htmlFor="new-reading-list">New list</label>
          <input id="new-reading-list" value={newListName} onChange={(event) => setNewListName(event.target.value)} maxLength={60} placeholder="e.g. Course reading" required />
          <button type="submit" disabled={!newListName.trim()}><FiPlus aria-hidden="true" /> Create list</button>
        </form>

        {lists.length > 0 && <nav className="catalog-list-tabs" aria-label="Your reading lists" role="tablist">
          {lists.map((list) => {
            const count = bookmarks.filter((bookmark) => String(bookmark.list_id) === String(list.id)).length
            return <button key={list.id} type="button" role="tab" aria-selected={String(list.id) === String(activeListId)} className={String(list.id) === String(activeListId) ? 'active' : ''} onClick={() => { setActiveListId(list.id); setRenameListId(null) }}>
              <span>{list.name}</span><small>{count}</small>
            </button>
          })}
        </nav>}

        {activeList && <div className="catalog-list-active-heading">
          {renameListId === activeList.id ? <form className="catalog-list-rename" onSubmit={handleRenameList}>
            <label className="sr-only" htmlFor="rename-reading-list">List name</label>
            <input id="rename-reading-list" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} maxLength={60} required autoFocus />
            <button type="submit" disabled={!renameValue.trim()} aria-label="Save list name"><FiCheck aria-hidden="true" /></button>
            <button type="button" onClick={() => setRenameListId(null)} aria-label="Cancel rename"><FiX aria-hidden="true" /></button>
          </form> : <>
            <h2>{activeList.name}</h2>
            <button type="button" onClick={() => { setRenameListId(activeList.id); setRenameValue(activeList.name) }} aria-label={`Rename ${activeList.name}`} title="Rename list"><FiEdit2 aria-hidden="true" /></button>
            {lists.length > 1 && <button type="button" onClick={handleDeleteList} disabled={activeBookmarks.length > 0} aria-label={`Delete empty list ${activeList.name}`} title={activeBookmarks.length > 0 ? 'Move or remove its books before deleting' : 'Delete empty list'}><FiTrash2 aria-hidden="true" /></button>}
          </>}
          <span>{activeBookmarks.length} {activeBookmarks.length === 1 ? 'book' : 'books'}</span>
        </div>}
      </section>

      {isLoadingLists ? <p className="catalog-list-empty">Loading your lists...</p> : activeBookmarks.length === 0 ? <section className="catalog-list-empty"><FiBookmark aria-hidden="true" /><h2>{activeList ? 'This list is empty' : 'No lists yet'}</h2><p>Save a book from the catalog or reader, or move a saved book here.</p><button type="button" onClick={() => navigate('/catalog')}>Browse catalog</button></section> : <section className="catalog-list-grid">
        {activeBookmarks.map((bookmark) => <article key={bookmark.book_id} className="catalog-list-book">
          <div className="catalog-list-book-icon"><FiBookmark aria-hidden="true" /></div>
          <div className="catalog-list-book-copy"><button type="button" onClick={() => navigate(`/catalog?book=${bookmark.book_id}`)} className="text-left hover:underline"><h2>{bookmark.title}</h2><p>{bookmark.author || 'Unknown author'}</p></button><small>Saved {new Date(bookmark.created_at).toLocaleDateString()}</small></div>
          <div className="catalog-list-book-actions">
            <label className="sr-only" htmlFor={`move-book-${bookmark.book_id}`}>Move {bookmark.title} to another list</label>
            <select id={`move-book-${bookmark.book_id}`} value={bookmark.list_id} onChange={(event) => handleMoveBookmark(bookmark, event.target.value)} aria-label={`Move ${bookmark.title} to another list`}>
              {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
            </select>
            <button type="button" aria-label={`Remove ${bookmark.title} from your lists`} onClick={() => handleRemove(bookmark.book_id)} title="Remove book"><FiTrash2 aria-hidden="true" /></button>
          </div>
        </article>)}
      </section>}
    </main>
  )
}
