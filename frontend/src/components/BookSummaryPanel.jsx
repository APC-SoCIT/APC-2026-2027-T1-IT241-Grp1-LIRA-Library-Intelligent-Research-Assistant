import { useEffect, useState } from 'react'
import { FiCheckCircle, FiFileText } from 'react-icons/fi'
import { getBookSummary } from '../services/catalogService'

const delay = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export default function BookSummaryPanel({ book, resource }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setSummary(null)
    setError('')
    setLoading(true)
    getBookSummary(book.id, resource.id)
      .then((result) => { if (active) setSummary(result) })
      .catch((requestError) => { if (active) setError(requestError.message || 'The book summary could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [book.id, resource.id])

  useEffect(() => {
    if (summary?.status !== 'generating') return undefined
    let active = true
    let attempts = 0
    const poll = async () => {
      try {
        while (active && attempts < 60) {
          await delay(2000)
          attempts += 1
          const result = await getBookSummary(book.id, resource.id)
          if (!active) return
          if (result?.status !== 'generating') {
            setSummary(result)
            if (!result) setError('Summary generation did not complete. Please try again.')
            return
          }
        }
        if (active) setError('The summary is still being prepared. Refresh this panel shortly.')
      } catch (requestError) {
        if (active) setError(requestError.message || 'The summary status could not be checked.')
      }
    }
    poll()
    return () => { active = false }
  }, [book.id, resource.id, summary?.status])

  if (loading) return null
  if (!summary) {
    return error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {summary.status !== 'generating' && <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F0FA] px-2.5 py-1 text-xs font-semibold text-[#003A70]"><FiFileText aria-hidden="true" /> AI-generated</span>}
        {summary.status === 'approved' && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800"><FiCheckCircle aria-hidden="true" /> Verified by librarian</span>}
        {summary.status === 'generating' && <span className="text-xs font-medium text-slate-600" role="status">A shared summary is being generated…</span>}
      </div>
      {summary.summary && <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{summary.summary}</p>}
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    </div>
  )
}
