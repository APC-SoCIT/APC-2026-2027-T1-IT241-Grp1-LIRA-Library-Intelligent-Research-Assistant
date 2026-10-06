import { useEffect, useState } from 'react'
import { FiArrowLeft, FiBookmark, FiTrash2 } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { listBookmarks, removeBookmark } from '../services/studentLibraryService'
import { useAuth } from '../hooks/useAuth'

export default function BookmarksPage() {
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const [bookmarks, setBookmarks] = useState([])
  const [status, setStatus] = useState({ type: '', message: '' })

  useEffect(() => {
    if (!session) return
    listBookmarks()
      .then((items) => setBookmarks(items))
      .catch((error) => setStatus({ type: 'error', message: error.message || 'Could not load your list.' }))
  }, [session])

  const handleRemove = async (bookId) => {
    try {
      await removeBookmark(bookId)
      setBookmarks((current) => current.filter((bookmark) => bookmark.book_id !== bookId))
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Could not remove this book.' })
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
          <h1><FiBookmark aria-hidden="true" /> My list</h1>
          <p>Books you saved from the catalog.</p>
        </div>
        <span className="catalog-list-count">{bookmarks.length} {bookmarks.length === 1 ? 'book' : 'books'}</span>
      </div>

      {status.message && <p className="catalog-list-error">{status.message}</p>}
      {bookmarks.length === 0 ? <section className="catalog-list-empty"><FiBookmark aria-hidden="true" /><h2>Your list is empty</h2><p>Save a book from the catalog and it will appear here.</p><button type="button" onClick={() => navigate('/catalog')}>Browse catalog</button></section> : <section className="catalog-list-grid">
        {bookmarks.map((bookmark) => <article key={bookmark.book_id} className="catalog-list-book">
          <div className="catalog-list-book-icon"><FiBookmark aria-hidden="true" /></div>
          <div className="catalog-list-book-copy"><button type="button" onClick={() => navigate(`/catalog?book=${bookmark.book_id}`)} className="text-left hover:underline"><h2>{bookmark.title}</h2><p>{bookmark.author || 'Unknown author'}</p></button><small>Saved {new Date(bookmark.created_at).toLocaleDateString()}</small></div>
          <button type="button" aria-label={`Remove ${bookmark.title} from your list`} onClick={() => handleRemove(bookmark.book_id)}><FiTrash2 aria-hidden="true" /></button>
        </article>)}
      </section>}
    </main>
  )
}
