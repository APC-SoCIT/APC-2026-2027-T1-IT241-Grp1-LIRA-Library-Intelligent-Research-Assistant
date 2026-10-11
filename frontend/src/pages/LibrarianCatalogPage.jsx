import { useEffect, useMemo, useState } from 'react'
import { FiArrowLeft, FiBookOpen, FiFilter, FiLogOut, FiPlus, FiSave, FiSearch, FiTrash2 } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../services/authService'
import { createCatalogBook, deleteCatalogBook, getCatalogProfileRole, listCatalogBooks, updateCatalogBook } from '../services/catalogService'

const knownCategories = ['Psychology', 'Engineering', 'Computer Science', 'Literature', 'Photography', 'Accounting', 'Architecture', 'Business & Economics', 'History']
const emptyBook = { title: '', author: '', isbn: '', publisher: '', publicationYear: '', publicationPlace: '', language: '', itemType: '', description: '', url: '', genres: '', categories: '' }

function formValue(book) {
  const subjects = [...new Set([...(book?.genres || []), ...(book?.categories || [])])]
  return { title: book?.title || '', author: book?.author || '', isbn: book?.isbn || '', publisher: book?.publisher || '', publicationYear: book?.publicationYear || '', publicationPlace: book?.publicationPlace || '', language: book?.language || '', itemType: book?.itemType || '', description: book?.description || '', url: book?.url?.split('|')[0] || '', genres: subjects.join(', '), categories: subjects.join(', ') }
}

function toPayload(form) {
  const payload = { ...form, publicationYear: form.publicationYear ? Number(form.publicationYear) : undefined }
  const subjects = form.genres.split(',').map((value) => value.trim()).filter(Boolean)
  payload.genres = subjects
  payload.categories = subjects
  for (const key of ['author', 'isbn', 'publisher', 'publicationPlace', 'language', 'itemType', 'description', 'url']) if (!payload[key]) delete payload[key]
  if (!payload.publicationYear) delete payload.publicationYear
  delete payload.title
  return { title: form.title.trim(), ...payload }
}

