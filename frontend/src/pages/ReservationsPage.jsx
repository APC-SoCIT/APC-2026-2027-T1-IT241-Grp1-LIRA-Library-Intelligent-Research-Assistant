import { useEffect, useState } from 'react'
import { FiArrowLeft, FiShoppingCart, FiTrash2 } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { listReservations, removeReservationCartItem } from '../services/studentLibraryService'
import { useAuth } from '../hooks/useAuth'

export default function ReservationsPage() {
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const [reservations, setReservations] = useState([])
  const [status, setStatus] = useState({ type: '', message: '' })
  const [isLoadingReservations, setIsLoadingReservations] = useState(true)

  useEffect(() => {
    if (!session) return
    let isCurrent = true
    setIsLoadingReservations(true)
    listReservations()
      .then((items) => { if (isCurrent) setReservations(items) })
      .catch((error) => { if (isCurrent) setStatus({ type: 'error', message: error.message || 'Could not load your reservation cart.' }) })
      .finally(() => { if (isCurrent) setIsLoadingReservations(false) })
    return () => { isCurrent = false }
  }, [session])

  const handleRemove = async (bookId) => {
    try {
      await removeReservationCartItem(bookId)
      setReservations((current) => current.filter((reservation) => reservation.book_id !== bookId))
      setStatus({ type: '', message: '' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Could not remove this book from your reservation cart.' })
    }
  }

  if (loading) return <div className="catalog-list-page"><p>Loading your reservations...</p></div>
  if (!session) return <div className="catalog-list-page"><p>Please sign in to view your reservations.</p><button type="button" onClick={() => navigate('/catalog')}>Go to sign in</button></div>
  if (isLoadingReservations) return <div className="catalog-list-page"><p>Loading your reservation cart...</p></div>

  const firstName = session.user.user_metadata?.first_name || session.user.user_metadata?.full_name?.split(' ')[0] || 'Student'

  return (
    <main className="catalog-list-page">
      <div className="catalog-list-header">
        <button type="button" className="catalog-list-back" onClick={() => navigate('/catalog')}><FiArrowLeft aria-hidden="true" /> Back to catalog</button>
        <div>
          <p className="catalog-list-eyebrow">{firstName}'s library</p>
          <h1><FiShoppingCart aria-hidden="true" /> My Reservation Cart</h1>
          <p>These books are queued for Koha processing; they are not confirmed Koha holds yet.</p>
        </div>
        <span className="catalog-list-count">{reservations.length} {reservations.length === 1 ? 'book' : 'books'}</span>
      </div>

      {status.message && <p className="catalog-list-error">{status.message}</p>}
      {reservations.length === 0 ? <section className="catalog-list-empty"><FiShoppingCart aria-hidden="true" /><h2>Your reservation cart is empty</h2><p>Add books from the catalog and they will be queued here for Koha processing.</p><button type="button" onClick={() => navigate('/catalog')}>Browse catalog</button></section> : <section className="catalog-list-grid">
        {reservations.map((reservation) => {
          return (
            <article key={reservation.book_id} className="catalog-list-book">
              <div className="catalog-list-book-icon"><FiShoppingCart aria-hidden="true" /></div>
              <div className="catalog-list-book-copy flex-1">
                <button type="button" onClick={() => navigate(`/catalog?book=${reservation.book_id}`)} className="text-left hover:underline">
                  <h2>{reservation.title}</h2>
                  <p>{reservation.author || 'Unknown author'}</p>
                </button>
                <small>Added {new Date(reservation.created_at).toLocaleDateString()}</small>
              </div>
              <button type="button" aria-label={`Remove ${reservation.title} from your reservation cart`} onClick={() => handleRemove(reservation.book_id)}><FiTrash2 aria-hidden="true" /></button>
            </article>
          )
        })}
      </section>}
    </main>
  )
}
