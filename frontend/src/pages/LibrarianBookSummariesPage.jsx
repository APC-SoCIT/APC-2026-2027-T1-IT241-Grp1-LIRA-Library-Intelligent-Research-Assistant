import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiCheck, FiFileText, FiLogOut, FiRefreshCw, FiX } from 'react-icons/fi'
import LibrarianNavigation from '../components/admin/LibrarianNavigation'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../services/authService'
import { getCatalogProfileRole, listBookSummaries, reviewBookSummary } from '../services/catalogService'

const updatedLabel = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const statusFilters = [
  { value: 'pending_review', label: 'Pending review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'generating', label: 'Generating' },
  { value: 'failed', label: 'Failed' },
  { value: '', label: 'All statuses' },
]
const statusLabels = Object.fromEntries(statusFilters.map(({ value, label }) => [value || 'all', label]))

export default function LibrarianBookSummariesPage() {
  const navigate = useNavigate()
  const { session, loading: authLoading, configured } = useAuth()
  const userId = session?.user.id
  const currentUser = useRef(userId)
  currentUser.current = userId
  const [role, setRole] = useState(undefined)
  const [accessError, setAccessError] = useState('')
  const [summaries, setSummaries] = useState([])
  const [filter, setFilter] = useState('pending_review')
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState('')
  const [reviewerNote, setReviewerNote] = useState('')
  const [loadState, setLoadState] = useState('loading')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const selected = summaries.find((summary) => summary.id === selectedId)
  const dirty = Boolean(selected && (draft !== (selected.summary || '') || reviewerNote !== (selected.reviewerNote || '')))

  useEffect(() => {
    let active = true
    setRole(undefined)
    setAccessError('')
    setSummaries([])
    setSelectedId('')
    setDraft('')
    setReviewerNote('')
    setLoadState('loading')
    if (!userId) return () => { active = false }
    async function load() {
      let nextRole
      try {
        nextRole = await getCatalogProfileRole()
      } catch (error) {
        if (active) {
          setAccessError(error.message || 'Could not verify your permissions.')
          setRole(null)
        }
        return
      }
      if (!active) return
      setRole(nextRole)
      if (nextRole !== 'librarian') return
      try {
        const items = await listBookSummaries(filter)
        if (!active) return
        setSummaries(items)
        setSelectedId(items[0]?.id || '')
        setDraft(items[0]?.summary || '')
        setLoadState('ready')
      } catch (error) {
        if (!active) return
        setLoadState('error')
        setStatus({ type: 'error', message: error.message || 'Could not load generated summaries.' })
      }
    }
    load()
    return () => { active = false }
  }, [userId, reloadKey, filter])

  function mayLeave() {
    return !saving && (!dirty || window.confirm('Discard your unsaved review changes?'))
  }

  function selectSummary(summary) {
    if (!mayLeave()) return
    setSelectedId(summary.id)
    setDraft(summary.summary || '')
    setReviewerNote('')
    setStatus(null)
  }

  function selectFilter(value) {
    if (!mayLeave()) return
    setStatus(null)
    setFilter(value)
  }

  async function reload() {
    if (!mayLeave()) return
    setReloadKey((value) => value + 1)
  }

  async function submitReview(action) {
    if (!selected || saving || !draft.trim()) return
    const requestUser = userId
    setSaving(true)
    setStatus(null)
    try {
      const reviewed = await reviewBookSummary(selected.id, {
        action,
        summary: draft.trim(),
        reviewerNote: reviewerNote.trim() || null,
        expectedUpdatedAt: selected.updatedAt,
      })
      if (currentUser.current !== requestUser) return
      const remaining = filter === 'pending_review'
        ? summaries.filter((summary) => summary.id !== selected.id)
        : summaries.map((summary) => summary.id === selected.id ? reviewed : summary)
      const next = filter === 'pending_review' ? remaining[0] : reviewed
      setSummaries(remaining)
      setSelectedId(next?.id || '')
      setDraft(next?.summary || '')
      setReviewerNote('')
      setStatus({ type: 'success', message: action === 'approve' ? 'Summary approved and published.' : 'Summary rejected.' })
    } catch (error) {
      if (currentUser.current === requestUser) {
        setStatus({ type: 'error', message: error.message || 'Could not save this review.', conflict: error.status === 409 })
      }
    } finally {
      if (currentUser.current === requestUser) setSaving(false)
    }
  }

  if (authLoading || (session && role === undefined)) return <main className="librarian-page"><section className="knowledge-access" role="status">Checking librarian access…</section></main>
  if (!configured || !session || role !== 'librarian') return (
    <main className="librarian-page"><section className="knowledge-access">
      <FiFileText aria-hidden="true" />
      <h1>{!configured ? 'Authentication unavailable' : accessError ? 'Could not verify access' : !session ? 'Sign in required' : 'Librarian access required'}</h1>
      <p>{!configured ? 'Configure Supabase authentication to review generated summaries.' : accessError || (!session ? 'Sign in with your librarian account to continue.' : 'Your account does not have permission to review summaries.')}</p>
      {accessError && <button type="button" onClick={reload}>Try again</button>}
      <button type="button" onClick={() => navigate('/catalog')}>Go to catalog</button>
    </section></main>
  )

  return (
    <main className="librarian-page">
      <header className="librarian-header">
        <div className="librarian-header-content">
          <p className="librarian-eyebrow">LIRA librarian workspace</p>
          <h1>AI book summaries</h1>
          <p>Monitor summaries by status and review new submissions.</p>
          <div className="librarian-header-stat"><FiFileText aria-hidden="true" /> {summaries.length} {statusLabels[filter || 'all'].toLowerCase()}</div>
        </div>
        <div className="librarian-header-art" aria-hidden="true"><FiFileText /></div>
        <div className="librarian-header-actions">
          <button type="button" disabled={saving} onClick={() => { if (mayLeave()) navigate('/catalog') }}><FiArrowLeft aria-hidden="true" /> OPAC</button>
          <button type="button" disabled={saving} onClick={async () => { if (mayLeave()) { try { await signOut() } catch (error) { setStatus({ type: 'error', message: error.message || 'Could not sign out.' }) } } }}><FiLogOut aria-hidden="true" /> Sign out</button>
        </div>
      </header>
      <LibrarianNavigation onNavigate={(event) => { if (!mayLeave()) event.preventDefault() }} />
      {status && <div className={`knowledge-notice ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>
        <span>{status.message}</span>
        {status.conflict && <button type="button" disabled={saving} onClick={reload}>Reload review queue</button>}
      </div>}
      <div className="flex flex-wrap gap-2 px-4 py-4 sm:px-8" aria-label="Filter summaries by status">
        {statusFilters.map((option) => (
          <button
            key={option.value || 'all'}
            type="button"
            aria-pressed={filter === option.value}
            onClick={() => selectFilter(option.value)}
            disabled={saving}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${filter === option.value ? 'border-[#004B87] bg-[#004B87] text-white' : 'border-[#c8d9ed] bg-white text-[#004B87] hover:bg-[#e8f0fa]'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="knowledge-layout">
        <aside className="knowledge-library" aria-label="Summaries awaiting review" aria-busy={loadState === 'loading'}>
          <div className="knowledge-library-heading">
            <div><p className="knowledge-eyebrow">Summary records</p><h2>{statusLabels[filter || 'all']} <span>{loadState === 'ready' ? summaries.length : '—'}</span></h2></div>
            <button type="button" className="knowledge-icon-button" aria-label="Reload review queue" onClick={reload} disabled={saving || loadState === 'loading'}><FiRefreshCw aria-hidden="true" /></button>
          </div>
          <div className="knowledge-entry-list">
            {loadState === 'loading' ? <p className="knowledge-empty" role="status">Loading summaries…</p>
              : loadState === 'error' ? <div className="knowledge-empty"><p>Summaries could not be loaded.</p><button type="button" onClick={reload}>Try again</button></div>
                : summaries.length ? summaries.map((summary) => (
                  <button key={summary.id} type="button" className={`knowledge-entry${selectedId === summary.id ? ' selected' : ''}`} aria-pressed={selectedId === summary.id} disabled={saving} onClick={() => selectSummary(summary)}>
                    <span className="knowledge-entry-meta">{statusLabels[summary.status] || summary.status} · {updatedLabel(summary.generatedAt)}</span>
                    <strong>{summary.bookTitle}</strong>
                    <span className="knowledge-excerpt">Catalog ID {summary.bookId} · Summary {summary.id.slice(0, 8)}</span>
                  </button>
                )) : <div className="knowledge-empty"><FiCheck aria-hidden="true" /><p>No summaries in this status.</p><span>New AI summaries will appear in the pending review list.</span></div>}
          </div>
        </aside>
        <section className="knowledge-editor" aria-labelledby="summary-review-title">
          <div className="knowledge-editor-heading">
            <div><p className="knowledge-eyebrow">{selected ? statusLabels[selected.status] || selected.status : 'Summary monitor'}</p><h2 id="summary-review-title">{selected?.bookTitle || 'No summary selected'}</h2></div>
            {dirty && <span className="knowledge-unsaved">Unsaved changes</span>}
          </div>
          {selected ? <div>
            <dl className="mb-5 grid gap-2 rounded-xl bg-[#f4f8fd] p-4 text-sm sm:grid-cols-2">
              <div><dt className="font-semibold text-slate-600">Catalog record ID</dt><dd><code>{selected.bookId}</code></dd></div>
              <div><dt className="font-semibold text-slate-600">Summary UID</dt><dd><code>{selected.id}</code></dd></div>
              <div className="sm:col-span-2"><dt className="font-semibold text-slate-600">Resource UID</dt><dd><code title={selected.resourceId}>{selected.resourceId.slice(0, 16)}…</code></dd></div>
            </dl>
            {selected.status === 'pending_review' ? <form onSubmit={(event) => { event.preventDefault(); submitReview('approve') }}>
            <fieldset disabled={saving || loadState !== 'ready'} className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700">Summary
                <textarea required minLength={1} maxLength={30000} rows={16} value={draft} onChange={(event) => setDraft(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 p-3 font-normal leading-6 text-slate-800 focus:border-[#004B87] focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </label>
              <label className="block text-sm font-semibold text-slate-700">Reviewer note <span className="font-normal text-slate-500">Optional</span>
                <textarea maxLength={2000} rows={3} value={reviewerNote} onChange={(event) => setReviewerNote(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 p-3 font-normal text-slate-800 focus:border-[#004B87] focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </label>
            </fieldset>
            <div className="knowledge-editor-footer">
              <span>Generated {updatedLabel(selected.generatedAt)}</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={saving || !draft.trim()} onClick={() => submitReview('reject')} className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-700 disabled:opacity-50"><FiX aria-hidden="true" /> Reject</button>
                <button type="submit" disabled={saving || !draft.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[#004B87] px-4 py-2 font-semibold text-white disabled:opacity-50"><FiCheck aria-hidden="true" /> {saving ? 'Saving…' : 'Save & approve'}</button>
              </div>
            </div>
            </form> : <section className="space-y-3">
              <p className="text-sm text-slate-600">Generated {updatedLabel(selected.generatedAt)}{selected.reviewedAt ? ` · reviewed ${updatedLabel(selected.reviewedAt)}` : ''}</p>
              {selected.summary
                ? <p className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-800">{selected.summary}</p>
                : <p className="text-sm text-slate-600">{selected.status === 'generating' ? 'Summary generation is still in progress.' : 'No summary text was saved for this record.'}</p>}
            </section>}
          </div> : <p className="knowledge-empty">{loadState === 'loading' ? 'Loading summaries…' : 'Select a summary record to inspect it.'}</p>}
        </section>
      </div>
    </main>
  )
}
