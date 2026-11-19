import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiFileText, FiLogOut, FiPlus, FiRefreshCw, FiSave, FiSearch } from 'react-icons/fi'
import LibrarianNavigation from '../components/admin/LibrarianNavigation'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../services/authService'
import { getCatalogProfileRole } from '../services/catalogService'
import { createKnowledgeEntry, listKnowledgeEntries, updateKnowledgeEntry } from '../services/knowledgeService'
import './librarianKnowledge.css'

const categories = { hours: 'Library hours', services: 'Services', rules: 'Rules & policies', contact: 'Contact information' }
const emptyForm = { kind: 'faq', category: 'hours', title: '', content: '', sourceUrl: '' }
const entryForm = (entry) => entry ? { kind: entry.kind, category: entry.category, title: entry.title, content: entry.content, sourceUrl: entry.sourceUrl || '' } : { ...emptyForm }
const updatedLabel = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export default function LibrarianKnowledgePage() {
  const navigate = useNavigate()
  const { session, loading: authLoading, configured } = useAuth()
  const userId = session?.user.id
  const currentUser = useRef(userId)
  currentUser.current = userId
  const [role, setRole] = useState(undefined)
  const [accessError, setAccessError] = useState('')
  const [entries, setEntries] = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [loadState, setLoadState] = useState('loading')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [kind, setKind] = useState('')
  const [accessRetry, setAccessRetry] = useState(0)
  const dirty = JSON.stringify(form) !== JSON.stringify(entryForm(selected))

  useEffect(() => {
    let active = true
    setRole(undefined); setAccessError(''); setEntries([]); setSelected(null)
    setForm({ ...emptyForm }); setStatus(null); setSaving(false); setLoadState('loading')
    setQuery(''); setCategory(''); setKind('')
    if (!userId) return () => { active = false }
    async function load() {
      let nextRole
      try { nextRole = await getCatalogProfileRole() }
      catch (error) { if (active) { setAccessError(error.message || 'Could not verify your permissions.'); setRole(null) }; return }
      if (!active) return
      setRole(nextRole)
      if (nextRole !== 'librarian') return
      try {
        const items = await listKnowledgeEntries()
        if (active) { setEntries(items); setLoadState('ready') }
      } catch (error) {
        if (active) { setLoadState('error'); setStatus({ type: 'error', message: error.message || 'Could not load the entries.' }) }
      }
    }
    load()
    return () => { active = false }
  }, [userId, accessRetry])

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return entries.filter((entry) => (!category || entry.category === category) && (!kind || entry.kind === kind)
      && (!term || `${entry.title} ${entry.content} ${entry.sourceUrl || ''}`.toLowerCase().includes(term)))
  }, [entries, query, category, kind])

  function mayLeave() {
    return !saving && (!dirty || window.confirm('Discard your unsaved changes?'))
  }

  function choose(entry) {
    if (!mayLeave()) return
    setSelected(entry); setForm(entryForm(entry)); setStatus(null)
  }

  async function reloadEntries() {
    if (!mayLeave()) return
    const requestUser = userId
    setLoadState('loading'); setStatus(null)
    try {
      const items = await listKnowledgeEntries()
      if (currentUser.current !== requestUser) return
      const refreshed = items.find((entry) => entry.id === selected?.id) || null
      setEntries(items); setSelected(refreshed); setForm(entryForm(refreshed)); setLoadState('ready')
    } catch (error) {
      if (currentUser.current === requestUser) { setLoadState('error'); setStatus({ type: 'error', message: error.message || 'Could not reload the entries.' }) }
    }
  }

  async function save(event) {
    event.preventDefault()
    if (saving || loadState !== 'ready') return
    const input = { ...form, title: form.title.trim(), content: form.content.trim(), sourceUrl: form.sourceUrl.trim() || null }
    if (!input.title || !input.content) { setStatus({ type: 'error', message: 'A title or question and an answer or policy are required.' }); return }
    const requestUser = userId
    setSaving(true); setStatus(null)
    try {
      const saved = selected ? await updateKnowledgeEntry(selected.id, input, selected.updatedAt) : await createKnowledgeEntry(input)
      if (currentUser.current !== requestUser) return
      setEntries((current) => [saved, ...current.filter((entry) => entry.id !== saved.id)])
      setSelected(saved); setForm(entryForm(saved))
      setStatus({ type: 'success', message: selected ? 'Changes saved.' : 'Entry created.' })
    } catch (error) {
      if (currentUser.current === requestUser) setStatus({ type: 'error', message: error.message || 'Could not save the entry.', conflict: error.status === 409 })
    } finally { if (currentUser.current === requestUser) setSaving(false) }
  }

  function change(field, value) { setForm((current) => ({ ...current, [field]: value })) }

  if (authLoading || (session && role === undefined)) return <main className="librarian-page"><section className="knowledge-access" role="status">Checking librarian access…</section></main>
  if (!configured || !session || role !== 'librarian') return (
    <main className="librarian-page"><section className="knowledge-access">
      <FiFileText aria-hidden="true" /><h1>{!configured ? 'Authentication unavailable' : accessError ? 'Could not verify access' : !session ? 'Sign in required' : 'Librarian access required'}</h1>
      <p>{!configured ? 'Configure Supabase authentication to manage FAQs and policies.' : accessError || (!session ? 'Sign in with your librarian account to continue.' : 'Your account does not have permission to manage library knowledge.')}</p>
      {accessError && <button type="button" onClick={() => setAccessRetry((value) => value + 1)}>Try again</button>}
      <button type="button" onClick={() => navigate('/catalog')}>Go to catalog</button>
    </section></main>
  )

  return (
    <main className="librarian-page knowledge-page">
      <header className="librarian-header">
        <div className="librarian-header-content"><p className="librarian-eyebrow">LIRA librarian workspace</p><h1>FAQs & policies</h1><p>Maintain clear, approved information for your library.</p>
          <div className="librarian-header-stat"><FiFileText aria-hidden="true" />{entries.length} saved {entries.length === 1 ? 'entry' : 'entries'}</div></div>
        <div className="librarian-header-art" aria-hidden="true"><FiFileText /></div>
        <div className="librarian-header-actions">
          <button type="button" disabled={saving} onClick={() => { if (mayLeave()) navigate('/catalog') }}><FiArrowLeft aria-hidden="true" /> OPAC</button>
          <button type="button" disabled={saving} onClick={async () => { if (mayLeave()) { try { await signOut() } catch (error) { setStatus({ type: 'error', message: error.message }) } } }}><FiLogOut aria-hidden="true" /> Sign out</button>
        </div>
      </header>
      <LibrarianNavigation onNavigate={(event) => { if (!mayLeave()) event.preventDefault() }} />
      {status && <div className={`knowledge-notice ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>
        <span>{status.message}</span>{status.conflict && <button type="button" disabled={saving} onClick={reloadEntries}>Reload saved entries</button>}
      </div>}
      <div className="knowledge-layout">
        <aside className="knowledge-library" aria-label="Saved FAQs and policies" aria-busy={loadState === 'loading'}>
          <div className="knowledge-library-heading"><div><p className="knowledge-eyebrow">Library knowledge</p><h2>Saved entries <span>{loadState === 'ready' ? filtered.length : '—'}</span></h2></div>
            <button type="button" className="knowledge-icon-button" aria-label="Reload entries" onClick={reloadEntries} disabled={saving || loadState === 'loading'}><FiRefreshCw aria-hidden="true" /></button></div>
          <button type="button" className="knowledge-add" onClick={() => choose(null)} disabled={saving || loadState !== 'ready'}><FiPlus aria-hidden="true" /> Add an entry</button>
          <div className="knowledge-filters">
            <label className="knowledge-search"><FiSearch aria-hidden="true" /><input aria-label="Search FAQs and policies" placeholder="Search questions, answers…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <div className="knowledge-filter-row">
              <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Type<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="">All types</option><option value="faq">FAQ</option><option value="policy">Policy</option></select></label>
            </div>
          </div>
          <div className="knowledge-entry-list">
            {loadState === 'loading' ? <p className="knowledge-empty" role="status">Loading library knowledge…</p>
              : loadState === 'error' ? <div className="knowledge-empty"><p>Entries could not be loaded.</p><button type="button" onClick={reloadEntries}>Try again</button></div>
                : filtered.length ? filtered.map((entry) => (
                  <button key={entry.id} type="button" className={`knowledge-entry${selected?.id === entry.id ? ' selected' : ''}`} aria-pressed={selected?.id === entry.id} disabled={saving} onClick={() => choose(entry)}>
                    <span className="knowledge-entry-meta"><span className="knowledge-kind">{entry.kind === 'faq' ? 'FAQ' : 'Policy'}</span>{categories[entry.category]}</span>
                    <strong>{entry.title}</strong><span className="knowledge-excerpt">{entry.content}</span><small>Updated {updatedLabel(entry.updatedAt)}</small>
                  </button>
                )) : <div className="knowledge-empty"><FiFileText aria-hidden="true" /><p>{entries.length ? 'No entries match your filters.' : 'Build your library’s knowledge.'}</p><span>{entries.length ? 'Try a different search or category.' : 'Add your first FAQ or policy to get started.'}</span></div>}
          </div>
        </aside>
        <section className="knowledge-editor" aria-labelledby="knowledge-editor-title">
          <div className="knowledge-editor-heading"><div><p className="knowledge-eyebrow">{selected ? 'Edit library knowledge' : 'Create library knowledge'}</p><h2 id="knowledge-editor-title">{selected ? 'Edit entry' : 'New entry'}</h2></div>{dirty && <span className="knowledge-unsaved">Unsaved changes</span>}</div>
          <form onSubmit={save}>
            <fieldset disabled={saving || loadState !== 'ready'}>
              <div className="knowledge-form-row">
                <label>Entry type<select value={form.kind} onChange={(event) => change('kind', event.target.value)}><option value="faq">Frequently asked question</option><option value="policy">Library policy</option></select></label>
                <label>Category<select value={form.category} onChange={(event) => change('category', event.target.value)}>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              </div>
              <label>{form.kind === 'faq' ? 'Question' : 'Policy title'}<input required maxLength={200} value={form.title} onChange={(event) => change('title', event.target.value)} placeholder={form.kind === 'faq' ? 'What would a library user ask?' : 'Give this policy a clear title'} /></label>
              <label>{form.kind === 'faq' ? 'Approved answer' : 'Policy content'}<textarea required rows={12} maxLength={10000} value={form.content} onChange={(event) => change('content', event.target.value)} placeholder="Write the approved library information here…" /><span className="knowledge-field-help">Use plain text. Include the details a library user needs.<span>{form.content.length.toLocaleString()} / 10,000</span></span></label>
              <label>Source link <span className="knowledge-optional">Optional</span><input type="url" maxLength={2000} pattern="https?://.*" value={form.sourceUrl} onChange={(event) => change('sourceUrl', event.target.value)} placeholder="https://…" /><span className="knowledge-field-help">Link to the approved library source, if available.</span></label>
            </fieldset>
            <div className="knowledge-editor-footer"><span>{saving ? 'Saving entry…' : selected ? `Last saved ${updatedLabel(selected.updatedAt)}` : 'Add approved information, then save your entry.'}</span><button type="submit" disabled={saving || loadState !== 'ready' || !dirty}><FiSave aria-hidden="true" />{saving ? 'Saving…' : selected ? 'Save changes' : 'Create entry'}</button></div>
          </form>
        </section>
      </div>
    </main>
  )
}
