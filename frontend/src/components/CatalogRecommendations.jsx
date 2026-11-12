import { FiBookOpen } from 'react-icons/fi'
import BookCover from './BookCover'
import { translate } from '../i18n/catalogTranslations'
import { buildCatalogRecommendations } from '../services/catalogRecommendations'

export default function CatalogRecommendations({ books, history, selectedBook, language, query, school, onSelectBook, compact = false }) {
  const recommendations = buildCatalogRecommendations(books, history, selectedBook, { query, school })
  const signals = [
    query.trim() && 'your current search',
    (history?.views?.length || history?.readings?.length || history?.searches?.length) && 'your library activity',
    selectedBook && 'the book you selected',
    school && 'your school interests',
  ].filter(Boolean)
  const context = signals.length > 1
    ? `${signals.slice(0, -1).join(', ')} and ${signals.at(-1)}`
    : signals[0]

  return (
    <section className={compact ? 'catalog-recommendations-compact' : 'mt-10 rounded-3xl border border-[var(--apc-border)] bg-[var(--apc-surface)] p-5 shadow-sm sm:p-7'}>
      <div className="flex items-start gap-3">
        <span className={`flex shrink-0 items-center justify-center bg-[#003A70] text-white ${compact ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl'}`}>
          <FiBookOpen className={compact ? 'h-4 w-4' : undefined} aria-hidden="true" />
        </span>
        <div>
          <h2 className={compact ? 'text-base font-semibold text-[#172B4D]' : 'text-xl font-semibold text-[#172B4D]'}>{translate(language, 'recommendationsTitle')}</h2>
          {!compact && <p className="mt-1 text-sm text-[#607B9E]">{translate(language, 'recommendationsIntro')}</p>}
          {context && <p className="mt-2 break-words text-xs font-medium leading-5 text-[#003A70]">Based on {context}.</p>}
        </div>
      </div>

      {recommendations.length === 0 ? (
        <p className={compact ? 'mt-4 text-sm leading-6 text-[#607B9E]' : 'mt-5 rounded-2xl border border-dashed border-[var(--apc-border)] bg-[var(--apc-blue-light)] px-5 py-6 text-sm leading-6 text-[#607B9E]'}>
          {translate(language, 'recommendationsEmpty')}
        </p>
      ) : (
        <div className={compact ? 'mt-4 grid gap-2' : 'mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3'}>
          {recommendations.map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => onSelectBook(book)}
              className={compact ? 'flex min-w-0 items-center gap-3 border-b border-[var(--apc-border)] py-2 text-left last:border-b-0 hover:bg-[var(--apc-blue-light)]' : 'flex min-w-0 items-center gap-4 rounded-2xl border border-[var(--apc-border)] bg-white p-3 text-left transition-transform hover:-translate-y-0.5 hover:shadow-md'}
            >
              <span className={compact ? 'h-[4.5rem] w-12 shrink-0 overflow-hidden rounded shadow-sm' : 'h-24 w-16 shrink-0 overflow-hidden rounded-md shadow-sm'}>
                <BookCover book={book} className="h-full w-full" />
              </span>
              <span className="min-w-0">
                <span className={compact ? 'block line-clamp-2 text-sm font-semibold leading-5 text-[#172B4D]' : 'block line-clamp-2 font-semibold leading-5 text-[#172B4D]'}>{book.title}</span>
                <span className="mt-1 block truncate text-xs text-[#607B9E]">{book.author || translate(language, 'authorNotListed')}</span>
                {!compact && book.itemType && <span className="mt-2 inline-block rounded-full bg-[var(--apc-blue-light)] px-2 py-1 text-[0.65rem] text-[var(--apc-navy)]">{book.itemType}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
