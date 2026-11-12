import {
  FiArrowLeft,
  FiBookOpen,
  FiBookmark,
  FiPrinter,
} from 'react-icons/fi'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookCover from './BookCover'
import { translate } from '../i18n/catalogTranslations'

function getOnlineResources(book) {
  const legacy = (book.url || book.online || '')
    .split('|')
    .map((value) => value.trim())
    .filter((value) => {
      try {
        return ['http:', 'https:'].includes(new URL(value).protocol)
      } catch {
        return false
      }
  })
  // Attached Koha files are consumed by the in-app reader. Do not expose their
  // API content URLs as ordinary external links in the detail page.
  return [...new Set(legacy)]
}

function getReadableResources(book) {
  return (book.resources || []).filter((resource) => resource.contentUrl && ['pdf', 'epub', 'html', 'text'].includes(resource.format))
}

function Metadata({ label, value }) {
  return (
    <div className="grid content-start gap-1 border-b border-[#dce6f1] px-4 py-3 sm:min-h-20 sm:px-5 sm:py-4">
      <dt className="text-[0.66rem] font-semibold uppercase tracking-wide text-[#526783]">{label}</dt>
      <dd className="break-words text-sm leading-5 text-[#172b4d]">{value}</dd>
    </div>
  )
}

export default function BookDetail({ book, language, onBack, onSaveBookmark, isBookmarked }) {
  const navigate = useNavigate()
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false)
  const t = (key) => translate(language, key)
  const resources = getOnlineResources(book)
  const readableResources = getReadableResources(book)
  const hasGutenbergResource = resources.some((resource) => resource.includes('gutenberg.org'))
  const hasReaderResource = hasGutenbergResource || resources.length > 0 || readableResources.length > 0
  const primaryFormat = readableResources[0]?.format?.toUpperCase()
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
    <section className="mt-6 overflow-hidden rounded-3xl border border-[#d4e0ef] bg-white text-[#172b4d] shadow-[0_22px_60px_rgba(9,47,105,0.14)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-[#003A70] via-[#004B87] to-[#145A96] px-5 py-4 text-white sm:px-8">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-white/90 transition-colors hover:text-[#F2B51A]">
          <FiArrowLeft aria-hidden="true" /> {t('backToResults')}
        </button>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 text-sm text-white/80 transition-colors hover:text-[#F2B51A]">
          <FiPrinter aria-hidden="true" /> {t('printRecord')}
        </button>
      </div>

      <div className="grid gap-7 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <div className="relative overflow-hidden rounded-2xl border border-[#c8d9ed] bg-gradient-to-br from-[#f4f8fd] via-white to-[#e8f0fa] p-5 sm:p-7">
            <div className="absolute -right-7 -top-10 h-36 w-36 rounded-full bg-[#F2B51A]/20" aria-hidden="true" />
            <div className="relative flex items-start gap-4 sm:gap-5">
              <div className="h-32 w-[5.25rem] shrink-0 overflow-hidden rounded-lg shadow-lg ring-1 ring-[var(--apc-border)] sm:h-40 sm:w-28">
                <BookCover book={book} className="h-full w-full" />
              </div>
              <div className="min-w-0">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[var(--apc-navy)]">{t('fromLibraryShelves')}</p>
                <h1 className="mt-2 text-2xl font-bold leading-tight text-[#003A70] sm:text-3xl">{book.title}</h1>
                {book.subtitle && <p className="mt-2 text-base leading-relaxed text-[#526783]">{book.subtitle}</p>}
                {book.author && <p className="mt-4 text-sm font-semibold text-[#334d6e]">{t('by')} {book.author}</p>}
                {book.description && <div className="mt-4 border-t border-[var(--apc-border)] pt-3">
                  <h2 className="text-sm font-semibold text-[#172B4D]">{t('summary')}</h2>
                  <p className={`mt-1 text-sm leading-6 text-[#526783] ${isSummaryExpanded ? 'whitespace-pre-line' : 'line-clamp-3'}`}>{book.description}</p>
                  {book.description.length > 220 && <button type="button" onClick={() => setIsSummaryExpanded((expanded) => !expanded)} className="mt-1 text-xs font-semibold text-[#003A70] hover:underline">
                    {t(isSummaryExpanded ? 'showLess' : 'readMore')}
                  </button>}
                </div>}
              </div>
            </div>
          </div>

          <section className="mt-7 overflow-hidden rounded-2xl border border-[#d4e0ef] bg-white">
            <div className="border-b border-white/10 bg-[#004B87] px-4 py-4 text-white sm:px-5">
              <h2 className="text-lg font-semibold">{t('bibliographicInformation')}</h2>
            </div>
            <dl className="grid sm:grid-cols-2">
              {metadata.map(([labelKey, value]) => (
                <Metadata key={labelKey} label={t(labelKey)} value={value} />
              ))}
            </dl>
          </section>

          {resources.length > 0 && (
            <section className="mt-7 rounded-2xl border border-[#c8d9ed] bg-[#f4f8fd] p-5">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--apc-navy)]">{t('exploreFurther')}</p>
              <h2 className="mt-1 text-lg font-semibold text-[#003A70]">{t('onlineResources')}</h2>
              <ul className="mt-4 space-y-3">
                {resources.map((resource) => (
                  <li key={resource}><button type="button" onClick={() => navigate(`/catalog/read/${book.id}`)} className="inline-flex max-w-full items-start gap-2 break-all text-left text-sm font-medium text-[#004B87] hover:underline"><FiBookOpen className="mt-0.5 shrink-0" aria-hidden="true" /> Open resource in book reader</button></li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="h-fit min-w-0 rounded-2xl border border-[#c8d9ed] bg-[#f4f8fd] p-5 sm:p-6">
          <div className="mb-4 border-b border-[#c8d9ed] pb-4">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--apc-navy)]">{t('makeYourselfAtHome')}</p>
            <h2 className="mt-1 text-lg font-semibold text-[#003A70]">{t('bookActions')}</h2>
          </div>
          <div className="mt-4 grid gap-2">
            {hasReaderResource && (
              <button
                type="button"
                onClick={() => navigate(`/catalog/read/${book.id}`)}
                className="inline-flex w-full min-w-0 items-center justify-center gap-2 whitespace-normal break-words rounded-xl border border-[#F2B51A] bg-[#004B87] px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[#003A70] [&>svg]:shrink-0"
              >
                <FiBookOpen aria-hidden="true" /> {t('readOnline')}
              </button>
            )}
            {primaryFormat && <p className="text-center text-xs font-medium text-[#526783]">Opens the attached {primaryFormat} inside the book reader.</p>}
            <button
              type="button"
              onClick={() => onSaveBookmark(book)}
              className="inline-flex w-full min-w-0 items-center justify-center gap-2 whitespace-normal break-words rounded-xl border border-[#c8d9ed] bg-white px-4 py-3 text-center text-sm font-semibold text-[#004B87] transition-colors hover:bg-[#e8f0fa] [&>svg]:shrink-0"
            >
              <FiBookmark aria-hidden="true" /> {isBookmarked ? t('removeFromLists') : t('addToLists')}
            </button>
          </div>
          <p className="mt-5 border-t border-[#c8d9ed] pt-4 text-xs leading-5 text-[#526783]">
            {t('availabilityNotIncluded')}
          </p>
        </aside>
      </div>
    </section>
  )
}
