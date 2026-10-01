import {
  FiArrowLeft,
  FiBookOpen,
  FiBookmark,
  FiExternalLink,
  FiPrinter,
  FiShoppingCart,
} from 'react-icons/fi'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookCover from './BookCover'
import { translate } from '../i18n/catalogTranslations'

function getOnlineResources(book) {
  return (book.url || book.online || '')
    .split('|')
    .map((value) => value.trim())
    .filter((value) => {
      try {
        return ['http:', 'https:'].includes(new URL(value).protocol)
      } catch {
        return false
      }
    })
}

function Metadata({ label, value }) {
  return (
    <div className="grid content-start gap-1 border-b border-[#eee5d7] px-4 py-3 sm:min-h-20 sm:px-5 sm:py-4">
      <dt className="text-[0.66rem] font-semibold uppercase tracking-wide text-[#89775f]">{label}</dt>
      <dd className="break-words text-sm leading-5 text-[#342c24]">{value}</dd>
    </div>
  )
}

export default function BookDetail({ book, language, onBack, onSaveBookmark, onReserveBook, isBookmarked }) {
  const navigate = useNavigate()
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false)
  const t = (key) => translate(language, key)
  const resources = getOnlineResources(book)
  const hasGutenbergResource = resources.some((resource) => resource.includes('gutenberg.org'))
  const metadata = [
    ['recordId', book.id],
    ['subtitle', book.subtitle],
    ['author', book.author],
    ['publisher', book.publisher],
    ['publicationPlace', book.publicationPlace],
    ['publicationYear', book.publicationYear],
    ['edition', book.edition],
    ['isbn', book.isbn],
    ['issn', book.issn],
    ['itemTypeLabel', book.itemType],
    ['language', book.language],
    ['categories', book.categories?.join(', ')],
    ['series', book.series],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '')

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-[#e8dcc8] bg-[#fffdf8] text-[#342c24] shadow-[0_20px_60px_rgba(91,67,36,0.12)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee5d7] bg-[#faf5eb] px-5 py-4 sm:px-8">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-[#79572f] transition-colors hover:text-[#47321c]">
          <FiArrowLeft aria-hidden="true" /> {t('backToResults')}
        </button>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 text-sm text-[#796b58] transition-colors hover:text-[#47321c]">
          <FiPrinter aria-hidden="true" /> {t('printRecord')}
        </button>
      </div>

      <div className="grid gap-7 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <div className="relative overflow-hidden rounded-2xl border border-[#e8dcc8] bg-gradient-to-br from-[#fbf3e4] via-[#fffaf0] to-[#f1e5d0] p-5 sm:p-7">
            <div className="absolute -right-7 -top-10 h-36 w-36 rounded-full bg-[#dfc49a]/20" aria-hidden="true" />
            <div className="relative flex items-start gap-4 sm:gap-5">
              <div className="h-32 w-[5.25rem] shrink-0 overflow-hidden rounded-lg shadow-lg ring-1 ring-[#d6c19d] sm:h-40 sm:w-28">
                <BookCover book={book} className="h-full w-full" />
              </div>
              <div className="min-w-0">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#9a784a]">{t('fromLibraryShelves')}</p>
                <h1 className="mt-2 text-2xl font-bold leading-tight text-[#342c24] sm:text-3xl">{book.title}</h1>
                {book.subtitle && <p className="mt-2 text-base leading-relaxed text-[#766650]">{book.subtitle}</p>}
                {book.author && <p className="mt-4 text-sm font-medium text-[#66543d]">{t('by')} {book.author}</p>}
                {book.description && <div className="mt-4 border-t border-[#e8dcc8] pt-3">
                  <h2 className="text-sm font-semibold text-[#49351f]">{t('summary')}</h2>
                  <p className={`mt-1 text-sm leading-6 text-[#675b4a] ${isSummaryExpanded ? 'whitespace-pre-line' : 'line-clamp-3'}`}>{book.description}</p>
                  {book.description.length > 220 && <button type="button" onClick={() => setIsSummaryExpanded((expanded) => !expanded)} className="mt-1 text-xs font-semibold text-[#79572f] hover:underline">
                    {t(isSummaryExpanded ? 'showLess' : 'readMore')}
                  </button>}
                </div>}
              </div>
            </div>
          </div>

          <section className="mt-7 overflow-hidden rounded-2xl border border-[#e8dcc8] bg-white/80">
            <div className="border-b border-[#eee5d7] bg-[#faf5eb] px-4 py-4 sm:px-5">
              <h2 className="text-lg font-semibold text-[#342c24]">{t('bibliographicInformation')}</h2>
            </div>
            <dl className="grid sm:grid-cols-2">
              {metadata.map(([labelKey, value]) => (
                <Metadata key={labelKey} label={t(labelKey)} value={value} />
              ))}
            </dl>
          </section>

          {resources.length > 0 && (
            <section className="mt-7 rounded-2xl border border-[#e8dcc8] bg-[#faf5eb] p-5">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#9a784a]">{t('exploreFurther')}</p>
              <h2 className="mt-1 text-lg font-semibold text-[#342c24]">{t('onlineResources')}</h2>
              <ul className="mt-4 space-y-3">
                {resources.map((resource) => (
                  <li key={resource}>
                    <a href={resource} target="_blank" rel="noreferrer" className="group inline-flex max-w-full items-start gap-2 break-all text-sm text-[#79572f] hover:text-[#47321c] hover:underline">
                      <FiExternalLink className="mt-0.5 shrink-0" aria-hidden="true" /> {resource}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="h-fit rounded-2xl border border-[#e8dcc8] bg-[#faf5eb] p-5 sm:p-6">
          <div className="mb-4 border-b border-[#e8dcc8] pb-4">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#9a784a]">{t('makeYourselfAtHome')}</p>
            <h2 className="mt-1 text-lg font-semibold text-[#342c24]">{t('bookActions')}</h2>
          </div>
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={() => onReserveBook(book)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#73532f] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#5b4126]"
            >
              <FiShoppingCart aria-hidden="true" /> {t('addToReservationCart')}
            </button>
            {hasGutenbergResource && (
              <button
                type="button"
                onClick={() => navigate(`/catalog/read/${book.id}`)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#c7a878] bg-[#fffdf8] px-4 py-3 text-sm font-semibold text-[#674a29] transition-colors hover:bg-[#f4ead9]"
              >
                <FiBookOpen aria-hidden="true" /> {t('readOnline')}
              </button>
            )}
            <button
              type="button"
              onClick={() => onSaveBookmark(book)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#ddd1bf] bg-white px-4 py-3 text-sm font-semibold text-[#5f5548] transition-colors hover:bg-[#f7f2e9]"
            >
              <FiBookmark aria-hidden="true" /> {isBookmarked ? t('removeFromLists') : t('addToLists')}
            </button>
          </div>
          <p className="mt-5 border-t border-[#e8dcc8] pt-4 text-xs leading-5 text-[#81725f]">
            {t('availabilityNotIncluded')}
          </p>
        </aside>
      </div>
    </section>
  )
}