export default function LibrarianCatalogPage() {
  const navigate = useNavigate()
  const { session, loading: authLoading, configured } = useAuth()
  const [role, setRole] = useState(null)
  const [books, setBooks] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState(emptyBook)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [listQuery, setListQuery] = useState('')
  const [authorFilter, setAuthorFilter] = useState('')
  const [languageFilter, setLanguageFilter] = useState('')
  const [itemTypeFilter, setItemTypeFilter] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })

  useEffect(() => {
    if (!session) {
      setLoading(false)
      return undefined
    }
    let active = true
    getCatalogProfileRole()
      .then((nextRole) => {
        if (!active) return
        setRole(nextRole)
        if (nextRole !== 'librarian') return null
        return listCatalogBooks().then((nextBooks) => { if (active) setBooks(nextBooks) })
      })
      .catch((error) => active && setStatus({ type: 'error', message: error.message || 'Could not load the catalog.' }))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [session])

  const selectedBook = useMemo(() => books.find((book) => book.id === selectedId), [books, selectedId])
  const suggestions = useMemo(() => ({
    authors: [...new Set(books.map((book) => book.author).filter(Boolean))].sort(),
    languages: [...new Set(books.map((book) => book.language).filter(Boolean))].sort(),
    itemTypes: [...new Set(books.map((book) => book.itemType).filter(Boolean))].sort(),
    genres: [...new Set(books.flatMap((book) => book.genres || []).filter(Boolean))].sort(),
    categories: [...new Set([...knownCategories, ...books.flatMap((book) => book.categories || [])].filter(Boolean))].sort(),
  }), [books])
  const filteredBooks = useMemo(() => {
    const query = listQuery.trim().toLowerCase()
    return books.filter((book) => {
      const matchesQuery = !query || [book.title, book.author, book.isbn, book.id].some((value) => String(value || '').toLowerCase().includes(query))
      return matchesQuery && (!authorFilter || book.author === authorFilter) && (!languageFilter || book.language === languageFilter) && (!itemTypeFilter || book.itemType === itemTypeFilter)
    })
  }, [authorFilter, books, itemTypeFilter, languageFilter, listQuery])
  const years = useMemo(() => Array.from({ length: new Date().getFullYear() - 1899 }, (_, index) => new Date().getFullYear() - index), [])

  const selectBook = (book) => { setSelectedId(book.id); setForm(formValue(book)); setStatus({ type: '', message: '' }) }
  const startNew = () => { setSelectedId(null); setForm(emptyBook); setStatus({ type: '', message: '' }) }

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setStatus({ type: '', message: '' })
    try {
      const saved = selectedBook ? await updateCatalogBook(selectedBook.id, toPayload(form)) : await createCatalogBook(toPayload(form))
      setBooks((current) => selectedBook ? current.map((book) => book.id === saved.id ? saved : book) : [saved, ...current])
      setSelectedId(saved.id); setForm(formValue(saved)); setStatus({ type: 'success', message: selectedBook ? 'Catalog record updated.' : 'Catalog record created.' })
    } catch (error) { setStatus({ type: 'error', message: error.message || 'Could not save the catalog record.' }) } finally { setBusy(false) }
  }

  const removeSelected = async () => {
    if (!selectedBook || !window.confirm(`Delete “${selectedBook.title || 'Untitled record'}” from Koha? This cannot be undone.`)) return
    setBusy(true); setStatus({ type: '', message: '' })
    try { await deleteCatalogBook(selectedBook.id); setBooks((current) => current.filter((book) => book.id !== selectedBook.id)); startNew(); setStatus({ type: 'success', message: 'Catalog record deleted.' }) }
    catch (error) { setStatus({ type: 'error', message: error.message || 'Could not delete the catalog record.' }) } finally { setBusy(false) }
  }

  if (authLoading || loading) return <main className="librarian-page"><p className="librarian-loading">Loading librarian workspace...</p></main>
  if (!configured) return <main className="librarian-page"><section className="librarian-message"><h1>Catalog management unavailable</h1><p>Configure Supabase authentication before opening the librarian workspace.</p></section></main>
  if (!session) return <main className="librarian-page"><section className="librarian-message"><h1>Sign in required</h1><p>Sign in through the catalog first, then open the librarian workspace.</p><button type="button" onClick={() => navigate('/catalog')}>Go to catalog sign in</button></section></main>
  if (role !== 'librarian') return <main className="librarian-page"><section className="librarian-message"><h1>Librarian access required</h1><p>Your account is signed in, but it does not have the librarian role.</p><button type="button" onClick={() => navigate('/catalog')}>Back to catalog</button></section></main>

  return <main className="librarian-page">
    <header className="librarian-header"><div><p className="librarian-eyebrow">LIRA catalog administration</p><h1>Manage library catalog</h1><p>Create and update authoritative Koha bibliographic records.</p></div><div className="librarian-header-actions"><button type="button" onClick={() => navigate('/catalog')}><FiArrowLeft /> OPAC</button><button type="button" onClick={signOut}><FiLogOut /> Sign out</button></div></header>
    {status.message && <p className={`librarian-status ${status.type}`}>{status.message}</p>}
    <div className="librarian-layout">
      <aside className="librarian-records"><div className="librarian-records-heading"><h2>Records <small>{filteredBooks.length}/{books.length}</small></h2><button type="button" onClick={startNew} title="New record"><FiPlus /></button></div><div className="librarian-record-tools"><label className="librarian-search"><FiSearch /><input aria-label="Search records" placeholder="Search title, author, ISBN..." value={listQuery} onChange={(event) => setListQuery(event.target.value)} /></label><label><FiFilter /> Author<select value={authorFilter} onChange={(event) => setAuthorFilter(event.target.value)}><option value="">All authors</option>{suggestions.authors.map((value) => <option key={value}>{value}</option>)}</select></label><label><FiFilter /> Language<select value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)}><option value="">All languages</option>{suggestions.languages.map((value) => <option key={value}>{value}</option>)}</select></label><label><FiFilter /> Item type<select value={itemTypeFilter} onChange={(event) => setItemTypeFilter(event.target.value)}><option value="">All item types</option>{suggestions.itemTypes.map((value) => <option key={value}>{value}</option>)}</select></label></div><div className="librarian-record-list">{filteredBooks.map((book) => <button type="button" key={book.id} className={`librarian-record ${book.id === selectedId ? 'active' : ''}`} onClick={() => selectBook(book)}><strong>{book.title || 'Untitled record'}</strong><span>{book.author || 'Unknown author'} · #{book.id}</span></button>)}{filteredBooks.length === 0 && <p className="librarian-empty">No matching records.</p>}</div></aside>
      <section className="librarian-editor"><div className="librarian-editor-heading"><div><p>{selectedBook ? `Editing record #${selectedBook.id}` : 'New catalog record'}</p><h2>{selectedBook ? selectedBook.title : 'Add a book'}</h2></div><FiBookOpen /></div><form onSubmit={submit} className="librarian-form"><label>Title *<input required maxLength="500" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>Author<input list="author-options" maxLength="500" value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} /></label><div className="librarian-form-grid"><label>ISBN<input maxLength="50" value={form.isbn} onChange={(event) => setForm({ ...form, isbn: event.target.value })} /></label><label>Publication year<input type="number" list="year-options" min="1000" max={new Date().getFullYear() + 5} step="1" placeholder="YYYY" value={form.publicationYear} onChange={(event) => setForm({ ...form, publicationYear: event.target.value })} /></label><label>Publisher<input maxLength="500" value={form.publisher} onChange={(event) => setForm({ ...form, publisher: event.target.value })} /></label><label>Publication place<input maxLength="500" value={form.publicationPlace} onChange={(event) => setForm({ ...form, publicationPlace: event.target.value })} /></label><label>Language<input list="language-options" maxLength="20" placeholder="e.g. eng" value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })} /></label><label>Item type<input list="item-type-options" maxLength="50" placeholder="e.g. BK" value={form.itemType} onChange={(event) => setForm({ ...form, itemType: event.target.value })} /></label></div><label>Online resource URL<input type="url" maxLength="2000" placeholder="https://..." value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} /></label><label>Genres / categories <span>comma-separated; the same values are saved to both fields</span><input list="genre-options" value={form.genres} onChange={(event) => setForm({ ...form, genres: event.target.value, categories: event.target.value })} /></label><label>Description<textarea maxLength="5000" rows="6" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><div className="librarian-form-actions"><button type="button" onClick={startNew}>Clear</button>{selectedBook && <button type="button" className="librarian-danger-button" onClick={removeSelected} disabled={busy}><FiTrash2 /> Delete</button>}<button type="submit" disabled={busy}>{busy ? 'Saving...' : selectedBook ? <><FiSave /> Save changes</> : <><FiPlus /> Create record</>}</button></div></form><datalist id="author-options">{suggestions.authors.map((value) => <option key={value} value={value} />)}</datalist><datalist id="language-options">{suggestions.languages.map((value) => <option key={value} value={value} />)}</datalist><datalist id="item-type-options">{suggestions.itemTypes.map((value) => <option key={value} value={value} />)}</datalist><datalist id="genre-options">{[...new Set([...suggestions.genres, ...suggestions.categories])].sort().map((value) => <option key={value} value={value} />)}</datalist><datalist id="year-options">{years.map((year) => <option key={year} value={year} />)}</datalist></section>
    </div>
  </main>
}
